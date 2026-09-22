import { CheckCircle2, Clock, FileClock, Undo2 } from "lucide-react";

/** Label status Form Nilai Rapor (Belum diisi · Draf · Dikembalikan · Terkirim) — dipakai daftar form, lembar isian, dan Rapor Kelas. */
export default function StatusForm({ status, dikembalikan }: { status: string; dikembalikan?: boolean }) {
  if (status === "DIKIRIM") return <span className="status-badge bg-emerald-50 text-emerald-700 border-emerald-200"><CheckCircle2 size={12} /> Terkirim</span>;
  if (dikembalikan) return <span className="status-badge bg-red-50 text-red-600 border-red-200"><Undo2 size={12} /> Dikembalikan</span>;
  if (status === "DRAF") return <span className="status-badge bg-amber-50 text-amber-700 border-amber-200"><FileClock size={12} /> Draf</span>;
  return <span className="status-badge bg-gray-50 text-gray-500 border-gray-200"><Clock size={12} /> Belum diisi</span>;
}

