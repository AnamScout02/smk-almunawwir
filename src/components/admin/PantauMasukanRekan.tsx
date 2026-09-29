"use client";
import { useEffect, useState } from "react";
import { ShieldCheck, Loader2, Search } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import Select from "@/components/admin/Select";
import EmptyState from "@/components/admin/EmptyState";
import Paginasi from "@/components/shared/Paginasi";
import { usePaginasi } from "@/lib/use-paginasi";
import { BarisKembali } from "@/components/shared/TombolKembali";

interface Orang { id: string; name: string; role: string }
interface Baris {
  id: string; jenis: string; isi: string; dibacaAt: string | null; createdAt: string;
  pengirim: Orang; penerima: Orang;
}

const LABEL: Record<string, string> = { KRITIK: "Kritik", SARAN: "Saran", APRESIASI: "Apresiasi" };
const BADGE: Record<string, string> = {
  KRITIK: "bg-amber-50 text-amber-700 border border-amber-200",
  SARAN: "bg-blue-50 text-blue-700 border border-blue-200",
  APRESIASI: "bg-emerald-50 text-emerald-700 border border-emerald-200",
};

/** Pengawasan masukan antar pegawai. Halaman ini SENGAJA satu-satunya tempat pengirim terlihat —
 *  jangan menambahkan nama pengirim ke layar mana pun yang bisa dibuka penerima atau rekan lain. */
export default function PantauMasukanRekan() {
  const [items, setItems] = useState<Baris[]>([]);
  const [loading, setLoading] = useState(true);
  const [cari, setCari] = useState("");
  const [fJenis, setFJenis] = useState("");
  const [fOrang, setFOrang] = useState("");

  useEffect(() => {
    fetch("/api/admin/masukan-rekan", { cache: "no-store" })
      .then(r => r.json()).then(d => setItems(Array.isArray(d) ? d : []))
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const orang = [...new Map(items.flatMap(i => [[i.pengirim.id, i.pengirim], [i.penerima.id, i.penerima]] as const)).values()]
    .sort((a, b) => a.name.localeCompare(b.name));
  const q = cari.toLowerCase();
  const tersaring = items.filter(i =>
    (!q || i.isi.toLowerCase().includes(q) || i.pengirim.name.toLowerCase().includes(q) || i.penerima.name.toLowerCase().includes(q)) &&
    (!fJenis || i.jenis === fJenis) &&
    (!fOrang || i.pengirim.id === fOrang || i.penerima.id === fOrang)
  );
  const hal = usePaginasi(tersaring, 25, `${q}|${fJenis}|${fOrang}`);
  const belum = items.filter(i => !i.dibacaAt).length;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<ShieldCheck size={22} />} title="Pantau Masukan Rekan"
        description="Seluruh kritik, saran, dan apresiasi antar pegawai beserta pengirimnya — khusus Superadmin" />
      <BarisKembali href="/dashboard/admin" />

      <div className="kisi-kartu kisi-kartu-4 mb-5">
        <StatTile ikon="pesan" color="primary" value={items.length} label="Total Masukan" />
        <StatTile ikon="peringatan" color="amber" value={items.filter(i => i.jenis === "KRITIK").length} label="Kritik" />
        <StatTile ikon="centang" color="emerald" value={items.filter(i => i.jenis === "APRESIASI").length} label="Apresiasi" />
        <StatTile ikon="menunggu" color={belum ? "amber" : "emerald"} value={belum} label="Belum Dibaca Penerima" />
      </div>

      <div className="baris-alat mb-5">
        <div className="alat-cari">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari isi, pengirim, atau penerima..." className="input-field pl-10" />
        </div>
        <div className="alat-saring">
          <Select value={fJenis} onChange={setFJenis} placeholder="Semua jenis" options={[
            { value: "", label: "Semua jenis" }, { value: "KRITIK", label: "Kritik" },
            { value: "SARAN", label: "Saran" }, { value: "APRESIASI", label: "Apresiasi" },
          ]} />
        </div>
        <div className="alat-saring">
          <Select value={fOrang} onChange={setFOrang} placeholder="Semua orang"
            options={[{ value: "", label: "Semua orang" }, ...orang.map(o => ({ value: o.id, label: o.name }))]} />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
      ) : tersaring.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="Belum Ada Masukan" description="Belum ada masukan antar pegawai yang tercatat." />
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-10">No</th>
                  <th>Tanggal</th><th>Pengirim</th><th>Penerima</th><th>Jenis</th><th>Isi</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {hal.potongan.map((i, n) => (
                  <tr key={i.id}>
                    <td className="angka">{hal.awal + n}</td>
                    <td className="text-xs whitespace-nowrap">{new Date(i.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" })}</td>
                    <td className="font-semibold text-primary-900 whitespace-nowrap">{i.pengirim.name}</td>
                    <td className="whitespace-nowrap">{i.penerima.name}</td>
                    <td><span className={`text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${BADGE[i.jenis] ?? ""}`}>{LABEL[i.jenis] ?? i.jenis}</span></td>
                    <td className="min-w-[18rem] text-sm text-gray-600">{i.isi}</td>
                    <td className={`text-xs whitespace-nowrap ${i.dibacaAt ? "text-emerald-700" : "text-gray-400"}`}>{i.dibacaAt ? "Dibaca" : "Belum"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Paginasi hal={hal} satuan="masukan" className="border-t border-gray-100" />
        </div>
      )}
    </div>
  );
}
