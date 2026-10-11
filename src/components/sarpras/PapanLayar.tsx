"use client";
import { useEffect, useRef, useState } from "react";
import { playBellAudio, playChime, unlockAudio } from "@/lib/bell-chime";
import PapanPegawai, { type PanelPegawai } from "@/components/sarpras/PapanPegawai";

export interface IsiPapan {
  token: string; modeQr: string;
  /** UMUM = TV kelas/koridor (jadwal, pengumuman, agenda, bel). GURU = TV ruang guru/ruang rapat, panelnya
   *  bergilir dan berisi apa yang hari ini belum diisi. */
  jenis: string; giliran: number;
  /** Volume TV (persen) selama bel berbunyi; null = volume TV tidak pernah disentuh. */
  volumeBel: number | null;
  manualJudul: string | null; manualIsi: string | null; manualSaja: boolean; manualCara: string;
  namaLayar: string; ruang: string; kelas: string | null; namaSekolah: string; logo: string | null;
  /** Judul panel jadwal untuk TV lab yang bersumber jam kejuruan satu jurusan (bukan "pemakaian ruang"). */
  judulJadwal?: string | null;
  jadwal: { mapel: string; mulai: string; selesai: string; guru: string | null; ruang: string | null; kelas: string | null }[];
  pengumuman: { judul: string; isi: string }[];
  agenda: { judul: string; tanggal: string; jenis: string }[];
  bel: { label: string; jam: string; audioUrl: string | null }[];
  /** Mode Bel TV = HENING (ruang ANBK/TKA): bel diam, pengumuman tampil tanpa nada/suara. */
  belHening: boolean;
  /** REGULER | UJIAN — jadwal bel yang dipakai TV ini hari ini (src/lib/bel-profil.ts). */
  profilBel: string;
  /** Halaman KEDUA papan kelas (25 Sep 2026). Papan kelas tidak bergilir per panel seperti papan ruang guru —
   *  ia berganti HALAMAN berisi empat panel sekaligus, supaya tampilannya tetap yang sudah dikenal. */
  kutipan: { arab: string; terjemahan: string; sumber: string } | null;
  peringkat: { kelas: string; skor: number; prestasi: number; pelanggaran: number }[];
  perluPerhatian: { nama: string; alpha: number }[];
  rekapKelas: { hadir: number; izin: number; sakit: number; alpha: number };
}

const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

/** Minta server menaikkan/mengembalikan volume TV lewat ADB. Gagalnya DIABAIKAN dengan sengaja: TV yang tidak
 * bisa diatur volumenya tetap harus membunyikan belnya, cuma pada volume yang sedang dipakai. */
function kirimVolume(token: string, fase: "mulai" | "selesai") {
  return fetch(`/api/layar/${token}/volume-bel`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fase }),
  }).catch(() => {});
}

/** Potongan daftar berjadwal yang PANTAS TERPAMPANG: dimulai satu baris sebelum yang akan datang, bukan dari
 * baris pertama hari itu. `slice(0, n)` polos membuat jadwal & bel sore TIDAK PERNAH muncul seharian — begitu
 * hari berjalan, enam baris pertama sudah lewat semua tetapi tetap yang ditampilkan (temuan user 25 Sep 2026:
 * "jam yang ke-6 09.45 kok tidak muncul"). Satu baris yang sudah lewat sengaja disisakan sebagai penanda posisi. */
function jendela<T>(daftar: T[], jam: (x: T) => string, kini: string, n: number): { awal: number; isi: T[] } {
  if (daftar.length <= n) return { awal: 0, isi: daftar };
  const berikut = kini ? daftar.findIndex(x => jam(x) >= kini) : 0;
  if (berikut < 0) return { awal: daftar.length - n, isi: daftar.slice(daftar.length - n) };
  const awal = Math.min(Math.max(0, berikut - 1), daftar.length - n);
  return { awal, isi: daftar.slice(awal, awal + n) };
}
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

/** PAPAN INFORMASI TV — layar penuh untuk TV kelas, koridor, lab, TU, dan ruang rapat.
 *
 * UKURAN MENGIKUTI TINGGI LAYAR (`clamp(... vh ...)`), bukan piksel tetap. Armada TV sekolah bercampur
 * resolusi — 1920×1080 di Lab TKJ, lebih rendah di Ruang Rapat — dan dengan ukuran piksel tetap papan yang sama
 * tampak besar-kecil berbeda serta memuat jumlah baris berbeda (temuan user 25 Sep 2026). Dengan satuan vh,
 * papan terlihat sama proporsinya di layar mana pun.
 *
 * Tata letak sesuai arahan user 24 September 2026:
 * - **Kop (logo panjang sekolah) dan jam tetap di atas.** Logo yang dipakai versi kop, bukan lambang bundar.
 * - **Sisa layar dibagi EMPAT panel**: Jadwal · Pengumuman · Agenda · Bel hari ini.
 * - **Tidak boleh bisa digulir.** Papan dipajang di dinding, tidak ada yang menggulirnya: tingginya dikunci
 *   setinggi layar (`h-dvh overflow-hidden`) dan tiap panel memotong isinya sendiri. Versi sebelumnya memakai
 *   `min-h-dvh` sehingga isi yang panjang menjuntai ke bawah dan tidak pernah terlihat.
 * - Motif khas sekolah sebagai tekstur, bergerak sangat pelan — enak dilihat sekaligus mengurangi risiko
 *   burn-in pada TV yang menyala berjam-jam.
 * - Pengumuman dari kantor menggantikan seluruh isi papan (bukan cuma jam), karena saat itulah satu-satunya
 *   hal yang perlu dibaca orang di ruangan.
 *
 * Isi papan terbatas pada yang pantas terpampang di dinding: tidak ada nilai, tidak ada absensi per nama. */
export default function PapanLayar({ isi }: { isi: IsiPapan }) {
  const [waktu, setWaktu] = useState<Date | null>(null);
  /* Pengumuman kantor disimpan di state supaya bisa BERUBAH DI TEMPAT. Nilai awalnya dari muatan halaman;
     sesudah itu disegarkan tiap 10 detik lewat /kabar. Memuat ulang halaman untuk ini akan mengembalikan
     giliran panel ke awal dan menyentak layar di dinding. */
  const [kabar, setKabar] = useState<{ judul: string | null; isi: string | null; manualSaja: boolean; cara: string; hening: boolean }>(
    /* Mode dari muatan halaman, BUKAN "TEKS_SUARA" tertulis mati. Dulu mode yang benar baru terbaca dari /kabar
       10 detik kemudian — saat itu pengumuman "teks saja" sudah telanjur dibacakan dan "suara saja" sudah menutup
       layar. Karena dashboard membuka ulang papan tepat setelah mengirim, bug itu terjadi SETIAP kali
       (laporan user 4 Okt 2026: "pilih teks saja malah ada teks dan suara"). */
    { judul: isi.manualJudul, isi: isi.manualIsi, manualSaja: isi.manualSaja, cara: isi.manualCara || "TEKS_SUARA", hening: isi.belHening });
  const hening = kabar.hening;

  useEffect(() => {
    const perbarui = () => setWaktu(new Date());
    perbarui();
    const t = setInterval(perbarui, 1000);
    const r = setTimeout(() => location.reload(), 10 * 60_000);
    return () => { clearInterval(t); clearTimeout(r); };
  }, []);

  /* ---------------- SUARA: bel sekolah & pengumuman ----------------
     Papan yang dipajang di dinding tidak pernah diklik siapa pun, jadi izin autoplay tidak bisa didapat dari
     gestur pengguna. Di aplikasi TV (MyAlwis Papan) hal itu sudah diizinkan lewat setelan WebView; di peramban
     biasa suara mungkin ditahan sampai ada interaksi — itu keterbatasan peramban, bukan kesalahan papan. */
  const belBerbunyi = useRef<Set<string>>(new Set());
  const volumeDinaikkan = useRef<Set<string>>(new Set());
  /* Penanda "sudah dibacakan" disimpan di TV (localStorage), bukan hanya di memori: papan memuat ulang dirinya
     tiap 10 menit, dan tanpa ini pengumuman yang sama dibacakan ulang setiap kali dimuat. Pengumuman BARU
     (teksnya berbeda) tetap dibacakan. */
  const pengumumanDibacakan = useRef<string | null>(null);
  useEffect(() => {
    try { pengumumanDibacakan.current = localStorage.getItem(`papan-dibacakan:${isi.token}`); } catch { /* abaikan */ }
  }, [isi.token]);
  const tandaiDibacakan = (teks: string) => {
    pengumumanDibacakan.current = teks;
    try { localStorage.setItem(`papan-dibacakan:${isi.token}`, teks); } catch { /* abaikan */ }
  };

  useEffect(() => { unlockAudio(); }, []);

  // Pengumuman & pencabutannya sampai ke dinding dalam ±10 detik — bukan menunggu muat ulang 10 menit.
  useEffect(() => {
    let hidup = true;
    const ambil = async () => {
      try {
        const r = await fetch(`/api/layar/${isi.token}/kabar`, { cache: "no-store" });
        if (!r.ok) return;
        const d = await r.json().catch(() => null);
        if (!hidup || !d) return;
        setKabar({ judul: d.judul ?? null, isi: d.isi ?? null, manualSaja: !!d.manualSaja, cara: d.cara ?? "TEKS_SUARA", hening: !!d.hening });
      } catch { /* jaringan sekolah kadang putus sesaat — coba lagi di denyut berikutnya */ }
    };
    const t = setInterval(ambil, 10_000);
    return () => { hidup = false; clearInterval(t); };
  }, [isi.token]);

  // BEL SEKOLAH: tiap TV jadi titik bel. Dicocokkan per menit, dan tiap bel hanya berbunyi SEKALI per hari
  // (penanda jam+label) supaya tidak berdentang berulang selama menit itu berjalan.
  useEffect(() => {
    if (!waktu || hening) return;   // Mode Hening (ruang ujian): bel tidak dibunyikan sama sekali
    const w = new Date(waktu.getTime() + (waktu.getTimezoneOffset() * 60_000) + 7 * 3600_000);
    const jjmm = `${String(w.getHours()).padStart(2, "0")}:${String(w.getMinutes()).padStart(2, "0")}`;
    for (const b of isi.bel) {
      const kunci = `${w.toDateString()}|${b.jam}|${b.label}`;
      if (b.jam !== jjmm || belBerbunyi.current.has(kunci)) continue;
      belBerbunyi.current.add(kunci);
      // Volume dikembalikan SETELAH suaranya benar-benar habis, bukan setelah jeda tebakan.
      playBellAudio(b.audioUrl).then(() => {
        if (isi.volumeBel != null) void kirimVolume(isi.token, "selesai");
      });
    }
  }, [waktu, isi.bel, isi.volumeBel, isi.token, hening]);

  /* VOLUME TV SAAT BEL — dinaikkan 15 DETIK SEBELUM bel, bukan pas bel berbunyi. Perintah ADB menempuh jaringan
     sekolah dan perlu satu sampai tiga detik; kalau baru dimulai bersamaan dengan belnya, justru detik-detik
     pertama bel yang terdengar pelan — bagian yang paling perlu terdengar. */
  useEffect(() => {
    if (!waktu || isi.volumeBel == null || hening) return;
    const w = new Date(waktu.getTime() + (waktu.getTimezoneOffset() * 60_000) + 7 * 3600_000);
    const detikHari = w.getHours() * 3600 + w.getMinutes() * 60 + w.getSeconds();
    for (const b of isi.bel) {
      const [jj, mm] = b.jam.split(":").map(Number);
      const selisih = (jj || 0) * 3600 + (mm || 0) * 60 - detikHari;
      if (selisih < 0 || selisih > 15) continue;
      const kunci = `${w.toDateString()}|${b.jam}|${b.label}`;
      if (volumeDinaikkan.current.has(kunci)) continue;
      volumeDinaikkan.current.add(kunci);
      void kirimVolume(isi.token, "mulai");
    }
  }, [waktu, isi.bel, isi.volumeBel, isi.token, hening]);

  // PENGUMUMAN KANTOR: nada perhatian lalu dibacakan. Suara Indonesia belum tentu ada di tiap TV — kalau tidak
  // ada, nada perhatian + tulisan besar tetap jalan, jadi pengumumannya tidak pernah hilang begitu saja.
  useEffect(() => {
    const teks = [kabar.judul, kabar.isi].filter(Boolean).join(". ");
    // Mode TEKS = tampil saja, tidak dibacakan. Penandanya tetap dicatat supaya berpindah mode tidak
    // membuat pengumuman yang sama dibacakan ulang.
    // Pengumuman dicabut → penanda dihapus, supaya teks yang sama yang dikirim ulang nanti dibacakan lagi.
    if (!teks) {
      pengumumanDibacakan.current = null;
      try { localStorage.removeItem(`papan-dibacakan:${isi.token}`); } catch { /* abaikan */ }
      return;
    }
    /* Penanda = MODE + teks: mengirim ulang teks yang sama dengan mode lain (teks saja → teks + suara) harus
       dibacakan; memuat ulang papan dengan pengumuman yang sama tidak. */
    const tanda = `${kabar.cara}|${teks}`;   // tanpa status hening: hening berakhir ≠ pengumuman baru
    if (pengumumanDibacakan.current === tanda) return;
    try { if (localStorage.getItem(`papan-dibacakan:${isi.token}`) === tanda) { pengumumanDibacakan.current = tanda; return; } } catch { /* abaikan */ }
    // Mode Hening: tampil saja, tanpa nada & suara — ruang ANBK/TKA tetap bisa diberi pengumuman (mis. token).
    if (kabar.cara === "TEKS" || hening) { tandaiDibacakan(tanda); return; }
    tandaiDibacakan(tanda);

    /* VOLUME DINAIKKAN JUGA UNTUK PENGUMUMAN (permintaan user 25 Sep 2026), memakai jalur yang sama dengan bel.
       Durasi bicara tidak diketahui — jembatan Android tidak melaporkan selesainya — jadi diperkirakan dari
       panjang teks (±11 huruf/detik pada kecepatan 0,95) lalu ditambah jeda nada perhatian. Perkiraan yang
       meleset tidak berbahaya: server tetap mengembalikan volume sendiri setelah 3 menit (src/lib/volume-bel.ts). */
    const pakaiVolume = isi.volumeBel != null;
    if (pakaiVolume) void kirimVolume(isi.token, "mulai");
    playChime();
    if (pakaiVolume) {
      const detik = Math.min(150, Math.max(10, Math.ceil(teks.length / 11) + 6));
      setTimeout(() => { void kirimVolume(isi.token, "selesai"); }, detik * 1000);
    }
    setTimeout(() => {
      /* JEMBATAN ANDROID DULU. `speechSynthesis` TIDAK ADA di WebView Android — itu fitur Chrome, bukan WebView —
         sehingga versi sebelumnya diam-diam tidak pernah berbunyi di TV meski Google TTS terpasang (terbukti
         25 Sep 2026). Aplikasi MyAlwis Papan memasang `window.PapanSuara`; peramban biasa tetap memakai
         `speechSynthesis`. Kalau keduanya tidak ada, nada perhatian + tulisan besar tetap jalan. */
      const jembatan = (window as unknown as { PapanSuara?: { ucap(t: string): void; siap(): boolean } }).PapanSuara;
      if (jembatan) {
        try { if (jembatan.siap()) { jembatan.ucap(teks); return; } } catch { /* jatuh ke cara peramban */ }
      }
      const suara = typeof window !== "undefined" ? window.speechSynthesis : undefined;
      if (!suara) return;
      try {
        const ucap = new SpeechSynthesisUtterance(teks);
        ucap.lang = "id-ID";
        ucap.rate = 0.95;
        const pilihan = suara.getVoices().find(v => v.lang?.toLowerCase().startsWith("id"));
        if (pilihan) ucap.voice = pilihan;
        suara.speak(ucap);
      } catch { /* tanpa mesin suara — cukup nada perhatian & tulisan */ }
    }, 2000);
  }, [kabar.judul, kabar.isi, kabar.cara, isi.volumeBel, isi.token, hening]);

  const wib = waktu ? new Date(waktu.getTime() + (waktu.getTimezoneOffset() * 60_000) + 7 * 3600_000) : null;
  const jam = wib ? `${String(wib.getHours()).padStart(2, "0")}:${String(wib.getMinutes()).padStart(2, "0")}` : "--:--";
  const detik = wib ? String(wib.getSeconds()).padStart(2, "0") : "--";
  const tanggal = wib ? `${HARI[wib.getDay()]}, ${wib.getDate()} ${BULAN[wib.getMonth()]} ${wib.getFullYear()}` : "";
  const kini = wib ? `${String(wib.getHours()).padStart(2, "0")}:${String(wib.getMinutes()).padStart(2, "0")}` : "";
  const sedangBerlangsung = (m: string, s: string) => !!kini && m <= kini && kini < s;
  const belBerikut = kini ? isi.bel.find(b => b.jam >= kini) : undefined;
  // Jadwal memakai jam SELESAI supaya pelajaran yang sedang berlangsung tetap terlihat, bukan langsung tergeser.
  const jadwalTampil = jendela(isi.jadwal, j => j.selesai, kini, 6);
  const belTampil = jendela(isi.bel, b => b.jam, kini, 6);

  /* Mode SUARA hanya DIBACAKAN — papan tetap menampilkan panel biasa. Dipakai untuk panggilan singkat
     ("Ananda Fulan dimohon ke Ruang BK") yang tidak pantas menutup seluruh layar selama berjam-jam sampai
     ada yang ingat mencabutnya (permintaan user 25 Sep 2026). */
  // Saat Hening pengumuman "suara saja" pun DITAMPILKAN — kalau tidak, pesan itu hilang sama sekali di ruang ujian.
  const adaPengumumanKantor = !!(kabar.judul || kabar.isi) && (kabar.cara !== "SUARA" || hening);
  const judulBel = hening ? "Bel hari ini · diheningkan" : isi.profilBel === "UJIAN" ? "Bel ujian hari ini" : "Bel hari ini";

  /* PAPAN RUANG GURU: pengumuman, agenda, dan bel yang sudah ikut di muatan halaman DISERTAKAN ke putaran panel.
     Papan ruang guru bukan berarti guru tidak perlu tahu pengumuman sekolah — yang berbeda hanya panel jadwal
     kelas, yang memang tidak ada di ruang rapat. */
  const panelTambahan: PanelPegawai[] = isi.jenis !== "GURU" ? [] : [
    // Papan ruang guru yang DIBERI KELAS ikut menayangkan jadwal kelas itu — TV ruang guru kadang dipasangkan
    // ke satu kelas tertentu untuk dipantau. Tanpa kelas, panel ini memang tidak ada.
    ...(isi.jadwal.length ? [{
      kunci: "jadwal", judul: isi.kelas ? `Jadwal hari ini — ${isi.kelas}` : isi.judulJadwal ?? `Pemakaian ${isi.ruang} hari ini`,
      kosong: "Tidak ada jadwal hari ini.",
      baris: jendela(isi.jadwal, j => j.selesai, kini, 10).isi.map(j => ({
        utama: !isi.kelas && j.kelas ? `${j.kelas} — ${j.mapel}` : j.mapel,
        sisi: `${j.mulai}–${j.selesai}${j.guru ? ` · ${j.guru}` : ""}`,
        tanda: sedangBerlangsung(j.mulai, j.selesai) ? "beres" as const : null,
      })),
    }] : []),
    ...(isi.pengumuman.length ? [{
      kunci: "pengumuman", judul: "Pengumuman sekolah", kosong: "Tidak ada pengumuman.",
      baris: isi.pengumuman.slice(0, 6).map(p => ({ utama: p.judul, sisi: p.isi.slice(0, 70) })),
    }] : []),
    ...(isi.agenda.length ? [{
      kunci: "agenda", judul: "Agenda terdekat", kosong: "Belum ada agenda.",
      baris: isi.agenda.slice(0, 6).map(a => {
        const t = new Date(a.tanggal);
        return { utama: a.judul, sisi: `${t.getUTCDate()} ${BULAN[t.getUTCMonth()]}` };
      }),
    }] : []),
    ...(isi.bel.length ? [{
      kunci: "bel", judul: judulBel, kosong: "Tidak ada jadwal bel hari ini.",
      baris: jendela(isi.bel, b => b.jam, kini, 8).isi.map(b => ({ utama: b.label, sisi: b.jam })),
    }] : []),
  ];

  /* ---------------- QR PRESENSI MANDIRI ----------------
     Guru & siswa memindai dari layar terdekat. Token berganti tiap 5 detik (foto layar cepat basi), tetapi
     pindaian tetap diterima ±1 menit — lihat src/lib/absensi-qr.ts. Server yang memutuskan boleh/tidaknya
     ditampilkan: MATI, JAM_PRESENSI (ikut jam buka–tutup, untuk TV siswa), atau SELALU (TV ruang guru). */
  const [qr, setQr] = useState<string | null>(null);
  const [pindaiTerakhir, setPindaiTerakhir] = useState<{ nama: string; jam: string }[]>([]);
  const [halaman, setHalaman] = useState(0);

  /* HALAMAN KEDUA papan kelas: kutipan harian, peringkat kedisiplinan, siswa perlu diperhatikan, rekap kehadiran.
     Hanya dinyalakan bila memang ada isinya — papan yang berganti ke halaman kosong terlihat seperti rusak.
     Sama seperti papan ruang guru, tombol kiri/kanan remote bisa memindah halaman secara manual. */
  const adaHalaman2 = !!(isi.kutipan || isi.peringkat.length || isi.perluPerhatian.length);
  useEffect(() => {
    if (isi.jenis === "GURU" || !adaHalaman2) return;
    const t = setInterval(() => setHalaman(h => (h + 1) % 2), Math.max(15, isi.giliran) * 1000);
    const tekan = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      setHalaman(h => (h + 1) % 2);
    };
    window.addEventListener("keydown", tekan);
    return () => { clearInterval(t); window.removeEventListener("keydown", tekan); };
  }, [isi.jenis, adaHalaman2, isi.giliran]);
  useEffect(() => {
    if (isi.modeQr === "MATI") return;
    let hidup = true;
    const ambil = async () => {
      try {
        const r = await fetch(`/api/layar/${isi.token}/qr`, { cache: "no-store" });
        const d = await r.json().catch(() => null);
        if (!hidup) return;
        setPindaiTerakhir(Array.isArray(d?.terakhir) ? d.terakhir : []);
        if (!d?.aktif || !d.isi) { setQr(null); return; }
        const QR = (await import("qrcode")).default;
        setQr(await QR.toDataURL(d.isi, { width: 520, margin: 1, errorCorrectionLevel: "M", color: { dark: "#0F1A45", light: "#FFFFFF" } }));
      } catch { if (hidup) setQr(null); }
    };
    ambil();
    const t = setInterval(ambil, 5000);
    return () => { hidup = false; clearInterval(t); };
  }, [isi.token, isi.modeQr]);

  /** Satu panel dari empat bagian. `judul` selalu tampil supaya petugas tahu panel itu memang ada isinya
   * atau memang kosong — bukan bagian yang gagal dimuat. */
  const Panel = ({ judul, kosong, children }: { judul: string; kosong: string; children?: React.ReactNode }) => (
    <section className="flex min-h-0 flex-col rounded-2xl bg-white/[0.06] p-3 sm:p-4">
      <h2 className="mb-2 shrink-0 font-bold uppercase tracking-[0.2em] text-white/45" style={{ fontSize: "clamp(0.65rem, 1.6vh, 0.9rem)" }}>{judul}</h2>
      <div className="min-h-0 flex-1 overflow-hidden">
        {children ?? <p className="flex h-full items-center justify-center text-center text-sm text-white/35 sm:text-base">{kosong}</p>}
      </div>
    </section>
  );

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-[#0A1030] text-white"
      /* cursor:none — papan dipajang di dinding dan tidak pernah diklik; penunjuk tetikus yang tertinggal di
         tengah layar terlihat seperti kotoran pada tampilan (temuan user 25 Sep 2026). */
      style={{ backgroundImage: "linear-gradient(135deg, #0A1030 0%, #0F1A45 40%, #1B2B6B 100%)", cursor: "none" }}>
      <div aria-hidden className="papan-motif" />
      <div aria-hidden className="papan-sinar" />

      {/* ZONA AMAN TV (25 September 2026). Sebagian TV memotong 2–5% tepi layar (overscan): papan tetap dilukis
          setinggi `h-dvh`, tetapi baris paling bawah tidak pernah terlihat — di Lab DKV baris "Tanpa keterangan"
          dan harakat kutipan Arab hilang, sementara di Lab TKJ (merek lain) utuh. Karena itu isi ditarik masuk
          2,5% dari tiap tepi. Sedikit ruang berkurang di TV yang tidak overscan, tetapi tidak ada lagi isi yang
          hilang diam-diam — dan isi yang hilang jauh lebih merugikan daripada margin yang sedikit lebih lebar. */}
      <div className="relative flex h-full flex-col gap-3 sm:gap-5"
        style={{ padding: "max(1rem, 2.5vh) max(1rem, 2.5vw)" }}>
        {/* KOP + JAM — selalu di atas, tidak ikut tergeser isi apa pun. */}
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/15 pb-3 sm:pb-4">
          <div className="flex min-w-0 items-center gap-3">
            {isi.logo && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={isi.logo} alt={isi.namaSekolah} className="w-auto object-contain" style={{ height: "clamp(2.2rem, 8vh, 4rem)" }} />
            )}
            <p className="min-w-0 truncate text-white/60" style={{ fontSize: "clamp(0.85rem, 2.4vh, 1.4rem)" }}>
              {isi.kelas ? `Kelas ${isi.kelas}` : isi.namaLayar} · {isi.ruang}
            </p>
          </div>
          <div className="text-right">
            <p className="font-heading font-bold tabular-nums leading-none" style={{ fontSize: "clamp(1.8rem, 7.5vh, 4.5rem)" }}>
              {jam}<span className="text-white/40" style={{ fontSize: "clamp(0.9rem, 3vh, 1.8rem)" }}>:{detik}</span>
            </p>
            <p className="mt-1 text-white/60" style={{ fontSize: "clamp(0.75rem, 2.2vh, 1.25rem)" }}>{tanggal}</p>
          </div>
        </header>

        {adaPengumumanKantor ? (
          /* Pengumuman kantor mengambil alih seluruh papan: saat itu hanya ini yang perlu dibaca. */
          <main className="papan-masuk flex min-h-0 flex-1 items-center justify-center">
            <div className="max-h-full w-full max-w-5xl overflow-hidden rounded-3xl border border-[#E8A020]/40 bg-[#E8A020]/10 px-6 py-8 text-center sm:px-12">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.35em] text-[#E8A020] sm:text-sm">Pengumuman</p>
              {kabar.judul && <h1 className="font-heading text-3xl font-bold leading-tight sm:text-6xl">{kabar.judul}</h1>}
              {kabar.isi && <p className="mt-3 whitespace-pre-line text-base leading-relaxed text-white/85 sm:mt-6 sm:text-2xl">{kabar.isi}</p>}
            </div>
          </main>
        ) : (
          /* EMPAT BAGIAN mengisi sisa layar, masing-masing memotong isinya sendiri. */
          /* Berdampingan mulai lebar sedang, BUKAN `lg`: pada 1280px papan sempat menumpuk QR di bawah daftar
             sehingga daftarnya tersisa dua baris (temuan user 25 Sep 2026). TV memang lebar, tetapi jendela
             pratinjau di dashboard tidak. */
          <main className={`grid min-h-0 flex-1 gap-3 sm:gap-4 ${qr ? "grid-cols-1 md:grid-cols-[1fr_auto]" : "grid-cols-1"}`}>
            {isi.jenis === "GURU" ? (
              /* Satu panel besar yang bergilir — di ruang rapat papan dibaca dari seberang ruangan, empat kotak
                 kecil di sana sama saja dengan tidak terbaca. */
              <PapanPegawai token={isi.token} giliranAwal={isi.giliran} tambahan={panelTambahan} />
            ) : halaman === 1 && adaHalaman2 ? (
            <div className="grid min-h-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              <Panel judul="Kutipan hari ini" kosong="Belum diisi di Konten Halaman → Papan TV.">
                {isi.kutipan ? (
                  /* Ukuran dikecilkan (25 Sep 2026: "tulisan arab terpotong" di Lab DKV). Teks Arab butuh
                     line-height longgar untuk harakat, sehingga dua baris Arab + terjemahan + sumber cepat
                     melebihi tinggi panel dan terpotong `overflow-hidden`. `px-2` memberi jarak supaya harakat
                     tidak menyentuh tepi panel. */
                  <div className="flex h-full flex-col items-center justify-center px-2 text-center">
                    {isi.kutipan.arab && (
                      <p className="font-arabic" style={{ fontSize: "clamp(0.9rem, 3.2vh, 1.9rem)", lineHeight: 2.1 }}>{isi.kutipan.arab}</p>
                    )}
                    {isi.kutipan.terjemahan && (
                      <p className="mt-1.5 text-white/75" style={{ fontSize: "clamp(0.72rem, 1.9vh, 1.1rem)" }}>{isi.kutipan.terjemahan}</p>
                    )}
                    {isi.kutipan.sumber && (
                      <p className="mt-1 font-semibold text-[#E8A020]" style={{ fontSize: "clamp(0.66rem, 1.6vh, 0.95rem)" }}>{isi.kutipan.sumber}</p>
                    )}
                  </div>
                ) : undefined}
              </Panel>

              <Panel judul="Kedisiplinan antar kelas — bulan ini" kosong="Belum ada catatan poin bulan ini.">
                {isi.peringkat.length > 0 ? (
                  <ul className="space-y-1.5">
                    {isi.peringkat.slice(0, 6).map((k, i) => (
                      <li key={k.kelas} className={`flex items-center gap-3 rounded-xl px-3 py-1.5 ${i === 0 ? "bg-[#E8A020] text-[#0A1030]" : "bg-white/8"}`}>
                        <span className="w-6 shrink-0 text-center font-heading font-bold tabular-nums" style={{ fontSize: "clamp(0.8rem, 2.2vh, 1.25rem)" }}>{i + 1}</span>
                        <span className="min-w-0 flex-1 truncate font-semibold" style={{ fontSize: "clamp(0.85rem, 2.4vh, 1.5rem)" }}>{k.kelas}</span>
                        <span className="shrink-0 tabular-nums" style={{ fontSize: "clamp(0.75rem, 2.1vh, 1.2rem)" }}>{k.skor > 0 ? `+${k.skor}` : k.skor}</span>
                      </li>
                    ))}
                  </ul>
                ) : undefined}
              </Panel>

              <Panel judul="Perlu diperhatikan — bulan ini"
                kosong={isi.kelas ? "Tidak ada yang perlu diperhatikan. Pertahankan!" : "Layar ini bukan untuk kelas tertentu."}>
                {isi.perluPerhatian.length > 0 ? (
                  <ul className="space-y-1.5">
                    {isi.perluPerhatian.map((x, i) => (
                      <li key={i} className="flex items-center gap-3 rounded-xl bg-[#E8A020]/15 px-3 py-1.5">
                        <span className="min-w-0 flex-1 truncate font-semibold" style={{ fontSize: "clamp(0.85rem, 2.4vh, 1.5rem)" }}>{x.nama}</span>
                        <span className="shrink-0 tabular-nums text-white/60" style={{ fontSize: "clamp(0.75rem, 2.1vh, 1.2rem)" }}>{x.alpha}× alfa</span>
                      </li>
                    ))}
                  </ul>
                ) : undefined}
              </Panel>

              <Panel judul="Kehadiran kelas — bulan ini" kosong="Belum ada absensi bulan ini.">
                {(isi.rekapKelas.hadir + isi.rekapKelas.izin + isi.rekapKelas.sakit + isi.rekapKelas.alpha) > 0 ? (
                  <ul className="space-y-1.5">
                    {([["Hadir", isi.rekapKelas.hadir], ["Izin", isi.rekapKelas.izin], ["Sakit", isi.rekapKelas.sakit], ["Tanpa keterangan", isi.rekapKelas.alpha]] as [string, number][]).map(([label, n]) => (
                      <li key={label} className={`flex items-center gap-3 rounded-xl px-3 py-1.5 ${label === "Tanpa keterangan" && n > 0 ? "bg-[#E8A020]/15" : "bg-white/8"}`}>
                        <span className="min-w-0 flex-1 truncate" style={{ fontSize: "clamp(0.8rem, 2.1vh, 1.25rem)" }}>{label}</span>
                        <span className="shrink-0 font-heading font-bold tabular-nums" style={{ fontSize: "clamp(0.8rem, 2.1vh, 1.25rem)" }}>{n}</span>
                      </li>
                    ))}
                  </ul>
                ) : undefined}
              </Panel>
            </div>
            ) : (
            <div className="grid min-h-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <Panel judul={isi.kelas ? "Jadwal hari ini" : isi.judulJadwal ?? `Pemakaian ${isi.ruang} hari ini`}
              kosong={isi.kelas ? "Tidak ada jadwal hari ini." : `Tidak ada kelas terjadwal di ${isi.ruang} hari ini.`}>
              {isi.jadwal.length > 0 ? (
                <ul className="space-y-1.5">
                  {jadwalTampil.isi.map((j, i) => {
                    // Jadwal bisa tumpang tindih (mis. mapel paralel di jam sama). Tandai KINI hanya pada yang
                    // PERTAMA cocok, supaya papan tidak menampilkan tiga "KINI" sekaligus dan membingungkan.
                    // Indeksnya ABSOLUT (awal jendela + i) — dengan indeks potongan, penandanya bergeser baris.
                    const aktif = sedangBerlangsung(j.mulai, j.selesai)
                      && isi.jadwal.findIndex(x => sedangBerlangsung(x.mulai, x.selesai)) === jadwalTampil.awal + i;
                    return (
                      <li key={i} className={`flex items-center gap-3 rounded-xl px-3 py-1.5 ${aktif ? "bg-[#E8A020] text-[#0A1030]" : "bg-white/8"}`}>
                        <span className="w-14 shrink-0 font-heading font-bold tabular-nums" style={{ fontSize: "clamp(0.85rem, 2.2vh, 1.3rem)" }}>{j.mulai}</span>
                        <span className="min-w-0 flex-1 truncate font-semibold" style={{ fontSize: "clamp(0.85rem, 2.4vh, 1.5rem)" }}>
                          {/* Papan RUANG menyebut kelas pemakainya — itu yang dicari orang yang masuk ke lab. */}
                          {!isi.kelas && j.kelas ? `${j.kelas} — ${j.mapel}` : j.mapel}
                        </span>
                        {aktif && <span className="shrink-0 rounded-full bg-[#0A1030] px-2 py-0.5 text-[11px] font-bold text-white">KINI</span>}
                      </li>
                    );
                  })}
                </ul>
              ) : undefined}
            </Panel>

            <Panel judul="Pengumuman sekolah" kosong="Tidak ada pengumuman.">
              {isi.pengumuman.length > 0 ? (
                <ul className="space-y-1.5">
                  {isi.pengumuman.slice(0, 3).map((p, i) => (
                    <li key={i} className="rounded-xl bg-white/8 px-3 py-1.5">
                      <p className="truncate font-semibold" style={{ fontSize: "clamp(0.85rem, 2.4vh, 1.5rem)" }}>{p.judul}</p>
                      <p className="line-clamp-2 text-xs text-white/55 sm:text-sm">{p.isi}</p>
                    </li>
                  ))}
                </ul>
              ) : undefined}
            </Panel>

            <Panel judul="Agenda terdekat" kosong="Belum ada agenda.">
              {isi.agenda.length > 0 ? (
                <ul className="space-y-1.5">
                  {isi.agenda.slice(0, 3).map((a, i) => {
                    const t = new Date(a.tanggal);
                    return (
                      <li key={i} className="flex items-center gap-3 rounded-xl bg-white/8 px-3 py-1.5">
                        <span className="w-10 shrink-0 text-center">
                          <span className="block font-heading text-base font-bold leading-none">{t.getUTCDate()}</span>
                          <span className="block text-[11px] text-white/50">{BULAN[t.getUTCMonth()].slice(0, 3)}</span>
                        </span>
                        <span className="min-w-0 flex-1 truncate" style={{ fontSize: "clamp(0.85rem, 2.4vh, 1.5rem)" }}>{a.judul}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : undefined}
            </Panel>

            <Panel judul={judulBel} kosong="Tidak ada jadwal bel hari ini.">
              {isi.bel.length > 0 ? (
                <ul className="space-y-1.5">
                  {belTampil.isi.map((b, i) => {
                    const berikut = belBerikut?.jam === b.jam && belBerikut?.label === b.label;
                    return (
                      <li key={i} className={`flex items-center gap-3 rounded-xl px-3 py-1.5 ${berikut ? "bg-white/20" : "bg-white/8"}`}>
                        <span className="w-14 shrink-0 font-heading font-bold tabular-nums" style={{ fontSize: "clamp(0.85rem, 2.2vh, 1.3rem)" }}>{b.jam}</span>
                        <span className="min-w-0 flex-1 truncate" style={{ fontSize: "clamp(0.85rem, 2.4vh, 1.5rem)" }}>{b.label}</span>
                        {berikut && <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-[#E8A020]">berikutnya</span>}
                      </li>
                    );
                  })}
                </ul>
              ) : undefined}
            </Panel>
            </div>
            )}

            {/* QR tetap di tempatnya, TIDAK ikut bergilir — guru yang baru datang harus bisa langsung memindai
                tanpa menunggu giliran panel. */}
            {qr && (
              <aside className="flex min-h-0 flex-col items-center justify-center rounded-2xl bg-white/[0.06] p-3 sm:p-4">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-white/45 sm:text-xs">Presensi mandiri</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="QR presensi" className="h-auto w-[min(26vh,210px)] rounded-xl bg-white p-2" />
                <p className="mt-2 max-w-[260px] text-center text-xs text-white/55 sm:text-sm">
                  Pindai dari menu <b>Absen Mandiri</b> di HP Anda
                </p>
                {/* Umpan balik langsung: yang baru memindai melihat namanya sendiri muncul, jadi tidak perlu
                    bertanya "sudah masuk belum?". Ikut respons QR, sehingga tampil dalam hitungan detik. */}
                {pindaiTerakhir.length > 0 && (
                  /* QR sengaja dikecilkan supaya lima nama terakhir muat utuh — daftar yang terpotong di tengah
                     membuat orang ragu apakah namanya sudah tercatat (permintaan user 25 Sep 2026). */
                  <div className="mt-3 w-full max-w-[280px] border-t border-white/10 pt-2">
                    <p className="mb-1.5 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-white/35">Baru tercatat</p>
                    <ul className="space-y-1">
                      {pindaiTerakhir.map((t, i) => (
                        <li key={i} className="flex items-center gap-2 rounded-lg bg-emerald-400/12 px-2 py-1">
                          <span className="min-w-0 flex-1 truncate" style={{ fontSize: "clamp(0.7rem, 1.8vh, 1rem)" }}>{t.nama}</span>
                          <span className="shrink-0 tabular-nums text-white/55" style={{ fontSize: "clamp(0.7rem, 1.7vh, 0.95rem)" }}>{t.jam}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </aside>
            )}
          </main>
        )}
      </div>
    </div>
  );
}
