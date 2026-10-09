"use client";
import { useCallback, useEffect, useState } from "react";
import { FileText, Loader2, CheckCircle2, RotateCcw, Search, ExternalLink } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import Modal from "@/components/admin/Modal";
import { BarisKembali } from "@/components/shared/TombolKembali";
import { useToast } from "@/components/shared/ToastProvider";

type Baris = { id: string; nama: string; nis: string; kelas: string | null; tempat: string; guru: string | null; url: string; status: string; catatan: string | null; pada: string | null };
const STATUS: Record<string, { label: string; kelas: string }> = {
  DIKIRIM: { label: "Menunggu diperiksa", kelas: "bg-amber-50 text-amber-700 border-amber-200" },
  REVISI: { label: "Diminta revisi", kelas: "bg-red-50 text-red-600 border-red-200" },
  DISETUJUI: { label: "Disetujui", kelas: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

/** LAPORAN AKHIR PKL (9 Okt 2026) — siswa mengunggah PDF, guru pembimbing / panitia PKL menyetujui atau meminta revisi.
 *  Dipakai Pusat PKL (semua siswa) dan portal guru (bimbingannya saja — cakupan ditentukan SERVER). */
export default function LaporanAkhirPklManager({ kembaliHref }: { kembaliHref?: string }) {
  const toast = useToast();
  const [data, setData] = useState<Baris[] | null>(null);
  const [cari, setCari] = useState("");
  const [saring, setSaring] = useState("");
  const [revisi, setRevisi] = useState<Baris | null>(null);
  const [catatan, setCatatan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const muat = useCallback(() => {
    fetch("/api/pkl/laporan-akhir").then(r => r.json()).then(d => setData(d.laporan ?? [])).catch(() => setData([]));
  }, []);
  useEffect(() => { muat(); }, [muat]);

  async function putuskan(b: Baris, status: "DISETUJUI" | "REVISI", cat = "") {
    setSibuk(true);
    try {
      const r = await fetch("/api/pkl/laporan-akhir", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: b.id, status, catatan: cat }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(j.error ?? "Gagal menyimpan."); return; }
      toast.success(status === "DISETUJUI" ? "Laporan disetujui." : "Permintaan revisi terkirim ke siswa."); setRevisi(null); setCatatan(""); muat();
    } catch { toast.error("Gagal menyimpan."); } finally { setSibuk(false); }
  }
  const d = data ?? [];
  const q = cari.trim().toLowerCase();
  const tampil = d.filter(b => (!saring || b.status === saring) && (!q || `${b.nama} ${b.nis} ${b.kelas ?? ""} ${b.tempat}`.toLowerCase().includes(q)));
  const hitung = (s: string) => d.filter(b => b.status === s).length;
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<FileText size={22} />} title="Laporan Akhir PKL" description="Periksa laporan akhir yang dikirim siswa: setujui atau minta revisi" />
      {kembaliHref && <BarisKembali href={kembaliHref} />}
      <div className="space-y-6">
        <div className="kisi-kartu kisi-kartu-3">
          <StatTile value={hitung("DIKIRIM")} label="Menunggu diperiksa" icon={FileText} color="amber" sorot={hitung("DIKIRIM") > 0} />
          <StatTile value={hitung("REVISI")} label="Diminta revisi" icon={RotateCcw} color="red" />
          <StatTile value={hitung("DISETUJUI")} label="Disetujui" icon={CheckCircle2} color="emerald" />
        </div>
        <div className="baris-alat">
          <div className="alat-cari"><Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" /><input className="input-field pl-10" value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari nama, kelas, atau tempat PKL" /></div>
          <div className="alat-tab flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-gray-100 bg-white p-1 scrollbar-hide">
            {[["", "Semua"], ["DIKIRIM", "Menunggu"], ["REVISI", "Revisi"], ["DISETUJUI", "Disetujui"]].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setSaring(k)} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition ${saring === k ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>{l}</button>
            ))}
          </div>
        </div>
        <div className="panel overflow-hidden">
          {!data ? <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
            : tampil.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">{d.length ? "Tidak ada laporan yang cocok." : "Belum ada siswa yang mengirim laporan akhir."}</p> : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr><th className="w-10">No</th><th>Siswa</th><th>Tempat PKL</th><th>Dikirim</th><th>Status</th><th className="text-right">Aksi</th></tr></thead>
                  <tbody>{tampil.map((b, i) => (
                    <tr key={b.id}>
                      <td className="angka">{i + 1}</td>
                      <td><span className="font-medium text-primary-900">{b.nama}</span><span className="block text-xs text-gray-400">{b.kelas ?? "—"}{b.guru ? ` · ${b.guru}` : ""}</span></td>
                      <td className="text-gray-600">{b.tempat}</td>
                      <td className="angka whitespace-nowrap text-gray-600">{b.pada ? new Date(b.pada).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }) : "—"}</td>
                      <td><span className={`status-badge ${STATUS[b.status]?.kelas ?? ""}`}>{STATUS[b.status]?.label ?? b.status}</span>{b.status === "REVISI" && b.catatan && <span className="mt-1 block max-w-xs text-xs text-gray-500">{b.catatan}</span>}</td>
                      <td><div className="flex justify-end gap-1.5">
                        <a href={b.url} target="_blank" rel="noreferrer" className="btn-modal-cancel px-3 text-xs"><ExternalLink size={14} /> Buka</a>
                        {b.status !== "DISETUJUI" && <button type="button" disabled={sibuk} onClick={() => putuskan(b, "DISETUJUI")} className="btn-modal-save px-3 text-xs"><CheckCircle2 size={14} /> Setujui</button>}
                        {b.status !== "DISETUJUI" && <button type="button" disabled={sibuk} onClick={() => { setRevisi(b); setCatatan(b.catatan ?? ""); }} className="btn-modal-cancel px-3 text-xs"><RotateCcw size={14} /> Revisi</button>}
                      </div></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
        </div>
      </div>
      <Modal open={!!revisi} onClose={() => setRevisi(null)} title="Minta Revisi" description={revisi ? `${revisi.nama} · ${revisi.tempat}` : ""}
        footer={<><button type="button" className="btn-modal-cancel" onClick={() => setRevisi(null)}>Batal</button><button type="button" className="btn-modal-save" disabled={sibuk} onClick={() => revisi && putuskan(revisi, "REVISI", catatan)}>{sibuk && <Loader2 size={14} className="animate-spin" />} Kirim ke Siswa</button></>}>
        <label className="label-field">Apa yang perlu diperbaiki</label>
        <textarea className="input-field" rows={4} value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="Mis. Bab III belum memuat uraian kegiatan per minggu; lampiran foto kurang." />
      </Modal>
    </div>
  );
}
