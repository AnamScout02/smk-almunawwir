"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, Loader2, Plus, Printer, Edit2, Trash2, Search, CalendarCheck, Upload, LayoutGrid, Download } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import StatTile from "@/components/admin/StatTile";
import Modal from "@/components/admin/Modal";
import Select from "@/components/admin/Select";
import DatePicker from "@/components/shared/DatePicker";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { JENIS_AGENDA, labelOf, styleOf } from "@/lib/tu-konstanta";

interface Agenda {
  id: string; judul: string; tanggalMulai: string; tanggalSelesai: string; jenis: string;
  keterangan: string | null; hariEfektif: boolean; tampilPublik: boolean;
  academicYearId: string | null; academicYear: { id: string; name: string } | null;
}
interface TahunAjaran { id: string; name: string; isActive: boolean }

const todayStr = () => new Date().toLocaleDateString("sv-SE");
const dotOf = (j: string) => JENIS_AGENDA.find(x => x.value === j)?.dot ?? "#9ca3af";

interface FormState {
  judul: string; tanggalMulai: string; tanggalSelesai: string; jenis: string;
  keterangan: string; hariEfektif: boolean; tampilPublik: boolean; academicYearId: string;
}
const EMPTY: FormState = {
  judul: "", tanggalMulai: todayStr(), tanggalSelesai: todayStr(), jenis: "KEGIATAN",
  keterangan: "", hariEfektif: false, tampilPublik: true, academicYearId: "",
};

export default function KalenderPendidikanManager() {
  const toast = useToast();
  const confirmDialog = useConfirm();

  const [rows, setRows] = useState<Agenda[]>([]);
  const [years, setYears] = useState<TahunAjaran[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [jenisFilter, setJenisFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [impor, setImpor] = useState(false);
  const [hasilImpor, setHasilImpor] = useState<{ masuk: number; dihapus: number; dilewati: string[]; lembar: string | null } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/admin/kalender-pendidikan${yearFilter ? `?academicYearId=${yearFilter}` : ""}`).then(r => r.json()).catch(() => []),
      fetch("/api/admin/tahun-ajaran").then(r => r.json()).catch(() => []),
    ])
      .then(([a, t]) => {
        setRows(Array.isArray(a) ? a : []);
        setYears(Array.isArray(t) ? t : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [yearFilter]);
  useEffect(() => { load(); }, [load]);

  const tahunAktif = useMemo(() => years.find(y => y.isActive), [years]);

  function openAdd() {
    setEditingId(null);
    setForm({ ...EMPTY, tanggalMulai: todayStr(), tanggalSelesai: todayStr(), academicYearId: tahunAktif?.id ?? "" });
    setModalOpen(true);
  }
  function openEdit(a: Agenda) {
    setEditingId(a.id);
    setForm({
      judul: a.judul, tanggalMulai: a.tanggalMulai.slice(0, 10), tanggalSelesai: a.tanggalSelesai.slice(0, 10),
      jenis: a.jenis, keterangan: a.keterangan ?? "", hariEfektif: a.hariEfektif,
      tampilPublik: a.tampilPublik, academicYearId: a.academicYearId ?? "",
    });
    setModalOpen(true);
  }

  /** Impor kalender dari berkas Excel sekolah. Berkasnya boleh apa adanya (banyak lembar:
   * RPE, kalender bulanan, perhitungan hari efektif) — lembar jadwal kegiatannya dicari sendiri. */
  async function handleImpor(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const sudahAda = rows.length > 0 && yearFilter;
    const ganti = sudahAda
      ? await confirmDialog(`Tahun ajaran ini sudah punya ${rows.length} agenda. Ganti semuanya dengan isi berkas ini?`)
      : false;
    if (sudahAda && !ganti) return;

    setImpor(true); setHasilImpor(null);
    const fd = new FormData();
    fd.append("file", file);
    if (yearFilter || tahunAktif?.id) fd.append("academicYearId", yearFilter || tahunAktif!.id);
    fd.append("ganti", ganti ? "1" : "0");
    const res = await fetch("/api/admin/kalender-pendidikan/import", { method: "POST", body: fd }).catch(() => null);
    setImpor(false);
    const d = await res?.json().catch(() => null);
    if (!res?.ok) return toast.error(d?.error ?? "Gagal mengimpor kalender.");
    setHasilImpor(d);
    toast.success(`${d.masuk} agenda berhasil diimpor.`);
    load();
  }

  async function handleSave() {
    if (!form.judul.trim()) return toast.error("Nama kegiatan wajib diisi.");
    if (form.tanggalSelesai < form.tanggalMulai) return toast.error("Tanggal selesai tidak boleh sebelum tanggal mulai.");
    setSaving(true);
    const res = await fetch(editingId ? `/api/admin/kalender-pendidikan/${editingId}` : "/api/admin/kalender-pendidikan", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, academicYearId: form.academicYearId || null }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) return toast.error((await res?.json().catch(() => null))?.error ?? "Gagal menyimpan agenda.");
    toast.success(editingId ? "Agenda diperbarui." : "Agenda ditambahkan.");
    setModalOpen(false);
    load();
  }

  async function handleDelete(a: Agenda) {
    if (!(await confirmDialog(`Hapus agenda "${a.judul}"?`))) return;
    const res = await fetch(`/api/admin/kalender-pendidikan/${a.id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) return toast.error("Gagal menghapus.");
    toast.success("Agenda dihapus.");
    load();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(a =>
      (!q || a.judul.toLowerCase().includes(q) || (a.keterangan ?? "").toLowerCase().includes(q)) &&
      (!jenisFilter || a.jenis === jenisFilter)
    );
  }, [rows, search, jenisFilter]);

  /** Dikelompokkan per bulan supaya kalender panjang setahun tetap enak dibaca. */
  const perBulan = useMemo(() => {
    const map = new Map<string, Agenda[]>();
    for (const a of filtered) {
      const key = a.tanggalMulai.slice(0, 7);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return [...map.entries()].sort((x, z) => x[0].localeCompare(z[0]));
  }, [filtered]);

  const fmt = (d: string) => new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  const rentang = (a: Agenda) =>
    a.tanggalMulai.slice(0, 10) === a.tanggalSelesai.slice(0, 10) ? fmt(a.tanggalMulai) : `${fmt(a.tanggalMulai)} – ${fmt(a.tanggalSelesai)}`;
  const namaBulan = (k: string) => {
    const [yy, mm] = k.split("-").map(Number);
    return new Date(yy, mm - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  };

  /** Jumlah hari efektif = total hari dari semua agenda yang ditandai hari efektif (inklusif). */
  const hariEfektif = useMemo(() => rows.reduce((total, a) => {
    if (!a.hariEfektif) return total;
    const ms = new Date(a.tanggalSelesai).getTime() - new Date(a.tanggalMulai).getTime();
    return total + Math.max(1, Math.round(ms / 86400000) + 1);
  }, 0), [rows]);

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<CalendarDays size={22} />} title="Kalender Pendidikan"
        description="Agenda kegiatan sekolah satu tahun ajaran — libur, ujian, rapat, dan kegiatan, siap dicetak" />

      <div className="alat-aksi justify-end mb-5">
        {/* Dua bentuk cetak, keduanya dipakai sekolah: MATRIKS (baris bulan × kolom tanggal)
            untuk ditempel di dinding & dilampirkan ke dokumen kurikulum, dan DAFTAR agenda per
            bulan sebagai rinciannya. */}
        <Link href={`/dashboard/admin/kalender-pendidikan/matriks${yearFilter ? `?academicYearId=${yearFilter}` : ""}`}
          className="btn-modal-cancel">
          <LayoutGrid size={16} /> Cetak Matriks
        </Link>
        <Link href={`/dashboard/admin/kalender-pendidikan/cetak${yearFilter ? `?academicYearId=${yearFilter}` : ""}`}
          className="btn-modal-cancel">
          <Printer size={16} /> Cetak Daftar Agenda
        </Link>
        <a href="/api/admin/kalender-pendidikan/template" className="btn-modal-cancel">
          <Download size={16} /> Unduh Template
        </a>
        <label className="btn-modal-cancel cursor-pointer">
          {impor ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {impor ? "Membaca berkas..." : "Impor dari Excel"}
          <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImpor} disabled={impor} />
        </label>
        <button onClick={openAdd} className="btn-modal-save">
          <Plus size={16} /> Tambah Agenda
        </button>
      </div>

      {hasilImpor && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 mb-5">
          <p className="text-sm font-semibold text-emerald-800">
            {hasilImpor.masuk} agenda masuk{hasilImpor.dihapus > 0 ? ` · ${hasilImpor.dihapus} agenda lama diganti` : ""}
            {hasilImpor.lembar ? ` · dibaca dari lembar "${hasilImpor.lembar}"` : ""}
          </p>
          {hasilImpor.dilewati.length > 0 && (
            <>
              <p className="text-xs text-amber-700 mt-1 font-semibold">
                {hasilImpor.dilewati.length} baris dilewati karena tanggalnya tidak terbaca — tambahkan manual:
              </p>
              <ul className="text-xs text-amber-700 list-disc list-inside mt-0.5">
                {hasilImpor.dilewati.slice(0, 6).map((x, i) => <li key={i}>{x}</li>)}
              </ul>
            </>
          )}
          <p className="text-xs text-emerald-700 mt-2">
            Jenis agenda ditebak dari judulnya (libur, ujian, pembelajaran, dll) — periksa sekilas dan perbaiki yang meleset lewat tombol Edit.
          </p>
        </div>
      )}

      <div className="kisi-kartu kisi-kartu-3 mb-5">
        <StatTile value={rows.length} label="Total Agenda" icon={CalendarDays} color="primary" />
        <StatTile value={hariEfektif} label="Hari Efektif Belajar" icon={CalendarCheck} color="emerald" />
        <StatTile value={rows.filter(a => a.jenis === "LIBUR").length} label="Agenda Libur" icon={CalendarDays} color="red" />
      </div>

      <div className="page-card p-4 mb-5 grid gap-3 md:grid-cols-3">
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama kegiatan..." className="input-field pl-10 w-full" />
        </div>
        <Select value={jenisFilter} onChange={setJenisFilter} placeholder="Semua Jenis"
          options={[{ value: "", label: "Semua Jenis" }, ...JENIS_AGENDA.map(j => ({ value: j.value, label: j.label }))]} />
        <Select value={yearFilter} onChange={setYearFilter} placeholder="Semua Tahun Ajaran"
          options={[{ value: "", label: "Semua Tahun Ajaran" },
            ...years.map(y => ({ value: y.id, label: y.isActive ? `${y.name} (Aktif)` : y.name }))]} />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-primary-500" /></div>
      ) : rows.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Kalender Masih Kosong"
          description="Tambahkan agenda pertama — libur semester, ujian, rapat, atau kegiatan sekolah." />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="Tidak Ditemukan" description="Tidak ada agenda yang cocok dengan filter." />
      ) : (
        <div className="space-y-5">
          {perBulan.map(([key, items]) => (
            <div key={key} className="page-card overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-white px-4 py-3 sm:px-5">
                <span className="font-heading font-semibold text-sm text-primary-900">{namaBulan(key)}</span>
                <span className="angka rounded-full border border-primary-100 bg-primary-50 px-2.5 py-0.5 text-xs font-semibold text-primary-700">{items.length} agenda</span>
              </div>
              <div className="overflow-x-auto"><table className="data-table">
                <thead>
                  <tr><th>Tanggal</th><th>Kegiatan</th><th>Jenis</th><th>Keterangan</th><th>Aksi</th></tr>
                </thead>
                <tbody>
                  {items.map(a => (
                    <tr key={a.id}>
                      <td className="whitespace-nowrap text-sm">{rentang(a)}</td>
                      <td>
                        <span className="inline-flex items-center gap-2 font-medium">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dotOf(a.jenis) }} />
                          {a.judul}
                        </span>
                        <span className="block text-xs text-gray-400 ml-4">
                          {a.hariEfektif ? "Hari efektif belajar · " : ""}
                          {a.tampilPublik ? "Tampil di halaman Agenda situs" : "Internal saja"}
                        </span>
                      </td>
                      <td>
                        <span className={`px-2 py-0.5 rounded-full border text-xs font-semibold ${styleOf(JENIS_AGENDA, a.jenis)}`}>
                          {labelOf(JENIS_AGENDA, a.jenis)}
                        </span>
                      </td>
                      <td className="text-sm max-w-[18rem] text-gray-500">{a.keterangan || "—"}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(a)} title="Edit"
                            className="p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg transition-colors">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleDelete(a)} title="Hapus"
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} scrollBody
        title={editingId ? "Edit Agenda" : "Tambah Agenda"}
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
            <label className="label-field">Nama Kegiatan</label>
            <input value={form.judul} onChange={e => setForm(f => ({ ...f, judul: e.target.value }))}
              placeholder="Contoh: Penilaian Akhir Semester Ganjil" className="input-field w-full" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label-field">Tanggal Mulai</label>
              <DatePicker value={form.tanggalMulai}
                onChange={v => setForm(f => ({ ...f, tanggalMulai: v, tanggalSelesai: f.tanggalSelesai < v ? v : f.tanggalSelesai }))} />
            </div>
            <div>
              <label className="label-field">Tanggal Selesai</label>
              <DatePicker value={form.tanggalSelesai} onChange={v => setForm(f => ({ ...f, tanggalSelesai: v }))} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label-field">Jenis</label>
              <Select value={form.jenis} onChange={v => setForm(f => ({ ...f, jenis: v }))}
                options={JENIS_AGENDA.map(j => ({ value: j.value, label: j.label }))} />
            </div>
            <div>
              <label className="label-field">Tahun Ajaran</label>
              <Select value={form.academicYearId} onChange={v => setForm(f => ({ ...f, academicYearId: v }))}
                placeholder="Pilih tahun ajaran..."
                options={[{ value: "", label: "Tidak dikaitkan" },
                  ...years.map(y => ({ value: y.id, label: y.isActive ? `${y.name} (Aktif)` : y.name }))]} />
            </div>
          </div>

          <div>
            <label className="label-field">Keterangan</label>
            <textarea value={form.keterangan} onChange={e => setForm(f => ({ ...f, keterangan: e.target.value }))}
              rows={2} className="input-field w-full" />
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={form.hariEfektif}
              onChange={e => setForm(f => ({ ...f, hariEfektif: e.target.checked }))}
              className="mt-0.5 w-4 h-4 accent-[#1B2B6B]" />
            <span className="text-sm">
              <span className="font-medium">Dihitung sebagai hari efektif belajar</span>
              <span className="block text-xs text-gray-400">
                Dipakai untuk rekap jumlah hari efektif yang diminta di dokumen kurikulum.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={form.tampilPublik}
              onChange={e => setForm(f => ({ ...f, tampilPublik: e.target.checked }))}
              className="mt-0.5 w-4 h-4 accent-[#1B2B6B]" />
            <span className="text-sm">
              <span className="font-medium">Tampilkan di halaman Agenda situs sekolah</span>
              <span className="block text-xs text-gray-400">
                Muncul di <span className="font-medium text-primary-700">smkalmunawwir.sch.id/agenda</span> (menu Agenda),
                terpisah antara &quot;Akan Datang&quot; dan &quot;Sudah Berlangsung&quot;. Matikan untuk agenda internal
                seperti rapat pimpinan.
              </span>
            </span>
          </label>
        </div>
      </Modal>
    </div>
  );
}
