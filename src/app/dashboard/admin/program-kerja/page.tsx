"use client";
import { useEffect, useState } from "react";
import { ListChecks, Loader2, Plus, Edit2, Trash2, Save, Clock, PlayCircle, CheckCircle2 } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import Modal from "@/components/admin/Modal";
import Select from "@/components/admin/Select";
import StatTile from "@/components/admin/StatTile";
import DatePicker from "@/components/shared/DatePicker";
import { useConfirm } from "@/components/shared/ConfirmProvider";

interface JabatanOption { id: string; name: string }
interface Program {
  id: string; title: string; description: string | null;
  tanggalMulai: string; tanggalSelesai: string | null;
  status: string; createdByName: string;
  jabatan: { id: string; name: string };
}

const STATUS_OPTIONS = [
  { value: "DIRENCANAKAN", label: "Direncanakan" },
  { value: "BERJALAN", label: "Berjalan" },
  { value: "SELESAI", label: "Selesai" },
  { value: "BATAL", label: "Batal" },
];
const STATUS_BADGE: Record<string, string> = {
  DIRENCANAKAN: "bg-gray-50 text-gray-600 border border-gray-200",
  BERJALAN: "bg-blue-50 text-blue-600 border border-blue-200",
  SELESAI: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  BATAL: "bg-red-50 text-red-500 border border-red-200",
};

const EMPTY_FORM = { jabatanId: "", title: "", description: "", tanggalMulai: "", tanggalSelesai: "", status: "DIRENCANAKAN" };

function fmt(d: string) {
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export default function ProgramKerjaAdminPage() {
  const confirmDialog = useConfirm();
  const [items, setItems] = useState<Program[]>([]);
  const [jabatanList, setJabatanList] = useState<JabatanOption[]>([]);
  const [filterJabatan, setFilterJabatan] = useState("");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Program | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    const qs = filterJabatan ? `?jabatanId=${filterJabatan}` : "";
    fetch(`/api/program-kerja${qs}`).then(r => r.json()).then(d => { setItems(Array.isArray(d) ? d : []); setLoading(false); }).catch(() => { setLoading(false); });
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filterJabatan]);
  useEffect(() => { fetch("/api/admin/jabatan").then(r => r.json()).then(d => setJabatanList(Array.isArray(d) ? d : [])).catch(() => {}); }, []);

  function openAdd() { setEditing(null); setForm(EMPTY_FORM); setError(""); setModal(true); }
  function openEdit(item: Program) {
    setEditing(item);
    setForm({
      jabatanId: item.jabatan.id, title: item.title, description: item.description ?? "",
      tanggalMulai: item.tanggalMulai.slice(0, 10), tanggalSelesai: item.tanggalSelesai?.slice(0, 10) ?? "",
      status: item.status,
    });
    setError(""); setModal(true);
  }

  async function handleSave() {
    if (!form.jabatanId || !form.title.trim() || !form.tanggalMulai) {
      setError("Jabatan, judul, dan tanggal mulai wajib diisi."); return;
    }
    setSaving(true);
    const body = { ...form, tanggalSelesai: form.tanggalSelesai || null };
    const res = editing
      ? await fetch(`/api/program-kerja/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : await fetch("/api/program-kerja", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error || "Gagal menyimpan"); return; }
    setModal(false);
    load();
  }

  async function handleDelete(item: Program) {
    if (!(await confirmDialog(`Hapus program "${item.title}"?`))) return;
    await fetch(`/api/program-kerja/${item.id}`, { method: "DELETE" });
    load();
  }

  const total = items.length;
  const berjalan = items.filter(i => i.status === "BERJALAN").length;
  const direncanakan = items.filter(i => i.status === "DIRENCANAKAN").length;
  const selesai = items.filter(i => i.status === "SELESAI").length;

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        icon={<ListChecks size={22} />}
        title="Program Kerja"
        description="Program kerja seluruh jabatan struktural — guru & staf"
      />

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <Select className="w-56" value={filterJabatan} onChange={setFilterJabatan}
          options={[{ value: "", label: "Semua Jabatan" }, ...jabatanList.map(j => ({ value: j.id, label: j.name }))]} />
        <button onClick={openAdd} className="inline-flex items-center gap-2 bg-gold hover:bg-gold/90 text-primary-900 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap sm:ml-auto">
          <Plus size={15} /> Tambah Program
        </button>
      </div>

      {!loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatTile color="primary" value={total} label="Total Program" icon={ListChecks} />
          <StatTile color="gray" value={direncanakan} label="Direncanakan" icon={Clock} />
          <StatTile color="blue" value={berjalan} label="Berjalan" icon={PlayCircle} />
          <StatTile color="emerald" value={selesai} label="Selesai" icon={CheckCircle2} />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 size={22} className="animate-spin mr-2" /> Memuat data...
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={ListChecks} title="Belum Ada Program Kerja" description="Tambahkan program kerja untuk jabatan struktural." />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-primary-100" style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.05) 0%, rgba(27,43,107,0.03) 100%)" }}>
                  {["Jabatan", "Judul", "Tanggal", "Status", "Dibuat oleh", ""].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className="border-b border-gray-50 last:border-0 hover:bg-primary-50/30 transition-colors">
                    <td className="px-5 py-3.5 text-gray-500 text-xs whitespace-nowrap">{item.jabatan.name}</td>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-primary-900">{item.title}</p>
                      {item.description && <p className="text-gray-400 text-xs mt-0.5 line-clamp-1">{item.description}</p>}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs whitespace-nowrap">
                      {fmt(item.tanggalMulai)}{item.tanggalSelesai ? ` – ${fmt(item.tanggalSelesai)}` : ""}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_BADGE[item.status] ?? STATUS_BADGE.DIRENCANAKAN}`}>
                        {STATUS_OPTIONS.find(s => s.value === item.status)?.label ?? item.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs whitespace-nowrap">{item.createdByName}</td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-primary-50 text-primary-600 transition" title="Ubah">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => handleDelete(item)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition" title="Hapus">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal scrollBody
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? "Ubah Program Kerja" : "Tambah Program Kerja"}
        footer={
          <>
            <button type="button" onClick={() => setModal(false)} className="btn-modal-cancel flex-1">Batal</button>
            <button type="button" onClick={handleSave} disabled={saving} className="btn-modal-save flex-1 flex items-center justify-center gap-2">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan
            </button>
          </>
        }
      >
        {error && <p className="error-msg mb-3">{error}</p>}
        <div className="space-y-3">
          <div>
            <label className="label-field">Jabatan</label>
            <Select value={form.jabatanId} onChange={v => setForm(p => ({ ...p, jabatanId: v }))}
              options={jabatanList.map(j => ({ value: j.id, label: j.name }))} placeholder="— Pilih Jabatan —" />
          </div>
          <div>
            <label className="label-field">Judul Program</label>
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="cth: Workshop Kurikulum Merdeka" className="input-field" />
          </div>
          <div>
            <label className="label-field">Deskripsi (opsional)</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} className="input-field resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Tanggal Mulai</label>
              <DatePicker value={form.tanggalMulai} onChange={v => setForm(p => ({ ...p, tanggalMulai: v }))} />
            </div>
            <div>
              <label className="label-field">Tanggal Selesai (opsional)</label>
              <DatePicker value={form.tanggalSelesai} onChange={v => setForm(p => ({ ...p, tanggalSelesai: v }))} />
            </div>
          </div>
          <div>
            <label className="label-field">Status</label>
            <Select value={form.status} onChange={v => setForm(p => ({ ...p, status: v }))} options={STATUS_OPTIONS} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
