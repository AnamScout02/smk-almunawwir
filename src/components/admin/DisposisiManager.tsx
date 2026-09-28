"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Forward, Loader2, Plus, Search, Printer, Edit2, Trash2, CheckCircle2, Paperclip, Inbox, Clock,
} from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import StatTile from "@/components/admin/StatTile";
import Modal from "@/components/admin/Modal";
import Select from "@/components/admin/Select";
import DatePicker from "@/components/shared/DatePicker";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { SIFAT_DISPOSISI, STATUS_DISPOSISI, TUJUAN_DISPOSISI_UMUM, labelOf, styleOf } from "@/lib/tu-konstanta";

interface SuratRow { id: string; nomor: string; tanggal: string; pihak: string; perihal: string; fileUrl: string | null }
interface Disposisi {
  id: string; suratId: string; tanggal: string; tujuan: string[]; instruksi: string;
  sifat: string; batasWaktu: string | null; status: string; tindakLanjut: string | null;
  selesaiAt: string | null; dariNama: string | null; surat: SuratRow;
}

const todayStr = () => new Date().toLocaleDateString("sv-SE");

interface FormState {
  suratId: string; tanggal: string; tujuan: string[]; tujuanLain: string;
  instruksi: string; sifat: string; batasWaktu: string; dariNama: string;
}
const EMPTY: FormState = {
  suratId: "", tanggal: todayStr(), tujuan: [], tujuanLain: "",
  instruksi: "", sifat: "BIASA", batasWaktu: "", dariNama: "",
};

export default function DisposisiManager() {
  const toast = useToast();
  const confirmDialog = useConfirm();

  const [rows, setRows] = useState<Disposisi[]>([]);
  const [surat, setSurat] = useState<SuratRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  const [tlOpen, setTlOpen] = useState<Disposisi | null>(null);
  const [tlText, setTlText] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/admin/disposisi").then(r => r.json()).catch(() => []),
      fetch("/api/admin/surat?tipe=MASUK").then(r => r.json()).catch(() => []),
    ])
      .then(([d, s]) => {
        setRows(Array.isArray(d) ? d : []);
        setSurat(Array.isArray(s) ? s : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  function openAdd(suratId?: string) {
    setEditingId(null);
    setForm({ ...EMPTY, tanggal: todayStr(), suratId: suratId ?? "" });
    setModalOpen(true);
  }
  function openEdit(d: Disposisi) {
    setEditingId(d.id);
    // Tujuan yang tidak ada di daftar umum dikembalikan ke kolom isian bebas, bukan hilang.
    const baku = d.tujuan.filter(t => TUJUAN_DISPOSISI_UMUM.includes(t));
    const lain = d.tujuan.filter(t => !TUJUAN_DISPOSISI_UMUM.includes(t));
    setForm({
      suratId: d.suratId, tanggal: d.tanggal.slice(0, 10), tujuan: baku, tujuanLain: lain.join(", "),
      instruksi: d.instruksi, sifat: d.sifat, batasWaktu: d.batasWaktu?.slice(0, 10) ?? "",
      dariNama: d.dariNama ?? "",
    });
    setModalOpen(true);
  }

  function toggleTujuan(t: string) {
    setForm(f => ({ ...f, tujuan: f.tujuan.includes(t) ? f.tujuan.filter(x => x !== t) : [...f.tujuan, t] }));
  }

  async function handleSave() {
    if (!form.suratId) return toast.error("Surat masuk wajib dipilih.");
    const tujuan = [...form.tujuan, ...form.tujuanLain.split(",").map(t => t.trim()).filter(Boolean)];
    if (tujuan.length === 0) return toast.error("Tujuan disposisi wajib dipilih minimal satu.");
    if (!form.instruksi.trim()) return toast.error("Isi instruksi wajib diisi.");

    setSaving(true);
    const res = await fetch(editingId ? `/api/admin/disposisi/${editingId}` : "/api/admin/disposisi", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, tujuan, batasWaktu: form.batasWaktu || null }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) return toast.error((await res?.json().catch(() => null))?.error ?? "Gagal menyimpan disposisi.");
    toast.success(editingId ? "Disposisi diperbarui." : "Disposisi dibuat.");
    setModalOpen(false);
    load();
  }

  async function ubahStatus(d: Disposisi, status: string, tindakLanjut?: string) {
    const res = await fetch(`/api/admin/disposisi/${d.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, ...(tindakLanjut !== undefined ? { tindakLanjut } : {}) }),
    }).catch(() => null);
    if (!res?.ok) return toast.error("Gagal memperbarui status.");
    toast.success(status === "SELESAI" ? "Disposisi ditandai selesai." : "Status diperbarui.");
    load();
  }

  async function handleDelete(d: Disposisi) {
    if (!(await confirmDialog(`Hapus disposisi untuk surat "${d.surat.perihal}"?`))) return;
    const res = await fetch(`/api/admin/disposisi/${d.id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) return toast.error("Gagal menghapus.");
    toast.success("Disposisi dihapus.");
    load();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(d =>
      (!q || d.surat.perihal.toLowerCase().includes(q) || d.surat.pihak.toLowerCase().includes(q) ||
        d.surat.nomor.toLowerCase().includes(q) || d.instruksi.toLowerCase().includes(q) ||
        d.tujuan.join(" ").toLowerCase().includes(q)) &&
      (!statusFilter || d.status === statusFilter)
    );
  }, [rows, search, statusFilter]);

  /** Surat masuk yang belum pernah didisposisikan — inilah yang sebenarnya perlu perhatian TU,
   * bukan sekadar disposisi yang belum selesai. */
  const belumDidisposisi = useMemo(() => {
    const sudah = new Set(rows.map(d => d.suratId));
    return surat.filter(s => !sudah.has(s.id));
  }, [rows, surat]);

  const jml = (s: string) => rows.filter(d => d.status === s).length;
  const fmt = (d: string) => new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  const lewatTempo = (d: Disposisi) =>
    d.status !== "SELESAI" && d.batasWaktu != null && new Date(d.batasWaktu) < new Date(todayStr());

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Forward size={22} />} title="Disposisi Surat Masuk"
        description="Meneruskan surat masuk ke pihak yang menangani, lengkap dengan instruksi dan pelacakan tindak lanjutnya" />

      <div className="kisi-kartu kisi-kartu-4 mb-5">
        <StatTile value={belumDidisposisi.length} label="Surat Belum Didisposisi" icon={Inbox} color="red" />
        <StatTile value={jml("BARU")} label="Belum Ditindaklanjuti" icon={Clock} color="amber" />
        <StatTile value={jml("DIPROSES")} label="Sedang Diproses" icon={Forward} color="blue" />
        <StatTile value={jml("SELESAI")} label="Selesai" icon={CheckCircle2} color="emerald" />
      </div>

      {belumDidisposisi.length > 0 && (
        <div className="page-card p-4 mb-5 border-l-4 border-l-red-400">
          <p className="text-sm font-semibold text-red-700 mb-1">
            {belumDidisposisi.length} surat masuk belum didisposisikan
          </p>
          <p className="text-xs text-gray-500 mb-3">
            Surat yang tercatat di Persuratan tapi belum diteruskan ke siapa pun. Klik untuk membuat disposisinya.
          </p>
          <div className="flex flex-wrap gap-2">
            {belumDidisposisi.slice(0, 8).map(s => (
              <button key={s.id} onClick={() => openAdd(s.id)}
                className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition text-left">
                <span className="font-semibold">{s.perihal}</span>
                <span className="block text-xs text-red-500">{s.pihak} · {fmt(s.tanggal)}</span>
              </button>
            ))}
            {belumDidisposisi.length > 8 && (
              <span className="text-xs text-gray-400 self-center">+{belumDidisposisi.length - 8} lagi</span>
            )}
          </div>
        </div>
      )}

      <div className="page-card p-4 mb-5 baris-alat">
        <div className="alat-cari">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari perihal, pengirim, nomor, tujuan..." className="input-field pl-10 w-full" />
        </div>
        <div className="alat-saring">
          <Select value={statusFilter} onChange={setStatusFilter} placeholder="Semua Status"
            options={[{ value: "", label: "Semua Status" }, ...STATUS_DISPOSISI.map(s => ({ value: s.value, label: s.label }))]} />
        </div>
        <div className="alat-aksi">
          <button onClick={() => openAdd()} className="btn-modal-save">
            <Plus size={16} /> Buat Disposisi
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Forward} title="Belum Ada Disposisi"
          description="Buat disposisi pertama dari surat masuk yang sudah tercatat di Persuratan." />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="Tidak Ditemukan" description="Tidak ada disposisi yang cocok dengan filter." />
      ) : (
        <>
          <div className="page-card overflow-hidden">
            <div className="overflow-auto scrollbar-visible">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tanggal</th><th>Surat</th><th>Diteruskan Kepada</th><th>Instruksi</th>
                    <th>Sifat</th><th>Status</th><th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(d => (
                    <tr key={d.id} className={lewatTempo(d) ? "bg-red-50/40" : undefined}>
                      <td className="whitespace-nowrap">{fmt(d.tanggal)}</td>
                      <td className="max-w-[16rem]">
                        <span className="font-medium">{d.surat.perihal}</span>
                        <span className="block text-xs text-gray-400">{d.surat.pihak} · {d.surat.nomor}</span>
                        {d.surat.fileUrl && (
                          <a href={d.surat.fileUrl} target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary-700 hover:underline mt-0.5">
                            <Paperclip size={11} /> Lampiran
                          </a>
                        )}
                      </td>
                      <td className="text-sm max-w-[14rem]">{d.tujuan.join(", ")}</td>
                      <td className="text-sm max-w-[16rem]">
                        {d.instruksi}
                        {d.batasWaktu && (
                          <span className={`block text-xs ${lewatTempo(d) ? "text-red-600 font-semibold" : "text-gray-400"}`}>
                            Batas: {fmt(d.batasWaktu)}{lewatTempo(d) ? " — lewat tempo" : ""}
                          </span>
                        )}
                        {d.tindakLanjut && <span className="block text-xs text-emerald-700 mt-0.5">↳ {d.tindakLanjut}</span>}
                      </td>
                      <td>
                        <span className={`px-2 py-0.5 rounded-full border text-xs font-semibold ${styleOf(SIFAT_DISPOSISI, d.sifat)}`}>
                          {labelOf(SIFAT_DISPOSISI, d.sifat)}
                        </span>
                      </td>
                      <td>
                        <span className={`px-2 py-0.5 rounded-full border text-xs font-semibold ${styleOf(STATUS_DISPOSISI, d.status)}`}>
                          {labelOf(STATUS_DISPOSISI, d.status)}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <Link href={`/dashboard/admin/disposisi/${d.id}/cetak`} title="Cetak lembar disposisi"
                            className="p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg transition-colors">
                            <Printer size={14} />
                          </Link>
                          {d.status !== "SELESAI" && (
                            <button onClick={() => { setTlOpen(d); setTlText(d.tindakLanjut ?? ""); }} title="Tandai selesai"
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                              <CheckCircle2 size={14} />
                            </button>
                          )}
                          {d.status === "BARU" && (
                            <button onClick={() => ubahStatus(d, "DIPROSES")} title="Tandai sedang diproses"
                              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
                              <Clock size={14} />
                            </button>
                          )}
                          <button onClick={() => openEdit(d)} title="Edit"
                            className="p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg transition-colors">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleDelete(d)} title="Hapus"
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
          <p className="text-xs text-gray-400 mt-3">Menampilkan {filtered.length} dari {rows.length} disposisi</p>
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} scrollBody size="lg"
        title={editingId ? "Edit Disposisi" : "Buat Disposisi"}
        description={editingId ? undefined : "Meneruskan surat masuk ke pihak yang menangani"}
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
            <label className="label-field">Surat Masuk</label>
            <Select value={form.suratId} onChange={v => setForm(f => ({ ...f, suratId: v }))}
              placeholder="Pilih surat masuk..."
              options={surat.map(s => ({ value: s.id, label: `${s.perihal} — ${s.pihak} (${fmt(s.tanggal)})` }))} />
            {surat.length === 0 && (
              <p className="text-sm text-amber-600 mt-1">
                Belum ada surat masuk tercatat. Catat dulu di menu Persuratan.
              </p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label-field">Tanggal Disposisi</label>
              <DatePicker value={form.tanggal} onChange={v => setForm(f => ({ ...f, tanggal: v }))} />
            </div>
            <div>
              <label className="label-field">Sifat</label>
              <Select value={form.sifat} onChange={v => setForm(f => ({ ...f, sifat: v }))}
                options={SIFAT_DISPOSISI.map(s => ({ value: s.value, label: s.label }))} />
            </div>
          </div>

          <div>
            <label className="label-field">Diteruskan Kepada</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {TUJUAN_DISPOSISI_UMUM.map(t => (
                <button key={t} type="button" onClick={() => toggleTujuan(t)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                    form.tujuan.includes(t)
                      ? "bg-primary-700 text-white border-primary-700"
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
                  {t}
                </button>
              ))}
            </div>
            <input value={form.tujuanLain} onChange={e => setForm(f => ({ ...f, tujuanLain: e.target.value }))}
              placeholder="Tujuan lain (pisahkan dengan koma)" className="input-field w-full mt-2" />
          </div>

          <div>
            <label className="label-field">Isi Instruksi</label>
            <textarea value={form.instruksi} onChange={e => setForm(f => ({ ...f, instruksi: e.target.value }))}
              rows={3} placeholder="Contoh: Untuk ditindaklanjuti dan dibuatkan laporan kegiatannya."
              className="input-field w-full" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label-field">Batas Waktu (opsional)</label>
              <DatePicker value={form.batasWaktu} onChange={v => setForm(f => ({ ...f, batasWaktu: v }))} />
            </div>
            <div>
              <label className="label-field">Pemberi Disposisi</label>
              <input value={form.dariNama} onChange={e => setForm(f => ({ ...f, dariNama: e.target.value }))}
                placeholder="Kepala Sekolah" className="input-field w-full" />
            </div>
          </div>
        </div>
      </Modal>

      <Modal open={tlOpen !== null} onClose={() => setTlOpen(null)} title="Tandai Selesai"
        description="Catat singkat apa yang sudah dikerjakan — jadi bukti tindak lanjut saat diperiksa."
        footer={
          <>
            <button onClick={() => setTlOpen(null)} className="btn-modal-cancel">Batal</button>
            <button onClick={() => { if (tlOpen) { ubahStatus(tlOpen, "SELESAI", tlText.trim() || undefined); setTlOpen(null); } }}
              className="btn-modal-save">Tandai Selesai</button>
          </>
        }>
        <label className="label-field">Tindak Lanjut</label>
        <textarea value={tlText} onChange={e => setTlText(e.target.value)} rows={3}
          placeholder="Contoh: Sudah dibuatkan surat balasan nomor 214/B.2/... tanggal 12 September 2026."
          className="input-field w-full" />
      </Modal>
    </div>
  );
}
