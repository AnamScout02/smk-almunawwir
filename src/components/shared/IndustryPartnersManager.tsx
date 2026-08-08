"use client";
import React, { useEffect, useState, useTransition } from "react";
import { Search, Edit2, Trash2, Save, Loader2, Building2, Users, Phone, User, Calendar, CheckCircle2, Clock, XCircle, FileText } from "lucide-react";
import DatePicker from "@/components/shared/DatePicker";
import FileUpload from "@/components/shared/FileUpload";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import Modal from "@/components/admin/Modal";
import EmptyState from "@/components/admin/EmptyState";
import { useConfirm } from "@/components/shared/ConfirmProvider";

interface Partner {
  id: string;
  name: string;
  address: string | null;
  contactPerson: string | null;
  contactPhone: string | null;
  industryField: string | null;
  mouStartDate: string | null;
  mouEndDate: string | null;
  mouDocumentUrl: string | null;
  quota: number | null;
  notes: string | null;
}

interface FormState {
  id: string; name: string; address: string; contactPerson: string; contactPhone: string;
  industryField: string; mouStartDate: string; mouEndDate: string; mouDocumentUrl: string; quota: string; notes: string;
}

const emptyForm: FormState = {
  id: "", name: "", address: "", contactPerson: "", contactPhone: "",
  industryField: "", mouStartDate: "", mouEndDate: "", mouDocumentUrl: "", quota: "", notes: "",
};

function getStatus(mouEndDate: string | null): { label: string; badge: string } {
  if (!mouEndDate) return { label: "Belum Ada MoU", badge: "bg-gray-50 text-gray-500 border border-gray-200" };
  const diffDays = (new Date(mouEndDate).getTime() - Date.now()) / 86400000;
  if (diffDays < 0) return { label: "Kedaluwarsa", badge: "bg-red-50 text-red-600 border border-red-200" };
  if (diffDays <= 30) return { label: "Akan Kedaluwarsa", badge: "bg-amber-50 text-amber-700 border border-amber-200" };
  return { label: "Aktif", badge: "bg-emerald-50 text-emerald-700 border border-emerald-200" };
}

export default function IndustryPartnersManager() {
  const confirmDialog = useConfirm();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [companyCounts, setCompanyCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/industry-partners");
    if (res.ok) setPartners(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
    fetch("/api/admin/internships").then(r => r.json()).then((students: { internship: { company: string } | null }[]) => {
      if (!Array.isArray(students)) return;
      const counts: Record<string, number> = {};
      for (const s of students) {
        if (!s.internship) continue;
        const key = s.internship.company.trim().toLowerCase();
        counts[key] = (counts[key] ?? 0) + 1;
      }
      setCompanyCounts(counts);
    }).catch(() => {});
  }, []);

  function openAdd() { setForm(emptyForm); setError(""); setModal(true); }
  function openEdit(p: Partner) {
    setForm({
      id: p.id, name: p.name, address: p.address ?? "", contactPerson: p.contactPerson ?? "", contactPhone: p.contactPhone ?? "",
      industryField: p.industryField ?? "", mouStartDate: p.mouStartDate?.slice(0, 10) ?? "", mouEndDate: p.mouEndDate?.slice(0, 10) ?? "",
      mouDocumentUrl: p.mouDocumentUrl ?? "", quota: p.quota != null ? String(p.quota) : "",
      notes: p.notes ?? "",
    });
    setError("");
    setModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Nama perusahaan wajib diisi."); return; }
    setError("");
    startTransition(async () => {
      const res = form.id
        ? await fetch(`/api/admin/industry-partners/${form.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
        : await fetch("/api/admin/industry-partners", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Gagal"); return; }
      setModal(false);
      load();
    });
  }

  async function handleDelete(id: string) {
    if (!await confirmDialog("Hapus data mitra industri ini?")) return;
    await fetch(`/api/admin/industry-partners/${id}`, { method: "DELETE" });
    load();
  }

  const filtered = partners.filter(p => {
    const q = search.toLowerCase();
    return !q || p.name.toLowerCase().includes(q) || (p.industryField ?? "").toLowerCase().includes(q);
  });

  const counts = {
    total: partners.length,
    aktif: partners.filter(p => getStatus(p.mouEndDate).label === "Aktif").length,
    akanExpire: partners.filter(p => getStatus(p.mouEndDate).label === "Akan Kedaluwarsa").length,
    expired: partners.filter(p => getStatus(p.mouEndDate).label === "Kedaluwarsa").length,
  };

  const fmt = (d: string) => new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        icon={<Building2 size={22} />}
        title="Mitra Industri (DU/DI)"
        description="Kelola daftar perusahaan mitra PKL & status MoU kerja sama"
      />

      <div className="flex justify-end mb-5">
        <button onClick={openAdd} className="inline-flex items-center gap-2 bg-gold hover:bg-gold/90 text-primary-900 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
          <Building2 size={15} /> Tambah Mitra
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatTile color="primary" icon={Building2} value={counts.total} label="Total Mitra" />
        <StatTile color="emerald" icon={CheckCircle2} value={counts.aktif} label="MoU Aktif" />
        <StatTile color="amber" icon={Clock} value={counts.akanExpire} label="Akan Kedaluwarsa" />
        <StatTile color="red" icon={XCircle} value={counts.expired} label="Kedaluwarsa" />
      </div>

      <div className="relative mb-5">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Cari nama perusahaan atau bidang usaha..."
          className="input-field pl-10" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 size={22} className="animate-spin mr-2" /> Memuat data...
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Building2} title="Belum Ada Mitra Industri" description="Tambahkan perusahaan yang bekerja sama untuk PKL siswa." />
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {filtered.map(p => {
            const status = getStatus(p.mouEndDate);
            const pklCount = companyCounts[p.name.trim().toLowerCase()] ?? 0;
            return (
              <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0">
                    <p className="font-heading font-bold text-primary-900 truncate">{p.name}</p>
                    {p.industryField && <p className="text-gray-400 text-xs">{p.industryField}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-primary-50 text-primary-600 transition"><Edit2 size={14} /></button>
                    <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition"><Trash2 size={14} /></button>
                  </div>
                </div>
                <span className={`inline-flex text-xs font-bold px-2.5 py-1 rounded-full mb-3 ${status.badge}`}>{status.label}</span>
                <div className="space-y-1.5 text-xs text-gray-500">
                  {p.contactPerson && <p className="flex items-center gap-1.5"><User size={12} className="text-gray-400" /> {p.contactPerson}</p>}
                  {p.contactPhone && <p className="flex items-center gap-1.5"><Phone size={12} className="text-gray-400" /> {p.contactPhone}</p>}
                  {p.mouEndDate && (
                    <p className="flex items-center gap-1.5"><Calendar size={12} className="text-gray-400" /> MoU s.d. {fmt(p.mouEndDate)}</p>
                  )}
                  <p className="flex items-center gap-1.5"><Users size={12} className="text-gray-400" /> {pklCount} siswa PKL saat ini{p.quota != null && ` (kuota ${p.quota})`}</p>
                  {p.mouDocumentUrl && (
                    <a href={p.mouDocumentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-primary-600 hover:text-primary-800 font-semibold">
                      <FileText size={12} /> Lihat Dokumen MoU
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal scrollBody
        open={modal}
        onClose={() => setModal(false)}
        title={form.id ? "Ubah Mitra Industri" : "Tambah Mitra Industri"}
        footer={
          <>
            <button type="button" onClick={() => setModal(false)} className="btn-modal-cancel flex-1">Batal</button>
            <button type="submit" form="partnerForm" disabled={isPending} className="btn-modal-save flex-1">
              {isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan
            </button>
          </>
        }
      >
        <form id="partnerForm" onSubmit={handleSave} className="flex flex-col gap-4">
          {error && <p className="error-msg">{error}</p>}
          <div>
            <label className="label-field">Nama Perusahaan *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-field" placeholder="cth: PT Telkom Indonesia" />
          </div>
          <div>
            <label className="label-field">Bidang Usaha</label>
            <input value={form.industryField} onChange={e => setForm(f => ({ ...f, industryField: e.target.value }))} className="input-field" placeholder="cth: Telekomunikasi" />
          </div>
          <div>
            <label className="label-field">Alamat</label>
            <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="input-field" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Kontak Person</label>
              <input value={form.contactPerson} onChange={e => setForm(f => ({ ...f, contactPerson: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="label-field">No. HP/Telp</label>
              <input value={form.contactPhone} onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))} className="input-field" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Mulai MoU</label>
              <DatePicker value={form.mouStartDate} onChange={v => setForm(f => ({ ...f, mouStartDate: v }))} />
            </div>
            <div>
              <label className="label-field">Berakhir MoU</label>
              <DatePicker value={form.mouEndDate} onChange={v => setForm(f => ({ ...f, mouEndDate: v }))} />
            </div>
          </div>
          <div>
            <label className="label-field">Kuota Siswa PKL (opsional)</label>
            <input type="number" min={0} value={form.quota} onChange={e => setForm(f => ({ ...f, quota: e.target.value }))} className="input-field" placeholder="cth: 5" />
          </div>
          <FileUpload value={form.mouDocumentUrl} onChange={v => setForm(f => ({ ...f, mouDocumentUrl: v }))}
            folder="mitra-industri" label="Dokumen MoU (opsional)" accept="application/pdf,image/*" hint="PDF atau foto scan — maks. 5MB" />
          <div>
            <label className="label-field">Catatan</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="input-field" />
          </div>
        </form>
      </Modal>
    </div>
  );
}
