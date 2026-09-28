"use client";
import { useEffect, useState } from "react";
import { ListChecks, Loader2, Plus, Edit2, Trash2, Save } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import Modal from "@/components/admin/Modal";
import Select from "@/components/admin/Select";
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

const EMPTY_FORM = { title: "", description: "", tanggalMulai: "", tanggalSelesai: "", status: "DIRENCANAKAN" };

function fmt(d: string) {
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export default function ProgramKerjaTeacherPage() {
  const confirmDialog = useConfirm();
  const [jabatanList, setJabatanList] = useState<JabatanOption[]>([]);
  const [activeJabatan, setActiveJabatan] = useState("");
  const [items, setItems] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Program | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/teacher/me").then(r => r.json()).then(d => {
      const list: JabatanOption[] = Array.isArray(d.jabatanDetailed) ? d.jabatanDetailed : [];
      setJabatanList(list);
      if (list[0]) setActiveJabatan(list[0].id);
      else setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  function load(jabatanId: string) {
    setLoading(true);
    fetch(`/api/program-kerja?jabatanId=${jabatanId}`).then(r => r.json()).then(d => { setItems(Array.isArray(d) ? d : []); setLoading(false); }).catch(() => setLoading(false));
  }
  useEffect(() => { if (activeJabatan) load(activeJabatan); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [activeJabatan]);

  function openAdd() { setEditing(null); setForm(EMPTY_FORM); setError(""); setModal(true); }
  function openEdit(item: Program) {
    setEditing(item);
    setForm({
      title: item.title, description: item.description ?? "",
      tanggalMulai: item.tanggalMulai.slice(0, 10), tanggalSelesai: item.tanggalSelesai?.slice(0, 10) ?? "",
      status: item.status,
    });
    setError(""); setModal(true);
  }

  async function handleSave() {
    if (!form.title.trim() || !form.tanggalMulai) { setError("Judul dan tanggal mulai wajib diisi."); return; }
    setSaving(true);
    const body = { ...form, jabatanId: activeJabatan, tanggalSelesai: form.tanggalSelesai || null };
    const res = editing
      ? await fetch(`/api/program-kerja/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : await fetch("/api/program-kerja", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error || "Gagal menyimpan"); return; }
    setModal(false);
    load(activeJabatan);
  }

  async function handleDelete(item: Program) {
    if (!(await confirmDialog(`Hapus program "${item.title}"?`))) return;
    await fetch(`/api/program-kerja/${item.id}`, { method: "DELETE" });
    load(activeJabatan);
  }

  if (!loading && jabatanList.length === 0) {
    return (
      <div className="p-6 lg:p-8 pt-16 lg:pt-8">
        <PageHeader icon={<ListChecks size={22} />} title="Program Kerja" description="Program kerja jabatan struktural Anda" />
        <EmptyState icon={ListChecks} title="Belum Ada Jabatan" description="Anda belum memegang jabatan struktural — hubungi admin kalau ini keliru." />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<ListChecks size={22} />}
        title="Program Kerja"
        description="Program kerja jabatan struktural Anda"
      />

      <div className="baris-alat mb-5">
      {jabatanList.length > 1 && (
        <div className="alat-tab flex flex-wrap gap-1 border border-gray-100 bg-white rounded-xl p-1">
          {jabatanList.map(j => (
            <button key={j.id} onClick={() => setActiveJabatan(j.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeJabatan === j.id ? "bg-primary-900 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              {j.name}
            </button>
          ))}
        </div>
      )}
        <div className="alat-aksi">
          <button onClick={openAdd} className="btn-modal-save">
            <Plus size={15} /> Tambah Program
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 size={22} className="animate-spin mr-2" /> Memuat data...
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={ListChecks} title="Belum Ada Program Kerja" description="Tambahkan program kerja untuk jabatan ini." />
      ) : (
        <div className="panel overflow-hidden">
          <div className="divide-y divide-gray-50">
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-primary-50/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-primary-900">{item.title}</p>
                  {item.description && <p className="text-gray-400 text-xs mt-0.5">{item.description}</p>}
                  <p className="text-gray-400 text-xs mt-0.5">
                    {fmt(item.tanggalMulai)}{item.tanggalSelesai ? ` – ${fmt(item.tanggalSelesai)}` : ""}
                  </p>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_BADGE[item.status] ?? STATUS_BADGE.DIRENCANAKAN}`}>
                  {STATUS_OPTIONS.find(s => s.value === item.status)?.label ?? item.status}
                </span>
                <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-primary-50 text-primary-700 transition" title="Ubah">
                  <Edit2 size={14} />
                </button>
                <button onClick={() => handleDelete(item)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition" title="Hapus">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
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
            <button type="button" onClick={handleSave} disabled={saving} className="btn-modal-save flex-1">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan
            </button>
          </>
        }
      >
        {error && <p className="error-msg mb-3">{error}</p>}
        <div className="space-y-3">
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
