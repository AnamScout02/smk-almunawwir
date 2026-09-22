"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Inbox, Loader2, Check, X, Printer, FileText, Stamp, Clock, Pencil } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import StatTile from "@/components/admin/StatTile";
import Modal from "@/components/admin/Modal";
import Select from "@/components/admin/Select";
import { useToast } from "@/components/shared/ToastProvider";
import { JENIS_SURAT, STATUS_PERMINTAAN, labelOf, styleOf } from "@/lib/tu-konstanta";

interface SiswaRef { id: string; nis: string; user: { name: string }; class: { name: string } | null }
interface SuratReq {
  id: string; jenis: string; keperluan: string; tujuan: string | null; nomorSurat: string | null;
  tanggal: string; namaSiswa: string; nisSiswa: string | null; kelasSiswa: string | null;
  requestStatus: string | null; requestedById: string | null; requestedAt: string | null;
  rejectReason: string | null; student: SiswaRef | null;
  /** Surat keluar yang terbit dari permohonan ini — tempat suratnya dibuka & dicetak. */
  suratId: string | null;
}
interface LegalisirReq {
  id: string; documentType: string; copies: number; purpose: string; status: string;
  requestDate: string; applicantName: string;
  requestStatus: string | null; requestedById: string | null; requestedAt: string | null;
  rejectReason: string | null; student: SiswaRef | null;
}
interface Pemohon { id: string; name: string; role: string }

const DOC_LABEL: Record<string, string> = {
  IJAZAH: "Ijazah", SKHUN: "SKHUN", RAPOR: "Rapor", SKL: "Surat Ket. Lulus", LAINNYA: "Lainnya",
};

type Item =
  | { tipe: "SURAT"; row: SuratReq }
  | { tipe: "LEGALISIR"; row: LegalisirReq };

export default function PermintaanSuratManager() {
  const toast = useToast();

  const [surat, setSurat] = useState<SuratReq[]>([]);
  const [legalisir, setLegalisir] = useState<LegalisirReq[]>([]);
  const [pemohon, setPemohon] = useState<Pemohon[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("DIAJUKAN");

  const [tolak, setTolak] = useState<Item | null>(null);
  const [alasan, setAlasan] = useState("");
  const [memproses, setMemproses] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/permintaan-surat?status=${statusFilter}`)
      .then(r => r.json())
      .then((d: { surat?: SuratReq[]; legalisir?: LegalisirReq[]; pemohon?: Pemohon[] }) => {
        setSurat(Array.isArray(d.surat) ? d.surat : []);
        setLegalisir(Array.isArray(d.legalisir) ? d.legalisir : []);
        setPemohon(Array.isArray(d.pemohon) ? d.pemohon : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [statusFilter]);
  useEffect(() => { load(); }, [load]);

  const namaPemohon = (id: string | null) => {
    const p = pemohon.find(x => x.id === id);
    if (!p) return "—";
    return `${p.name}${p.role === "PARENT" ? " (Orang Tua)" : p.role === "STUDENT" ? " (Siswa)" : ""}`;
  };

  async function putuskan(item: Item, keputusan: "DISETUJUI" | "DITOLAK", rejectReason?: string) {
    setMemproses(item.row.id);
    const res = await fetch(`/api/admin/permintaan-surat/${item.row.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipe: item.tipe, keputusan, rejectReason }),
    }).catch(() => null);
    setMemproses(null);
    if (!res?.ok) return toast.error((await res?.json().catch(() => null))?.error ?? "Gagal memproses permintaan.");
    toast.success(keputusan === "DISETUJUI"
      ? "Permintaan disetujui — suratnya sudah dibuatkan di Persuratan, tinggal dicek lalu dicetak."
      : "Permintaan ditolak.");
    setTolak(null); setAlasan("");
    load();
  }

  const items: Item[] = useMemo(() => [
    ...surat.map(row => ({ tipe: "SURAT" as const, row })),
    ...legalisir.map(row => ({ tipe: "LEGALISIR" as const, row })),
  ].sort((a, b) => (a.row.requestedAt ?? "").localeCompare(b.row.requestedAt ?? "")), [surat, legalisir]);

  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Inbox size={22} />} title="Permintaan Surat"
        description="Antrian permintaan Surat Keterangan & Legalisir yang diajukan sendiri oleh siswa/orang tua lewat portal" />

      <div className="kisi-kartu kisi-kartu-3 mb-5">
        <StatTile value={items.length} label={statusFilter === "DIAJUKAN" ? "Menunggu Diproses" : "Permintaan"} icon={Clock} color="amber" />
        <StatTile value={surat.length} label="Surat Keterangan" icon={FileText} color="primary" />
        <StatTile value={legalisir.length} label="Legalisir Dokumen" icon={Stamp} color="blue" />
      </div>

      <div className="page-card p-4 mb-5 grid gap-3 md:grid-cols-2">
        <Select value={statusFilter} onChange={setStatusFilter}
          options={[
            { value: "DIAJUKAN", label: "Menunggu Diproses" },
            { value: "DISETUJUI", label: "Sudah Disetujui" },
            { value: "DITOLAK", label: "Ditolak" },
            { value: "SEMUA", label: "Semua Permintaan" },
          ]} />
        <p className="text-xs text-gray-400 self-center">
          Permintaan surat yang disetujui otomatis dibuatkan suratnya di <strong>Persuratan</strong> —
          nomor resmi, kop, dan isinya sudah terisi dari data siswa. Periksa dulu kalimatnya lewat
          tombol Edit, baru dicetak. Legalisir tetap diproses dari menu Legalisir.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-primary-500" /></div>
      ) : items.length === 0 ? (
        <EmptyState icon={Inbox}
          title={statusFilter === "DIAJUKAN" ? "Tidak Ada Antrian" : "Belum Ada Data"}
          description={statusFilter === "DIAJUKAN"
            ? "Semua permintaan sudah diproses. Permintaan baru dari portal siswa/orang tua akan muncul di sini."
            : "Belum ada permintaan dengan status ini."} />
      ) : (
        <div className="page-card overflow-hidden">
          <div className="overflow-auto scrollbar-visible">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Diajukan</th><th>Siswa</th><th>Jenis Permintaan</th><th>Keperluan</th>
                  <th>Diajukan Oleh</th><th>Status</th><th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const r = item.row;
                  const isSurat = item.tipe === "SURAT";
                  const s = isSurat ? (r as SuratReq) : null;
                  const l = !isSurat ? (r as LegalisirReq) : null;
                  return (
                    <tr key={`${item.tipe}-${r.id}`}>
                      <td className="whitespace-nowrap text-sm">{fmt(r.requestedAt)}</td>
                      <td>
                        <span className="font-medium">{r.student?.user.name ?? (s?.namaSiswa ?? l?.applicantName ?? "—")}</span>
                        <span className="block text-xs text-gray-400">
                          {r.student?.nis ?? s?.nisSiswa ?? "—"}
                          {r.student?.class?.name ? ` · ${r.student.class.name}` : ""}
                        </span>
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                          {isSurat ? <FileText size={14} className="text-primary-500" /> : <Stamp size={14} className="text-blue-500" />}
                          {isSurat ? labelOf(JENIS_SURAT, s!.jenis) : `Legalisir ${DOC_LABEL[l!.documentType] ?? l!.documentType}`}
                        </span>
                        <span className="block text-xs text-gray-400">
                          {isSurat ? (s!.nomorSurat ?? "Nomor terbit saat disetujui") : `${l!.copies} rangkap`}
                        </span>
                      </td>
                      <td className="text-sm max-w-[16rem]">
                        {isSurat ? s!.keperluan : l!.purpose}
                        {isSurat && s!.tujuan ? <span className="block text-xs text-gray-400">Tujuan: {s!.tujuan}</span> : null}
                        {r.rejectReason ? <span className="block text-xs text-red-600">Ditolak: {r.rejectReason}</span> : null}
                      </td>
                      <td className="text-sm">{namaPemohon(r.requestedById)}</td>
                      <td>
                        <span className={`px-2 py-0.5 rounded-full border text-xs font-semibold ${styleOf(STATUS_PERMINTAAN, r.requestStatus ?? "")}`}>
                          {labelOf(STATUS_PERMINTAAN, r.requestStatus ?? "")}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          {r.requestStatus === "DIAJUKAN" && (
                            <>
                              <button onClick={() => putuskan(item, "DISETUJUI")} disabled={memproses === r.id}
                                title="Setujui" className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-40">
                                {memproses === r.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                              </button>
                              <button onClick={() => { setTolak(item); setAlasan(""); }} title="Tolak"
                                className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition">
                                <X size={14} />
                              </button>
                            </>
                          )}
                          {r.requestStatus === "DISETUJUI" && (isSurat ? (
                            s!.suratId ? (
                              <>
                                <Link href={`/dashboard/admin/persuratan/${s!.suratId}/edit`} title="Periksa & perbaiki isi surat"
                                  className="p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg transition-colors">
                                  <Pencil size={14} />
                                </Link>
                                <Link href={`/dashboard/admin/persuratan/${s!.suratId}/cetak`} title="Cetak surat"
                                  className="p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg transition-colors">
                                  <Printer size={14} />
                                </Link>
                              </>
                            ) : (
                              <Link href={`/dashboard/admin/surat-keterangan/${r.id}/cetak`} title="Buka untuk dicetak"
                                className="p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg transition-colors">
                                <Printer size={14} />
                              </Link>
                            )
                          ) : (
                            <Link href="/dashboard/admin/legalisir" title="Buka untuk dicetak"
                              className="p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg transition-colors">
                              <Printer size={14} />
                            </Link>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={tolak !== null} onClose={() => setTolak(null)} title="Tolak Permintaan"
        description="Alasannya ditampilkan ke siswa/orang tua di portal mereka, jadi tulis yang jelas."
        footer={
          <>
            <button onClick={() => setTolak(null)} className="btn-modal-cancel">Batal</button>
            <button onClick={() => { if (tolak && alasan.trim()) putuskan(tolak, "DITOLAK", alasan.trim()); else toast.error("Alasan penolakan wajib diisi."); }}
              className="btn-modal-save">Tolak Permintaan</button>
          </>
        }>
        <label className="label-field">Alasan Penolakan</label>
        <textarea value={alasan} onChange={e => setAlasan(e.target.value)} rows={3}
          placeholder="Contoh: Ijazah belum bisa dilegalisir karena berkas asli masih di Dinas."
          className="input-field w-full" />
      </Modal>
    </div>
  );
}
