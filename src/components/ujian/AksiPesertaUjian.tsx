"use client";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  History, Loader2, Lock, LockOpen, MonitorSmartphone, Send, Settings2, TimerReset, Trash2, Undo2, AlarmClockPlus, ScrollText,
} from "lucide-react";
import Modal from "@/components/admin/Modal";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { useToast } from "@/components/shared/ToastProvider";
import { teksTambahanWaktu } from "@/lib/durasi-teks";

/** PUSAT RESET per peserta — dipakai bersama Papan Pantau (per ujian) dan Ruang Kendali (semua
 * ujian), supaya tombol & aturannya cuma ada di satu tempat. Padanan menu reset CBT Admin
 * Bimasoft: Reset Login, Tambah/Reset Waktu, Buka Kembali status Selesai, Kunci/Buka Kunci,
 * Kumpulkan Paksa, Ulang dari Awal — plus Jejak Aktivitas sebagai bukti bila ada sanggahan.
 * Semua tindakan (kecuali Ulang) TIDAK menghapus jawaban. */

export type StatusPeserta = "BELUM_MULAI" | "MENGERJAKAN" | "TERPUTUS" | "TERKUNCI" | "WAKTU_HABIS" | "SELESAI";

export const LABEL_STATUS_PESERTA: Record<StatusPeserta, string> = {
  BELUM_MULAI: "Belum mulai", MENGERJAKAN: "Mengerjakan", TERPUTUS: "Terputus",
  TERKUNCI: "Terkunci", WAKTU_HABIS: "Waktu habis", SELESAI: "Selesai",
};
export const GAYA_STATUS_PESERTA: Record<StatusPeserta, string> = {
  BELUM_MULAI: "bg-gray-50 text-gray-600 border-gray-200",
  MENGERJAKAN: "bg-emerald-50 text-emerald-700 border-emerald-200",
  TERPUTUS: "bg-amber-50 text-amber-700 border-amber-200",
  TERKUNCI: "bg-purple-50 text-purple-700 border-purple-200",
  WAKTU_HABIS: "bg-red-50 text-red-600 border-red-200",
  SELESAI: "bg-blue-50 text-blue-700 border-blue-200",
};

const ARTI_JEJAK: Record<string, string> = {
  MULAI: "Mulai mengerjakan", MASUK_LAGI: "Masuk lagi dengan token", BUKA_HALAMAN: "Membuka / memuat ulang halaman ujian",
  PERANGKAT_TERDAFTAR: "Perangkat didaftarkan", DITOLAK_PERANGKAT: "Ditolak — dibuka dari perangkat lain",
  SAMBUNG_KEMBALI: "Koneksi tersambung kembali", KUNCI_OTOMATIS: "Dikunci otomatis (terputus terlalu lama)",
  KUNCI_PENGAWAS: "Dikunci pengawas", BUKA_KUNCI: "Kunci dibuka", RESET_LOGIN: "Reset login",
  TAMBAH_WAKTU: "Tambah waktu", RESET_WAKTU: "Reset waktu ke durasi penuh", BUKA_SELESAI: "Status selesai dibuka kembali",
  LANJUTKAN: "Dilanjutkan", BUKA_TERPUTUS: "Dibuka setelah terputus", PUTAR_AUDIO: "Memutar audio listening",
  KUMPUL: "Mengumpulkan", KUMPUL_OTOMATIS: "Dikumpulkan otomatis (waktu habis)", KUMPUL_PAKSA: "Dikumpulkan paksa pengawas",
  PINDAH_TAB: "Pindah tab / aplikasi", KELUAR_LAYAR_PENUH: "Keluar dari layar penuh", SALIN: "Mencoba menyalin",
  KLIK_KANAN: "Klik kanan", PRINT_SCREEN: "Menekan Print Screen", PINTASAN: "Pintasan keyboard terlarang",
};

interface Garis { jenis: string; waktu: string; ket?: string; oleh?: string; pelanggaran: boolean }
interface MuatanJejak {
  startedAt: string; submittedAt: string | null; tenggat: string; tambahanMenit: number;
  terkunci: boolean; alasanKunci: string | null; perangkat: string | null; garis: Garis[];
}

interface ButirJawaban { nomor: number; tipe: string; pertanyaan: string; isi: string; terisi: boolean }
interface MuatanJawaban {
  siswa: string; nis: string; terakhirAktif: string | null; submitted: string | null;
  jumlahSoal: number; terjawab: number; butir: ButirJawaban[];
}

const jam = (d: string) => new Date(d).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export default function AksiPesertaUjian({
  examId, studentId, nama, status, alasanKunci, onSelesai,
}: {
  examId: string; studentId: string; nama: string; status: StatusPeserta;
  alasanKunci?: string | null;
  onSelesai: () => void;
}) {
  const confirmDialog = useConfirm();
  const toast = useToast();
  const [buka, setBuka] = useState(false);
  const [menit, setMenit] = useState("10");
  const [sibuk, setSibuk] = useState<string | null>(null);
  const [jejak, setJejak] = useState<MuatanJejak | null>(null);
  const [memuatJejak, setMemuatJejak] = useState(false);
  // Jawaban sementara (23 September 2026) — MURNI BACA, tidak menyentuh pengerjaan siswa.
  const [jawaban, setJawaban] = useState<MuatanJawaban | null>(null);
  const [memuatJawaban, setMemuatJawaban] = useState(false);

  const ambilJawaban = useCallback(async (diam = false) => {
    if (!diam) setMemuatJawaban(true);
    try {
      const r = await fetch(`/api/teacher/exams/${examId}/jawaban-live?studentId=${studentId}`);
      const d = await r.json();
      if (d.error) { if (!diam) toast.error(d.error); return; }
      setJawaban(d);
    } catch { if (!diam) toast.error("Koneksi bermasalah."); }
    finally { if (!diam) setMemuatJawaban(false); }
  }, [examId, studentId, toast]);

  // Selama panel terbuka, jawaban disegarkan sendiri tiap 15 detik supaya pengawas melihat
  // perkembangan tanpa menekan apa pun — hanya membaca, tidak mengirim apa pun ke siswa.
  useEffect(() => {
    if (!buka || !jawaban) return;
    const t = setInterval(() => { ambilJawaban(true); }, 15_000);
    return () => clearInterval(t);
  }, [buka, jawaban, ambilJawaban]);

  if (status === "BELUM_MULAI") return <span className="text-gray-300 text-xs">—</span>;
  const selesai = status === "SELESAI";

  async function jalankan(aksi: string, tanya?: string) {
    if (tanya && !(await confirmDialog(tanya))) return;
    setSibuk(aksi);
    try {
      const r = await fetch(`/api/teacher/exams/${examId}/lanjutkan`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, aksi, menit: Number(menit) || 10 }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) { toast.error(d?.error ?? "Gagal."); return; }
      toast.success(d.pesan);
      setBuka(false);
      onSelesai();
    } catch { toast.error("Koneksi bermasalah."); }
    finally { setSibuk(null); }
  }

  function lihatJejak() {
    setMemuatJejak(true);
    fetch(`/api/teacher/exams/${examId}/jejak?studentId=${studentId}`)
      .then(r => r.json())
      .then(d => { if (d.error) toast.error(d.error); else setJejak(d); })
      .catch(() => {})
      .finally(() => setMemuatJejak(false));
  }

  const tombol = (aksi: string, label: string, ket: string, Ikon: React.ElementType, warna: string, tanya?: string) => (
    <button key={aksi} type="button" onClick={() => jalankan(aksi, tanya)} disabled={!!sibuk}
      className={`text-left rounded-xl border p-3 transition disabled:opacity-40 ${warna}`}>
      <span className="flex items-center gap-2 font-heading font-bold text-sm">
        {sibuk === aksi ? <Loader2 size={15} className="animate-spin" /> : <Ikon size={15} />} {label}
      </span>
      <span className="block text-xs opacity-80 mt-0.5 leading-snug">{ket}</span>
    </button>
  );

  return (
    <>
      <button type="button" onClick={() => { setBuka(true); setJejak(null); setJawaban(null); }}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-primary-100 bg-primary-50 text-primary-700 text-xs font-semibold hover:bg-primary-100 whitespace-nowrap">
        <Settings2 size={12} /> Tindakan
      </button>

      {/* Portal ke body: tabel pantau berada di dalam kartu ber-overflow, modal tidak boleh terpotong. */}
      {buka && createPortal(
        <Modal open={buka} onClose={() => setBuka(false)} title={nama} description={`Status: ${LABEL_STATUS_PESERTA[status]}`} size="xl" scrollBody
          footer={<button type="button" onClick={() => setBuka(false)} className="btn-modal-cancel flex-1">Tutup</button>}>
          <div className="space-y-4">
            {status === "TERKUNCI" && alasanKunci && (
              <div className="rounded-xl border border-purple-200 bg-purple-50 px-3.5 py-2.5 text-xs text-purple-800">{alasanKunci}</div>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              {!selesai && tombol("reset-login", "Reset Login", "Siswa terlempar keluar / pindah komputer. Kunci perangkat dilepas, jawaban tetap.", MonitorSmartphone, "border-primary-100 bg-primary-50/60 text-primary-900 hover:bg-primary-50")}
              {status === "TERKUNCI" && tombol("buka-kunci", "Buka Kunci", "Siswa boleh melanjutkan dari sisa waktunya.", LockOpen, "border-purple-200 bg-purple-50 text-purple-800 hover:bg-purple-100")}
              {!selesai && status !== "TERKUNCI" && tombol("kunci", "Kunci Sekarang", "Hentikan sementara (mis. dugaan kecurangan) sampai dibuka.", Lock, "border-gray-200 bg-white text-gray-700 hover:bg-gray-50", `Kunci pengerjaan ${nama}? Ia tidak bisa melanjutkan sampai kuncinya dibuka.`)}
              {!selesai && tombol("reset-waktu", "Reset Waktu", "Sisa waktu kembali ke durasi penuh, dihitung dari sekarang. Jawaban tetap.", TimerReset, "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100", `Kembalikan waktu ${nama} ke durasi penuh?`)}
              {selesai && tombol("buka-selesai", "Buka Kembali", `Salah pencet Kumpulkan. Status kembali Mengerjakan, sisa waktu minimal ${Number(menit) || 10} menit.`, Undo2, "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100", `Buka kembali pengerjaan ${nama}? Nilainya dikosongkan sampai ia mengumpulkan lagi.`)}
              {!selesai && tombol("kumpulkan", "Kumpulkan Paksa", "Tutup & nilai jawaban yang sudah tersimpan sekarang.", Send, "border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100", `Tutup & nilai jawaban ${nama} sekarang?`)}
              {tombol("ulang", "Ulang dari Awal", "SEMUA jawaban dihapus, siswa mulai lagi seperti belum pernah mengerjakan.", Trash2, "border-red-200 bg-red-50 text-red-700 hover:bg-red-100", `Hapus SELURUH pengerjaan ${nama}? Jawabannya hilang permanen.`)}
            </div>

            <div className="rounded-xl border border-gray-200 p-3 flex flex-wrap items-center gap-2">
              <AlarmClockPlus size={16} className="text-emerald-700" />
              <span className="text-sm font-semibold text-gray-700">{selesai ? "Sisa waktu saat dibuka kembali" : "Tambah waktu"}</span>
              <input value={menit} onChange={e => setMenit(e.target.value.replace(/\D/g, "").slice(0, 3))} inputMode="numeric" className="input-field w-20 text-center" />
              <span className="text-sm text-gray-500">menit</span>
              {!selesai && (
                <button type="button" onClick={() => jalankan("tambah-waktu")} disabled={!!sibuk || !(Number(menit) > 0)}
                  className="btn-modal-save ml-auto">
                  {sibuk === "tambah-waktu" ? <Loader2 size={14} className="animate-spin" /> : <AlarmClockPlus size={14} />} Tambahkan
                </button>
              )}
            </div>

            <div className="rounded-xl border border-gray-200">
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100">
                <span className="text-sm font-heading font-bold text-gray-800 flex items-center gap-1.5"><ScrollText size={15} /> Jawaban Sementara</span>
                <button type="button" onClick={() => ambilJawaban()} disabled={memuatJawaban} className="text-xs font-semibold text-primary-700 hover:underline disabled:opacity-40">
                  {memuatJawaban ? "Memuat..." : jawaban ? "Muat ulang" : "Tampilkan"}
                </button>
              </div>
              {jawaban && (
                <div className="p-3">
                  <p className="text-xs text-gray-500 mb-2">
                    Terjawab {jawaban.terjawab} dari {jawaban.jumlahSoal} soal
                    {jawaban.terakhirAktif ? ` · terakhir aktif ${jam(jawaban.terakhirAktif)}` : ""}
                    {jawaban.submitted ? ` · sudah dikumpulkan ${jam(jawaban.submitted)}` : ""}
                    <span className="block text-gray-400">Diperbarui otomatis tiap 15 detik. Ketikan yang belum terkirim dari perangkat siswa belum terlihat di sini.</span>
                  </p>
                  <ol className="space-y-1.5 max-h-80 overflow-y-auto scrollbar-visible pr-1">
                    {jawaban.butir.map(b => (
                      <li key={b.nomor} className="rounded-lg border border-gray-100 px-2.5 py-1.5">
                        <p className="text-xs text-gray-400">{b.nomor}. {b.pertanyaan}</p>
                        {b.terisi
                          ? <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{b.isi}</p>
                          : <p className="text-sm text-gray-300 italic">belum dijawab</p>}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-gray-200">
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100">
                <span className="text-sm font-heading font-bold text-gray-800 flex items-center gap-1.5"><History size={15} /> Jejak Aktivitas</span>
                <button type="button" onClick={lihatJejak} disabled={memuatJejak} className="text-xs font-semibold text-primary-700 hover:underline disabled:opacity-40">
                  {memuatJejak ? "Memuat..." : jejak ? "Muat ulang" : "Tampilkan"}
                </button>
              </div>
              {jejak && (
                <div className="p-3">
                  <p className="text-xs text-gray-500 mb-2">
                    Mulai {jam(jejak.startedAt)} · tenggat {jam(jejak.tenggat)}{jejak.tambahanMenit ? ` (tenggat digeser pengawas ${teksTambahanWaktu(jejak.tambahanMenit)})` : ""}
                    {jejak.perangkat ? ` · perangkat ${jejak.perangkat}` : " · belum terikat perangkat"}
                  </p>
                  {jejak.garis.length === 0 ? <p className="text-sm text-gray-400">Belum ada catatan.</p> : (
                    <ol className="space-y-1 max-h-72 overflow-y-auto scrollbar-visible pr-1">
                      {jejak.garis.map((g, i) => (
                        <li key={i} className={`flex gap-2 text-xs rounded-lg px-2 py-1 ${g.pelanggaran ? "bg-red-50 text-red-700" : "text-gray-700"}`}>
                          <span className="font-mono text-gray-400 shrink-0">{jam(g.waktu)}</span>
                          <span className="flex-1">
                            {ARTI_JEJAK[g.jenis] ?? g.jenis}
                            {g.ket && g.jenis !== "PUTAR_AUDIO" ? <span className="text-gray-400"> — {g.ket}</span> : null}
                            {g.oleh ? <span className="text-gray-400"> · oleh {g.oleh}</span> : null}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </div>
          </div>
        </Modal>,
        document.body,
      )}
    </>
  );
}
