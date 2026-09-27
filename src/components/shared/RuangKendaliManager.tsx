"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Radio, Loader2, RefreshCw, KeyRound, Users2, Wifi, WifiOff, CheckCircle2, AlertTriangle,
  ChevronDown, ChevronRight, Eye, EyeOff, ShieldAlert, TimerReset, Send, RotateCcw, Search, Shuffle, Lock, LockOpen, Megaphone,
} from "lucide-react";
import Modal from "@/components/admin/Modal";
import PesanPesertaPanel from "@/components/ujian/PesanPesertaPanel";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import EmptyState from "@/components/admin/EmptyState";
import Select from "@/components/admin/Select";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { useToast } from "@/components/shared/ToastProvider";
import AksiPesertaUjian, { LABEL_STATUS_PESERTA, GAYA_STATUS_PESERTA, type StatusPeserta } from "@/components/ujian/AksiPesertaUjian";
import { salinTeks } from "@/lib/salin-teks";
import { teksTambahanWaktu, judulTambahanWaktu } from "@/lib/durasi-teks";
import { usePantauLangsung } from "@/lib/use-pantau-langsung";

/** RUANG KENDALI UJIAN - satu layar untuk operator/pengawas memantau SEMUA ujian yang sedang
 * berjalan dan menindaknya langsung: ganti token, beri tambahan waktu, buka siswa yang terputus,
 * kumpulkan paksa, atau ulang dari awal.
 *
 * Padanan aplikasi "CBT Admin" Bimasoft, bedanya tidak perlu aplikasi desktop terpisah - dan
 * karena di web yang sama, tindakannya langsung berlaku tanpa sinkronisasi. */

interface UjianRow {
  id: string; title: string; subject: string; token: string; isPublished: boolean;
  kegiatan: { id: string; nama: string; singkatan: string } | null;
  kelas: string; guru: string; jumlahSoal: number; startTime: string; endTime: string; duration: number;
  examkey: string | null; acakSoal: boolean; acakOpsi: boolean; jumlahDikerjakan: number | null;
  status: "DRAFT" | "TERJADWAL" | "BERLANGSUNG" | "SELESAI";
  jumlahSiswa: number; belum: number; mengerjakan: number; terputus: number; selesai: number; waktuHabis: number; pelanggaran: number;
  terkunci: number; tokenOtomatisMenit: number; tokenBerganti: string | null;
  /** Token BERSAMA kegiatan — kalau terisi, INI yang dibacakan ke peserta (token ujian tetap berlaku). */
  tokenKegiatan: string | null; tokenKegiatanBerganti: string | null;
}
interface Kendali { ujian: UjianRow[]; ringkas: { ujianBerlangsung: number; mengerjakan: number; terputus: number; waktuHabis: number; selesai: number; pelanggaran: number; terkunci: number }; diperbarui: string }
interface BarisPantau {
  /** Alasan penahanan panitia (belum menyelesaikan administrasi) — src/lib/peserta-ditahan.ts. */
  ditahan?: string | null;
  student: { id: string; nis: string; user: { name: string } };
  status: StatusPeserta;
  terjawab: number; ragu: number; total: number; pelanggaran: number; lastSeenAt: string | null; score: number | null; sisaDetik: number | null;
  tambahanMenit: number; alasanKunci: string | null; menunggu: number;
}

const GAYA_STATUS: Record<string, string> = {
  BERLANGSUNG: "bg-emerald-50 text-emerald-700 border-emerald-200",
  TERJADWAL: "bg-blue-50 text-blue-700 border-blue-200",
  SELESAI: "bg-gray-50 text-gray-600 border-gray-200",
  DRAFT: "bg-amber-50 text-amber-700 border-amber-200",
};
const LABEL_STATUS: Record<string, string> = { BERLANGSUNG: "Berlangsung", TERJADWAL: "Terjadwal", SELESAI: "Selesai", DRAFT: "Draft" };
const fmtJam = (d: string) => new Date(d).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const fmtSisa = (s: number | null) => s === null ? "-" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function RuangKendaliManager({ basePath }: { basePath: string }) {
  const confirmDialog = useConfirm();
  const toast = useToast();
  const [data, setData] = useState<Kendali | null>(null);
  const [lingkup, setLingkup] = useState("aktif");
  const [buka, setBuka] = useState<string | null>(null);
  const [cari, setCari] = useState("");
  const [sibuk, setSibuk] = useState<string | null>(null);
  // Pesan ke SEMUA ujian yang sedang berlangsung (21 September 2026) — superadmin/proktor.
  const [pesanMassal, setPesanMassal] = useState(false);
  const [teksMassal, setTeksMassal] = useState("");
  const [kirimMassal, setKirimMassal] = useState(false);

  const muat = useCallback(() => {
    fetch(`/api/teacher/exams/kendali?lingkup=${lingkup}`).then(r => (r.ok ? r.json() : null)).then(d => d && setData(d)).catch(() => {});
  }, [lingkup]);
  useEffect(() => { muat(); const t = setInterval(muat, 5000); return () => clearInterval(t); }, [muat]);

  // Daftar siswa ujian yang sedang dibuka: langsung (SSE), otomatis kembali ke polling 5 detik bila perlu.
  const langsung = usePantauLangsung<{ baris: BarisPantau[] }>(buka, !!buka);

  async function kirimPesanMassal() {
    const examIds = (data?.ujian ?? []).filter(u => u.status === "BERLANGSUNG").map(u => u.id);
    if (!teksMassal.trim()) return toast.error("Tulis isi pesannya dulu.");
    setKirimMassal(true);
    const r = await fetch("/api/teacher/exams/pesan-massal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teks: teksMassal, examIds }) }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setKirimMassal(false);
    if (!r?.ok) return toast.error(d?.error ?? "Gagal mengirim pesan.");
    toast.success(`Pesan terkirim ke ${d.terkirim} ujian.`);
    setPesanMassal(false);
  }

  async function gantiToken(u: UjianRow) {
    // Memutar token YANG SEDANG DIPAKAI: kegiatan (berlaku untuk semua mapel di kegiatan itu)
    // atau, untuk ujian lepas, token ujiannya sendiri.
    const bersama = !!u.tokenKegiatan && !!u.kegiatan;
    const pesan = bersama
      ? `Ganti token bersama ${u.kegiatan?.singkatan ?? "kegiatan"}? Token ini dipakai SEMUA mata pelajaran di kegiatan itu. Siswa yang sudah masuk tidak terganggu.`
      : `Ganti token ujian "${u.title}"? Siswa yang sudah masuk tidak terganggu, tapi yang belum masuk harus memakai token baru.`;
    if (!(await confirmDialog(pesan))) return;
    setSibuk(u.id);
    const r = await fetch(bersama ? `/api/teacher/kegiatan-ujian/${u.kegiatan!.id}/token` : `/api/teacher/exams/${u.id}/token`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aksi: "buat" }),
    }).catch(() => null);
    setSibuk(null);
    const d = await r?.json().catch(() => null);
    if (!r?.ok) return toast.error(d?.error ?? "Gagal mengganti token.");
    toast.success(`Token baru: ${d.token}`); muat();
  }
  async function terbitkan(u: UjianRow) {
    const r = await fetch(`/api/teacher/exams/${u.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isPublished: !u.isPublished }) }).catch(() => null);
    if (!r?.ok) return toast.error("Gagal mengubah status.");
    toast.success(!u.isPublished ? "Ujian diterbitkan." : "Ujian ditarik dari siswa."); muat();
  }
  async function massal(u: UjianRow, aksi: "tambah-waktu" | "kumpulkan-semua" | "buka-terputus" | "buka-kunci-semua") {
    const tanya = aksi === "kumpulkan-semua" ? `Tutup & nilai SEMUA pengerjaan yang belum dikumpulkan pada "${u.title}"?`
      : aksi === "buka-kunci-semua" ? `Buka kunci ${u.terkunci} pengerjaan yang terkunci pada "${u.title}"?`
      : aksi === "buka-terputus" ? `Beri tambahan 15 menit untuk siswa yang terputus / kehabisan waktu pada "${u.title}"?`
      : `Beri tambahan 15 menit untuk SEMUA siswa yang belum mengumpulkan pada "${u.title}"?`;
    if (!(await confirmDialog(tanya))) return;
    setSibuk(u.id);
    const r = await fetch(`/api/teacher/exams/${u.id}/massal`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aksi, menit: 15 }) }).catch(() => null);
    setSibuk(null);
    const d = await r?.json().catch(() => null);
    if (!r?.ok) return toast.error(d?.error ?? "Gagal.");
    toast.success(d.pesan); muat(); if (buka) langsung.muatUlang();
  }

  const tampil = (data?.ujian ?? []).filter(u =>
    !cari || [u.title, u.kelas, u.subject, u.token, u.guru].some(x => x.toLowerCase().includes(cari.toLowerCase())));

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Radio size={22} />} title="Ruang Kendali Ujian"
        description="Semua ujian dalam satu layar - pantau peserta, ganti token, tambah waktu, buka yang terputus, kumpulkan paksa" />

      {!data ? <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-gray-400" /></div> : (
        <>
          <div className="kisi-kartu kisi-kartu-7 mb-5">
            <StatTile value={data.ringkas.ujianBerlangsung} label="Ujian Berlangsung" icon={Radio} color="primary" size="md" />
            <StatTile value={data.ringkas.mengerjakan} label="Sedang Mengerjakan" icon={Wifi} color="emerald" size="md" />
            <StatTile value={data.ringkas.terputus} label="Terputus" icon={WifiOff} color="amber" size="md" />
            <StatTile value={data.ringkas.terkunci ?? 0} label="Terkunci" icon={Lock} color="purple" size="md" />
            <StatTile value={data.ringkas.waktuHabis} label="Waktu Habis" icon={AlertTriangle} color="red" size="md" />
            <StatTile value={data.ringkas.selesai} label="Sudah Selesai" icon={CheckCircle2} color="blue" size="md" />
            <StatTile value={data.ringkas.pelanggaran} label="Catatan Pelanggaran" icon={ShieldAlert} color="gray" size="md" />
          </div>

          {/* Satu baris alat (DESIGN_SYSTEM §4.1): dulu grid tanpa kolom tegas + tombol pesan di baris sendiri. */}
          <div className="page-card p-4 mb-4 baris-alat">
            <div className="alat-cari">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari ujian, kelas, mapel, token, atau guru..." className="input-field pl-10" />
            </div>
            <div className="alat-saring">
              <Select value={lingkup} onChange={setLingkup} options={[
                { value: "aktif", label: "Hari ini & yang akan datang" },
                { value: "semua", label: "Semua ujian" },
              ]} />
            </div>
            {data.ujian.some(u => u.status === "BERLANGSUNG") && (
              <div className="alat-aksi alat-teks">
                <button type="button" onClick={() => { setTeksMassal(""); setPesanMassal(true); }} className="btn-modal-save">
                  <Megaphone /> Pesan ke Semua Ujian Berlangsung
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mb-2 text-xs text-gray-400">
            <span>Diperbarui otomatis tiap 5 detik · {new Date(data.diperbarui).toLocaleTimeString("id-ID")}</span>
            <button onClick={muat} className="flex items-center gap-1 hover:text-primary-700"><RefreshCw size={12} /> segarkan</button>
          </div>

          {tampil.length === 0 ? (
            <EmptyState icon={Radio} title="Tidak ada ujian" description={lingkup === "aktif" ? "Belum ada ujian hari ini. Ubah saringan ke Semua ujian untuk melihat arsip." : "Belum ada ujian yang dibuat."} />
          ) : (
            <div className="space-y-3">
              {tampil.map(u => {
                const terbuka = buka === u.id;
                const baris = terbuka ? (langsung.data?.baris ?? []) : [];
                const perhatian = u.terputus + u.waktuHabis + (u.terkunci ?? 0) > 0 || u.pelanggaran >= 5;
                return (
                  <div key={u.id} className={`page-card overflow-hidden ${perhatian ? "ring-1 ring-amber-200" : ""}`}>
                    {/* HP: judul → kisi angka 3×2 → token & kendali, masing-masing selebar kartu. Dulu enam angka
                        `shrink-0` sebaris (±310px) membuat kartu meluber di layar 360–390px (temuan user 21 Sep 2026). */}
                    <div className="p-4 flex flex-wrap items-start gap-x-4 gap-y-3">
                      <button onClick={() => setBuka(terbuka ? null : u.id)} className="mt-0.5 text-gray-400 hover:text-primary-700 shrink-0" title={terbuka ? "Tutup daftar siswa" : "Lihat daftar siswa"}>
                        {terbuka ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </button>
                      <div className="flex-1 min-w-0 basis-[calc(100%-2.5rem)] lg:basis-0 lg:min-w-[16rem]">
                        <div className="flex flex-wrap items-center gap-2">
                          {u.kegiatan && <span className="badge badge-gold" title={u.kegiatan.nama}>{u.kegiatan.singkatan}</span>}
                          <Link href={`${basePath}/${u.id}`} className="font-heading font-bold text-primary-900 hover:underline">{u.title}</Link>
                          <span className={`px-2 py-0.5 rounded-full border text-xs font-semibold ${GAYA_STATUS[u.status]}`}>{LABEL_STATUS[u.status]}</span>
                          {u.examkey && <span className="flex items-center gap-1 text-xs text-purple-700" title="Hanya bisa dibuka lewat browser ujian"><Lock size={11} /> examkey</span>}
                          {u.acakSoal && <span className="flex items-center gap-1 text-xs text-gray-400" title="Soal diacak per siswa"><Shuffle size={11} /> acak</span>}
                          {u.jumlahDikerjakan && <span className="text-xs text-gray-400">{u.jumlahDikerjakan} dari {u.jumlahSoal} soal</span>}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {u.kelas} · {u.subject} · {u.guru} · {u.jumlahSoal} soal · {u.duration} menit · {fmtJam(u.startTime)} s.d. {fmtJam(u.endTime)}
                        </p>
                      </div>

                      {/* hitungan cepat */}
                      <div className="grid grid-cols-3 gap-y-2 w-full text-center sm:flex sm:w-auto sm:items-center sm:gap-3 sm:shrink-0">
                        {[
                          [u.belum, "belum", "text-gray-400"],
                          [u.mengerjakan, "kerja", "text-emerald-600"],
                          [u.terputus, "putus", "text-amber-600"],
                          [u.terkunci ?? 0, "kunci", "text-purple-600"],
                          [u.waktuHabis, "habis", "text-red-600"],
                          [u.selesai, "selesai", "text-blue-600"],
                        ].map(([n, l, c], i) => (
                          <div key={i} className="min-w-[2.6rem]">
                            <p className={`font-heading font-bold text-lg leading-none ${c as string}`}>{n as number}</p>
                            <p className="text-xs text-gray-400 uppercase tracking-wide">{l as string}</p>
                          </div>
                        ))}
                      </div>

                      {/* kendali */}
                      <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto sm:shrink-0">
                        {/* SATU token saja (20 September 2026, keputusan user: "tidak perlu ada
                            berarti hilangkan"). Kegiatan yang punya token bersama memakainya; ujian
                            lepas tanpa kegiatan memakai tokennya sendiri. Token per-ujian TIDAK
                            dihapus di server — tetap diterima supaya siswa yang terlanjur memakainya
                            di tengah ujian tidak tertolak — hanya tidak lagi ditampilkan. */}
                        <button onClick={async () => { const tk = u.tokenKegiatan ?? u.token; if (await salinTeks(tk)) toast.success(`Token ${tk} disalin`); else toast.error(`Tidak bisa menyalin otomatis. Token: ${tk}`); }}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl font-mono font-bold text-sm ${u.tokenKegiatan ? "bg-gold/15 border border-gold/40 text-gold-dark" : "bg-primary-50 border border-primary-100 text-primary-700"}`}
                          title={u.tokenKegiatan ? `Token bersama ${u.kegiatan?.singkatan ?? "kegiatan"} — berlaku untuk semua mapel di kegiatan ini` : "Salin token"}>
                          <KeyRound size={13} /> {u.tokenKegiatan ?? u.token}
                        </button>
                        {(u.tokenKegiatan ? u.tokenKegiatanBerganti : u.tokenBerganti) && (
                          <span className="text-xs text-gray-400 whitespace-nowrap" title="Token berganti otomatis">
                            ganti {new Date((u.tokenKegiatan ? u.tokenKegiatanBerganti : u.tokenBerganti)!).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                        <button onClick={() => gantiToken(u)} disabled={sibuk === u.id} className="p-1.5 text-gray-400 hover:text-primary-700 rounded-lg hover:bg-primary-50 disabled:opacity-40" title="Ganti token (kalau bocor)">
                          {sibuk === u.id ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                        </button>
                        <button onClick={() => terbitkan(u)} className={`p-1.5 rounded-lg ${u.isPublished ? "text-emerald-600 hover:bg-emerald-50" : "text-gray-400 hover:bg-gray-50"}`} title={u.isPublished ? "Tarik dari siswa" : "Terbitkan"}>
                          {u.isPublished ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                      </div>
                    </div>

                    {/* tindakan massal + daftar siswa */}
                    {terbuka && (
                      <div className="border-t border-gray-100">
                        <div className="px-4 py-3 bg-gray-50/60 flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-gray-500 mr-1">Tindakan untuk satu kelas:</span>
                          <button onClick={() => massal(u, "buka-terputus")} disabled={sibuk === u.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-xs font-semibold hover:bg-amber-100 disabled:opacity-40">
                            <WifiOff size={13} /> Buka yang terputus +15m
                          </button>
                          <button onClick={() => massal(u, "tambah-waktu")} disabled={sibuk === u.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 disabled:opacity-40">
                            <TimerReset size={13} /> Tambah 15 menit untuk semua
                          </button>
                          {(u.terkunci ?? 0) > 0 && (
                            <button onClick={() => massal(u, "buka-kunci-semua")} disabled={sibuk === u.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-purple-200 bg-purple-50 text-purple-800 text-xs font-semibold hover:bg-purple-100 disabled:opacity-40">
                              <LockOpen size={13} /> Buka {u.terkunci} yang terkunci
                            </button>
                          )}
                          <button onClick={() => massal(u, "kumpulkan-semua")} disabled={sibuk === u.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 disabled:opacity-40">
                            <Send size={13} /> Kumpulkan semua sekarang
                          </button>
                          <span className="w-full sm:w-auto sm:ml-auto flex items-center text-xs text-gray-400">{langsung.mode === "langsung" ? <><span className="live-dot text-emerald-500 mr-1" />Langsung</> : langsung.mode === "menyambung" ? "Menyambung…" : "Diperbarui tiap 5 detik"}</span>
                          <Link href={`${basePath}/${u.id}?tab=pantau`} className="text-xs font-semibold text-primary-700 hover:underline">Buka papan pantau lengkap →</Link>
                        </div>
                        <div className="px-4 pt-3"><PesanPesertaPanel examId={u.id} /></div>
                        {baris.length === 0 ? (
                          <div className="p-6 flex justify-center text-gray-400"><Loader2 size={20} className="animate-spin" /></div>
                        ) : (
                          <div className="overflow-auto max-h-96 scrollbar-visible">
                            <table className="data-table">
                              <thead><tr><th>Siswa</th><th>Status</th><th>Kemajuan</th><th>Ragu</th><th>Sisa</th><th>Pelanggaran</th><th>Nilai</th><th>Tindakan</th></tr></thead>
                              <tbody>
                                {baris.map(b => (
                                  <tr key={b.student.id} className={b.pelanggaran >= 3 ? "bg-red-50/40" : ""}>
                                    <td><span className="font-medium">{b.student.user.name}</span><span className="block text-xs text-gray-400">{b.student.nis}</span></td>
                                    <td>{b.ditahan
                        ? <span title={b.ditahan} className="px-2 py-0.5 rounded-full border text-xs font-semibold whitespace-nowrap bg-rose-50 text-rose-700 border-rose-200">Ditahan<span className="block font-normal max-w-[10rem] whitespace-normal">{b.ditahan}</span></span>
                        : <span className={`px-2 py-0.5 rounded-full border text-xs font-semibold whitespace-nowrap ${GAYA_STATUS_PESERTA[b.status]}`}>{LABEL_STATUS_PESERTA[b.status]}</span>}</td>
                                    <td><div className="flex items-center gap-2"><div className="w-20 h-2 rounded-full bg-gray-100 overflow-hidden"><div className="h-full bg-primary-700" style={{ width: `${b.total ? (b.terjawab / b.total) * 100 : 0}%` }} /></div><span className="text-xs">{b.terjawab}/{b.total}</span></div></td>
                                    <td className="text-center">{b.ragu > 0 ? <span className="font-bold text-amber-600">{b.ragu}</span> : <span className="text-gray-300">0</span>}</td>
                                    <td className="font-mono text-sm whitespace-nowrap">
                                      {b.status === "MENGERJAKAN" || b.status === "TERPUTUS" || b.status === "TERKUNCI" ? fmtSisa(langsung.sisa(b.sisaDetik)) : "-"}
                                      {b.tambahanMenit > 0 && <span className="ml-1 text-xs font-sans font-semibold text-emerald-600" title={judulTambahanWaktu(b.tambahanMenit)}>{teksTambahanWaktu(b.tambahanMenit)}</span>}
                                    </td>
                                    <td className="text-center">{b.pelanggaran > 0 ? <span className={`font-bold ${b.pelanggaran >= 3 ? "text-red-600" : "text-amber-700"}`}>{b.pelanggaran}</span> : <span className="text-gray-300">0</span>}</td>
                                    <td className="text-center font-bold text-primary-900">{b.score ?? "-"}{b.menunggu > 0 && <span className="block text-xs font-semibold text-amber-600" title={`${b.menunggu} soal belum dikoreksi`}>sementara</span>}</td>
                                    <td>
                                      <AksiPesertaUjian examId={u.id} studentId={b.student.id} nama={b.student.user.name} status={b.status} alasanKunci={b.alasanKunci} onSelesai={() => { langsung.muatUlang(); muat(); }} />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-5 rounded-xl bg-primary-50 p-4 text-xs text-primary-900">
            <p className="font-semibold mb-1 flex items-center gap-1.5"><Users2 size={13} /> Catatan pemakaian</p>
            <ul className="space-y-0.5 text-primary-700">
              <li>· <b>Terputus</b> = lebih dari 60 detik tidak ada denyut dari komputer siswa (halaman ujian berdenyut tiap 20 detik). Jawaban tetap aman — yang belum terkirim disimpan di perangkat siswa dan dikirim ulang saat tersambung.</li>
              <li>· <b>Terkunci</b> = dikunci pengawas, atau terputus lebih lama dari batas di Pengaturan Ujian. Buka lewat Tindakan → Buka Kunci.</li>
              <li>· <b>Ganti token</b> tidak mengganggu siswa yang sudah masuk; token sebelumnya masih diterima 2 menit.</li>
              <li>· <b>Tambah waktu</b> berlaku khusus siswa yang diberi — jam tutup ujian tidak digeser, siswa lain tidak ikut bertambah waktunya.</li>
              <li>· <b>Reset Login</b> dipakai kalau siswa pindah komputer. <b>Ulang dari Awal</b> menghapus seluruh jawabannya.</li>
            </ul>
          </div>
        </>
      )}

      <Modal open={pesanMassal} onClose={() => setPesanMassal(false)} title="Pesan ke Semua Ujian Berlangsung" size="lg"
        description={`Dikirim ke ${data?.ujian.filter(u => u.status === "BERLANGSUNG").length ?? 0} ujian — tampil di layar peserta dalam beberapa detik`}
        footer={<>
          <button type="button" onClick={() => setPesanMassal(false)} className="btn-modal-cancel">Batal</button>
          <button type="button" disabled={kirimMassal} onClick={kirimPesanMassal} className="btn-modal-save">{kirimMassal ? <Loader2 className="animate-spin" /> : <Send />} Kirim</button>
        </>}>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {["Waktu tersisa 10 menit.", "Waktu tersisa 5 menit. Periksa kembali jawaban Anda.", "Jangan lupa menekan Kumpulkan setelah selesai."].map(t => (
              <button key={t} type="button" onClick={() => setTeksMassal(t)}
                className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-600 hover:bg-primary-50 hover:text-primary-700">{t}</button>
            ))}
          </div>
          <label className="label-field" htmlFor="pesan-massal">Isi pesan</label>
          <textarea id="pesan-massal" value={teksMassal} onChange={e => setTeksMassal(e.target.value)} rows={3} maxLength={500} className="input-field w-full" />
          <p className="text-xs text-gray-500">Untuk kelas, jurusan, ruang, atau siswa tertentu, buka ujiannya lalu pakai &ldquo;Pesan ke Peserta&rdquo;.</p>
        </div>
      </Modal>
    </div>
  );
}
