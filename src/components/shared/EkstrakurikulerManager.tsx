"use client";
import { useEffect, useState } from "react";
import { Flag, Loader2, Plus, Trash2, X } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import Modal from "@/components/admin/Modal";
import Select from "@/components/admin/Select";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { useToast } from "@/components/shared/ToastProvider";
import { PageSkeleton } from "@/components/shared/Skeleton";

interface Ekskul { id: string; name: string; _count: { members: number } }
interface StudentOption { id: string; nis: string; name: string; className: string }
interface Member {
  id: string; role: string | null;
  student: { nis: string; user: { name: string }; class: { name: string } | null };
}

export default function EkstrakurikulerManager() {
  const confirmDialog = useConfirm();
  const toast = useToast();
  const [ekskulList, setEkskulList] = useState<Ekskul[]>([]);
  const [active, setActive] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [role, setRole] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [categoryModal, setCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);

  function loadEkskulList(preferId?: string) {
    fetch("/api/ekstrakurikuler").then(r => r.json()).then(d => {
      const list: Ekskul[] = Array.isArray(d) ? d : [];
      setEkskulList(list);
      const next = preferId && list.some(e => e.id === preferId) ? preferId : list[0]?.id;
      if (next) setActive(next); else setLoading(false);
    }).catch(() => setLoading(false));
  }

  useEffect(() => {
    loadEkskulList();
    fetch("/api/ekstrakurikuler/students").then(r => r.json()).then(d => setStudents(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  function load(id: string) {
    setLoading(true);
    fetch(`/api/ekstrakurikuler/${id}/members`).then(r => r.json()).then(d => { setMembers(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }
  useEffect(() => { if (active) load(active); }, [active]);

  function openAdd() { setStudentId(""); setRole(""); setError(""); setModal(true); }

  async function handleSave() {
    if (!studentId) { setError("Pilih siswa terlebih dahulu."); return; }
    setSaving(true);
    const res = await fetch(`/api/ekstrakurikuler/${active}/members`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentId, role: role || null }),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error || "Gagal menyimpan"); return; }
    setModal(false);
    load(active);
    setEkskulList(prev => prev.map(e => e.id === active ? { ...e, _count: { members: e._count.members + 1 } } : e));
  }

  async function handleRemove(m: Member) {
    if (!(await confirmDialog(`Keluarkan ${m.student.user.name} dari ekstrakurikuler ini?`))) return;
    await fetch(`/api/ekstrakurikuler/${active}/members/${m.id}`, { method: "DELETE" });
    load(active);
    setEkskulList(prev => prev.map(e => e.id === active ? { ...e, _count: { members: Math.max(0, e._count.members - 1) } } : e));
  }

  function openAddCategory() { setNewCategoryName(""); setCategoryError(""); setCategoryModal(true); }

  async function handleAddCategory() {
    if (!newCategoryName.trim()) { setCategoryError("Nama ekstrakurikuler wajib diisi."); return; }
    setCategoryError("");
    setSavingCategory(true);
    const res = await fetch("/api/ekstrakurikuler", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newCategoryName }),
    });
    setSavingCategory(false);
    if (!res.ok) { const d = await res.json(); setCategoryError(d.error || "Gagal menambah"); return; }
    const created = await res.json();
    setCategoryModal(false);
    toast.success(`Ekstrakurikuler "${created.name}" ditambahkan`);
    loadEkskulList(created.id);
  }

  async function handleDeleteCategory(ek: Ekskul) {
    if (!(await confirmDialog(`Hapus ekstrakurikuler "${ek.name}" beserta seluruh data anggotanya?`))) return;
    const res = await fetch(`/api/ekstrakurikuler/${ek.id}`, { method: "DELETE" });
    if (!res.ok) { const d = await res.json(); toast.error(d.error || "Gagal menghapus"); return; }
    toast.success(`Ekstrakurikuler "${ek.name}" dihapus`);
    loadEkskulList();
  }

  const categoryModalNode = (
    <Modal
      open={categoryModal}
      onClose={() => setCategoryModal(false)}
      title="Tambah Ekstrakurikuler"
      footer={
        <>
          <button type="button" onClick={() => setCategoryModal(false)} className="btn-modal-cancel flex-1">Batal</button>
          <button type="button" onClick={handleAddCategory} disabled={savingCategory} className="btn-modal-save flex-1 flex items-center justify-center gap-2">
            {savingCategory ? <Loader2 size={14} className="animate-spin" /> : null} Simpan
          </button>
        </>
      }
    >
      {categoryError && <p className="error-msg mb-3">{categoryError}</p>}
      <div>
        <label className="label-field">Nama Ekstrakurikuler</label>
        <input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="cth: Futsal, PMR, Rohis, Marching Band"
          className="input-field" />
      </div>
    </Modal>
  );

  if (!loading && ekskulList.length === 0) {
    return (
      <div className="p-6 lg:p-8">
        <PageHeader
          icon={<Flag size={22} />}
          title="Ekstrakurikuler"
          description="Data anggota ekstrakurikuler"
        />
        <div className="flex justify-end mb-5">
          <button onClick={openAddCategory} className="inline-flex items-center gap-2 bg-gold hover:bg-gold/90 text-primary-900 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap">
            <Plus size={15} /> Tambah Ekstrakurikuler
          </button>
        </div>
        <EmptyState icon={Flag} title="Belum Ada Ekstrakurikuler" description="Tambahkan ekstrakurikuler pertama (mis. OSIS, Pramuka, Futsal, PMR, dll)." />
        {categoryModalNode}
      </div>
    );
  }

  const activeEkskul = ekskulList.find(e => e.id === active);

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        icon={<Flag size={22} />}
        title="Ekstrakurikuler"
        description={activeEkskul ? `Anggota ${activeEkskul.name}` : "Data anggota ekstrakurikuler"}
      />

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <button onClick={openAddCategory} className="inline-flex items-center gap-2 border border-gray-200 text-gray-600 font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-gray-50 transition whitespace-nowrap">
          <Plus size={15} /> Tambah Ekstrakurikuler
        </button>
        <button onClick={openAdd} className="inline-flex items-center gap-2 bg-gold hover:bg-gold/90 text-primary-900 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap sm:ml-auto">
          <Plus size={15} /> Tambah Anggota
        </button>
      </div>

      {ekskulList.length > 0 && (
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-5 flex-wrap">
          {ekskulList.map(e => (
            <button key={e.id} onClick={() => setActive(e.id)}
              className={`group flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${active === e.id ? "bg-white shadow text-primary-700" : "text-gray-500 hover:text-gray-700"}`}>
              {e.name} ({e._count.members})
              <span onClick={(ev) => { ev.stopPropagation(); handleDeleteCategory(e); }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-100 hover:text-red-600 transition-opacity" title="Hapus ekstrakurikuler">
                <X size={12} />
              </span>
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <PageSkeleton />
      ) : members.length === 0 ? (
        <EmptyState icon={Flag} title="Belum Ada Anggota" description="Tambahkan siswa sebagai anggota ekstrakurikuler ini." />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-50">
            {members.map(m => (
              <div key={m.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-primary-50/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-primary-900">{m.student.user.name}</p>
                  <p className="text-gray-400 text-xs">{m.student.class?.name ?? "—"} · {m.student.nis}</p>
                </div>
                {m.role && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 border border-primary-200 whitespace-nowrap">{m.role}</span>}
                <button onClick={() => handleRemove(m)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition" title="Keluarkan">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Tambah Anggota"
        footer={
          <>
            <button type="button" onClick={() => setModal(false)} className="btn-modal-cancel flex-1">Batal</button>
            <button type="button" onClick={handleSave} disabled={saving} className="btn-modal-save flex-1 flex items-center justify-center gap-2">
              {saving ? <Loader2 size={14} className="animate-spin" /> : null} Simpan
            </button>
          </>
        }
      >
        {error && <p className="error-msg mb-3">{error}</p>}
        <div className="space-y-3">
          <div>
            <label className="label-field">Siswa</label>
            <Select value={studentId} onChange={setStudentId}
              options={students.map(s => ({ value: s.id, label: `${s.name} — ${s.className} (${s.nis})` }))} placeholder="— Pilih Siswa —" />
          </div>
          <div>
            <label className="label-field">Peran (opsional)</label>
            <input value={role} onChange={e => setRole(e.target.value)} placeholder="cth: Ketua" className="input-field" />
          </div>
        </div>
      </Modal>

      {categoryModalNode}
    </div>
  );
}
