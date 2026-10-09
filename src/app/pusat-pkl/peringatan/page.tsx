export const dynamic = "force-dynamic";
import Link from "next/link";
import { Siren } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import { hitungPeringatanPkl } from "@/lib/pkl-peringatan";

export const metadata = { title: "Peringatan Dini PKL" };

/** PERINGATAN DINI PKL — siswa sedang PKL yang perlu didatangi/dihubungi. Akses dijaga layout Pusat PKL. */
export default async function Page() {
  const d = await hitungPeringatanPkl();
  const tinggi = d.filter(x => x.skor >= 5).length;
  const ada = (kata: string) => d.filter(x => x.alasan.some(a => a.includes(kata))).length;
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Siren size={22} />} title="Peringatan Dini PKL" description="Siswa sedang PKL yang menunjukkan tanda perlu ditindaklanjuti" />
      <div className="space-y-6">
        <div className="kisi-kartu kisi-kartu-4">
          <StatTile value={d.length} label="Siswa perlu perhatian" ikon="peringatan" color="amber" sorot={d.length > 0} />
          <StatTile value={tinggi} label="Paling mendesak" ikon="piutang" color="red" />
          <StatTile value={ada("jurnal")} label="Jurnal tertinggal" ikon="jurnal" color="blue" />
          <StatTile value={ada("alpha") + ada("tidak presensi")} label="Kehadiran bermasalah" ikon="alpha" color="purple" />
        </div>
        <div className="panel overflow-hidden">
          {d.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">Tidak ada siswa PKL yang perlu perhatian saat ini.</p> : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th className="w-10">No</th><th>Siswa</th><th>Tempat PKL</th><th>Guru pembimbing</th><th>Tanda</th><th className="text-right">Aksi</th></tr></thead>
                <tbody>{d.map((x, i) => (
                  <tr key={x.id}>
                    <td className="angka">{i + 1}</td>
                    <td><span className="font-medium text-primary-900">{x.nama}</span><span className="block text-xs text-gray-400">{x.kelas ?? "—"}</span></td>
                    <td className="text-gray-600">{x.tempat}</td>
                    <td className={x.guru ? "text-gray-600" : "text-amber-700"}>{x.guru ?? "Belum ada"}</td>
                    <td>
                      <span className={`status-badge ${x.skor >= 5 ? "bg-red-50 text-red-600 border-red-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>{x.skor >= 5 ? "Mendesak" : "Perlu dicek"}</span>
                      <ul className="mt-1 text-xs text-gray-600">{x.alasan.map(a => <li key={a}>• {a}</li>)}</ul>
                    </td>
                    <td><div className="flex justify-end gap-1.5">
                      <Link href={`/pusat-pkl/siswa/${x.studentId}`} className="btn-modal-cancel px-3 text-xs">Linimasa</Link>
                      {x.nomorOrtu && <a href={`https://wa.me/${x.nomorOrtu}?text=${encodeURIComponent(`Assalamu'alaikum. Kami dari SMK Al-Munawwir IIBS ingin menanyakan kabar ananda ${x.nama} yang sedang PKL di ${x.tempat}.`)}`} target="_blank" rel="noreferrer" className="btn-modal-cancel px-3 text-xs">WA Orang Tua</a>}
                    </div></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <p className="border-t border-gray-100 px-5 py-3 text-xs text-gray-500">
            Tanda: tidak menulis jurnal 5 hari atau lebih, alpha 2 kali dalam 14 hari, tidak presensi 4 hari (hanya untuk siswa yang pernah presensi), laporan masalah belum selesai, belum dimonitor 30 hari, belum punya guru pembimbing, jurnal yang sama persis berulang (4 kali) atau sama dengan teman se-DUDI (3 hari). Ini daftar untuk ditindaklanjuti, bukan penilaian.
          </p>
        </div>
      </div>
    </div>
  );
}
