export const dynamic = "force-dynamic";
import Link from "next/link";
import { Archive } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import { labelTa, muatArsipPkl, ringkasAngkatan } from "@/lib/pkl-arsip";

export const metadata = { title: "Arsip PKL per Angkatan" };

/** ARSIP PKL PER ANGKATAN — tiap tahun ajaran: peserta, DUDI yang ditempati, nilai, dan unduhan Excel-nya.
 *  Akses dijaga layout Pusat PKL. */
export default async function Page({ searchParams }: { searchParams: Promise<{ ta?: string }> }) {
  const semua = await muatArsipPkl();
  const daftarTa = [...new Set(semua.map(x => x.ta))].sort((a, b) => b - a);
  const { ta: q } = await searchParams;
  const ta = daftarTa.includes(Number(q)) ? Number(q) : daftarTa[0];
  const b = semua.filter(x => x.ta === ta);
  const r = ringkasAngkatan(b);
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Archive size={22} />} title="Arsip PKL per Angkatan" description="Riwayat PKL tiap tahun ajaran — tetap tersimpan setelah siswanya lulus" />
      {daftarTa.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">Belum ada data PKL.</p> : (
        <div className="space-y-6">
          <div className="kisi-kartu kisi-kartu-5">
            <StatTile value={r.peserta} label={`Peserta ${labelTa(ta)}`} ikon="siswa" color="primary" />
            <StatTile value={r.dudi} label="DUDI ditempati" ikon="pkl" color="blue" />
            <StatTile value={r.selesai} label="Selesai PKL" ikon="hadir" color="emerald" />
            <StatTile value={r.rataIndustri ?? "—"} label="Rata-rata nilai industri" ikon="prestasi" color="purple" />
            <StatTile value={r.mutasi} label="Mutasi tempat" ikon="peringatan" color="amber" />
          </div>
          <div className="baris-alat">
            <div className="alat-tab flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-gray-100 bg-white p-1 scrollbar-hide">
              {daftarTa.map(t => (
                <Link key={t} href={`/pusat-pkl/arsip?ta=${t}`} scroll={false}
                  className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition ${t === ta ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>{labelTa(t)}</Link>
              ))}
            </div>
            <div className="alat-aksi"><a href={`/pusat-pkl/arsip/cetak?ta=${ta}`} className="btn-modal-cancel btn-teks">Laporan Tahunan</a><a href={`/api/pkl/arsip?ta=${ta}`} className="btn-modal-cancel btn-teks">Unduh Excel</a></div>
          </div>
          <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
            <div className="panel min-w-0 overflow-hidden xl:col-span-5">
              <div className="panel-kepala"><p className="panel-judul">Per DUDI</p></div>
              {r.perDudi.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">Belum ada siswa yang mendapat tempat PKL.</p> : (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead><tr><th>DUDI</th><th className="text-right">Siswa</th><th className="text-right">Selesai</th><th className="text-right">Nilai</th></tr></thead>
                    <tbody>{r.perDudi.map(d => (
                      <tr key={d.nama}><td className="font-medium text-primary-900">{d.nama}</td><td className="angka text-right">{d.siswa}</td><td className="angka text-right">{d.selesai}</td><td className="angka text-right">{d.rata ?? "—"}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="panel min-w-0 overflow-hidden xl:col-span-7">
              <div className="panel-kepala"><p className="panel-judul">Daftar siswa</p><span className="text-xs text-gray-400">{b.length} baris</span></div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr><th className="w-10">No</th><th>Siswa</th><th>Tempat PKL</th><th>Masa</th><th className="text-right">Nilai</th></tr></thead>
                  <tbody>{b.map((x, i) => (
                    <tr key={x.id}>
                      <td className="angka">{i + 1}</td>
                      <td><span className="font-medium text-primary-900">{x.nama}</span><span className="block text-xs text-gray-400">{x.kelas ?? x.jurusan}{x.statusSiswa !== "AKTIF" ? ` · ${x.statusSiswa.toLowerCase()}` : ""}</span></td>
                      <td className={x.tempat ? "text-gray-700" : "text-amber-700"}>{x.tempat ?? "Belum dapat DUDI"}{x.status === "CANCELLED" && <span className="block text-xs text-red-600">dibatalkan</span>}</td>
                      <td className="whitespace-nowrap text-gray-600">{x.mulai.toLocaleDateString("id-ID", { month: "short", year: "numeric", timeZone: "UTC" })} – {x.selesai.toLocaleDateString("id-ID", { month: "short", year: "numeric", timeZone: "UTC" })}</td>
                      <td className="angka text-right">{x.nilaiIndustri ?? "—"}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
