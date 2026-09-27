"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, Loader2, Send, Timer, AlertTriangle, Grid3x3, Maximize2, Flag, Wifi, WifiOff,
  Lock, MonitorSmartphone, RefreshCw, AArrowDown, AArrowUp, Calculator, PencilLine, Megaphone,
} from "lucide-react";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import SoalTampil, { type SoalView, type AturanAudio } from "@/components/ujian/SoalTampil";
import KalkulatorUjian from "@/components/ujian/KalkulatorUjian";
import KertasCoretan from "@/components/ujian/KertasCoretan";
import { fetchUjian, pengawasanDitahan } from "@/lib/perangkat-ujian";
import type { Jawaban } from "@/lib/soal";
import TombolKembali from "@/components/shared/TombolKembali";

/** Halaman pengerjaan ujian.
 *   - Waktu dihitung dari `deadline` server, dikoreksi selisih jam server-klien (`serverNow`), dan
 *     diperbarui DENYUT tiap 20 detik — tambahan waktu dari pengawas langsung sampai ke sini.
 *   - OFFLINE-FIRST: tiap jawaban & tanda ragu-ragu masuk ANTREAN di perangkat (localStorage)
 *     dulu, lalu dikirim. Kalau jaringan putus, siswa tetap bisa menjawab; antrean dikirim ulang
 *     otomatis begitu tersambung. Memuat ulang halaman tidak menghilangkan antrean.
 *   - Kalau `satuSoalPerHalaman`, soal diminta ke server satu per satu; peta nomor di samping.
 *   - Kunci perangkat & kunci pengawas dijaga server (balasan 423 → layar terkunci).
 *   - Pindah tab, keluar layar penuh, salin, Print Screen DICATAT (tidak menghentikan ujian).
 *   - Watermark nama + NIS di layar: foto layar yang bocor langsung ketahuan milik siapa. */

interface Muatan {
  id: string; title: string; description: string | null; subject: string; duration: number;
  teacher: { user: { name: string } };
  satuSoalPerHalaman: boolean; batasPindahTab: number;
  deadline: string; serverNow: string; submitted: boolean; score: number | null; tampilkanNilai: boolean;
  skorButir?: Record<string, number | null>;
  jawaban: Record<string, Jawaban>;
  peta: { id: string; nomor: number; tipe: string; dijawab: boolean }[];
  soal: SoalView[]; jumlah: number; pelanggaran: number;
  ragu?: string[];
  batasPutarAudio?: number; putarAudio?: Record<string, number>;
  peserta?: { nama: string; nis: string };
  izinKalkulator?: boolean; izinCoretan?: boolean;
  kegiatan?: { nama: string; singkatan: string } | null;
  /** Waktu perbaikan live terakhir pada naskah ini — pembanding untuk memuat ulang soal. */
  versiSoal?: string | null;
  /** Pesan pengawas untuk peserta ini (src/lib/pesan-ujian.ts) — juga diperbarui lewat denyut. */
  pesan?: PesanPengawas[];
}
type PesanPengawas = { id: string; teks: string; questionId: string | null; waktu: string };
type ItemAntrean = { questionId: string; t: number } & ({ jawaban: Jawaban } | { ragu: boolean });
type Antrean = Record<string, ItemAntrean>;

const fmtClock = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
const terisi = (j: Jawaban | undefined) => j !== undefined && j !== null && j !== "" && !(Array.isArray(j) && j.length === 0);
const SKALA = [0.9, 1, 1.15, 1.3];

export default function StudentExamPage() {
  const { id } = useParams<{ id: string }>();
  const confirmDialog = useConfirm();
  const router = useRouter();
  const [m, setM] = useState<Muatan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [blokir, setBlokir] = useState<{ kode: string; pesan: string } | null>(null);
  // Pesan pengawas (21 September 2026): yang sudah ditekan "Mengerti" diingat di perangkat supaya tidak muncul lagi.
  const [pesanPengawas, setPesanPengawas] = useState<PesanPengawas[]>([]);
  const [pesanDibaca, setPesanDibaca] = useState<Set<string>>(new Set());
  const [riwayatPesan, setRiwayatPesan] = useState(false);
  const [jawaban, setJawaban] = useState<Record<string, Jawaban>>({});
  const [ragu, setRagu] = useState<Set<string>>(new Set());
  const [putarAudio, setPutarAudio] = useState<Record<string, number>>({});
  const [nomor, setNomor] = useState(1);
  const [soalAktif, setSoalAktif] = useState<SoalView | null>(null);
  const [memuatSoal, setMemuatSoal] = useState(false);
  const [sisa, setSisa] = useState(0);
  const [tersimpan, setTersimpan] = useState<"ok" | "menyimpan" | "lokal">("ok");
  const [koneksi, setKoneksi] = useState<"online" | "offline">("online");
  const [menunggu, setMenunggu] = useState(0);
  const [pelanggaran, setPelanggaran] = useState(0);
  const [peringatan, setPeringatan] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [petaBuka, setPetaBuka] = useState(false);
  const [ukuran, setUkuran] = useState(1);
  const [infoPerbaikan, setInfoPerbaikan] = useState("");
  const [bukaKalkulator, setBukaKalkulator] = useState(false);
  const [bukaCoretan, setBukaCoretan] = useState(false);
  /** Detik yang dihabiskan di tiap soal SEJAK denyut terakhir yang berhasil (lihat denyut). */
  const waktuRef = useRef<Record<string, number>>({});
  const soalAktifRef = useRef<string | null>(null);
  const soalTerlihatRef = useRef<string | null>(null);
  const aktifRef = useRef(false);
  const selisihRef = useRef(0);         // serverNow - clientNow (ms)
  const submittingRef = useRef(false);
  const mengirimRef = useRef(false);
  const kirimTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const versiRef = useRef<string | null>(null);
  const kunciAntrean = `antrean-ujian:${id}`;

  /* -------- antrean jawaban di perangkat -------- */
  const bacaAntrean = useCallback((): Antrean => {
    try { return JSON.parse(localStorage.getItem(kunciAntrean) || "{}") as Antrean; } catch { return {}; }
  }, [kunciAntrean]);
  const tulisAntrean = useCallback((a: Antrean) => {
    try {
      if (Object.keys(a).length) localStorage.setItem(kunciAntrean, JSON.stringify(a));
      else localStorage.removeItem(kunciAntrean);
    } catch { /* penyimpanan penuh/diblokir: tetap dicoba kirim langsung */ }
    setMenunggu(Object.keys(a).length);
  }, [kunciAntrean]);

  useEffect(() => {
    try { const u = Number(localStorage.getItem("ukuran-huruf-ujian")); if (u >= 0 && u < SKALA.length) queueMicrotask(() => setUkuran(u)); } catch { /* abaikan */ }
  }, []);
  function gantiUkuran(arah: -1 | 1) {
    setUkuran(u => {
      const baru = Math.min(SKALA.length - 1, Math.max(0, u + arah));
      try { localStorage.setItem("ukuran-huruf-ujian", String(baru)); } catch { /* abaikan */ }
      return baru;
    });
  }

  /** Pemicu denyut & pemulihan kunci dari luar efeknya (dipakai sinyal pengawas). */
  const denyutRef = useRef<(() => Promise<void>) | null>(null);
  const pulihRef = useRef<(() => Promise<void>) | null>(null);
  const tolak = (d: { kode?: string; error?: string } | null) => setBlokir({ kode: d?.kode ?? "TERKUNCI", pesan: d?.error ?? "Pengerjaan dikunci." });

  const muat = useCallback(async () => {
    const r = await fetchUjian(`/api/student/exams/${id}`);
    if (r.status === 423) { tolak(await r.json().catch(() => null)); setLoading(false); return; }
    if (!r.ok) { const d = await r.json().catch(() => ({})); setError(d.error || "Ujian tidak ditemukan"); setLoading(false); return; }
    const d: Muatan = await r.json();
    if (d.submitted) {
      // Sudah dikumpulkan: tidak ada yang ditampilkan — bersihkan sisa di perangkat & kembali ke beranda.
      try { localStorage.removeItem(kunciAntrean); localStorage.removeItem(`coretan-ujian:${id}`); } catch { /* abaikan */ }
      router.replace(`/ujian-online?selesai=${id}`);
      return;
    }
    selisihRef.current = new Date(d.serverNow).getTime() - Date.now();
    versiRef.current = d.versiSoal ?? null;
    if (Array.isArray(d.pesan)) setPesanPengawas(d.pesan);
    // Gabungkan antrean yang belum terkirim (lebih baru dari server) ke tampilan.
    const antrean = d.submitted ? {} : bacaAntrean();
    const jaw = { ...(d.jawaban ?? {}) };
    const rg = new Set(d.ragu ?? []);
    for (const it of Object.values(antrean)) {
      if ("jawaban" in it) { if (terisi(it.jawaban)) jaw[it.questionId] = it.jawaban; else delete jaw[it.questionId]; }
      else if (it.ragu) rg.add(it.questionId); else rg.delete(it.questionId);
    }
    setBlokir(null);
    setM(d); setJawaban(jaw); setRagu(rg); setPutarAudio(d.putarAudio ?? {}); setPelanggaran(d.pelanggaran ?? 0);
    setMenunggu(Object.keys(antrean).length);
    if (d.soal.length) setSoalAktif(d.soal[0]);
    setSisa(Math.max(0, Math.floor((new Date(d.deadline).getTime() - (Date.now() + selisihRef.current)) / 1000)));
    setLoading(false);
  }, [id, bacaAntrean, kunciAntrean, router]);
  useEffect(() => { muat().catch(() => { setError("Gagal memuat ujian"); setLoading(false); }); }, [muat]);

  /* -------- satu soal per halaman --------
   * TAHAN PUTUS (20 September 2026): tiap pindah nomor dulu selalu satu permintaan ke server, jadi
   * wifi yang putus sedetik saja membuat siswa tersangkut di layar kosong — padahal jawabannya
   * sudah aman di antrean. Sekarang soal yang SUDAH pernah dibuka disimpan di perangkat, dan
   * soal BERIKUTNYA diambil lebih awal di latar.
   *
   * Yang SENGAJA tidak dilakukan: mengambil seluruh naskah sekaligus. `satuSoalPerHalaman` ada
   * justru supaya naskah utuh tidak pernah berada dalam satu muatan yang bisa disalin habis lewat
   * alat pengembang. Jadi yang disimpan hanya yang sudah dilihat siswa + satu langkah ke depan —
   * tidak menambah apa pun yang belum pernah ia lihat. */
  const singgahSoal = useRef<Map<number, SoalView>>(new Map());

  const ambilSoal = useCallback(async (n: number, diam = false): Promise<SoalView | null> => {
    const ada = singgahSoal.current.get(n);
    if (ada) return ada;
    const r = await fetchUjian(`/api/student/exams/${id}?nomor=${n}`).catch(() => null);
    if (!r) { if (!diam) setKoneksi("offline"); return null; }
    if (r.status === 423) { if (!diam) tolak(await r.json().catch(() => null)); return null; }
    const d = r.ok ? await r.json().catch(() => null) : null;
    const soal = d?.soal?.[0] ?? null;
    if (soal) singgahSoal.current.set(n, soal);
    return soal;
  }, [id]);

  const bukaNomor = useCallback(async (n: number) => {
    if (!m) return;
    setNomor(n);
    if (!m.satuSoalPerHalaman || m.submitted) { setSoalAktif(m.soal[n - 1] ?? null); return; }
    const singgah = singgahSoal.current.get(n);
    if (singgah) setSoalAktif(singgah);
    else setMemuatSoal(true);
    const soal = await ambilSoal(n);
    if (soal) setSoalAktif(soal);
    else if (!singgah) setPeringatan("Soal nomor ini belum bisa dimuat karena koneksi terputus. Jawaban Anda tetap aman — coba lagi sebentar.");
    setMemuatSoal(false);
    // Ambil satu langkah ke depan di latar, tanpa mengganggu layar bila gagal.
    const total = m.peta.length;
    if (n + 1 <= total) void ambilSoal(n + 1, true);
  }, [m, ambilSoal]);

  /* -------- soal diperbaiki pengawas (edit live) --------
   * Hanya ISI soal yang dimuat ulang — jawaban di layar tidak ditimpa. ID soal & kode pilihan
   * dijamin sama oleh server. */
  const muatUlangSoal = useCallback(async (versi: string) => {
    if (!m || versi === versiRef.current) return;
    versiRef.current = versi;
    singgahSoal.current.clear(); // soal diperbaiki pengawas → simpanan lama tidak boleh dipakai lagi
    const r = await fetchUjian(m.satuSoalPerHalaman ? `/api/student/exams/${id}?nomor=${nomor}` : `/api/student/exams/${id}`).catch(() => null);
    const d = r?.ok ? await r.json().catch(() => null) : null;
    if (!d?.soal) return;
    if (m.satuSoalPerHalaman) { if (d.soal[0]) setSoalAktif(d.soal[0]); }
    else { setM(prev => prev ? { ...prev, soal: d.soal } : prev); setSoalAktif(d.soal[nomor - 1] ?? null); }
    setInfoPerbaikan("Pengawas baru saja memperbaiki soal. Tampilan soal sudah diperbarui — jawaban Anda tetap tersimpan.");
  }, [m, id, nomor]);

  const perbaruiTenggat = useCallback((deadline?: string, serverNow?: string) => {
    if (serverNow) selisihRef.current = new Date(serverNow).getTime() - Date.now();
    if (deadline) setM(prev => (prev && prev.deadline !== deadline ? { ...prev, deadline } : prev));
  }, []);

  /* -------- kirim antrean -------- */
  const kumpulkan = useRef<(otomatis?: boolean) => void>(() => {});
  const kirimAntrean = useCallback(async (): Promise<boolean> => {
    if (mengirimRef.current) return false;
    mengirimRef.current = true;
    try {
      for (const [k, it] of Object.entries(bacaAntrean())) {
        const body = "jawaban" in it ? { questionId: it.questionId, jawaban: it.jawaban } : { questionId: it.questionId, ragu: it.ragu };
        const r = await fetchUjian(`/api/student/exams/${id}/jawab`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        }).catch(() => null);
        if (!r) { setKoneksi("offline"); setTersimpan("lokal"); return false; }
        setKoneksi("online");
        const d = await r.json().catch(() => null);
        if (r.status === 423) { tolak(d); return false; }
        if (r.status === 403 && d?.habis) { kumpulkan.current(true); return false; }
        if (r.ok || r.status === 400 || r.status === 404) {
          // Terkirim, atau ditolak permanen (sudah dikumpulkan / soal tak dikenal) — keluarkan dari
          // antrean. Kalau siswa mengubah jawabannya selagi terkirim, versi baru tetap tinggal.
          const kini = bacaAntrean();
          if (kini[k]?.t === it.t) { delete kini[k]; tulisAntrean(kini); }
          if (r.ok) { perbaruiTenggat(d?.deadline); if (d?.versiSoal) muatUlangSoal(d.versiSoal); }
          if (d?.selesai) { muat(); return false; }
          continue;
        }
        setKoneksi("offline"); setTersimpan("lokal");
        return false; // galat server — coba lagi nanti
      }
      setTersimpan("ok");
      return true;
    } finally { mengirimRef.current = false; }
  }, [id, bacaAntrean, tulisAntrean, perbaruiTenggat, muatUlangSoal, muat]);

  function antrekan(kunci: string, item: ItemAntrean) {
    const a = bacaAntrean();
    a[kunci] = item;
    tulisAntrean(a);
    setTersimpan("menyimpan");
    if (kirimTimer.current) clearTimeout(kirimTimer.current);
    kirimTimer.current = setTimeout(() => { kirimAntrean(); }, 400);
  }

  /* -------- jawab & ragu-ragu -------- */
  function jawab(qid: string, j: Jawaban) {
    setJawaban(prev => { const n = { ...prev }; if (terisi(j)) n[qid] = j; else delete n[qid]; return n; });
    antrekan(`j:${qid}`, { questionId: qid, jawaban: j ?? null, t: Date.now() });
  }
  function toggleRagu(qid: string) {
    const nilai = !ragu.has(qid);
    setRagu(prev => { const s = new Set(prev); if (nilai) s.add(qid); else s.delete(qid); return s; });
    antrekan(`r:${qid}`, { questionId: qid, ragu: nilai, t: Date.now() });
  }

  /* -------- kumpulkan -------- */
  useEffect(() => { kumpulkan.current = async (otomatis = false) => {
    if (submittingRef.current || !m || m.submitted) return;
    submittingRef.current = true; setSubmitting(true);
    let ulangi = false;
    try {
      await kirimAntrean();
      const waktu = ambilWaktu();
      if (Object.keys(waktu).length) {
        const rw = await fetchUjian(`/api/student/exams/${id}/denyut`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ waktu }),
        }).catch(() => null);
        if (rw?.ok) kurangiWaktu(waktu);
      }
      if (Object.keys(bacaAntrean()).length) {
        setPeringatan(otomatis ? "Waktu habis. Jawaban terakhir masih menunggu koneksi — dikumpulkan otomatis begitu tersambung." : "Masih ada jawaban yang belum terkirim. Menunggu koneksi...");
        ulangi = true; return;
      }
      const res = await fetchUjian(`/api/student/exams/${id}/submit`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ otomatis }),
      });
      if (res.status === 423) { tolak(await res.json().catch(() => null)); return; }
      if (!res.ok) { const d = await res.json().catch(() => ({})); setPeringatan(d.error || "Gagal mengumpulkan"); return; }
      tulisAntrean({});
      await muat();
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    } catch {
      setPeringatan("Koneksi bermasalah saat mengumpulkan. Mencoba lagi..."); ulangi = true;
    } finally {
      setSubmitting(false); submittingRef.current = false;
      if (ulangi) setTimeout(() => kumpulkan.current(otomatis), 5000);
    }
  }; });

  /* -------- pewaktu -------- */
  useEffect(() => {
    if (!m || m.submitted) return;
    const t = setInterval(() => {
      const s = Math.max(0, Math.floor((new Date(m.deadline).getTime() - (Date.now() + selisihRef.current)) / 1000));
      setSisa(s);
      // Catat 1 detik untuk soal yang sedang dikerjakan — hanya kalau halaman ujian benar-benar
      // di layar (bukan saat pindah tab / terkunci).
      const qid = m.satuSoalPerHalaman ? soalAktifRef.current : soalTerlihatRef.current;
      if (qid && aktifRef.current && !document.hidden) waktuRef.current[qid] = (waktuRef.current[qid] ?? 0) + 1;
      if (s <= 0) { clearInterval(t); kumpulkan.current(true); }
    }, 1000);
    return () => clearInterval(t);
  }, [m]);

  /* -------- soal yang sedang dikerjakan (untuk catatan waktu per soal) -------- */
  useEffect(() => { soalAktifRef.current = soalAktif?.id ?? null; }, [soalAktif]);
  useEffect(() => {
    if (!m || m.submitted || m.satuSoalPerHalaman) return;
    // Mode semua soal satu halaman: soal yang PALING banyak tampil di layar dianggap sedang dikerjakan.
    const rasio = new Map<string, number>();
    const pengamat = new IntersectionObserver(entri => {
      for (const e of entri) rasio.set(e.target.id.replace(/^soal-/, ""), e.intersectionRatio);
      let terbaik: string | null = null, nilai = 0;
      for (const [k, v] of rasio) if (v > nilai) { nilai = v; terbaik = k; }
      soalTerlihatRef.current = terbaik;
    }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
    document.querySelectorAll('[id^="soal-"]').forEach(el => pengamat.observe(el));
    return () => pengamat.disconnect();
  }, [m]);

  /** Ambil catatan waktu yang belum terkirim; setelah denyut berhasil, kurangi yang sudah terkirim. */
  const ambilWaktu = () => ({ ...waktuRef.current });
  const kurangiWaktu = (terkirim: Record<string, number>) => {
    for (const [k, v] of Object.entries(terkirim)) {
      const sisaDtk = (waktuRef.current[k] ?? 0) - v;
      if (sisaDtk > 0) waktuRef.current[k] = sisaDtk; else delete waktuRef.current[k];
    }
  };
  const fnWaktu = useRef({ ambilWaktu, kurangiWaktu });
  useEffect(() => { fnWaktu.current = { ambilWaktu, kurangiWaktu }; });

  /* -------- pesan pengawas -------- */
  const kunciPesanDibaca = `pesan-dibaca:${id}`;
  useEffect(() => {
    let ids: string[] = [];
    try { ids = JSON.parse(localStorage.getItem(kunciPesanDibaca) ?? "[]"); } catch { /* penyimpanan tidak tersedia */ }
    queueMicrotask(() => setPesanDibaca(new Set(Array.isArray(ids) ? ids : [])));
  }, [kunciPesanDibaca]);
  const pesanBaru = pesanPengawas.filter(p => !pesanDibaca.has(p.id));
  const jumlahPesanBaru = pesanBaru.length;
  const pesanTerakhirRef = useRef(0);
  useEffect(() => {
    // Getar singkat di HP saat pesan baru datang — tanpa suara supaya lab tetap tenang.
    if (jumlahPesanBaru > pesanTerakhirRef.current) { try { navigator.vibrate?.(200); } catch { /* abaikan */ } }
    pesanTerakhirRef.current = jumlahPesanBaru;
  }, [jumlahPesanBaru]);
  function tandaiPesanDibaca(pid: string) {
    setPesanDibaca(prev => {
      const baru = new Set(prev); baru.add(pid);
      try { localStorage.setItem(kunciPesanDibaca, JSON.stringify([...baru].slice(-100))); } catch { /* abaikan */ }
      return baru;
    });
  }

  /* -------- denyut + koneksi -------- */
  const fn = useRef({ muat, kirimAntrean, muatUlangSoal, perbaruiTenggat, bacaAntrean });
  useEffect(() => { fn.current = { muat, kirimAntrean, muatUlangSoal, perbaruiTenggat, bacaAntrean }; });
  const aktif = !!m && !m.submitted && !blokir;
  useEffect(() => { aktifRef.current = aktif; }, [aktif]);
  // Aplikasi SMK Al-Munawwir (Android): layar DISEMATKAN otomatis selama pengerjaan (termasuk saat dikunci pengawas),
  // dilepas begitu dikumpulkan atau halaman ditinggalkan. Di browser biasa `AplikasiSMK` tidak ada — tidak berbuat apa-apa.
  const modeUjianAplikasi = !!m && !m.submitted;
  useEffect(() => {
    (window as unknown as { AplikasiSMK?: { modeUjian: (b: boolean) => void } }).AplikasiSMK?.modeUjian(modeUjianAplikasi);
  }, [modeUjianAplikasi]);
  useEffect(() => () => { (window as unknown as { AplikasiSMK?: { modeUjian: (b: boolean) => void } }).AplikasiSMK?.modeUjian(false); }, []);
  useEffect(() => {
    if (!aktif) return;
    let putusSejak: number | null = null;
    const denyut = async () => {
      const waktu = fnWaktu.current.ambilWaktu();
      const r = await fetchUjian(`/api/student/exams/${id}/denyut`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ putusDetik: putusSejak ? Math.round((Date.now() - putusSejak) / 1000) : 0, waktu }),
      }).catch(() => null);
      if (!r) { setKoneksi("offline"); putusSejak ??= Date.now(); return; }
      const d = await r.json().catch(() => null);
      if (r.status === 423) { tolak(d); return; }
      if (r.status === 404) {
        // Pengerjaan dihapus pengawas ("Ulang dari awal") atau ujian ditarik: jawaban lama di perangkat tidak berlaku
        // lagi — kembali ke halaman token supaya siswa mulai dari awal (dulu layar ini diam sampai di-refresh).
        try { localStorage.removeItem(kunciAntrean); } catch { /* abaikan */ }
        router.replace(`/ujian-online/mulai/${id}`);
        return;
      }
      if (!r.ok || !d) return;
      setKoneksi("online"); putusSejak = null;
      fnWaktu.current.kurangiWaktu(waktu);
      if (d.submitted) { fn.current.muat(); return; }
      fn.current.perbaruiTenggat(d.deadline, d.serverNow);
      if (d.versiSoal) fn.current.muatUlangSoal(d.versiSoal);
      if (Array.isArray(d.pesan)) setPesanPengawas(d.pesan);
      if (Object.keys(fn.current.bacaAntrean()).length) fn.current.kirimAntrean();
    };
    denyutRef.current = denyut;
    const t = setInterval(denyut, 20_000);
    const onOnline = () => { denyut(); };
    const onOffline = () => { setKoneksi("offline"); putusSejak ??= Date.now(); };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    if (Object.keys(fn.current.bacaAntrean()).length) fn.current.kirimAntrean();
    return () => { denyutRef.current = null; clearInterval(t); window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aktif, id]);

  /* -------- saat TERKUNCI: coba pulih sendiri --------
   * Denyut berhenti begitu `blokir` terisi (lihat `aktif` di atas), jadi tanpa ini layar siswa
   * tidak pernah tahu pengawas sudah menekan Reset Login / Buka Kunci — harus dimuat ulang manual
   * (temuan user 20 September 2026: "tombol tindakan tidak otomatis ter-action, harus hard refresh").
   * Mengetuk ulang tiap 8 detik: begitu kuncinya dilepas, ujian lanjut sendiri. */
  useEffect(() => {
    if (!blokir) return;
    let batal = false;
    // Diketuk lewat `denyut`, bukan `/info`: hanya denyut yang memeriksa kunci pengawas DAN kunci
    // perangkat sekaligus (`jagaAttempt`) — selama masih terkunci ia membalas 423.
    const coba = async () => {
      const r = await fetchUjian(`/api/student/exams/${id}/denyut`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
      }).catch(() => null);
      if (batal || !r || r.status === 423 || !r.ok) return;
      setBlokir(null);
      setLoading(true);
      muat().catch(() => setLoading(false));
    };
    pulihRef.current = coba;
    const t = setInterval(coba, 8000);
    coba();
    return () => { batal = true; pulihRef.current = null; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blokir, id]);

  /* -------- SINYAL PENGAWAS: tindakan sampai ±1 detik (21 September 2026) --------
   * Denyut hanya tiap 20 detik; tanpa ini Reset Login / Reset & Tambah Waktu / Kunci / Buka Kunci / Kumpulkan / pesan /
   * perbaikan soal baru terasa belakangan, dan pengawas me-refresh layar siswa (temuan user: "hanya muncul notif, harus
   * hard refresh"). Layar ini membuka long-poll yang ditahan server sampai pengawas bertindak (src/lib/sinyal-ujian.ts),
   * lalu menjalankan denyut SEKARANG — keadaan sebenarnya tetap datang dari denyut yang sudah dijaga. Sinyal umum
   * (pesan ke semua, soal diperbaiki) disebar acak 0–3 detik supaya ratusan layar tidak menghantam server serentak. */
  const dengarSinyal = (!!m && !m.submitted) || !!blokir;
  useEffect(() => {
    if (!dengarSinyal) return;
    const ctl = new AbortController();
    let hidup = true;
    const tidur = (ms: number) => new Promise(r => setTimeout(r, ms));
    (async () => {
      while (hidup) {
        const r = await fetchUjian(`/api/student/exams/${id}/sinyal`, { signal: ctl.signal, cache: "no-store" }).catch(() => null);
        if (!hidup) break;
        const d = r?.ok ? await r.json().catch(() => null) : null;
        if (d?.sinyal) {
          if (d.sebar) await tidur(Math.random() * 3000);
          if (!hidup) break;
          const jalankan = pulihRef.current ?? denyutRef.current;
          if (jalankan) await jalankan();
          continue;
        }
        if (!r || !r.ok) await tidur(5000 + Math.random() * 5000); // terputus/galat — jangan memborbardir server
      }
    })();
    return () => { hidup = false; ctl.abort(); };
  }, [dengarSinyal, id]);

  /* -------- LAYAR PENUH WAJIB + layar tidak boleh tidur --------
   * Browser tidak bisa benar-benar mengunci perangkat (Alt-Tab & tombol Home di luar jangkauan
   * halaman web), jadi yang paling kuat yang bisa dilakukan: PAKSA layar penuh selama mengerjakan
   * dan tahan layar supaya tidak tidur. Keluar dari layar penuh tetap tercatat sebagai pelanggaran,
   * dan bila melewati batas, server mengunci pengerjaan (lihat route pelanggaran).
   * Layar penuh butuh sentuhan pengguna, jadi saat tidak aktif ditampilkan tirai satu tombol —
   * bukan permintaan diam-diam yang pasti ditolak browser. iOS Safari tidak punya Fullscreen API:
   * di sana tirai ini sengaja dilewati supaya peserta tidak terkunci di luar ujian. */
  const adaLayarPenuh = typeof document !== "undefined" && !!document.documentElement.requestFullscreen;
  const [layarPenuh, setLayarPenuh] = useState(true);
  useEffect(() => {
    if (!aktif || !adaLayarPenuh) return;
    const periksa = () => setLayarPenuh(!!document.fullscreenElement);
    periksa();
    document.addEventListener("fullscreenchange", periksa);
    return () => document.removeEventListener("fullscreenchange", periksa);
  }, [aktif, adaLayarPenuh]);

  useEffect(() => {
    if (!aktif) return;
    type Kunci = { release: () => Promise<void> };
    let kunci: Kunci | null = null;
    let batal = false;
    const minta = async () => {
      try {
        const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<Kunci> } };
        if (!nav.wakeLock) return;
        const k = await nav.wakeLock.request("screen");
        if (batal) { k.release().catch(() => {}); return; }
        kunci = k;
      } catch { /* ditolak browser/baterai lemah — abaikan, bukan hal kritis */ }
    };
    minta();
    const lagi = () => { if (document.visibilityState === "visible" && !kunci) minta(); };
    document.addEventListener("visibilitychange", lagi);
    return () => {
      batal = true;
      document.removeEventListener("visibilitychange", lagi);
      kunci?.release().catch(() => {});
    };
  }, [aktif]);

  /* -------- pelanggaran: pindah tab / layar penuh / salin / Print Screen -------- */
  useEffect(() => {
    if (!aktif) return;
    const catat = async (jenis: string) => {
      if (pengawasanDitahan()) return; // jendela izin mikrofon (Jawaban Lisan) — src/lib/perangkat-ujian.ts
      const r = await fetchUjian(`/api/student/exams/${id}/pelanggaran`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jenis }),
      }).catch(() => null);
      const d = await r?.json().catch(() => null);
      if (d?.jumlah !== undefined) {
        setPelanggaran(d.jumlah);
        // Batas terlampaui → server sudah mengunci pengerjaan. Langsung tampilkan layar terkunci
        // supaya siswa tidak bisa meneruskan; pemulihan otomatis menunggu pengawas membuka
        // (keputusan user 20 September 2026: "langsung logout dan minta di-reset login").
        if (d.terkunci) {
          tolak({ kode: "TERKUNCI", error: `Anda keluar dari layar ujian ${d.pindahTab}x (batas ${d.batas}). Pengerjaan dikunci — angkat tangan dan minta pengawas membuka kembali.` });
          return;
        }
        setPeringatan(jenis === "PRINT_SCREEN" ? "Tangkapan layar tercatat dan terlihat oleh pengawas."
          : d.melebihiBatas ? `Anda sudah ${d.pindahTab}x berpindah dari halaman ujian (batas ${d.batas}). Pengawas sudah diberi tahu.`
          : `Aktivitas di luar halaman ujian tercatat (${d.pindahTab}x pindah tab).`);
      }
    };
    const onVis = () => { if (document.hidden) catat("PINDAH_TAB"); };
    const onBlur = () => catat("PINDAH_TAB");
    const onFs = () => { if (!document.fullscreenElement) catat("KELUAR_LAYAR_PENUH"); };
    const onCopy = (e: Event) => { e.preventDefault(); catat("SALIN"); };
    const onMenu = (e: Event) => { e.preventDefault(); };
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (e.key === "PrintScreen") {
        navigator.clipboard?.writeText("").catch(() => {});
        catat("PRINT_SCREEN");
        return;
      }
      const ctrl = e.ctrlKey || e.metaKey;
      if ((ctrl && ["c", "x", "v", "p", "s", "u"].includes(k)) || e.key === "F12" || (ctrl && e.shiftKey && ["i", "j", "c"].includes(k))) {
        e.preventDefault();
        if (k !== "v" && k !== "x") catat("PINTASAN");
      }
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("copy", onCopy);
    document.addEventListener("contextmenu", onMenu);
    // HANYA keydown: dulu `keyup` ikut dipasang sehingga satu pintasan tercatat dua kali
    // (temuan user 23 Sep 2026 — jejak "Pintasan keyboard terlarang" berpasangan).
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("contextmenu", onMenu);
      window.removeEventListener("keydown", onKey);
    };
  }, [aktif, id]);

  async function kumpulkanManual() {
    if (!m || submitting) return;
    const belum = m.peta.filter(p => !terisi(jawaban[p.id])).length;
    const nRagu = m.peta.filter(p => ragu.has(p.id)).length;
    const bagian = [belum > 0 ? `${belum} soal belum dijawab` : "", nRagu > 0 ? `${nRagu} soal masih ditandai ragu-ragu` : ""].filter(Boolean);
    const msg = bagian.length
      ? `Masih ada ${bagian.join(" dan ")}. Yakin kumpulkan sekarang? Jawaban tidak bisa diubah setelah dikumpulkan.`
      : "Kumpulkan ujian sekarang? Jawaban tidak bisa diubah setelah dikumpulkan.";
    if (!(await confirmDialog(msg))) return;
    kumpulkan.current(false);
  }

  const aturanAudio: AturanAudio | undefined = m && (m.batasPutarAudio ?? 0) > 0 ? {
    batas: m.batasPutarAudio ?? 0,
    hitungan: putarAudio,
    minta: async ({ questionId, stimulusId }) => {
      const r = await fetchUjian(`/api/student/exams/${id}/putar-audio`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionId, stimulusId }),
      }).catch(() => null);
      if (!r?.ok) return false;
      const d = await r.json().catch(() => null);
      const kunci = stimulusId ? `stim:${stimulusId}` : questionId;
      setPutarAudio(p => ({ ...p, [kunci]: (p[kunci] ?? 0) + 1 }));
      return typeof d?.sisa === "number" ? d.sisa : 99;
    },
  } : undefined;

  if (loading) return <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;

  /* ================= DIKUNCI / PERANGKAT LAIN ================= */
  if (blokir) return (
    <div className="p-6 lg:p-8 max-w-lg mx-auto">
      <div className="rounded-2xl border border-purple-200 bg-white shadow-lg p-6 text-center mt-6">
        <div className="w-14 h-14 rounded-full bg-purple-50 flex items-center justify-center mx-auto mb-3">
          {blokir.kode === "PERANGKAT" ? <MonitorSmartphone size={26} className="text-purple-700" /> : <Lock size={26} className="text-purple-700" />}
        </div>
        <p className="font-heading font-bold text-gray-800 text-lg">{blokir.kode === "PERANGKAT" ? "Ujian Terbuka di Perangkat Lain" : "Pengerjaan Dikunci"}</p>
        <p className="text-sm text-gray-600 mt-2 leading-relaxed">{blokir.pesan}</p>
        <p className="text-xs text-gray-400 mt-3">Jawaban yang sudah Anda isi tetap aman. Angkat tangan dan panggil pengawas.</p>
        <button onClick={() => { setLoading(true); muat().catch(() => setLoading(false)); }} className="btn-modal-save mt-5">
          <RefreshCw size={15} /> Coba Lagi
        </button>
      </div>
    </div>
  );

  if (aktif && adaLayarPenuh && !layarPenuh) return (
    <div className="p-6 lg:p-8 max-w-lg mx-auto">
      <div className="rounded-2xl border border-primary-100 bg-white shadow-lg p-6 text-center mt-6">
        <div className="w-14 h-14 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-3">
          <Maximize2 size={26} className="text-primary-700" />
        </div>
        <p className="font-heading font-bold text-gray-800 text-lg">Masuk Layar Penuh</p>
        <p className="text-sm text-gray-600 mt-2 leading-relaxed">
          Ujian dikerjakan dalam layar penuh. Keluar dari layar penuh tercatat sebagai pelanggaran.
        </p>
        <p className="text-xs text-gray-400 mt-3">Jam ujian tetap berjalan. Jawaban Anda aman.</p>
        <button onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})} className="btn-modal-save mt-5">
          <Maximize2 size={15} /> Lanjutkan Ujian
        </button>
      </div>
    </div>
  );

  if (error || !m) return (
    <div className="p-6 lg:p-8">
      <div className="bg-red-50 border border-red-100 text-red-600 rounded-xl p-4 text-sm">{error || "Ujian tidak ditemukan"}</div>
      <TombolKembali href={"/ujian-online"} className="inline-flex items-center gap-2 mt-4 px-3 py-2 rounded-lg hover:bg-gray-100 text-gray-500 text-sm font-semibold" />
    </div>
  );

  const genting = sisa < 300;
  const terjawab = m.peta.filter(p => terisi(jawaban[p.id])).length;

  /* ================= SETELAH DIKUMPULKAN =================
   * Peserta TIDAK ditunjukkan soal, jawaban, maupun benar/salahnya (keputusan user 13 Sep 2026) —
   * `muat` langsung mengalihkan ke beranda peserta; ini hanya tampilan singkat selama berpindah. */
  if (m.submitted) {
    return (
      <div className="p-6 lg:p-8 flex flex-col items-center justify-center min-h-[50vh] gap-2 text-gray-500">
        <Loader2 size={24} className="animate-spin" />
        <p className="text-sm">Ujian sudah dikumpulkan. Mengalihkan ke beranda peserta...</p>
      </div>
    );
  }

  /** Tombol alat di bilah atas — SATU tinggi (40px) supaya sebaris rapi di HP. */
  const alatUjian = (aktif: boolean) =>
    `flex items-center justify-center gap-1.5 h-10 min-w-10 px-2.5 rounded-xl border text-xs font-semibold transition ${aktif ? "bg-primary-700 text-white border-primary-700" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`;

  const tombolRagu = (qid: string) => {
    const on = ragu.has(qid);
    return (
      <button type="button" onClick={() => toggleRagu(qid)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-semibold transition ${on ? "bg-amber-400 border-amber-400 text-white" : "bg-white border-amber-200 text-amber-700 hover:bg-amber-50"}`}>
        <Flag size={14} /> {on ? "Ragu-ragu" : "Tandai ragu-ragu"}
      </button>
    );
  };

  /* ================= SEDANG MENGERJAKAN ================= */
  return (
    <div className="p-4 lg:p-6 select-none">
      {/* watermark identitas — di atas konten tapi tidak menghalangi klik */}
      {m.peserta && (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-40 overflow-hidden print:hidden">
          <div className="absolute -inset-[50%] flex flex-wrap content-start gap-x-28 gap-y-24 -rotate-[24deg] opacity-[0.055]">
            {Array.from({ length: 90 }).map((_, i) => (
              <span key={i} className="font-heading font-bold text-primary-900 text-sm whitespace-nowrap">{m.peserta!.nama} · {m.peserta!.nis}</span>
            ))}
          </div>
        </div>
      )}

      {/* bilah atas: waktu, kemajuan, status simpan.
          HP & tablet (< lg): baris 1 = judul + sisa waktu, baris 2 = alat. Layar lebar: satu baris.
          Judul TIDAK boleh ikut mengecil demi alat (temuan user 21 Sep 2026: judul terjepit jadi satu kolom sempit). */}
      <div className="sticky top-0 z-30 bg-cream/95 backdrop-blur pt-2 pb-3 mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="font-heading font-bold text-primary-900 truncate leading-snug">
            {m.kegiatan && <span className="badge badge-gold mr-1.5 align-middle" title={m.kegiatan.nama}>{m.kegiatan.singkatan}</span>}{m.title}
          </p>
          <p className="text-xs text-gray-500">{m.subject} · {terjawab}/{m.jumlah} terjawab{ragu.size ? ` · ${ragu.size} ragu-ragu` : ""} ·
            <span className={tersimpan === "lokal" ? "text-red-600 font-semibold" : "text-gray-400"}> {tersimpan === "menyimpan" ? "menyimpan..." : tersimpan === "lokal" ? `${menunggu} jawaban tersimpan di perangkat, dikirim saat tersambung` : "tersimpan"}</span>
          </p>
        </div>
        <span className={`order-2 lg:order-3 shrink-0 flex items-center gap-1.5 h-10 font-mono font-bold text-lg px-3 rounded-xl border angka ${genting ? "bg-red-50 text-red-600 border-red-200 animate-pulse" : "bg-primary-50 text-primary-700 border-primary-100"}`}>
          <Timer size={16} /> {fmtClock(sisa)}
        </span>
        <div className="order-3 lg:order-2 w-full lg:w-auto flex flex-wrap items-center gap-2">
          <span className={`flex items-center gap-1.5 h-10 px-2.5 rounded-xl border text-xs font-semibold ${koneksi === "online" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"}`}
            title={koneksi === "online" ? "Tersambung ke server" : "Terputus — jawaban tetap disimpan di perangkat ini"}>
            {koneksi === "online" ? <Wifi size={14} /> : <WifiOff size={14} />}
            <span className={koneksi === "online" ? "hidden sm:inline" : ""}>{koneksi === "online" ? "Tersambung" : "Terputus"}</span>
          </span>
          <div className="hidden sm:flex h-10 items-center rounded-xl border border-gray-200 bg-white overflow-hidden">
            <button onClick={() => gantiUkuran(-1)} disabled={ukuran === 0} className="h-full px-2.5 text-gray-500 hover:bg-gray-50 disabled:opacity-30" title="Perkecil huruf"><AArrowDown size={15} /></button>
            <button onClick={() => gantiUkuran(1)} disabled={ukuran === SKALA.length - 1} className="h-full px-2.5 text-gray-500 hover:bg-gray-50 disabled:opacity-30 border-l border-gray-200" title="Perbesar huruf"><AArrowUp size={15} /></button>
          </div>
          {m.izinKalkulator && (
            <button onClick={() => setBukaKalkulator(v => !v)} title="Kalkulator" className={alatUjian(bukaKalkulator)}>
              <Calculator size={15} /> <span className="hidden xl:inline">Kalkulator</span>
            </button>
          )}
          {m.izinCoretan && (
            <button onClick={() => setBukaCoretan(v => !v)} title="Kertas coretan" className={alatUjian(bukaCoretan)}>
              <PencilLine size={15} /> <span className="hidden xl:inline">Coretan</span>
            </button>
          )}
          {pesanPengawas.length > 0 && (
            <button onClick={() => setRiwayatPesan(v => !v)} title="Pesan pengawas" className={`relative ${alatUjian(riwayatPesan)}`}>
              <Megaphone size={15} /> <span className="hidden xl:inline">Pesan</span>
              {jumlahPesanBaru > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[11px] leading-[18px] text-center">{jumlahPesanBaru}</span>}
            </button>
          )}
          <button onClick={() => setPetaBuka(v => !v)} className={`lg:hidden ${alatUjian(petaBuka)}`}><Grid3x3 size={15} /> Nomor</button>
          <button onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})} className={`hidden sm:flex ${alatUjian(false)}`} title="Layar penuh"><Maximize2 size={15} /></button>
        </div>
      </div>
      {/* PESAN PENGAWAS — yang belum dibaca tampil menonjol; nomor soal diterjemahkan ke urutan acak siswa ini. */}
      {(riwayatPesan ? pesanPengawas : pesanBaru.slice(0, 1)).map(p => {
        const nomorSoal = p.questionId ? m.peta.find(x => x.id === p.questionId)?.nomor ?? null : null;
        const baru = !pesanDibaca.has(p.id);
        return (
          <div key={p.id} role={baru ? "alert" : undefined}
            className={`mb-3 rounded-xl border px-4 py-3 flex items-start gap-3 ${baru ? "border-blue-300 bg-blue-50 text-blue-900 shadow-panel" : "border-gray-200 bg-white text-gray-700"}`}>
            <Megaphone size={18} className={`shrink-0 mt-0.5 ${baru ? "text-blue-700" : "text-gray-400"}`} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-blue-800">
                Pesan pengawas · {new Date(p.waktu).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                {nomorSoal && <> · Soal no. {nomorSoal}</>}
                {!riwayatPesan && jumlahPesanBaru > 1 && <span className="font-normal text-blue-700"> · +{jumlahPesanBaru - 1} pesan lain</span>}
              </p>
              <p className="text-sm sm:text-base font-medium whitespace-pre-wrap">{p.teks}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 shrink-0">
              {nomorSoal && (
                <button type="button" onClick={() => { bukaNomor(nomorSoal); tandaiPesanDibaca(p.id); }} className="btn-modal-cancel text-xs">Buka soal {nomorSoal}</button>
              )}
              {baru && <button type="button" onClick={() => tandaiPesanDibaca(p.id)} className="btn-modal-save text-xs">Mengerti</button>}
            </div>
          </div>
        );
      })}

      {infoPerbaikan && (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 flex items-center gap-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="shrink-0" />
          <span className="flex-1">{infoPerbaikan}</span>
          <button onClick={() => setInfoPerbaikan("")} className="text-xs font-semibold hover:underline shrink-0">Tutup</button>
        </div>
      )}

      {peringatan && (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-sm px-4 py-2 flex items-center gap-2">
          <AlertTriangle size={16} className="shrink-0" /> <span className="flex-1">{peringatan} {pelanggaran > 0 && <span className="text-xs text-amber-600">({pelanggaran} catatan)</span>}</span>
          <button onClick={() => setPeringatan("")} className="ml-auto text-xs underline shrink-0">tutup</button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_16rem]">
        {/* soal */}
        <div>
          <div style={{ zoom: SKALA[ukuran] }}>
            {m.description && nomor === 1 && <div className="panel p-4 mb-4 text-sm text-gray-600">{m.description}</div>}
            {memuatSoal ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-10 flex justify-center text-gray-400"><Loader2 size={22} className="animate-spin" /></div>
            ) : m.satuSoalPerHalaman ? (
              soalAktif && <SoalTampil soal={soalAktif} jawaban={jawaban[soalAktif.id] ?? null} onJawab={j => jawab(soalAktif.id, j)} audio={aturanAudio} examId={id} />
            ) : (
              <div className="space-y-4">{m.soal.map(s => (
                <div key={s.id} id={`soal-${s.id}`}>
                  <SoalTampil soal={s} jawaban={jawaban[s.id] ?? null} onJawab={j => jawab(s.id, j)} audio={aturanAudio} examId={id} />
                  <div className="flex justify-end mt-2">{tombolRagu(s.id)}</div>
                </div>
              ))}</div>
            )}
          </div>

          <div className={m.satuSoalPerHalaman ? "grid grid-cols-2 gap-2 mt-4 sm:flex sm:items-center sm:justify-between sm:gap-3" : "flex flex-wrap items-center justify-between gap-3 mt-4"}>
            {m.satuSoalPerHalaman ? (
              <>
                <button onClick={() => bukaNomor(Math.max(1, nomor - 1))} disabled={nomor <= 1} className="btn-modal-cancel gap-1 disabled:opacity-40"><ArrowLeft size={14} /> Sebelumnya</button>
                {soalAktif && <div className="col-span-2 order-last sm:order-none [&>button]:w-full [&>button]:justify-center sm:[&>button]:w-auto">{tombolRagu(soalAktif.id)}</div>}
                {nomor < m.jumlah ? (
                  <button onClick={() => bukaNomor(nomor + 1)} className="btn-modal-save gap-1">Berikutnya <ArrowRight size={14} /></button>
                ) : (
                  <button onClick={kumpulkanManual} disabled={submitting} className="btn-modal-save">{submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Kumpulkan</button>
                )}
              </>
            ) : (
              <button onClick={kumpulkanManual} disabled={submitting} className="btn-modal-save ml-auto">{submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Kumpulkan Ujian</button>
            )}
          </div>
        </div>

        {/* peta nomor */}
        <aside className={`${petaBuka ? "block" : "hidden"} lg:block`}>
          <div className="panel p-4 lg:sticky lg:top-20">
            <p className="text-xs font-bold text-primary-900 uppercase tracking-wide mb-2">Nomor soal</p>
            <div className="grid grid-cols-6 lg:grid-cols-5 gap-1.5">
              {m.peta.map(p => {
                const sudah = terisi(jawaban[p.id]);
                const rg = ragu.has(p.id);
                const aktifNo = m.satuSoalPerHalaman ? p.nomor === nomor : false;
                return (
                  <button key={p.id} onClick={() => { bukaNomor(p.nomor); setPetaBuka(false); if (!m.satuSoalPerHalaman) document.getElementById(`soal-${p.id}`)?.scrollIntoView({ behavior: "smooth" }); }}
                    className={`relative h-8 rounded-lg text-xs font-bold border transition ${aktifNo ? "ring-2 ring-primary-500 ring-offset-1" : ""} ${rg ? "bg-amber-400 border-amber-400 text-white" : sudah ? "bg-emerald-500 border-emerald-500 text-white" : aktifNo ? "bg-primary-700 border-primary-700 text-white" : "bg-white border-gray-200 text-gray-500 hover:border-primary-300"}`}>
                    {p.nomor}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 text-xs text-gray-400 space-y-0.5">
              <p><span className="inline-block w-3 h-3 rounded bg-emerald-500 align-middle mr-1" /> sudah dijawab</p>
              <p><span className="inline-block w-3 h-3 rounded bg-amber-400 align-middle mr-1" /> ragu-ragu</p>
              <p><span className="inline-block w-3 h-3 rounded border border-gray-300 align-middle mr-1" /> belum dijawab</p>
            </div>
            {m.satuSoalPerHalaman && (
              <button onClick={kumpulkanManual} disabled={submitting} className="btn-modal-save w-full mt-4">
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Kumpulkan
              </button>
            )}
          </div>
        </aside>
      </div>

      {bukaCoretan && m.izinCoretan && <KertasCoretan kunci={`coretan-ujian:${id}`} onTutup={() => setBukaCoretan(false)} />}
      {bukaKalkulator && m.izinKalkulator && <KalkulatorUjian onTutup={() => setBukaKalkulator(false)} />}
    </div>
  );
}
