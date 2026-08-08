"use client";
import { useEffect, useState } from "react";
import { Boxes, Loader2, Plus, Edit2, Trash2, Save, CheckCircle2, AlertTriangle, XOctagon, Wrench, Search } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import Modal from "@/components/admin/Modal";
import Select from "@/components/admin/Select";
import StatTile from "@/components/admin/StatTile";
import DatePicker from "@/components/shared/DatePicker";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { PageSkeleton } from "@/components/shared/Skeleton";

interface Asset {
  id: string; name: string; category: string; quantity: number; condition: string;
  location: string | null; acquiredDate: string | null; fundingSource: string | null; notes: string | null;
}
interface DamageReport {
  id: string; reportDate: string; description: string; status: string;
  repairDate: string | null; repairNotes: string | null; reportedBy: string | null;
  asset: { name: string; category: string; location: string | null };
}

const CONDITION_OPTIONS = [
  { value: "BAIK", label: "Baik" },
  { value: "RUSAK_RINGAN", label: "Rusak Ringan" },
  { value: "RUSAK_BERAT", label: "Rusak Berat" },
];
const CONDITION_BADGE: Record<string, string> = {
  BAIK: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  RUSAK_RINGAN: "bg-amber-50 text-amber-700 border border-amber-200",
  RUSAK_BERAT: "bg-red-50 text-red-600 border border-red-200",
};
const DAMAGE_STATUS_OPTIONS = [
  { value: "BELUM_DIPERBAIKI", label: "Belum Diperbaiki" },
  { value: "SEDANG_DIPERBAIKI", label: "Sedang Diperbaiki" },
  { value: "SELESAI", label: "Selesai" },
];
const DAMAGE_STATUS_BADGE: Record<string, string> = {
  BELUM_DIPERBAIKI: "bg-red-50 text-red-600 border border-red-200",
  SEDANG_DIPERBAIKI: "bg-amber-50 text-amber-700 border border-amber-200",
  SELESAI: "bg-emerald-50 text-emerald-700 border border-emerald-200",
};

const EMPTY_FORM = {
  name: "", category: "", quantity: "1", condition: "BAIK",
  location: "", acquiredDate: "", fundingSource: "", notes: "",
};
const EMPTY_DAMAGE_FORM = { assetId: "", description: "", reportedBy: "" };
const TABS = [
  { key: "barang", label: "Barang" },
  { key: "kerusakan", label: "Laporan Kerusakan" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function fmt(d: string) {
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export default function InventarisManager() {
  const confirmDialog = useConfirm();
  const [tab, setTab] = useState<TabKey>("barang");
  const [items, setItems] = useState<Asset[]>([]);
  const [reports, setReports] = useState<DamageReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [damageModal, setDamageModal] = useState(false);
  const [editingDamage, setEditingDamage] = useState<DamageReport | null>(null);
  const [damageForm, setDamageForm] = useState(EMPTY_DAMAGE_FORM);
  const [damageStatus, setDamageStatus] = useState("BELUM_DIPERBAIKI");
  const [damageRepairNotes, setDamageRepairNotes] = useState("");
  const [damageError, setDamageError] = useState("");
  const [savingDamage, setSavingDamage] = useState(false);
  const [search, setSearch] = useState("");

  function load() {
    setLoading(true);
    Promise.all([
      fetch("/api/inventaris").then(r => r.json()),
      fetch("/api/inventaris/damage-reports").then(r => r.json()),
    ]).then(([a, d]) => {
      setItems(Array.isArray(a) ? a : []);
      setReports(Array.isArray(d) ? d : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  function openAdd() { setEditing(null); setForm(EMPTY_FORM); setError(""); setModal(true); }
  function openEdit(item: Asset) {
    setEditing(item);
    setForm({
      name: item.name, category: item.category, quantity: String(item.quantity), condition: item.condition,
      location: item.location ?? "", acquiredDate: item.acquiredDate?.slice(0, 10) ?? "",
      fundingSource: item.fundingSource ?? "", notes: item.notes ?? "",
    });
    setError(""); setModal(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.category.trim()) { setError("Nama barang dan kategori wajib diisi."); return; }
    setSaving(true);
    const body = { ...form, acquiredDate: form.acquiredDate || null };
    const res = editing
      ? await fetch(`/api/inventaris/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : await fetch("/api/inventaris", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error || "Gagal menyimpan"); return; }
    setModal(false);
    load();
  }

  async function handleDelete(item: Asset) {
    if (!(await confirmDialog(`Hapus barang "${item.name}" dari inventaris?`))) return;
    await fetch(`/api/inventaris/${item.id}`, { method: "DELETE" });
    load();
  }

  function openAddDamage() { setEditingDamage(null); setDamageForm(EMPTY_DAMAGE_FORM); setDamageError(""); setDamageModal(true); }
  function openEditDamage(r: DamageReport) {
    setEditingDamage(r);
    setDamageStatus(r.status);
    setDamageRepairNotes(r.repairNotes ?? "");
    setDamageError(""); setDamageModal(true);
  }
  async function handleSaveDamage() {
    setSavingDamage(true);
    let res: Response;
    if (editingDamage) {
      res = await fetch(`/api/inventaris/damage-reports/${editingDamage.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: damageStatus, repairNotes: damageRepairNotes }),
      });
    } else {
      if (!damageForm.assetId || !damageForm.description.trim()) { setDamageError("Barang dan deskripsi wajib diisi."); setSavingDamage(false); return; }
      res = await fetch("/api/inventaris/damage-reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(damageForm) });
    }
    setSavingDamage(false);
    if (!res.ok) { const d = await res.json(); setDamageError(d.error || "Gagal menyimpan"); return; }
    setDamageModal(false);
    load();
  }
  async function handleDeleteDamage(r: DamageReport) {
    if (!(await confirmDialog(`Hapus laporan kerusakan "${r.asset.name}"?`))) return;
    await fetch(`/api/inventaris/damage-reports/${r.id}`, { method: "DELETE" });
    load();
  }

  const total = items.length;
  const baik = items.filter(i => i.condition === "BAIK").length;
  const ringan = items.filter(i => i.condition === "RUSAK_RINGAN").length;
  const berat = items.filter(i => i.condition === "RUSAK_BERAT").length;
  const belumDiperbaiki = reports.filter(r => r.status !== "SELESAI").length;

  const q = search.toLowerCase();
  const filteredItems = items.filter(i =>
    !q || i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q) || (i.location ?? "").toLowerCase().includes(q)
  );
  const filteredReports = reports.filter(r =>
    !q || r.asset.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) || (r.reportedBy ?? "").toLowerCase().includes(q)
  );

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        icon={<Boxes size={22} />}
        title="Inventaris Barang"
        description="Data barang, perlengkapan & laporan kerusakan sekolah"
      />

      <div className="flex justify-end mb-5">
        {tab === "barang" ? (
          <button onClick={openAdd} className="inline-flex items-center gap-2 bg-gold hover:bg-gold/90 text-primary-900 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap">
            <Plus size={15} /> Tambah Barang
          </button>
        ) : (
          <button onClick={openAddDamage} className="inline-flex items-center gap-2 bg-gold hover:bg-gold/90 text-primary-900 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap">
            <Plus size={15} /> Lapor Kerusakan
          </button>
        )}
      </div>

      {!loading && tab === "barang" && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatTile color="primary" value={total} label="Total Jenis Barang" icon={Boxes} />
          <StatTile color="emerald" value={baik} label="Kondisi Baik" icon={CheckCircle2} />
          <StatTile color="amber" value={ringan} label="Rusak Ringan" icon={AlertTriangle} />
          <StatTile color="red" value={berat} label="Rusak Berat" icon={XOctagon} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors relative ${tab === t.key ? "bg-white shadow text-primary-700" : "text-gray-500 hover:text-gray-700"}`}>
              {t.label}
              {t.key === "kerusakan" && belumDiperbaiki > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-red-500 text-white">{belumDiperbaiki}</span>
              )}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={tab === "barang" ? "Cari nama, kategori, atau lokasi..." : "Cari barang, deskripsi, atau pelapor..."}
            className="input-field pl-9 text-sm" />
        </div>
      </div>

      {loading ? (
        <PageSkeleton />
      ) : tab === "barang" ? (
        <>
          {items.length === 0 ? (
            <EmptyState icon={Boxes} title="Belum Ada Data Inventaris" description="Tambahkan barang/perlengkapan sekolah." />
          ) : filteredItems.length === 0 ? (
            <EmptyState icon={Search} title="Tidak Ditemukan" description="Tidak ada barang yang cocok dengan pencarian." />
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-primary-100" style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.05) 0%, rgba(27,43,107,0.03) 100%)" }}>
                      {["Nama Barang", "Kategori", "Jumlah", "Kondisi", "Lokasi", "Tgl Perolehan", ""].map(h => (
                        <th key={h} className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map(item => (
                      <tr key={item.id} className="border-b border-gray-50 last:border-0 hover:bg-primary-50/30 transition-colors">
                        <td className="px-5 py-3.5">
                          <p className="font-semibold text-primary-900">{item.name}</p>
                          {item.notes && <p className="text-gray-400 text-xs mt-0.5 line-clamp-1">{item.notes}</p>}
                        </td>
                        <td className="px-5 py-3.5 text-gray-500 text-xs whitespace-nowrap">{item.category}</td>
                        <td className="px-5 py-3.5 text-gray-600 text-center">{item.quantity}</td>
                        <td className="px-5 py-3.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${CONDITION_BADGE[item.condition] ?? CONDITION_BADGE.BAIK}`}>
                            {CONDITION_OPTIONS.find(c => c.value === item.condition)?.label ?? item.condition}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-gray-500 text-xs whitespace-nowrap">{item.location || "-"}</td>
                        <td className="px-5 py-3.5 text-gray-500 text-xs whitespace-nowrap">{item.acquiredDate ? fmt(item.acquiredDate) : "-"}</td>
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
        </>
      ) : (
        reports.length === 0 ? (
          <EmptyState icon={Wrench} title="Belum Ada Laporan Kerusakan" description="Laporkan barang yang rusak untuk dipantau perbaikannya." />
        ) : filteredReports.length === 0 ? (
          <EmptyState icon={Search} title="Tidak Ditemukan" description="Tidak ada laporan yang cocok dengan pencarian." />
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-primary-100" style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.05) 0%, rgba(27,43,107,0.03) 100%)" }}>
                    {["Barang", "Tgl Lapor", "Deskripsi", "Status", "Pelapor", ""].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredReports.map(r => (
                    <tr key={r.id} className="border-b border-gray-50 last:border-0 hover:bg-primary-50/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-primary-900">{r.asset.name}</p>
                        <p className="text-gray-400 text-xs">{r.asset.location || r.asset.category}</p>
                      </td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs whitespace-nowrap">{fmt(r.reportDate)}</td>
                      <td className="px-5 py-3.5 text-gray-600">{r.description}</td>
                      <td className="px-5 py-3.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${DAMAGE_STATUS_BADGE[r.status]}`}>
                          {DAMAGE_STATUS_OPTIONS.find(s => s.value === r.status)?.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs whitespace-nowrap">{r.reportedBy || "-"}</td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <button onClick={() => openEditDamage(r)} className="p-1.5 rounded-lg hover:bg-primary-50 text-primary-600 transition" title="Perbarui Status">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDeleteDamage(r)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition" title="Hapus">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      <Modal scrollBody
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? "Ubah Barang" : "Tambah Barang"}
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
            <label className="label-field">Nama Barang</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="cth: Kursi Siswa" className="input-field" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Kategori</label>
              <input value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} placeholder="cth: Furnitur" className="input-field" />
            </div>
            <div>
              <label className="label-field">Jumlah</label>
              <input type="number" min={0} value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} className="input-field" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Kondisi</label>
              <Select value={form.condition} onChange={v => setForm(p => ({ ...p, condition: v }))} options={CONDITION_OPTIONS} />
            </div>
            <div>
              <label className="label-field">Lokasi/Ruangan</label>
              <input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="cth: Lab Komputer" className="input-field" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Tanggal Perolehan</label>
              <DatePicker value={form.acquiredDate} onChange={v => setForm(p => ({ ...p, acquiredDate: v }))} />
            </div>
            <div>
              <label className="label-field">Sumber Dana (opsional)</label>
              <input value={form.fundingSource} onChange={e => setForm(p => ({ ...p, fundingSource: e.target.value }))} placeholder="cth: BOS" className="input-field" />
            </div>
          </div>
          <div>
            <label className="label-field">Catatan (opsional)</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="input-field resize-none" />
          </div>
        </div>
      </Modal>

      <Modal scrollBody
        open={damageModal}
        onClose={() => setDamageModal(false)}
        title={editingDamage ? "Perbarui Status Perbaikan" : "Lapor Kerusakan"}
        footer={
          <>
            <button type="button" onClick={() => setDamageModal(false)} className="btn-modal-cancel flex-1">Batal</button>
            <button type="button" onClick={handleSaveDamage} disabled={savingDamage} className="btn-modal-save flex-1 flex items-center justify-center gap-2">
              {savingDamage ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan
            </button>
          </>
        }
      >
        {damageError && <p className="error-msg mb-3">{damageError}</p>}
        {editingDamage ? (
          <div className="space-y-3">
            <div>
              <p className="label-field">Barang</p>
              <p className="text-sm font-semibold text-primary-900">{editingDamage.asset.name}</p>
              <p className="text-xs text-gray-400">{editingDamage.description}</p>
            </div>
            <div>
              <label className="label-field">Status Perbaikan</label>
              <Select value={damageStatus} onChange={setDamageStatus} options={DAMAGE_STATUS_OPTIONS} />
            </div>
            <div>
              <label className="label-field">Catatan Perbaikan (opsional)</label>
              <textarea value={damageRepairNotes} onChange={e => setDamageRepairNotes(e.target.value)} rows={2} className="input-field resize-none" placeholder="cth: Diperbaiki tukang servis, ganti sparepart" />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="label-field">Barang</label>
              <Select value={damageForm.assetId} onChange={v => setDamageForm(p => ({ ...p, assetId: v }))}
                options={items.map(i => ({ value: i.id, label: `${i.name} (${i.location || i.category})` }))} placeholder="— Pilih Barang —" />
            </div>
            <div>
              <label className="label-field">Deskripsi Kerusakan</label>
              <textarea value={damageForm.description} onChange={e => setDamageForm(p => ({ ...p, description: e.target.value }))} rows={2} className="input-field resize-none" placeholder="cth: Layar proyektor bergaris" />
            </div>
            <div>
              <label className="label-field">Pelapor (opsional)</label>
              <input value={damageForm.reportedBy} onChange={e => setDamageForm(p => ({ ...p, reportedBy: e.target.value }))} className="input-field" placeholder="Nama pelapor" />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
