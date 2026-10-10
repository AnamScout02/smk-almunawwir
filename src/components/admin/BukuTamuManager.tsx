"use client";
import { useCariAwal } from "@/lib/cari-awal";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookUser, Loader2, Plus, Search, Printer, Edit2, Trash2, LogOut, Users, QrCode, Camera } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import Modal from "@/components/admin/Modal";
import Select from "@/components/admin/Select";
import DatePicker from "@/components/shared/DatePicker";
import MonthPicker from "@/components/shared/MonthPicker";
import StudentPicker, { type LookupStudent } from "@/components/admin/StudentPicker";
import ImageUpload from "@/components/admin/ImageUpload";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";

interface GuestEntry {
  id: string; visitDate: string; timeIn: string | null; timeOut: string | null;
  guestName: string; category: string; institution: string | null;
  viaQr?: boolean; photoUrl?: string | null;
  studentId: string | null;
  student: { id: string; nis: string; user: { name: string }; class: { name: string } | null } | null;
  purpose: string; metWith: string | null; phone: string | null; notes: string | null;
}

export const GUEST_CATEGORIES = [
  { value: "DINAS", label: "Dinas / Instansi" },
  { value: "WALI_MURID", label: "Wali Murid" },
  { value: "VENDOR", label: "Vendor / Rekanan" },
  { value: "UMUM", label: "Tamu Umum" },
  { value: "LAINNYA", label: "Lainnya" },
];

const CATEGORY_STYLE: Record<string, string> = {
  DINAS: "bg-blue-50 text-blue-700 border-blue-200",
  WALI_MURID: "bg-emerald-50 text-emerald-700 border-emerald-200",
  VENDOR: "bg-amber-50 text-amber-700 border-amber-200",
  UMUM: "bg-gray-50 text-gray-600 border-gray-200",
  LAINNYA: "bg-purple-50 text-purple-700 border-purple-200",
};

const todayStr = () => new Date().toLocaleDateString("sv-SE"); // "YYYY-MM-DD" waktu lokal
const nowTime = () => new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }).replace(".", ":");
const thisMonth = () => todayStr().slice(0, 7);

interface FormState {
  visitDate: string; timeIn: string; guestName: string; category: string;
  institution: string; studentId: string | null; purpose: string;
  metWith: string; phone: string; notes: string;
}

const EMPTY_FORM: FormState = {
  visitDate: todayStr(), timeIn: nowTime(), guestName: "", category: "",
  institution: "", studentId: null, purpose: "", metWith: "", phone: "", notes: "",
};

export default function BukuTamuManager() {
  const toast = useToast();
  const confirmDialog = useConfirm();

  const [entries, setEntries] = useState<GuestEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(thisMonth());
  const [search, setSearch] = useState("");
  useCariAwal(setSearch);
  const [catFilter, setCatFilter] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [pickedStudent, setPickedStudent] = useState<LookupStudent | null>(null);
  // Foto kunjungan SENGAJA tidak ada di formulir tamu — diunggah petugas TU dari daftar ini,
  // setelah barisnya ada (permintaan user 13 September 2026).
  const [fotoUntuk, setFotoUntuk] = useState<GuestEntry | null>(null);
  const [fotoUrl, setFotoUrl] = useState("");
  const [simpanFoto, setSimpanFoto] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/buku-tamu?month=${month}`)
      .then(r => r.json())
      .then(d => setEntries(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [month]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, visitDate: todayStr(), timeIn: nowTime() });
    setPickedStudent(null);
    setModalOpen(true);
  }

  function openEdit(e: GuestEntry) {
    setEditingId(e.id);
    setForm({
      visitDate: e.visitDate.slice(0, 10), timeIn: e.timeIn ?? "", guestName: e.guestName,
      category: e.category, institution: e.institution ?? "", studentId: e.studentId,
      purpose: e.purpose, metWith: e.metWith ?? "", phone: e.phone ?? "", notes: e.notes ?? "",
    });
    setPickedStudent(e.student ? { id: e.student.id, name: e.student.user.name, nis: e.student.nis, className: e.student.class?.name ?? null } : null);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.guestName.trim()) return toast.error("Nama tamu wajib diisi.");
    if (!form.category) return toast.error("Kategori tamu wajib dipilih.");
    if (!form.purpose.trim()) return toast.error("Keperluan wajib diisi.");

    setSaving(true);
    const body = { ...form, studentId: form.category === "WALI_MURID" ? form.studentId : null };
    const res = await fetch(editingId ? `/api/admin/buku-tamu/${editingId}` : "/api/admin/buku-tamu", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    setSaving(false);

    if (!res?.ok) return toast.error("Gagal menyimpan data kunjungan.");
    toast.success(editingId ? "Kunjungan diperbarui." : "Kunjungan dicatat.");
    setModalOpen(false);
    load();
  }

  /** Tombol cepat di baris tabel — cuma kirim timeOut, field lain tidak disentuh (lihat catatan
   * di api/admin/buku-tamu/[id]/route.ts). */
  async function markLeft(e: GuestEntry) {
    const res = await fetch(`/api/admin/buku-tamu/${e.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timeOut: nowTime() }),
    }).catch(() => null);
    if (!res?.ok) return toast.error("Gagal menandai jam pulang.");
    toast.success(`${e.guestName} ditandai pulang.`);
    load();
  }

  async function simpanFotoKunjungan() {
    if (!fotoUntuk) return;
    setSimpanFoto(true);
    const res = await fetch(`/api/admin/buku-tamu/${fotoUntuk.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoUrl: fotoUrl || null }),
    }).catch(() => null);
    setSimpanFoto(false);
    if (!res?.ok) return toast.error("Gagal menyimpan foto kunjungan.");
    toast.success(fotoUrl ? "Foto kunjungan tersimpan." : "Foto kunjungan dihapus.");
    setFotoUntuk(null);
    load();
  }

  async function handleDelete(e: GuestEntry) {
    if (!(await confirmDialog(`Hapus catatan kunjungan "${e.guestName}"?`))) return;
    const res = await fetch(`/api/admin/buku-tamu/${e.id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) return toast.error("Gagal menghapus.");
    toast.success("Catatan kunjungan dihapus.");
    load();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter(e =>
      (!q || e.guestName.toLowerCase().includes(q) || (e.institution ?? "").toLowerCase().includes(q) ||
        e.purpose.toLowerCase().includes(q) || (e.metWith ?? "").toLowerCase().includes(q)) &&
      (!catFilter || e.category === catFilter)
    );
  }, [entries, search, catFilter]);

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  const catLabel = (v: string) => GUEST_CATEGORIES.find(c => c.value === v)?.label ?? v;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<BookUser size={22} />} title="Buku Tamu"
        description="Catatan kunjungan tamu dinas, wali murid, vendor, dan tamu umum ke sekolah" />

      <div className="page-card p-4 mb-5 baris-alat">
        <div className="alat-saring">
          <MonthPicker value={month} onChange={setMonth} />
        </div>
        <div className="alat-cari">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama tamu, instansi, keperluan..." className="input-field pl-10 w-full" />
        </div>
        <div className="alat-saring">
          <Select value={catFilter} onChange={setCatFilter} placeholder="Semua Kategori"
            options={[{ value: "", label: "Semua Kategori" }, ...GUEST_CATEGORIES]} />
        </div>
        <div className="alat-aksi">
          <Link href="/dashboard/admin/buku-tamu/qr" className="btn-modal-cancel">
            <QrCode size={16} /> Cetak QR Buku Tamu
          </Link>
          <Link href={`/dashboard/admin/buku-tamu/cetak?month=${month}`} className="btn-modal-cancel">
            <Printer size={16} /> Cetak Rekap Bulan Ini
          </Link>
          <button onClick={openAdd} className="btn-modal-save btn-teks">
            <Plus size={16} /> Catat Kunjungan
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
      ) : entries.length === 0 ? (
        <EmptyState icon={Users} title="Belum Ada Kunjungan Bulan Ini" description="Catat kunjungan tamu pertama lewat tombol di atas." />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="Tidak Ditemukan" description="Tidak ada kunjungan yang cocok dengan filter." />
      ) : (
        <>
          <div className="page-card overflow-hidden">
            <div className="overflow-auto scrollbar-visible">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tanggal</th><th>Jam</th><th>Nama Tamu</th><th>Kategori</th>
                    <th>Asal / Siswa Terkait</th><th>Keperluan</th><th>Ditemui</th><th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(e => (
                    <tr key={e.id}>
                      <td className="whitespace-nowrap">{fmtDate(e.visitDate)}</td>
                      <td className="whitespace-nowrap text-xs">
                        {e.timeIn || "—"}{e.timeOut ? ` – ${e.timeOut}` : ""}
                      </td>
                      <td className="font-medium">
                        {e.guestName}
                        {e.viaQr ? (
                          <span className="ml-1.5 align-middle inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold"
                            title="Diisi sendiri oleh tamu lewat QR — belum diverifikasi petugas">
                            <QrCode size={10} /> QR
                          </span>
                        ) : null}
                        {e.phone ? <span className="block text-xs text-gray-400">{e.phone}</span> : null}
                      </td>
                      <td>
                        <span className={`px-2 py-0.5 rounded-full border text-xs font-semibold ${CATEGORY_STYLE[e.category] ?? CATEGORY_STYLE.UMUM}`}>
                          {catLabel(e.category)}
                        </span>
                      </td>
                      <td className="text-sm">
                        {e.student
                          ? <>{e.student.user.name}<span className="block text-xs text-gray-400">{e.student.class?.name ?? "—"} · {e.student.nis}</span></>
                          : (e.institution || "—")}
                      </td>
                      <td className="text-sm max-w-[16rem]">{e.purpose}</td>
                      <td className="text-sm">{e.metWith || "—"}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          {!e.timeOut && (
                            <button onClick={() => markLeft(e)} title="Tandai Pulang"
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                              <LogOut size={14} />
                            </button>
                          )}
                          <button onClick={() => { setFotoUntuk(e); setFotoUrl(e.photoUrl ?? ""); }}
                            title={e.photoUrl ? "Lihat / ganti foto kunjungan" : "Tambahkan foto kunjungan"}
                            className={`p-1.5 rounded-lg transition-colors ${e.photoUrl ? "text-emerald-600 hover:bg-emerald-50" : "text-gray-400 hover:text-primary-700 hover:bg-primary-50"}`}>
                            <Camera size={14} />
                          </button>
                          <button onClick={() => openEdit(e)} title="Edit"
                            className="p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg transition-colors">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleDelete(e)} title="Hapus"
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">Menampilkan {filtered.length} dari {entries.length} kunjungan bulan ini</p>
        </>
      )}

      <Modal open={fotoUntuk !== null} onClose={() => setFotoUntuk(null)}
        title="Foto Kunjungan"
        description={fotoUntuk ? `${fotoUntuk.guestName} — ${fotoUntuk.institution || "tanpa instansi"}` : undefined}
        footer={
          <>
            <button onClick={() => setFotoUntuk(null)} className="btn-modal-cancel">Batal</button>
            <button onClick={simpanFotoKunjungan} disabled={simpanFoto} className="btn-modal-save">
              {simpanFoto ? "Menyimpan..." : "Simpan"}
            </button>
          </>
        }>
        <p className="text-xs text-gray-400 mb-3">
          Dokumentasi kunjungan — diunggah petugas, bukan oleh tamu. Kosongkan lalu simpan untuk menghapus foto.
        </p>
        <ImageUpload value={fotoUrl} onChange={setFotoUrl} folder="buku-tamu" label="Foto Kunjungan" aspect="wide" />
      </Modal>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} scrollBody
        title={editingId ? "Edit Kunjungan" : "Catat Kunjungan Tamu"}
        description={editingId ? undefined : "Diisi petugas TU saat tamu datang"}
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="btn-modal-cancel">Batal</button>
            <button onClick={handleSave} disabled={saving} className="btn-modal-save">
              {saving && <Loader2 size={15} className="animate-spin" />} Simpan
            </button>
          </>
        }>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label-field">Tanggal Kunjungan</label>
            <DatePicker value={form.visitDate} onChange={v => setForm(f => ({ ...f, visitDate: v }))} />
          </div>
          <div>
            <label className="label-field">Jam Datang</label>
            <input value={form.timeIn} onChange={e => setForm(f => ({ ...f, timeIn: e.target.value }))}
              placeholder="08:30" className="input-field w-full" />
          </div>
          <div>
            <label className="label-field">Nama Tamu <span className="text-red-500">*</span></label>
            <input value={form.guestName} onChange={e => setForm(f => ({ ...f, guestName: e.target.value }))}
              placeholder="Nama lengkap tamu" className="input-field w-full" />
          </div>
          <div>
            <label className="label-field">Kategori <span className="text-red-500">*</span></label>
            <Select value={form.category} onChange={v => setForm(f => ({ ...f, category: v }))}
              options={GUEST_CATEGORIES} placeholder="Pilih kategori tamu..." />
          </div>

          {/* Field kondisional: wali murid butuh cari siswa, kategori lain butuh nama instansi */}
          {form.category === "WALI_MURID" ? (
            <div className="md:col-span-2">
              <label className="label-field">Siswa yang Terkait</label>
              <StudentPicker value={pickedStudent} onChange={s => { setPickedStudent(s); setForm(f => ({ ...f, studentId: s?.id ?? null })); }} />
            </div>
          ) : form.category ? (
            <div className="md:col-span-2">
              <label className="label-field">Asal Instansi</label>
              <input value={form.institution} onChange={e => setForm(f => ({ ...f, institution: e.target.value }))}
                placeholder="Mis. Cabang Dinas Pendidikan Wilayah Banyuwangi" className="input-field w-full" />
            </div>
          ) : null}

          <div className="md:col-span-2">
            <label className="label-field">Keperluan <span className="text-red-500">*</span></label>
            <textarea value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
              rows={2} placeholder="Mis. Monitoring pelaksanaan UKK" className="input-field w-full" />
          </div>
          <div>
            <label className="label-field">Ditemui Oleh</label>
            <input value={form.metWith} onChange={e => setForm(f => ({ ...f, metWith: e.target.value }))}
              placeholder="Mis. Kepala Sekolah" className="input-field w-full" />
          </div>
          <div>
            <label className="label-field">No. HP</label>
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="08xxxxxxxxxx" className="input-field w-full" />
          </div>
          <div className="md:col-span-2">
            <label className="label-field">Catatan</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2} placeholder="Opsional" className="input-field w-full" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
