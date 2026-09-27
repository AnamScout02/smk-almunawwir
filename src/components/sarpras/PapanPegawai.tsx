"use client";
import React, { useEffect, useRef, useState } from "react";

interface BarisPapan { utama: string; sisi?: string | null; tanda?: "perlu" | "beres" | null }
interface OrangUlangTahun { nama: string; foto: string | null; usia: number | null; jabatan: string | null }
export interface PanelPegawai {
  kunci: string; judul: string; keterangan?: string | null; angka?: string | null;
  baris: BarisPapan[]; kosong: string; sisa?: number;
  jenis?: "ULANG_TAHUN"; orang?: OrangUlangTahun[];
}

/** Konfeti dengan posisi TETAP, bukan acak: nilai acak di badan komponen berbeda antara render server dan klien
 * (CLAUDE.md #15), dan papan ini dirender di server. */
const KONFETI = [
  { kiri: "5%", warna: "#E8A020", jeda: "0s", lama: "7s", geser: "38px", putar: "720deg", lebar: 10, tinggi: 16, bulat: 2 },
  { kiri: "13%", warna: "#F5C842", jeda: "1.4s", lama: "9s", geser: "-26px", putar: "540deg", lebar: 8, tinggi: 8, bulat: 99 },
  { kiri: "22%", warna: "#7A88C4", jeda: "3.1s", lama: "8s", geser: "44px", putar: "900deg", lebar: 12, tinggi: 7, bulat: 2 },
  { kiri: "31%", warna: "#ffffff", jeda: "0.7s", lama: "10s", geser: "-34px", putar: "620deg", lebar: 7, tinggi: 14, bulat: 2 },
  { kiri: "40%", warna: "#E8A020", jeda: "4.2s", lama: "7.5s", geser: "30px", putar: "840deg", lebar: 9, tinggi: 9, bulat: 99 },
  { kiri: "49%", warna: "#F5C842", jeda: "2.3s", lama: "9.5s", geser: "-42px", putar: "480deg", lebar: 11, tinggi: 6, bulat: 2 },
  { kiri: "58%", warna: "#7A88C4", jeda: "5.5s", lama: "8.5s", geser: "36px", putar: "780deg", lebar: 8, tinggi: 15, bulat: 2 },
  { kiri: "67%", warna: "#ffffff", jeda: "1.9s", lama: "7.8s", geser: "-28px", putar: "960deg", lebar: 7, tinggi: 7, bulat: 99 },
  { kiri: "76%", warna: "#E8A020", jeda: "3.8s", lama: "9.2s", geser: "46px", putar: "600deg", lebar: 10, tinggi: 13, bulat: 2 },
  { kiri: "85%", warna: "#F5C842", jeda: "0.4s", lama: "8.2s", geser: "-32px", putar: "720deg", lebar: 9, tinggi: 9, bulat: 99 },
  { kiri: "93%", warna: "#7A88C4", jeda: "6.1s", lama: "7.2s", geser: "24px", putar: "540deg", lebar: 12, tinggi: 8, bulat: 2 },
];

/** PANEL BERGILIR PAPAN RUANG GURU (25 September 2026).
 *
 * Permintaan user: panel "bergeser-geser setiap 2 menit atau berapa" — satu layar tidak cukup untuk presensi
 * pegawai, jurnal, absensi kelas, piket, dan rekap kehadiran sekaligus, dan guru di ruang rapat memang melihat
 * papan sambil lalu, bukan membacanya lama-lama.
 *
 * Yang perlu dijaga saat mengubah berkas ini:
 * - **Satu panel penuh per giliran, bukan empat panel kecil.** Papan ini dibaca dari seberang ruangan; empat
 *   kotak kecil di TV ruang rapat sama saja dengan tidak terbaca.
 * - **Data disegarkan LEWAT FETCH, papan tidak boleh memuat ulang halaman.** Memuat ulang mengembalikan giliran
 *   ke panel pertama dan menyentak layar di dinding.
 * - **Titik giliran di bawah layar** dibuat supaya orang yang baru masuk ruangan tahu ada panel lain menyusul
 *   dan tidak menganggap papan macet di satu tampilan.
 * - **Pergiliran memakai `setInterval`, bukan animasi CSS bertumpuk.** Papan berjalan berjam-jam tanpa
 *   disentuh; interval sederhana yang dibersihkan di `return` tidak menumpuk seperti animasi berulang.
 *
 * Ukuran huruf memakai satuan `vh` dengan alasan yang sama seperti papan induk: armada TV sekolah bercampur
 * resolusi, dan piksel tetap membuat papan yang sama tampak besar-kecil berbeda. */
export default function PapanPegawai({ token, giliranAwal, tambahan = [] }: { token: string; giliranAwal: number; tambahan?: PanelPegawai[] }) {
  const [panel, setPanel] = useState<PanelPegawai[] | null>(null);
  const [libur, setLibur] = useState<string | null>(null);
  const [giliran, setGiliran] = useState(Math.max(15, giliranAwal || 120));
  const [indeks, setIndeks] = useState(0);
  const [galat, setGalat] = useState(false);
  const hidup = useRef(true);
  /* Sampai kapan pergiliran otomatis ditahan setelah seseorang menggeser manual dari remote. Disimpan di ref,
     bukan state: interval pergiliran tidak perlu dibuat ulang tiap kali tombol ditekan. */
  const jedaSampai = useRef(0);
  const wadah = useRef<HTMLDivElement | null>(null);
  const daftarRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => () => { hidup.current = false; }, []);

  // Muat isi lalu segarkan tiap satu giliran: papan selalu menampilkan keadaan yang tidak lebih tua dari
  // sekali putaran panel, tanpa membebani server dengan kueri tiap beberapa detik.
  useEffect(() => {
    const ambil = async () => {
      try {
        const r = await fetch(`/api/layar/${token}/pegawai`, { cache: "no-store" });
        const d = await r.json().catch(() => null);
        if (!hidup.current) return;
        if (!r.ok || !d) { setGalat(true); return; }
        setGalat(false);
        setLibur(d.libur ?? null);
        setPanel(Array.isArray(d.panel) ? d.panel : []);
        if (typeof d.giliran === "number" && d.giliran >= 15) setGiliran(d.giliran);
      } catch { if (hidup.current) setGalat(true); }
    };
    ambil();
    const t = setInterval(ambil, Math.max(60, giliran) * 1000);
    return () => clearInterval(t);
  }, [token, giliran]);

  /* Panel dari server + panel yang sudah ada di muatan halaman (pengumuman, agenda, bel). Pada hari libur
     daftar "belum diisi" tidak berlaku, tetapi agenda & pengumuman tetap pantas berputar — jadi hari libur
     hanya MENGGANTI panel pegawai dengan satu kartu keterangan, bukan mematikan papan. */
  const daftar: PanelPegawai[] = libur
    ? [{ kunci: "libur", judul: "Hari ini libur", keterangan: libur, baris: [], kosong: libur, angka: null }, ...tambahan]
    : [...(panel ?? []), ...tambahan];
  const jumlah = panel ? daftar.length : 0;
  useEffect(() => {
    if (jumlah < 2) return;
    const t = setInterval(() => {
      if (Date.now() < jedaSampai.current) return;   // baru digeser manual — biarkan dibaca dulu
      setIndeks(i => (i + 1) % jumlah);
    }, giliran * 1000);
    return () => clearInterval(t);
  }, [jumlah, giliran]);

  /* GESER MANUAL DARI REMOTE TV (25 September 2026, permintaan user). Tombol kiri/kanan pada remote sampai ke
     halaman sebagai `ArrowLeft`/`ArrowRight` — aplikasi papan tidak menangkapnya sendiri, jadi cukup didengarkan
     di sini. Setelah digeser, pergiliran otomatis ditahan 3 menit supaya panel yang sengaja dipilih orang tidak
     langsung berganti sendiri di depan matanya. */
  useEffect(() => {
    if (jumlah < 2) return;
    const tekan = (e: KeyboardEvent) => {
      const maju = e.key === "ArrowRight" || e.key === "MediaTrackNext";
      const mundur = e.key === "ArrowLeft" || e.key === "MediaTrackPrevious";
      if (!maju && !mundur) return;
      e.preventDefault();
      jedaSampai.current = Date.now() + 3 * 60_000;
      setIndeks(i => (i + (maju ? 1 : -1) + jumlah) % jumlah);
    };
    window.addEventListener("keydown", tekan);
    return () => window.removeEventListener("keydown", tekan);
  }, [jumlah]);

  // Daftar panel bisa memendek (mis. jadi hari libur) saat giliran sedang di indeks terakhir.
  useEffect(() => { if (jumlah && indeks >= jumlah) setIndeks(0); }, [jumlah, indeks]);

  /* GULIR PELAN untuk daftar yang lebih tinggi dari panelnya (permintaan user 25 Sep 2026: "kenapa tidak bisa
     bergulir pelan ke atas sehingga namanya semua muncul" — 37 pegawai tidak mungkin muat sekali tayang).
     Dibuat dengan transisi CSS, bukan `scrollTop` bergerak tiap frame: TV menjalankan papan ini berjam-jam, dan
     animasi yang ditangani penyusun (compositor) jauh lebih ringan daripada seratus pembaruan gaya per detik.
     Iramanya: diam 4 detik supaya baris pertama sempat dibaca → gulir ±22 piksel/detik → diam 3 detik di ujung →
     kembali ke atas. Ulang sampai giliran panel berganti. */
  useEffect(() => {
    const w = wadah.current, u = daftarRef.current;
    if (!w || !u) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    u.style.transition = "none";
    u.style.transform = "translateY(0)";

    const jadwal: ReturnType<typeof setTimeout>[] = [];
    let ulang: ReturnType<typeof setInterval> | null = null;

    // Diukur ULANG tiap putaran, bukan sekali di awal: tinggi baris baru pasti setelah huruf `clamp(...vh...)`
    // selesai dihitung dan isi panel diperbarui, dan jumlah barisnya sendiri bisa berubah saat data disegarkan.
    const sekali = () => {
      const lebih = u.scrollHeight - w.clientHeight;
      if (lebih <= 8) { u.style.transition = "none"; u.style.transform = "translateY(0)"; return; }
      const detikTurun = Math.max(6, lebih / 22);
      jadwal.push(setTimeout(() => {
        u.style.transition = `transform ${detikTurun}s linear`;
        u.style.transform = `translateY(-${lebih}px)`;
      }, 4000));
      jadwal.push(setTimeout(() => {
        u.style.transition = "transform 1.2s ease";
        u.style.transform = "translateY(0)";
      }, 4000 + detikTurun * 1000 + 3000));
    };

    // Satu bingkai jeda supaya tata letak selesai dulu — mengukur di dalam efek yang sama dengan render
    // menghasilkan scrollHeight yang belum final.
    const mulai = requestAnimationFrame(() => {
      sekali();
      const lebih = u.scrollHeight - w.clientHeight;
      if (lebih > 8) ulang = setInterval(sekali, (4 + Math.max(6, lebih / 22) + 3 + 1.2) * 1000);
    });

    return () => {
      cancelAnimationFrame(mulai);
      if (ulang) clearInterval(ulang);
      jadwal.forEach(clearTimeout);
    };
  }, [indeks, panel]);

  if (!panel) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl bg-white/[0.06] text-white/40"
        style={{ fontSize: "clamp(0.85rem, 2.4vh, 1.4rem)" }}>
        {galat ? "Isi papan belum bisa dimuat." : "Memuat…"}
      </div>
    );
  }

  const p = daftar[indeks];
  if (!p) return null;

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-2xl bg-white/[0.06] p-4 sm:p-6">
      <header className="mb-3 flex shrink-0 flex-wrap items-end justify-between gap-2 border-b border-white/10 pb-3">
        <div className="min-w-0">
          <h2 className={`font-heading font-bold leading-tight ${p.jenis === "ULANG_TAHUN" ? "papan-ucapan text-[#E8A020]" : ""}`}
            style={{ fontSize: "clamp(1.1rem, 4vh, 2.4rem)" }}>{p.judul}</h2>
          {p.keterangan && (
            <p className="mt-0.5 text-white/50" style={{ fontSize: "clamp(0.75rem, 2vh, 1.15rem)" }}>{p.keterangan}</p>
          )}
        </div>
        {p.angka && (
          <p className="shrink-0 font-heading font-bold tabular-nums text-[#E8A020]" style={{ fontSize: "clamp(1.2rem, 4.5vh, 2.8rem)" }}>{p.angka}</p>
        )}
      </header>

      {/* `papan-masuk` DIPINDAH ke wadah ini, JANGAN ditaruh di <ul> yang digulir. Kelas itu memakai
          `animation-fill-mode: both` dan keyframe terakhirnya menyetel `transform: none`; nilai animasi CSS
          mengalahkan gaya inline, sehingga `translateY` untuk menggulir daftar tidak pernah berlaku sama sekali
          — gulirnya diam tanpa galat apa pun (temuan user 25 Sep 2026: "kok nama-nama tidak bergulir ke atas?"). */}
      <div ref={wadah} className="papan-masuk min-h-0 flex-1 overflow-hidden" key={p.kunci}>
        {p.jenis === "ULANG_TAHUN" && p.orang?.length ? (
          /* Tampilan khusus: foto bulat besar + nama + usia, dengan hujan konfeti di belakangnya. Panel ini
             muncul hanya di hari-H dan memang dibuat untuk dilihat sekilas dari seberang ruangan. */
          <div className="relative flex h-full items-center justify-center overflow-hidden">
            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
              {KONFETI.map((k, i) => (
                <span key={i} className="papan-konfeti" style={{
                  left: k.kiri, width: k.lebar, height: k.tinggi, background: k.warna, borderRadius: k.bulat,
                  animationDelay: k.jeda, animationDuration: k.lama,
                  ["--geser" as string]: k.geser, ["--putar" as string]: k.putar,
                } as React.CSSProperties} />
              ))}
            </div>
            {/* UKURAN MENYESUAIKAN JUMLAH ORANG. Hampir selalu hanya satu-dua orang berulang tahun pada satu hari,
                dan panel sebesar layar yang diisi foto kecil di tengah terlihat seperti ada yang gagal dimuat —
                jadi satu orang mendapat foto hampir setinggi panel, empat orang ke atas baru mengecil. */}
            <div className={`relative flex max-h-full flex-wrap items-start justify-center overflow-hidden ${p.orang.length > 3 ? "gap-4" : "gap-8"}`}>
              {p.orang.slice(0, 6).map((o, i) => {
                const banyak = p.orang!.length;
                /* Tinggi total kartu = foto + nama + usia + jabatan, dan panelnya sendiri sudah berkurang tinggi
                   kop & judul. Ukuran 44vh membuat isinya meluber keluar panel (temuan user 25 Sep 2026), jadi
                   foto dibatasi sepertiga tinggi layar untuk satu orang — sisanya masih cukup untuk teksnya. */
                const ukuranFoto = banyak === 1 ? "clamp(7rem, 30vh, 18rem)"
                  : banyak <= 3 ? "clamp(6rem, 22vh, 13rem)" : "clamp(4.5rem, 16vh, 9rem)";
                const ukuranCahaya = banyak === 1 ? "clamp(8.5rem, 36vh, 22rem)"
                  : banyak <= 3 ? "clamp(7.5rem, 28vh, 16rem)" : "clamp(6rem, 21vh, 11rem)";
                const ukuranNama = banyak === 1 ? "clamp(1.3rem, 4.6vh, 2.8rem)"
                  : banyak <= 3 ? "clamp(1.05rem, 3.4vh, 2rem)" : "clamp(0.95rem, 2.8vh, 1.6rem)";
                const ukuranUsia = banyak === 1 ? "clamp(1.1rem, 4vh, 2.4rem)"
                  : banyak <= 3 ? "clamp(0.9rem, 2.8vh, 1.6rem)" : "clamp(0.8rem, 2.2vh, 1.3rem)";
                const lebarKartu = banyak === 1 ? "min(32rem, 80vw)" : banyak <= 3 ? "min(20rem, 40vw)" : "min(15rem, 34vw)";
                return (
                <div key={i} className="bounce-in relative flex flex-col items-center text-center"
                  style={{ width: lebarKartu, animationDelay: `${i * 120}ms` }}>
                  <div className="papan-cahaya-ultah pointer-events-none absolute rounded-full"
                    style={{ width: ukuranCahaya, height: ukuranCahaya, top: `calc((${ukuranFoto} - ${ukuranCahaya}) / 2)`,
                      background: "radial-gradient(circle, rgba(232,160,32,0.45) 0%, transparent 70%)" }} />
                  <div className="podium-glow relative mb-4 overflow-hidden rounded-full border-4 border-[#E8A020] bg-white/10"
                    style={{ width: ukuranFoto, height: ukuranFoto }}>
                    {o.foto
                      /* eslint-disable-next-line @next/next/no-img-element */
                      ? <img src={o.foto} alt={o.nama} className="h-full w-full object-cover" />
                      : <span className="flex h-full w-full items-center justify-center font-heading font-bold text-[#E8A020]"
                          style={{ fontSize: `calc(${ukuranFoto} / 2.4)` }}>{o.nama.slice(0, 1).toUpperCase()}</span>}
                  </div>
                  <p className="font-heading font-bold leading-tight" style={{ fontSize: ukuranNama }}>{o.nama}</p>
                  {o.usia != null && (
                    <p className="mt-1 font-semibold text-[#E8A020]" style={{ fontSize: ukuranUsia }}>{o.usia} tahun</p>
                  )}
                  {o.jabatan && (
                    <p className="mt-1 text-white/50" style={{ fontSize: "clamp(0.75rem, 2.1vh, 1.2rem)" }}>{o.jabatan}</p>
                  )}
                </div>
                );
              })}
            </div>
          </div>
        ) : p.baris.length === 0 ? (
          <p className="flex h-full items-center justify-center text-center text-emerald-300/80" style={{ fontSize: "clamp(0.9rem, 2.8vh, 1.6rem)" }}>
            {p.kosong}
          </p>
        ) : (
          <ul ref={daftarRef} className="space-y-1.5 will-change-transform">
            {p.baris.map((b, i) => (
              <li key={i} className={`flex items-center gap-3 rounded-xl px-3 py-1.5 ${b.tanda === "perlu" ? "bg-[#E8A020]/15" : b.tanda === "beres" ? "bg-emerald-400/12" : "bg-white/8"}`}>
                <span className="min-w-0 flex-1 truncate font-semibold" style={{ fontSize: "clamp(0.85rem, 2.6vh, 1.6rem)" }}>{b.utama}</span>
                {b.sisi && (
                  <span className="max-w-[45%] shrink-0 truncate text-right text-white/55" style={{ fontSize: "clamp(0.75rem, 2.1vh, 1.25rem)" }}>{b.sisi}</span>
                )}
              </li>
            ))}
            {!!p.sisa && p.sisa > 0 && (
              <li className="px-3 pt-1 text-white/45" style={{ fontSize: "clamp(0.75rem, 2vh, 1.15rem)" }}>+{p.sisa} lainnya</li>
            )}
          </ul>
        )}
      </div>

      {jumlah > 1 && (
        <div className="mt-3 flex shrink-0 items-center justify-center gap-1.5">
          {daftar.map((x, i) => (
            <span key={x.kunci} aria-hidden
              className={`h-1.5 rounded-full transition-all duration-500 ${i === indeks ? "w-6 bg-[#E8A020]" : "w-1.5 bg-white/25"}`} />
          ))}
        </div>
      )}
    </section>
  );
}
