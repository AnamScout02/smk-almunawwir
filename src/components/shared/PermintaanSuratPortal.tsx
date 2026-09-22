"use client";
import { useCallback, useEffect, useState } from "react";
import { FileText, Loader2, Plus, Stamp, Clock, CheckCircle2, XCircle } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import Modal from "@/components/admin/Modal";
import Select from "@/components/admin/Select";
import { useToast } from "@/components/shared/ToastProvider";
import { JENIS_SURAT, STATUS_PERMINTAAN, labelOf, styleOf } from "@/lib/tu-konstanta";

interface Siswa { id: string; nis: string; nama: string; kelas: string | null }
interface SuratRow {
  id: string; jenis: string; keperluan: string; tujuan: string | null; nomorSurat: string | null;
  requestStatus: string | null; requestedAt: string | null; rejectReason: string | null; studentId: string | null;
}
interface LegalisirRow {
  id: string; documentType: string; copies: number; purpose: string; status: string;
  requestStatus: string | null; requestedAt: string | null; rejectReason: string | null;
  pickupDate: string | null; studentId: string | null;
}

const DOKUMEN_LEGALISIR = [
  { value: "IJAZAH", label: "Ijazah" },
  { value: "SKHUN", label: "SKHUN" },
  { value: "RAPOR", label: "Rapor" },
  { value: "SKL", label: "Surat Keterangan Lulus" },
  { value: "LAINNYA", label: "Dokumen Lain" },
];

const ICON_STATUS: Record<string, typeof Clock> = {
  DIAJUKAN: Clock, DISETUJUI: CheckCircle2, DITOLAK: XCircle,
};

/** Portal pengajuan surat untuk siswa & orang tua — komponen yang SAMA dipakai kedua portal
 * (pola "Manager" §13 DESIGN_SYSTEM). Siapa boleh mengajukan untuk siapa ditentukan di server
 * (lihat src/lib/permintaan-surat.ts), komponen ini tidak menentukan apa pun soal hak akses. */
export default function PermintaanSuratPortal({ untukOrangTua = false }: { untukOrangTua?: boolean }) {
  const toast = useToast();

  const [siswa, setSiswa] = useState<Siswa[]>([]);
  const [surat, setSurat] = useState<SuratRow[]>([]);
  const [legalisir, setLegalisir] = useState<LegalisirRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    tipe: "SURAT", studentId: "", jenis: "AKTIF", documentType: "IJAZAH",
    copies: "1", keperluan: "", tujuan: "",
  });

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/permintaan-surat")
      .then(r => r.json())
      .then((d: { siswa?: Siswa[]; surat?: SuratRow[]; legalisir?: LegalisirRow[] }) => {
        setSiswa(Array.isArray(d.siswa) ? d.siswa : []);
        setSurat(Array.isArray(d.surat) ? d.surat : []);
        setLegalisir(Array.isArray(d.legalisir) ? d.legalisir : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setForm({
      tipe: "SURAT", studentId: siswa[0]?.id ?? "", jenis: "AKTIF", documentType: "IJAZAH",
      copies: "1", keperluan: "", tujuan: "",
    });
    setOpen(true);
  }

  async function kirim() {
    if (!form.keperluan.trim()) return toast.error("Keperluan wajib diisi.");
    setSaving(true);
    const res = await fetch("/api/permintaan-surat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipe: form.tipe, studentId: form.studentId || siswa[0]?.id,
        jenis: form.jenis, documentType: form.documentType,
        copies: Number(form.copies) || 1, keperluan: form.keperluan, tujuan: form.tujuan,
      }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) return toast.error((await res?.json().catch(() => null))?.error ?? "Gagal mengirim permintaan.");
    toast.success("Permintaan terkirim. Tunggu diproses petugas Tata Usaha.");
    setOpen(false);
    load();
  }

  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "—";
  const namaSiswa = (id: string | null) => siswa.find(s => s.id === id)?.nama ?? "";
  const total = surat.length + legalisir.length;

  function KartuStatus({ status, alasan }: { status: string | null; alasan: string | null }) {
    const Icon = ICON_STATUS[status ?? ""] ?? Clock;
    return (
      <div>
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-semibold ${styleOf(STATUS_PERMINTAAN, status ?? "")}`}>
          <Icon size={12} /> {labelOf(STATUS_PERMINTAAN, status ?? "")}
        </span>
        {alasan && <span className="block text-xs text-red-600 mt-1">{alasan}</span>}
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<FileText size={22} />} title="Permintaan Surat"
        description={untukOrangTua
          ? "Ajukan Surat Keterangan atau legalisir dokumen untuk anak Anda tanpa perlu datang ke sekolah"
          : "Ajukan Surat Keterangan atau legalisir dokumen tanpa perlu antre di ruang Tata Usaha"} />

      <div className="alat-aksi justify-end mb-5">
        <button onClick={openAdd} disabled={siswa.length === 0} className="btn-modal-save btn-teks disabled:opacity-40">
          <Plus size={16} /> Ajukan Permintaan
        </button>
      </div>

      <div className="page-card p-4 mb-5">
        <p className="text-sm text-gray-600">
          Permintaan yang dikirim akan diperiksa petugas Tata Usaha. Kalau disetujui, suratnya
          dicetak dan bisa diambil di ruang TU — status di halaman ini ikut berubah, jadi tidak
          perlu bolak-balik menanyakan.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-primary-500" /></div>
      ) : total === 0 ? (
        <EmptyState icon={FileText} title="Belum Ada Permintaan"
          description="Ajukan permintaan pertama lewat tombol di atas." />
      ) : (
        <div className="space-y-5">
          {surat.length > 0 && (
            <div className="page-card overflow-hidden">
              <div className="px-4 py-2.5 flex items-center gap-2 border-b border-gray-100 bg-white">
                <FileText size={15} />
                <span className="font-heading font-semibold text-sm">Surat Keterangan</span>
                <span className="text-xs text-gray-500 ml-auto">{surat.length} permintaan</span>
              </div>
              <div className="overflow-auto scrollbar-visible">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Diajukan</th>{untukOrangTua && <th>Untuk</th>}
                      <th>Jenis Surat</th><th>Keperluan</th><th>Nomor Surat</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {surat.map(s => (
                      <tr key={s.id}>
                        <td className="whitespace-nowrap text-sm">{fmt(s.requestedAt)}</td>
                        {untukOrangTua && <td className="text-sm">{namaSiswa(s.studentId)}</td>}
                        <td className="font-medium">{labelOf(JENIS_SURAT, s.jenis)}</td>
                        <td className="text-sm max-w-[16rem]">
                          {s.keperluan}
                          {s.tujuan ? <span className="block text-xs text-gray-400">Tujuan: {s.tujuan}</span> : null}
                        </td>
                        <td className="text-xs">{s.nomorSurat || "—"}</td>
                        <td><KartuStatus status={s.requestStatus} alasan={s.rejectReason} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {legalisir.length > 0 && (
            <div className="page-card overflow-hidden">
              <div className="px-4 py-2.5 flex items-center gap-2 border-b border-gray-100 bg-white">
                <Stamp size={15} />
                <span className="font-heading font-semibold text-sm">Legalisir Dokumen</span>
                <span className="text-xs text-gray-500 ml-auto">{legalisir.length} permintaan</span>
              </div>
              <div className="overflow-auto scrollbar-visible">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Diajukan</th>{untukOrangTua && <th>Untuk</th>}
                      <th>Dokumen</th><th>Rangkap</th><th>Keperluan</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {legalisir.map(l => (
                      <tr key={l.id}>
                        <td className="whitespace-nowrap text-sm">{fmt(l.requestedAt)}</td>
                        {untukOrangTua && <td className="text-sm">{namaSiswa(l.studentId)}</td>}
                        <td className="font-medium">{labelOf(DOKUMEN_LEGALISIR, l.documentType)}</td>
                        <td className="text-center">{l.copies}</td>
                        <td className="text-sm max-w-[16rem]">{l.purpose}</td>
                        <td>
                          <KartuStatus status={l.requestStatus} alasan={l.rejectReason} />
                          {l.requestStatus === "DISETUJUI" && (
                            <span className="block text-xs text-gray-400 mt-1">
                              {l.pickupDate ? `Sudah diambil ${fmt(l.pickupDate)}` : "Bisa diambil di ruang TU"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} scrollBody title="Ajukan Permintaan Surat"
        footer={
          <>
            <button onClick={() => setOpen(false)} className="btn-modal-cancel">Batal</button>
            <button onClick={kirim} disabled={saving} className="btn-modal-save">
              {saving && <Loader2 size={15} className="animate-spin" />} Kirim Permintaan
            </button>
          </>
        }>
        <div className="space-y-4">
          {siswa.length > 1 && (
            <div>
              <label className="label-field">Untuk Siswa</label>
              <Select value={form.studentId} onChange={v => setForm(f => ({ ...f, studentId: v }))}
                options={siswa.map(s => ({ value: s.id, label: `${s.nama}${s.kelas ? ` — ${s.kelas}` : ""}` }))} />
            </div>
          )}

          <div>
            <label className="label-field">Jenis Permintaan</label>
            <Select value={form.tipe} onChange={v => setForm(f => ({ ...f, tipe: v }))}
              options={[
                { value: "SURAT", label: "Surat Keterangan" },
                { value: "LEGALISIR", label: "Legalisir Dokumen" },
              ]} />
          </div>

          {form.tipe === "SURAT" ? (
            <div>
              <label className="label-field">Surat yang Dibutuhkan</label>
              <Select value={form.jenis} onChange={v => setForm(f => ({ ...f, jenis: v }))}
                options={JENIS_SURAT.map(j => ({ value: j.value, label: j.label }))} />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="label-field">Dokumen</label>
                <Select value={form.documentType} onChange={v => setForm(f => ({ ...f, documentType: v }))}
                  options={DOKUMEN_LEGALISIR} />
              </div>
              <div>
                <label className="label-field">Jumlah Rangkap</label>
                <input type="number" min={1} max={20} value={form.copies}
                  onChange={e => setForm(f => ({ ...f, copies: e.target.value }))} className="input-field w-full" />
              </div>
            </div>
          )}

          <div>
            <label className="label-field">Keperluan</label>
            <textarea value={form.keperluan} onChange={e => setForm(f => ({ ...f, keperluan: e.target.value }))}
              rows={3} placeholder="Contoh: Syarat pendaftaran beasiswa / melamar pekerjaan"
              className="input-field w-full" />
          </div>

          {form.tipe === "SURAT" && (
            <div>
              <label className="label-field">Ditujukan Kepada (opsional)</label>
              <input value={form.tujuan} onChange={e => setForm(f => ({ ...f, tujuan: e.target.value }))}
                placeholder="Nama instansi/lembaga" className="input-field w-full" />
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
