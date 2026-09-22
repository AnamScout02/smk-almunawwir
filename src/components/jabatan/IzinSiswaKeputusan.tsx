"use client";
import { useCallback, useEffect, useState } from "react";
import { CalendarX, Check, CheckCircle2, Clock, Loader2, Paperclip, X, XCircle } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import Modal from "@/components/admin/Modal";
import { useToast } from "@/components/shared/ToastProvider";

interface Pengajuan {
  id: string; jenis: string; status: string; alasan: string; lampiran: boolean; tanggalMulai: string; tanggalSelesai: string;
  namaPengaju: string; namaPemutus: string | null; diputuskanPada: string | null; catatanPemutus: string | null; createdAt: string;
  siswa: string; nis: string; kelas: string; bolehPutuskan: boolean;
}

const STATUS: Record<string, { label: string; kelas: string; ikon: typeof Clock }> = {
  MENUNGGU: { label: "Menunggu", kelas: "bg-amber-50 text-amber-700 border-amber-200", ikon: Clock },
  DISETUJUI: { label: "Disetujui", kelas: "bg-emerald-50 text-emerald-700 border-emerald-200", ikon: CheckCircle2 },
  DITOLAK: { label: "Ditolak", kelas: "bg-red-50 text-red-600 border-red-200", ikon: XCircle },
  DIBATALKAN: { label: "Dibatalkan", kelas: "bg-gray-50 text-gray-600 border-gray-200", ikon: X },
};
const tgl = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** IZIN / SAKIT SISWA — pengajuan orang tua dari portal. Wali kelas menyetujui/menolak (absensi terisi otomatis saat disetujui);
 * Wakasek Kesiswaan & Guru BK memantau semua kelas (17 Sep 2026). */
/** Dipakai portal GURU (pemegang tugasnya) dan portal ADMIN (superadmin — akses penuh tanpa
 * dilempar ke shell portal guru, keputusan user 19 September 2026). */
export default function IzinSiswaKeputusan() {
  const toast = useToast();
  const [tab, setTab] = useState<"MENUNGGU" | "SEMUA">("MENUNGGU");
  const [data, setData] = useState<Pengajuan[] | null>(null);
  const [tolak, setTolak] = useState<Pengajuan | null>(null);
  const [catatan, setCatatan] = useState("");
  const [sibuk, setSibuk] = useState("");

  const muat = useCallback(() => {
    setData(null);
    fetch(`/api/teacher/izin-siswa?status=${tab}`, { cache: "no-store" }).then(r => r.json())
      .then(d => setData(Array.isArray(d.daftar) ? d.daftar : [])).catch(() => setData([]));
  }, [tab]);
  useEffect(() => { muat(); }, [muat]);

  async function putuskan(p: Pengajuan, keputusan: "DISETUJUI" | "DITOLAK", cat = "") {
    setSibuk(p.id);
    const r = await fetch(`/api/teacher/izin-siswa/${p.id}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keputusan, catatan: cat }),
    }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setSibuk("");
    if (!r?.ok) { toast.error(d?.error ?? "Gagal menyimpan keputusan."); return; }
    toast.success(keputusan === "DISETUJUI" ? `Disetujui — ${d.hariDiisi} hari absensi terisi ${p.jenis === "SAKIT" ? "Sakit" : "Izin"}.` : "Pengajuan ditolak. Orang tua sudah diberi tahu.");
    setTolak(null); setCatatan("");
    muat();
  }

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<CalendarX size={22} />} title="Izin / Sakit Siswa"
        description="Pengajuan dari orang tua — setujui untuk mengisi absensi otomatis, atau tolak dengan alasan" />

      <div className="baris-alat mb-5">
        <div className="alat-tab flex w-fit gap-1 rounded-xl border border-gray-100 bg-white p-1">
          {([["MENUNGGU", "Menunggu keputusan"], ["SEMUA", "Semua pengajuan"]] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setTab(k)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${tab === k ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>{l}</button>
          ))}
        </div>
      </div>

      {!data ? (
        <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
      ) : data.length === 0 ? (
        <EmptyState icon={CalendarX} title={tab === "MENUNGGU" ? "Tidak ada pengajuan menunggu" : "Belum ada pengajuan"} description="Pengajuan izin/sakit dari orang tua akan tampil di sini dan dikabarkan lewat notifikasi." />
      ) : (
        <div className="panel overflow-hidden">
          <ul className="divide-y divide-gray-50">
            {data.map(p => {
              const st = STATUS[p.status] ?? STATUS.MENUNGGU;
              return (
                <li key={p.id} className="flex flex-wrap items-start gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-primary-900">{p.siswa} <span className="text-xs font-normal text-gray-500">· {p.kelas} · {p.nis}</span></p>
                    <p className="text-sm text-gray-700">
                      <strong>{p.jenis === "SAKIT" ? "Sakit" : "Izin"}</strong> · {tgl(p.tanggalMulai)}{p.tanggalSelesai !== p.tanggalMulai ? ` – ${tgl(p.tanggalSelesai)}` : ""}
                    </p>
                    <p className="text-sm text-gray-600">{p.alasan}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      Diajukan {p.namaPengaju} · {new Date(p.createdAt).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      {p.namaPemutus && ` · diputuskan ${p.namaPemutus}`}
                    </p>
                    {p.catatanPemutus && <p className="text-xs text-gray-600">Catatan: {p.catatanPemutus}</p>}
                    {p.lampiran && (
                      <a href={`/api/izin-siswa/${p.id}/lampiran`} target="_blank" rel="noopener" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline">
                        <Paperclip size={12} /> Lihat surat
                      </a>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {p.bolehPutuskan ? (
                      <>
                        <button type="button" onClick={() => { setTolak(p); setCatatan(""); }} disabled={sibuk === p.id} className="btn-modal-cancel">
                          <X size={15} /> Tolak
                        </button>
                        <button type="button" onClick={() => putuskan(p, "DISETUJUI")} disabled={sibuk === p.id} className="btn-modal-save">
                          {sibuk === p.id ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Setujui
                        </button>
                      </>
                    ) : (
                      <span className={`status-badge ${st.kelas}`}><st.ikon size={12} /> {st.label}</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <Modal open={!!tolak} onClose={() => setTolak(null)} title="Tolak pengajuan" description={tolak ? `${tolak.siswa} · ${tolak.kelas}` : undefined}
        footer={<>
          <button type="button" onClick={() => setTolak(null)} className="btn-modal-cancel">Batal</button>
          <button type="button" onClick={() => tolak && putuskan(tolak, "DITOLAK", catatan)} disabled={catatan.trim().length < 3 || sibuk === tolak?.id} className="btn-hapus">
            {sibuk === tolak?.id ? <Loader2 size={15} className="animate-spin" /> : <X size={15} />} Tolak Pengajuan
          </button>
        </>}>
        <label htmlFor="alasan-tolak" className="label-field">Alasan penolakan (dikirim ke orang tua)</label>
        <textarea id="alasan-tolak" value={catatan} onChange={e => setCatatan(e.target.value)} rows={3} maxLength={300} className="input-field"
          placeholder="Contoh: mohon lampirkan surat dokter karena sakit lebih dari 2 hari" />
      </Modal>
    </div>
  );
}
