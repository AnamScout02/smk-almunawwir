"use client";
import { useCallback, useEffect, useState } from "react";
import { CalendarX, CheckCircle2, Clock, FileText, Loader2, Paperclip, Send, X, XCircle } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import DatePicker from "@/components/shared/DatePicker";
import EmptyState from "@/components/admin/EmptyState";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";

interface Anak { id: string; nama: string; kelas: string }
interface Pengajuan {
  id: string; studentId: string; jenis: string; tanggalMulai: string; tanggalSelesai: string; alasan: string; lampiran: boolean;
  status: string; namaPemutus: string | null; diputuskanPada: string | null; catatanPemutus: string | null; createdAt: string;
}
interface Data { anak: Anak[]; daftar: Pengajuan[]; aturan: { maksHari: number; sakitWajibSuratLebihDari: number; hariIni: string } }

const STATUS: Record<string, { label: string; kelas: string; ikon: typeof Clock }> = {
  MENUNGGU: { label: "Menunggu wali kelas", kelas: "bg-amber-50 text-amber-700 border-amber-200", ikon: Clock },
  DISETUJUI: { label: "Disetujui", kelas: "bg-emerald-50 text-emerald-700 border-emerald-200", ikon: CheckCircle2 },
  DITOLAK: { label: "Ditolak", kelas: "bg-red-50 text-red-600 border-red-200", ikon: XCircle },
  DIBATALKAN: { label: "Dibatalkan", kelas: "bg-gray-50 text-gray-600 border-gray-200", ikon: X },
};
const tgl = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** AJUKAN IZIN / SAKIT — orang tua mengajukan ketidakhadiran anak dengan lampiran foto surat; wali kelas menyetujui dan absensi
 * terisi otomatis (17 Sep 2026). */
export default function IzinOrangTuaPage() {
  const toast = useToast();
  const confirmDialog = useConfirm();
  const [data, setData] = useState<Data | null>(null);
  const [anak, setAnak] = useState("");
  const [jenis, setJenis] = useState("");
  const [mulai, setMulai] = useState("");
  const [selesai, setSelesai] = useState("");
  const [alasan, setAlasan] = useState("");
  const [lampiran, setLampiran] = useState<{ berkas: string; nama: string } | null>(null);
  const [mengunggah, setMengunggah] = useState(false);
  const [mengirim, setMengirim] = useState(false);

  const muat = useCallback(() => {
    fetch("/api/parent/izin", { cache: "no-store" }).then(r => r.json()).then((d: Data) => {
      setData(d);
      setAnak(a => a || d.anak[0]?.id || "");
      setMulai(m => m || d.aturan.hariIni);
    }).catch(() => {});
  }, []);
  useEffect(() => { muat(); }, [muat]);

  async function unggah(file: File) {
    setMengunggah(true);
    const fd = new FormData();
    fd.set("file", file);
    const r = await fetch("/api/izin-siswa/lampiran", { method: "POST", body: fd }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setMengunggah(false);
    if (!r?.ok) { toast.error(d?.error ?? "Lampiran gagal diunggah."); return; }
    setLampiran({ berkas: d.berkas, nama: file.name });
  }

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    if (!anak || !jenis || !mulai) { toast.warning("Lengkapi anak, jenis, dan tanggal."); return; }
    setMengirim(true);
    const r = await fetch("/api/parent/izin", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: anak, jenis, tanggalMulai: mulai, tanggalSelesai: selesai || mulai, alasan, lampiran: lampiran?.berkas ?? "" }),
    }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setMengirim(false);
    if (!r?.ok) { toast.error(d?.error ?? "Pengajuan gagal dikirim."); return; }
    toast.success("Pengajuan terkirim ke wali kelas.");
    setJenis(""); setSelesai(""); setAlasan(""); setLampiran(null);
    muat();
  }

  async function batalkan(p: Pengajuan) {
    if (!(await confirmDialog("Batalkan pengajuan ini?"))) return;
    const r = await fetch(`/api/parent/izin/${p.id}`, { method: "DELETE" }).catch(() => null);
    const d = await r?.json().catch(() => null);
    if (!r?.ok) { toast.error(d?.error ?? "Gagal membatalkan."); return; }
    toast.success("Pengajuan dibatalkan.");
    muat();
  }

  if (!data) return <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;
  const namaAnak = (id: string) => data.anak.find(a => a.id === id)?.nama ?? "-";

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<CalendarX size={22} />} title="Ajukan Izin / Sakit"
        description="Beri tahu wali kelas bila ananda tidak dapat hadir — absensi terisi otomatis setelah disetujui" />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 items-start">
        <form onSubmit={kirim} className="panel p-5 space-y-4 xl:col-span-5">
          <h3 className="font-heading font-semibold text-primary-900">Pengajuan baru</h3>
          {data.anak.length > 1 && (
            <div>
              <label className="label-field">Anak</label>
              <Select value={anak} onChange={setAnak} options={data.anak.map(a => ({ value: a.id, label: `${a.nama} — ${a.kelas}` }))} />
            </div>
          )}
          <div>
            <label className="label-field">Jenis</label>
            <div className="grid grid-cols-2 gap-2">
              {[["SAKIT", "Sakit"], ["IZIN", "Izin (keperluan lain)"]].map(([v, l]) => (
                <button key={v} type="button" onClick={() => setJenis(v)} aria-pressed={jenis === v}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${jenis === v ? "border-primary-900 bg-primary-900 text-white" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label-field">Mulai tanggal</label>
              <DatePicker value={mulai} onChange={setMulai} />
            </div>
            <div>
              <label className="label-field">Sampai tanggal</label>
              <DatePicker value={selesai} onChange={setSelesai} />
              <p className="text-xs text-gray-500 mt-1">Kosongkan bila hanya satu hari.</p>
            </div>
          </div>
          <div>
            <label htmlFor="alasan-izin" className="label-field">Alasan</label>
            <textarea id="alasan-izin" value={alasan} onChange={e => setAlasan(e.target.value)} rows={3} maxLength={500} className="input-field"
              placeholder="Contoh: demam sejak semalam, istirahat di rumah" />
          </div>
          <div>
            <label className="label-field">Foto surat (opsional)</label>
            {lampiran ? (
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5 text-sm">
                <Paperclip size={15} className="shrink-0 text-primary-700" />
                <span className="min-w-0 flex-1 truncate">{lampiran.nama}</span>
                <button type="button" onClick={() => setLampiran(null)} className="text-gray-400 hover:text-red-600" aria-label="Hapus lampiran"><X size={16} /></button>
              </div>
            ) : (
              <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 px-3 py-4 text-sm text-gray-600 hover:bg-gray-50 ${mengunggah ? "opacity-60" : ""}`}>
                {mengunggah ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
                {mengunggah ? "Mengunggah…" : "Ambil foto atau pilih berkas (JPG/PNG/PDF)"}
                <input type="file" accept="image/*,application/pdf" capture="environment" className="sr-only" disabled={mengunggah}
                  onChange={e => { const f = e.target.files?.[0]; if (f) unggah(f); e.target.value = ""; }} />
              </label>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Sakit lebih dari {data.aturan.sakitWajibSuratLebihDari} hari sekolah wajib melampirkan surat dokter. Pengajuan paling lambat H+1, maksimal {data.aturan.maksHari} hari. Lampiran hanya dapat dilihat wali kelas, BK, dan Kesiswaan.
            </p>
          </div>
          <button type="submit" disabled={mengirim || mengunggah} className="btn-modal-save w-full">
            {mengirim ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Kirim ke Wali Kelas
          </button>
        </form>

        <div className="panel overflow-hidden xl:col-span-7">
          <div className="border-b border-gray-100 px-5 py-3.5"><h3 className="font-heading font-semibold text-primary-900">Riwayat pengajuan</h3></div>
          {data.daftar.length === 0 ? (
            <EmptyState icon={FileText} title="Belum ada pengajuan" description="Pengajuan izin atau sakit yang dikirim akan tampil di sini beserta keputusannya." />
          ) : (
            <ul className="divide-y divide-gray-50">
              {data.daftar.map(p => {
                const st = STATUS[p.status] ?? STATUS.MENUNGGU;
                return (
                  <li key={p.id} className="flex flex-wrap items-start gap-3 px-5 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-primary-900 text-sm">
                        {p.jenis === "SAKIT" ? "Sakit" : "Izin"} · {tgl(p.tanggalMulai)}{p.tanggalSelesai !== p.tanggalMulai ? ` – ${tgl(p.tanggalSelesai)}` : ""}
                      </p>
                      <p className="text-xs text-gray-500">{data.anak.length > 1 ? `${namaAnak(p.studentId)} · ` : ""}{p.alasan}</p>
                      {p.lampiran && <a href={`/api/izin-siswa/${p.id}/lampiran`} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline"><Paperclip size={12} /> Lihat lampiran</a>}
                      {p.catatanPemutus && <p className="mt-1 text-xs text-gray-600">Catatan wali kelas: {p.catatanPemutus}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className={`status-badge ${st.kelas}`}><st.ikon size={12} /> {st.label}</span>
                      {p.status === "MENUNGGU" && (
                        <button type="button" onClick={() => batalkan(p)} className="text-xs font-semibold text-red-600 hover:underline">Batalkan</button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
