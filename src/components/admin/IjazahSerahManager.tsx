"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GraduationCap, Loader2, Plus, Search, Printer, Edit2, Trash2, FileCheck2, Users } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import StatTile from "@/components/admin/StatTile";
import Modal from "@/components/admin/Modal";
import Select from "@/components/admin/Select";
import DatePicker from "@/components/shared/DatePicker";
import StudentPicker, { type LookupStudent } from "@/components/admin/StudentPicker";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { DOKUMEN_IJAZAH, PENGAMBIL_IJAZAH, labelOf } from "@/lib/tu-konstanta";

interface Serah {
  id: string; studentId: string; dokumen: string[]; nomorIjazah: string | null;
  tanggalSerah: string; diambilOleh: string; pengambilNama: string;
  pengambilHubungan: string | null; pengambilNik: string | null; pengambilPhone: string | null;
  petugas: string | null; keterangan: string | null;
  student: {
    id: string; nis: string; nisn: string | null; enrollYear: number | null;
    user: { name: string }; class: { name: string } | null; major: { code: string; name: string };
  };
}

const todayStr = () => new Date().toLocaleDateString("sv-SE");

interface FormState {
  studentId: string | null; dokumen: string[]; nomorIjazah: string; tanggalSerah: string;
  diambilOleh: string; pengambilNama: string; pengambilHubungan: string;
  pengambilNik: string; pengambilPhone: string; petugas: string; keterangan: string;
}
const EMPTY: FormState = {
  studentId: null, dokumen: ["IJAZAH"], nomorIjazah: "", tanggalSerah: todayStr(),
  diambilOleh: "SENDIRI", pengambilNama: "", pengambilHubungan: "",
  pengambilNik: "", pengambilPhone: "", petugas: "", keterangan: "",
};

export default function IjazahSerahManager() {
  const toast = useToast();
  const confirmDialog = useConfirm();

  const [rows, setRows] = useState<Serah[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [picked, setPicked] = useState<LookupStudent | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/ijazah-serah?year=${year}`)
      .then(r => r.json())
      .then(d => setRows(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [year]);
  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditingId(null);
    setForm({ ...EMPTY, tanggalSerah: todayStr() });
    setPicked(null);
    setModalOpen(true);
  }
  function openEdit(s: Serah) {
    setEditingId(s.id);
    setForm({
      studentId: s.studentId, dokumen: s.dokumen, nomorIjazah: s.nomorIjazah ?? "",
      tanggalSerah: s.tanggalSerah.slice(0, 10), diambilOleh: s.diambilOleh,
      pengambilNama: s.pengambilNama, pengambilHubungan: s.pengambilHubungan ?? "",
      pengambilNik: s.pengambilNik ?? "", pengambilPhone: s.pengambilPhone ?? "",
      petugas: s.petugas ?? "", keterangan: s.keterangan ?? "",
    });
    setPicked({
      id: s.student.id, name: s.student.user.name, nis: s.student.nis,
      className: s.student.class?.name ?? null, enrollYear: s.student.enrollYear,
    });
    setModalOpen(true);
  }

  /** Memilih alumni ikut mengisi nomor ijazah dari Buku Induk, dan — kalau yang mengambil
   * dirinya sendiri — sekalian nama pengambilnya. Keduanya tetap bisa diubah manual. */
  function pilihSiswa(s: LookupStudent | null) {
    setPicked(s);
    setForm(f => ({
      ...f,
      studentId: s?.id ?? null,
      nomorIjazah: s?.graduationIjazahNo || f.nomorIjazah,
      pengambilNama: f.diambilOleh === "SENDIRI" ? (s?.name ?? f.pengambilNama) : f.pengambilNama,
    }));
  }

  function ubahPengambil(v: string) {
    setForm(f => ({
      ...f, diambilOleh: v,
      pengambilNama: v === "SENDIRI" ? (picked?.name ?? "") : (f.diambilOleh === "SENDIRI" ? "" : f.pengambilNama),
      pengambilHubungan: v === "SENDIRI" ? "" : f.pengambilHubungan,
    }));
  }

  function toggleDokumen(v: string) {
    setForm(f => ({ ...f, dokumen: f.dokumen.includes(v) ? f.dokumen.filter(x => x !== v) : [...f.dokumen, v] }));
  }

  async function handleSave() {
    if (!form.studentId) return toast.error("Alumni wajib dipilih.");
    if (form.dokumen.length === 0) return toast.error("Pilih minimal satu dokumen yang diserahkan.");
    if (!form.pengambilNama.trim()) return toast.error("Nama pengambil wajib diisi.");

    setSaving(true);
    const res = await fetch(editingId ? `/api/admin/ijazah-serah/${editingId}` : "/api/admin/ijazah-serah", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) return toast.error((await res?.json().catch(() => null))?.error ?? "Gagal menyimpan.");
    toast.success(editingId ? "Data diperbarui." : "Penyerahan dicatat.");
    setModalOpen(false);
    load();
  }

  async function handleDelete(s: Serah) {
    if (!(await confirmDialog(`Hapus catatan penyerahan untuk ${s.student.user.name}?`))) return;
    const res = await fetch(`/api/admin/ijazah-serah/${s.id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) return toast.error("Gagal menghapus.");
    toast.success("Catatan dihapus.");
    load();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(s =>
      s.student.user.name.toLowerCase().includes(q) || s.student.nis.toLowerCase().includes(q) ||
      s.pengambilNama.toLowerCase().includes(q) || (s.nomorIjazah ?? "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  const fmt = (d: string) => new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  const thisYear = new Date().getFullYear();
  const diwakilkan = rows.filter(s => s.diambilOleh !== "SENDIRI").length;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<GraduationCap size={22} />} title="Buku Penyerahan Ijazah"
        description="Serah-terima ijazah & SKHUN ASLI kepada alumni — berbeda dari Legalisir yang mengurus fotokopi" />

      <div className="kisi-kartu kisi-kartu-3 mb-5">
        <StatTile value={rows.length} label={`Penyerahan Tahun ${year}`} icon={FileCheck2} color="primary" />
        <StatTile value={rows.length - diwakilkan} label="Diambil Sendiri" icon={GraduationCap} color="emerald" />
        <StatTile value={diwakilkan} label="Diwakilkan" icon={Users} color="amber" />
      </div>

      <div className="page-card p-4 mb-5 baris-alat">
        <div className="alat-cari">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama alumni, NIS, pengambil, nomor ijazah..." className="input-field pl-10 w-full" />
        </div>
        <div className="alat-saring">
          <Select value={year} onChange={setYear}
            options={Array.from({ length: 8 }, (_, i) => String(thisYear - i)).map(t => ({ value: t, label: `Tahun ${t}` }))} />
        </div>
        <div className="alat-aksi">
          <Link href={`/dashboard/admin/ijazah-serah/cetak?year=${year}`} className="btn-modal-cancel">
            <Printer size={16} /> Cetak Buku Tahun Ini
          </Link>
          <button onClick={openAdd} className="btn-modal-save btn-teks">
            <Plus size={16} /> Catat Penyerahan
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-primary-500" /></div>
      ) : rows.length === 0 ? (
        <EmptyState icon={GraduationCap} title={`Belum Ada Penyerahan Tahun ${year}`}
          description="Catat penyerahan ijazah pertama lewat tombol di atas." />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="Tidak Ditemukan" description="Tidak ada catatan yang cocok." />
      ) : (
        <>
          <div className="page-card overflow-hidden">
            <div className="overflow-auto scrollbar-visible">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tanggal</th><th>Alumni</th><th>Dokumen</th><th>No. Ijazah</th>
                    <th>Diambil Oleh</th><th>Petugas</th><th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => (
                    <tr key={s.id}>
                      <td className="whitespace-nowrap">{fmt(s.tanggalSerah)}</td>
                      <td>
                        <span className="font-medium">{s.student.user.name}</span>
                        <span className="block text-xs text-gray-400">
                          {s.student.nis} · {s.student.major.code}{s.student.enrollYear ? ` · Angkatan ${s.student.enrollYear}` : ""}
                        </span>
                      </td>
                      <td className="text-xs max-w-[12rem]">{s.dokumen.map(d => labelOf(DOKUMEN_IJAZAH, d)).join(", ")}</td>
                      <td className="text-xs whitespace-nowrap">{s.nomorIjazah || "—"}</td>
                      <td className="text-sm">
                        {s.pengambilNama}
                        <span className="block text-xs text-gray-400">
                          {labelOf(PENGAMBIL_IJAZAH, s.diambilOleh)}
                          {s.pengambilHubungan ? ` · ${s.pengambilHubungan}` : ""}
                          {s.pengambilNik ? ` · NIK ${s.pengambilNik}` : ""}
                        </span>
                      </td>
                      <td className="text-sm">{s.petugas || "—"}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(s)} title="Edit"
                            className="p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg transition-colors">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleDelete(s)} title="Hapus"
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
          <p className="text-xs text-gray-400 mt-3">Menampilkan {filtered.length} dari {rows.length} catatan tahun {year}</p>
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} scrollBody size="lg"
        title={editingId ? "Edit Penyerahan Ijazah" : "Catat Penyerahan Ijazah"}
        description={editingId ? undefined : "Diisi petugas TU saat dokumen asli diserahkan"}
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="btn-modal-cancel">Batal</button>
            <button onClick={handleSave} disabled={saving} className="btn-modal-save">
              {saving && <Loader2 size={15} className="animate-spin" />} Simpan
            </button>
          </>
        }>
        <div className="space-y-4">
          <div>
            <label className="label-field">Alumni</label>
            <StudentPicker value={picked} onChange={pilihSiswa} placeholder="Ketik nama / NIS alumni (min. 2 huruf)..." />
          </div>

          <div>
            <label className="label-field">Dokumen yang Diserahkan</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {DOKUMEN_IJAZAH.map(d => (
                <button key={d.value} type="button" onClick={() => toggleDokumen(d.value)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                    form.dokumen.includes(d.value)
                      ? "bg-primary-700 text-white border-primary-700"
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label-field">Nomor Ijazah</label>
              <input value={form.nomorIjazah} onChange={e => setForm(f => ({ ...f, nomorIjazah: e.target.value }))}
                className="input-field w-full" />
            </div>
            <div>
              <label className="label-field">Tanggal Penyerahan</label>
              <DatePicker value={form.tanggalSerah} onChange={v => setForm(f => ({ ...f, tanggalSerah: v }))} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label-field">Diambil Oleh</label>
              <Select value={form.diambilOleh} onChange={ubahPengambil}
                options={PENGAMBIL_IJAZAH.map(p => ({ value: p.value, label: p.label }))} />
            </div>
            <div>
              <label className="label-field">Nama Pengambil</label>
              <input value={form.pengambilNama} onChange={e => setForm(f => ({ ...f, pengambilNama: e.target.value }))}
                className="input-field w-full" />
            </div>
          </div>

          {form.diambilOleh !== "SENDIRI" && (
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="label-field">Hubungan dengan Alumni</label>
                <input value={form.pengambilHubungan} onChange={e => setForm(f => ({ ...f, pengambilHubungan: e.target.value }))}
                  placeholder="Ayah / Ibu / Kakak" className="input-field w-full" />
              </div>
              <div>
                <label className="label-field">NIK Pengambil</label>
                <input value={form.pengambilNik} onChange={e => setForm(f => ({ ...f, pengambilNik: e.target.value }))}
                  placeholder="Sesuai KTP" className="input-field w-full" />
              </div>
              <div>
                <label className="label-field">No. HP Pengambil</label>
                <input value={form.pengambilPhone} onChange={e => setForm(f => ({ ...f, pengambilPhone: e.target.value }))}
                  className="input-field w-full" />
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label-field">Petugas yang Menyerahkan</label>
              <input value={form.petugas} onChange={e => setForm(f => ({ ...f, petugas: e.target.value }))}
                className="input-field w-full" />
            </div>
            <div>
              <label className="label-field">Keterangan</label>
              <input value={form.keterangan} onChange={e => setForm(f => ({ ...f, keterangan: e.target.value }))}
                className="input-field w-full" />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
