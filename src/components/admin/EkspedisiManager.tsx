"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Send, Loader2, Plus, Search, Printer, Edit2, Trash2, PackageCheck, Package } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import StatTile from "@/components/admin/StatTile";
import Modal from "@/components/admin/Modal";
import Select from "@/components/admin/Select";
import DatePicker from "@/components/shared/DatePicker";
import MonthPicker from "@/components/shared/MonthPicker";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { CARA_KIRIM, STATUS_EKSPEDISI, labelOf, styleOf } from "@/lib/tu-konstanta";

interface SuratRow { id: string; nomor: string; perihal: string; tanggal?: string; pihak?: string }
interface Ekspedisi {
  id: string; tanggal: string; suratId: string | null; nomorSurat: string | null;
  perihal: string; tujuan: string; alamatTujuan: string | null; jumlah: number;
  caraKirim: string; penerimaNama: string | null; penerimaJabatan: string | null;
  tanggalTerima: string | null; status: string; petugas: string | null; keterangan: string | null;
  surat: SuratRow | null;
}

const todayStr = () => new Date().toLocaleDateString("sv-SE");
const thisMonth = () => todayStr().slice(0, 7);

interface FormState {
  tanggal: string; suratId: string; nomorSurat: string; perihal: string; tujuan: string;
  alamatTujuan: string; jumlah: string; caraKirim: string; petugas: string; keterangan: string;
}
const EMPTY: FormState = {
  tanggal: todayStr(), suratId: "", nomorSurat: "", perihal: "", tujuan: "",
  alamatTujuan: "", jumlah: "1", caraKirim: "LANGSUNG", petugas: "", keterangan: "",
};

export default function EkspedisiManager() {
  const toast = useToast();
  const confirmDialog = useConfirm();

  const [rows, setRows] = useState<Ekspedisi[]>([]);
  const [suratKeluar, setSuratKeluar] = useState<SuratRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(thisMonth());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  const [terimaOpen, setTerimaOpen] = useState<Ekspedisi | null>(null);
  const [terima, setTerima] = useState({ nama: "", jabatan: "", tanggal: todayStr() });

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/admin/ekspedisi?month=${month}`).then(r => r.json()).catch(() => []),
      fetch("/api/admin/surat?tipe=KELUAR").then(r => r.json()).catch(() => []),
    ])
      .then(([e, s]) => {
        setRows(Array.isArray(e) ? e : []);
        setSuratKeluar(Array.isArray(s) ? s : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [month]);
  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditingId(null);
    setForm({ ...EMPTY, tanggal: todayStr() });
    setModalOpen(true);
  }
  function openEdit(e: Ekspedisi) {
    setEditingId(e.id);
    setForm({
      tanggal: e.tanggal.slice(0, 10), suratId: e.suratId ?? "", nomorSurat: e.nomorSurat ?? "",
      perihal: e.perihal, tujuan: e.tujuan, alamatTujuan: e.alamatTujuan ?? "",
      jumlah: String(e.jumlah), caraKirim: e.caraKirim, petugas: e.petugas ?? "",
      keterangan: e.keterangan ?? "",
    });
    setModalOpen(true);
  }

  /** Memilih surat keluar otomatis mengisi nomor & perihal — tapi tetap bisa diubah manual,
   * karena tidak semua yang dikirim adalah surat (bisa berkas laporan/proposal). */
  function pilihSurat(id: string) {
    const s = suratKeluar.find(x => x.id === id);
    setForm(f => ({
      ...f, suratId: id,
      nomorSurat: s?.nomor ?? f.nomorSurat,
      perihal: s?.perihal ?? f.perihal,
      tujuan: s?.pihak ?? f.tujuan,
    }));
  }

  async function handleSave() {
    if (!form.perihal.trim()) return toast.error("Perihal wajib diisi.");
    if (!form.tujuan.trim()) return toast.error("Tujuan wajib diisi.");
    setSaving(true);
    const res = await fetch(editingId ? `/api/admin/ekspedisi/${editingId}` : "/api/admin/ekspedisi", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, suratId: form.suratId || null }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) return toast.error("Gagal menyimpan catatan ekspedisi.");
    toast.success(editingId ? "Catatan diperbarui." : "Pengiriman dicatat.");
    setModalOpen(false);
    load();
  }

  async function simpanTerima() {
    if (!terimaOpen) return;
    if (!terima.nama.trim()) return toast.error("Nama penerima wajib diisi.");
    const res = await fetch(`/api/admin/ekspedisi/${terimaOpen.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "DITERIMA", penerimaNama: terima.nama.trim(),
        penerimaJabatan: terima.jabatan.trim() || null, tanggalTerima: terima.tanggal,
      }),
    }).catch(() => null);
    if (!res?.ok) return toast.error("Gagal menyimpan tanda terima.");
    toast.success("Tanda terima dicatat.");
    setTerimaOpen(null);
    load();
  }

  async function handleDelete(e: Ekspedisi) {
    if (!(await confirmDialog(`Hapus catatan pengiriman "${e.perihal}"?`))) return;
    const res = await fetch(`/api/admin/ekspedisi/${e.id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) return toast.error("Gagal menghapus.");
    toast.success("Catatan dihapus.");
    load();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(e =>
      (!q || e.perihal.toLowerCase().includes(q) || e.tujuan.toLowerCase().includes(q) ||
        (e.nomorSurat ?? "").toLowerCase().includes(q) || (e.penerimaNama ?? "").toLowerCase().includes(q)) &&
      (!statusFilter || e.status === statusFilter)
    );
  }, [rows, search, statusFilter]);

  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "—";
  const belum = rows.filter(e => e.status === "DIKIRIM").length;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Send size={22} />} title="Buku Ekspedisi"
        description="Catatan serah-terima surat & dokumen keluar beserta tanda tangan penerimanya" />

      <div className="kisi-kartu kisi-kartu-3 mb-5">
        <StatTile value={rows.length} label="Pengiriman Bulan Ini" icon={Package} color="primary" />
        <StatTile value={belum} label="Belum Ada Tanda Terima" icon={Send} color="amber" />
        <StatTile value={rows.length - belum} label="Sudah Diterima" icon={PackageCheck} color="emerald" />
      </div>

      <div className="page-card p-4 mb-5 baris-alat">
        <div className="alat-saring">
          <MonthPicker value={month} onChange={setMonth} />
        </div>
        <div className="alat-cari">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari perihal, tujuan, nomor, penerima..." className="input-field pl-10 w-full" />
        </div>
        <div className="alat-saring">
          <Select value={statusFilter} onChange={setStatusFilter} placeholder="Semua Status"
            options={[{ value: "", label: "Semua Status" }, ...STATUS_EKSPEDISI.map(s => ({ value: s.value, label: s.label }))]} />
        </div>
        <div className="alat-aksi">
          <Link href={`/dashboard/admin/ekspedisi/cetak?month=${month}`} className="btn-modal-cancel">
            <Printer size={16} /> Cetak Buku Bulan Ini
          </Link>
          <button onClick={openAdd} className="btn-modal-save btn-teks">
            <Plus size={16} /> Catat Pengiriman
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Send} title="Belum Ada Pengiriman Bulan Ini"
          description="Catat surat atau dokumen yang dikirim keluar lewat tombol di atas." />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="Tidak Ditemukan" description="Tidak ada catatan yang cocok dengan filter." />
      ) : (
        <>
          <div className="page-card overflow-hidden">
            <div className="overflow-auto scrollbar-visible">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tanggal</th><th>Nomor Surat</th><th>Perihal</th><th>Tujuan</th>
                    <th className="text-center">Jml</th><th>Cara Kirim</th><th>Penerima</th><th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(e => (
                    <tr key={e.id}>
                      <td className="whitespace-nowrap">{fmt(e.tanggal)}</td>
                      <td className="text-xs whitespace-nowrap">{e.nomorSurat || "—"}</td>
                      <td className="max-w-[16rem] font-medium">{e.perihal}</td>
                      <td className="text-sm max-w-[14rem]">
                        {e.tujuan}
                        {e.alamatTujuan && <span className="block text-xs text-gray-400">{e.alamatTujuan}</span>}
                      </td>
                      <td className="text-center">{e.jumlah}</td>
                      <td className="text-xs">{labelOf(CARA_KIRIM, e.caraKirim)}</td>
                      <td className="text-sm">
                        {e.penerimaNama
                          ? <>{e.penerimaNama}<span className="block text-xs text-gray-400">{e.penerimaJabatan || "—"} · {fmt(e.tanggalTerima)}</span></>
                          : <span className={`px-2 py-0.5 rounded-full border text-xs font-semibold ${styleOf(STATUS_EKSPEDISI, e.status)}`}>
                              {labelOf(STATUS_EKSPEDISI, e.status)}
                            </span>}
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          {e.status !== "DITERIMA" && (
                            <button onClick={() => { setTerimaOpen(e); setTerima({ nama: "", jabatan: "", tanggal: todayStr() }); }}
                              title="Catat tanda terima"
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                              <PackageCheck size={14} />
                            </button>
                          )}
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
          <p className="text-xs text-gray-400 mt-3">Menampilkan {filtered.length} dari {rows.length} catatan bulan ini</p>
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} scrollBody size="lg"
        title={editingId ? "Edit Catatan Pengiriman" : "Catat Pengiriman Dokumen"}
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
            <label className="label-field">Ambil dari Surat Keluar (opsional)</label>
            <Select value={form.suratId} onChange={pilihSurat} placeholder="Isi manual / pilih surat keluar..."
              options={[{ value: "", label: "Isi manual (bukan surat)" },
                ...suratKeluar.map(s => ({ value: s.id, label: `${s.nomor} — ${s.perihal}` }))]} />
            <p className="text-xs text-gray-400 mt-1">
              Dokumen yang bukan surat (laporan, proposal, berkas) tetap bisa dicatat — pilih &quot;Isi manual&quot;.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label-field">Tanggal Kirim</label>
              <DatePicker value={form.tanggal} onChange={v => setForm(f => ({ ...f, tanggal: v }))} />
            </div>
            <div>
              <label className="label-field">Nomor Surat / Dokumen</label>
              <input value={form.nomorSurat} onChange={e => setForm(f => ({ ...f, nomorSurat: e.target.value }))}
                className="input-field w-full" />
            </div>
          </div>

          <div>
            <label className="label-field">Perihal / Isi Dokumen</label>
            <input value={form.perihal} onChange={e => setForm(f => ({ ...f, perihal: e.target.value }))}
              className="input-field w-full" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label-field">Dikirim Kepada</label>
              <input value={form.tujuan} onChange={e => setForm(f => ({ ...f, tujuan: e.target.value }))}
                placeholder="Nama orang / instansi" className="input-field w-full" />
            </div>
            <div>
              <label className="label-field">Alamat Tujuan</label>
              <input value={form.alamatTujuan} onChange={e => setForm(f => ({ ...f, alamatTujuan: e.target.value }))}
                className="input-field w-full" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="label-field">Jumlah Berkas</label>
              <input type="number" min={1} value={form.jumlah}
                onChange={e => setForm(f => ({ ...f, jumlah: e.target.value }))} className="input-field w-full" />
            </div>
            <div>
              <label className="label-field">Cara Kirim</label>
              <Select value={form.caraKirim} onChange={v => setForm(f => ({ ...f, caraKirim: v }))}
                options={CARA_KIRIM.map(c => ({ value: c.value, label: c.label }))} />
            </div>
            <div>
              <label className="label-field">Petugas Pengirim</label>
              <input value={form.petugas} onChange={e => setForm(f => ({ ...f, petugas: e.target.value }))}
                className="input-field w-full" />
            </div>
          </div>

          <div>
            <label className="label-field">Keterangan</label>
            <textarea value={form.keterangan} onChange={e => setForm(f => ({ ...f, keterangan: e.target.value }))}
              rows={2} className="input-field w-full" />
          </div>
        </div>
      </Modal>

      <Modal open={terimaOpen !== null} onClose={() => setTerimaOpen(null)} title="Catat Tanda Terima"
        description={terimaOpen?.perihal}
        footer={
          <>
            <button onClick={() => setTerimaOpen(null)} className="btn-modal-cancel">Batal</button>
            <button onClick={simpanTerima} className="btn-modal-save">Simpan</button>
          </>
        }>
        <div className="space-y-4">
          <div>
            <label className="label-field">Nama Penerima</label>
            <input value={terima.nama} onChange={e => setTerima(t => ({ ...t, nama: e.target.value }))}
              className="input-field w-full" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label-field">Jabatan Penerima</label>
              <input value={terima.jabatan} onChange={e => setTerima(t => ({ ...t, jabatan: e.target.value }))}
                className="input-field w-full" />
            </div>
            <div>
              <label className="label-field">Tanggal Diterima</label>
              <DatePicker value={terima.tanggal} onChange={v => setTerima(t => ({ ...t, tanggal: v }))} />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
