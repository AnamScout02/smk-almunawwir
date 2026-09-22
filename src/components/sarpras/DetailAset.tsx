"use client";
import { Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Boxes, CalendarClock, Hammer, Loader2 } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import { FormLaporKerusakan, FormPinjam } from "@/components/sarpras/LayananSarprasManager";
import { KONDISI, STATUS_RUSAK, rentang, tgl } from "@/components/sarpras/sarpras-umum";

interface Aset { id: string; name: string; category: string; quantity: number; condition: string; location: string | null; kodeInventaris: string | null; acquiredDate: string | null; fundingSource: string | null; notes: string | null;
  perawatan: { id: string; judul: string; berikutnya: string; terakhir: string | null; aktif: boolean }[];
  peminjaman: { id: string; peminjamNama: string; mulai: string; selesai: string; status: string; jumlah: number }[] }
interface Data {
  akses: { kelola: boolean }; aset: Aset; kerusakanTerbuka: number;
  riwayat: null | { mutasi: { id: string; dari: string | null; ke: string | null; olehNama: string; tanggal: string; catatan: string | null }[]; kerusakan: { id: string; reportDate: string; description: string; status: string; reportedBy: string | null; repairNotes: string | null }[] };
}
const WARNA_KONDISI: Record<string, string> = { BAIK: "bg-emerald-50 text-emerald-700 border-emerald-200", RUSAK_RINGAN: "bg-amber-50 text-amber-700 border-amber-200", RUSAK_BERAT: "bg-red-50 text-red-600 border-red-200" };

/** DETAIL ASET — tujuan QR label. Semua guru & staf bisa melapor kerusakan / meminjam; pengelola melihat riwayat. */
export default function DetailAset({ id, inventarisHref }: { id: string; inventarisHref?: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [galat, setGalat] = useState("");
  const [lapor, setLapor] = useState(false);
  const [pinjam, setPinjam] = useState(false);
  const muat = useCallback(() => {
    fetch(`/api/sarpras/aset/${encodeURIComponent(id)}`, { cache: "no-store" }).then(async r => {
      const d = await r.json().catch(() => null);
      if (!r.ok) setGalat(d?.error ?? "Gagal memuat."); else setData(d);
    }).catch(() => setGalat("Gagal memuat."));
  }, [id]);
  useEffect(() => { muat(); }, [muat]);

  if (galat) return <div className="p-6 lg:p-8 pt-16 lg:pt-8"><EmptyState icon={Boxes} title="Aset tidak ditemukan" description={galat} /></div>;
  if (!data) return <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;
  const a = data.aset;
  const baris: [string, string | null][] = [
    ["Kode inventaris", a.kodeInventaris], ["Kategori", a.category], ["Lokasi", a.location], ["Jumlah", `${a.quantity} unit`],
    ["Tanggal perolehan", a.acquiredDate ? tgl(a.acquiredDate) : null], ["Sumber dana", a.fundingSource], ["Keterangan", a.notes],
  ];
  const asetForm = { id: a.id, name: a.name, category: a.category, location: a.location, quantity: a.quantity };
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Boxes size={22} />} title={a.name} description={`${a.location ?? a.category} · ${KONDISI[a.condition] ?? a.condition}${data.kerusakanTerbuka ? ` · ${data.kerusakanTerbuka} laporan kerusakan belum selesai` : ""}`} />
      <div className="baris-alat mb-5">
        <div className="alat-aksi">
          {inventarisHref && data.akses.kelola && <Link href={inventarisHref} className="btn-modal-cancel btn-teks"><Boxes /> Inventaris</Link>}
          <button type="button" onClick={() => setLapor(true)} className="btn-modal-cancel btn-teks"><Hammer /> Lapor Kerusakan</button>
          {a.condition !== "RUSAK_BERAT" && <button type="button" onClick={() => setPinjam(true)} className="btn-modal-save btn-teks"><CalendarClock /> Pinjam</button>}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 items-start">
        <div className="panel p-5">
          <div className="mb-3 flex items-center gap-2"><span className={`status-badge ${WARNA_KONDISI[a.condition] ?? ""}`}>{KONDISI[a.condition] ?? a.condition}</span></div>
          <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-2 text-sm">
            {baris.filter(([, v]) => v).map(([k, v]) => (<Fragment key={k}><dt className="text-gray-500">{k}</dt><dd className="min-w-0 text-gray-800">{v}</dd></Fragment>))}
          </dl>
        </div>
        <div className="space-y-6">
          {a.peminjaman.length > 0 && (
            <div className="panel p-5">
              <p className="label-kecil mb-2">Jadwal dipinjam</p>
              <ul className="space-y-1 text-sm text-gray-700">{a.peminjaman.map(p => <li key={p.id}>{rentang(p.mulai, p.selesai)} · {p.peminjamNama}{p.jumlah > 1 ? ` (${p.jumlah})` : ""}</li>)}</ul>
            </div>
          )}
          {a.perawatan.filter(p => p.aktif).length > 0 && (
            <div className="panel p-5">
              <p className="label-kecil mb-2">Perawatan</p>
              <ul className="space-y-1 text-sm text-gray-700">{a.perawatan.filter(p => p.aktif).map(p => <li key={p.id}>{p.judul} — berikutnya {tgl(p.berikutnya)}{p.terakhir ? ` (terakhir ${tgl(p.terakhir)})` : ""}</li>)}</ul>
            </div>
          )}
          {data.riwayat && (
            <div className="panel p-5 space-y-4">
              <div>
                <p className="label-kecil mb-2">Riwayat kerusakan</p>
                {data.riwayat.kerusakan.length === 0 ? <p className="text-sm text-gray-500">Belum pernah dilaporkan rusak.</p> : (
                  <ul className="space-y-2 text-sm">{data.riwayat.kerusakan.map(k => (
                    <li key={k.id}><span className={`status-badge mr-1 ${STATUS_RUSAK[k.status]?.kelas}`}>{STATUS_RUSAK[k.status]?.label}</span>{tgl(k.reportDate)} · {k.description}{k.reportedBy ? ` — ${k.reportedBy}` : ""}{k.repairNotes ? <span className="block text-xs text-emerald-800">{k.repairNotes}</span> : null}</li>
                  ))}</ul>
                )}
              </div>
              <div>
                <p className="label-kecil mb-2">Riwayat pindah lokasi</p>
                {data.riwayat.mutasi.length === 0 ? <p className="text-sm text-gray-500">Belum pernah dipindah (sejak pencatatan 17 Sep 2026).</p> : (
                  <ul className="space-y-1 text-sm text-gray-700">{data.riwayat.mutasi.map(m => <li key={m.id}>{tgl(m.tanggal)} · {m.dari ?? "—"} → {m.ke ?? "—"} · {m.olehNama}{m.catatan ? ` (${m.catatan})` : ""}</li>)}</ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <FormLaporKerusakan buka={lapor} tutup={() => setLapor(false)} aset={[asetForm]} asetTetap={asetForm} selesai={muat} />
      <FormPinjam buka={pinjam} tutup={() => setPinjam(false)} aset={[asetForm]} ruang={[]} asetTetap={asetForm} selesai={muat} />
    </div>
  );
}
