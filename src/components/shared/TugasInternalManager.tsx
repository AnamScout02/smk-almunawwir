"use client";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ClipboardList, Loader2, Plus, Send, Trash2, TriangleAlert } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import Modal from "@/components/admin/Modal";
import EmptyState from "@/components/admin/EmptyState";
import DatePicker from "@/components/shared/DatePicker";
import Paginasi from "@/components/shared/Paginasi";
import { usePaginasi } from "@/lib/use-paginasi";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";

interface Tugas {
  id: string; judul: string; rincian: string | null; pemberiNama: string; penerimaId: string | null;
  penerimaNama: string | null; targetJabatan: string[]; prioritas: string; tenggat: string | null;
  status: string; catatanHasil: string | null; selesaiPada: string | null; selesaiOleh: string | null; createdAt: string;
}
interface Data { daftar: Tugas[]; bolehMemberi: boolean; bolehLihatSemua: boolean; jabatan: string[]; pegawai: { id: string; name: string }[]; saya: string; jabatanSaya?: string[] }

const STATUS: Record<string, { label: string; kelas: string }> = {
  BARU: { label: "Baru", kelas: "bg-blue-50 text-blue-700 border-blue-200" },
  DIKERJAKAN: { label: "Dikerjakan", kelas: "bg-amber-50 text-amber-700 border-amber-200" },
  SELESAI: { label: "Selesai", kelas: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  DIBATALKAN: { label: "Dibatalkan", kelas: "bg-gray-100 text-gray-600 border-gray-200" },
};
const PRIORITAS: Record<string, { label: string; kelas: string }> = {
  RENDAH: { label: "Rendah", kelas: "bg-gray-100 text-gray-600 border-gray-200" },
  NORMAL: { label: "Normal", kelas: "bg-primary-50 text-primary-700 border-primary-100" },
  TINGGI: { label: "Tinggi", kelas: "bg-red-50 text-red-600 border-red-200" },
};
const KOSONG = { judul: "", rincian: "", penerimaId: "", targetJabatan: "", prioritas: "NORMAL", tenggat: "" };
const tgl = (iso: string) => new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });

/** PAPAN TUGAS ANTAR JABATAN — pimpinan/TU memberi tugas ke satu pegawai atau ke pemegang jabatan;
 * penerima menandai Dikerjakan/Selesai beserta catatan hasil (18 September 2026). */
export default function TugasInternalManager({ basePath }: { basePath: string }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState<Data | null>(null);
  const [cakupan, setCakupan] = useState<"semua" | "saya">("semua");
  const [saringStatus, setSaringStatus] = useState("");
  const [buka, setBuka] = useState(false);
  const [form, setForm] = useState(KOSONG);
  const [sibuk, setSibuk] = useState(false);
  const [hasil, setHasil] = useState<{ tugas: Tugas; catatan: string } | null>(null);

  const muat = useCallback(() => {
    fetch(`/api/tugas-internal${cakupan === "saya" ? "?cakupan=saya" : ""}`, { cache: "no-store" })
      .then(r => (r.ok ? r.json() : null)).then(d => d && setData(d)).catch(() => {});
  }, [cakupan]);
  useEffect(() => { muat(); }, [muat]);

  async function simpan() {
    setSibuk(true);
    const r = await fetch("/api/tugas-internal", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, targetJabatan: form.targetJabatan ? [form.targetJabatan] : [] }),
    }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setSibuk(false);
    if (!r?.ok) { toast.error(d?.error ?? "Gagal menyimpan."); return; }
    toast.success("Tugas dikirim ke penerima.");
    setBuka(false); setForm(KOSONG); muat();
  }

  async function ubahStatus(t: Tugas, status: string, catatanHasil?: string) {
    const r = await fetch(`/api/tugas-internal/${t.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, catatanHasil }),
    }).catch(() => null);
    const d = await r?.json().catch(() => null);
    if (!r?.ok) { toast.error(d?.error ?? "Gagal memperbarui."); return; }
    toast.success(status === "SELESAI" ? "Tugas ditandai selesai." : "Status diperbarui.");
    setHasil(null); muat();
  }

  async function hapus(t: Tugas) {
    if (!(await confirm(`Hapus tugas "${t.judul}"?`))) return;
    const r = await fetch(`/api/tugas-internal/${t.id}`, { method: "DELETE" }).catch(() => null);
    if (!r?.ok) { toast.error("Gagal menghapus."); return; }
    toast.success("Tugas dihapus."); muat();
  }

  const tersaring = (data?.daftar ?? []).filter(t => !saringStatus || t.status === saringStatus);
  const hal = usePaginasi(tersaring, 20, `${cakupan}|${saringStatus}`);
  const belum = (data?.daftar ?? []).filter(t => t.status === "BARU" || t.status === "DIKERJAKAN").length;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<ClipboardList size={22} />} title="Papan Tugas"
        description={`Penugasan antar jabatan${belum ? ` — ${belum} belum selesai` : ""}`} />

      {!data ? (
        <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
      ) : (
        <>
          <div className="baris-alat mb-5">
            <div className="alat-saring">
              <Select value={saringStatus} onChange={setSaringStatus} placeholder="Semua status"
                options={[{ value: "", label: "Semua status" }, ...Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label }))]} />
            </div>
            {data.bolehLihatSemua && (
              <div className="alat-tab flex gap-1 rounded-xl border border-gray-100 bg-white p-1">
                {(["semua", "saya"] as const).map(v => (
                  <button key={v} type="button" onClick={() => setCakupan(v)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${cakupan === v ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
                    {v === "semua" ? "Semua tugas" : "Tugas saya"}
                  </button>
                ))}
              </div>
            )}
            {data.bolehMemberi && (
              <div className="alat-aksi">
                <button type="button" onClick={() => setBuka(true)} className="btn-modal-save btn-teks"><Plus /> Beri Tugas</button>
              </div>
            )}
          </div>

          {tersaring.length === 0 ? (
            <EmptyState icon={ClipboardList} title="Belum ada tugas"
              description={data.bolehMemberi ? "Buat tugas untuk pegawai atau pemegang jabatan tertentu." : "Tugas yang ditujukan kepada Anda akan tampil di sini."} />
          ) : (
            <div className="panel overflow-hidden">
              <ul className="divide-y divide-gray-50">
                {hal.potongan.map(t => {
                  const st = STATUS[t.status] ?? STATUS.BARU;
                  const pr = PRIORITAS[t.prioritas] ?? PRIORITAS.NORMAL;
                  const terlambat = t.tenggat && t.status !== "SELESAI" && new Date(t.tenggat) < new Date();
                  const milikSaya = t.penerimaId === data.saya || t.targetJabatan.length > 0;
                  return (
                    <li key={t.id} className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-primary-900">{t.judul}</p>
                        <span className={`status-badge ${st.kelas}`}>{st.label}</span>
                        <span className={`status-badge ${pr.kelas}`}>{pr.label}</span>
                        {terlambat && <span className="status-badge border-red-200 bg-red-50 text-red-600"><TriangleAlert size={12} /> Lewat tenggat</span>}
                      </div>
                      {t.rincian && <p className="mt-1 whitespace-pre-line text-sm text-gray-600">{t.rincian}</p>}
                      <p className="mt-1 text-xs text-gray-500">
                        Dari {t.pemberiNama} · untuk {t.penerimaNama ?? t.targetJabatan.join(", ")}
                        {t.tenggat ? ` · tenggat ${tgl(t.tenggat)}` : ""}
                      </p>
                      {t.catatanHasil && (
                        <p className="mt-2 rounded-lg bg-emerald-50/60 px-3 py-2 text-sm text-emerald-900">
                          <span className="font-semibold">Hasil:</span> {t.catatanHasil}
                          {t.selesaiOleh ? ` — ${t.selesaiOleh}` : ""}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {milikSaya && t.status === "BARU" && (
                          <button type="button" onClick={() => ubahStatus(t, "DIKERJAKAN")} className="btn-modal-cancel px-3 text-xs">Tandai Dikerjakan</button>
                        )}
                        {milikSaya && t.status !== "SELESAI" && t.status !== "DIBATALKAN" && (
                          <button type="button" onClick={() => setHasil({ tugas: t, catatan: t.catatanHasil ?? "" })} className="btn-modal-save px-3 text-xs">
                            <CheckCircle2 /> Selesai
                          </button>
                        )}
                        {data.bolehMemberi && t.status !== "SELESAI" && (
                          <button type="button" onClick={() => ubahStatus(t, "DIBATALKAN")} className="btn-modal-cancel px-3 text-xs">Batalkan</button>
                        )}
                        {data.bolehMemberi && (
                          <button type="button" onClick={() => hapus(t)} title="Hapus" className="rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              <Paginasi hal={hal} satuan="tugas" className="border-t border-gray-100" />
            </div>
          )}
        </>
      )}

      <Modal open={buka} onClose={() => !sibuk && setBuka(false)} title="Beri tugas" size="lg"
        footer={<>
          <button type="button" onClick={() => setBuka(false)} disabled={sibuk} className="btn-modal-cancel">Batal</button>
          <button type="button" onClick={simpan} disabled={sibuk || !form.judul.trim()} className="btn-modal-save">
            {sibuk ? <Loader2 className="animate-spin" /> : <Send />} Kirim
          </button>
        </>}>
        <div className="space-y-4">
          <div><label className="label-field">Judul tugas</label>
            <input className="input-field" maxLength={200} value={form.judul} onChange={e => setForm(f => ({ ...f, judul: e.target.value }))}
              placeholder="Contoh: Siapkan data sarana untuk visitasi" /></div>
          <div><label className="label-field">Rincian</label>
            <textarea rows={4} maxLength={2000} className="input-field" value={form.rincian}
              onChange={e => setForm(f => ({ ...f, rincian: e.target.value }))} placeholder="Apa yang perlu dikerjakan, hasil yang diharapkan" /></div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div><label className="label-field">Penerima (perorangan)</label>
              <Select value={form.penerimaId} onChange={v => setForm(f => ({ ...f, penerimaId: v, targetJabatan: v ? "" : f.targetJabatan }))}
                placeholder="Pilih pegawai" options={[{ value: "", label: "— tidak perorangan —" }, ...(data?.pegawai ?? []).map(p => ({ value: p.id, label: p.name }))]} /></div>
            <div><label className="label-field">atau jabatan</label>
              <Select value={form.targetJabatan} onChange={v => setForm(f => ({ ...f, targetJabatan: v, penerimaId: v ? "" : f.penerimaId }))}
                placeholder="Pilih jabatan" options={[{ value: "", label: "— tidak per jabatan —" }, ...(data?.jabatan ?? []).map(j => ({ value: j, label: j }))]} /></div>
            <div><label className="label-field">Prioritas</label>
              <Select value={form.prioritas} onChange={v => setForm(f => ({ ...f, prioritas: v }))}
                options={Object.entries(PRIORITAS).map(([value, p]) => ({ value, label: p.label }))} /></div>
            <div><label className="label-field">Tenggat</label>
              <DatePicker value={form.tenggat} onChange={v => setForm(f => ({ ...f, tenggat: v }))} /></div>
          </div>
        </div>
      </Modal>

      <Modal open={!!hasil} onClose={() => setHasil(null)} title="Selesaikan tugas" description={hasil?.tugas.judul}
        footer={<>
          <button type="button" onClick={() => setHasil(null)} className="btn-modal-cancel">Batal</button>
          <button type="button" onClick={() => hasil && ubahStatus(hasil.tugas, "SELESAI", hasil.catatan)} className="btn-modal-save">
            <CheckCircle2 /> Tandai Selesai
          </button>
        </>}>
        <label className="label-field">Catatan hasil (dilihat pemberi tugas)</label>
        <textarea rows={4} maxLength={2000} className="input-field" value={hasil?.catatan ?? ""}
          onChange={e => setHasil(h => (h ? { ...h, catatan: e.target.value } : h))} placeholder="Apa yang sudah dikerjakan / hasilnya" />
        <p className="mt-2 text-xs text-gray-400">Pemberi tugas ({hasil?.tugas.pemberiNama}) akan mendapat notifikasi.</p>
      </Modal>
      <span className="hidden">{basePath}</span>
    </div>
  );
}
