import Link from "next/link";
import { Award } from "lucide-react";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/admin/PageHeader";
import { susunKeterlaksanaan, ringkasPerGuru } from "@/lib/keterlaksanaan";
import { pekanKini } from "@/lib/jurnal-cepat";

/** Daftar guru aktif → lembar Rapor Kinerja masing-masing (server component, dua pintu: portal admin & portal guru). */
export default async function RaporKinerjaDaftar({ basePath }: { basePath: string }) {
  const [guru, terlaksana, pk] = await Promise.all([
    prisma.teacher.findMany({
      where: { OR: [{ teacherStatus: null }, { teacherStatus: "AKTIF" }], user: { role: "TEACHER" } },
      select: { id: true, nip: true, user: { select: { name: true } }, jabatan: { select: { jabatan: { select: { name: true } } } } },
      orderBy: { user: { name: "asc" } },
    }),
    susunKeterlaksanaan().catch(() => null),
    pekanKini(),
  ]);
  const ringkas = terlaksana ? ringkasPerGuru(terlaksana.baris) : new Map();
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Award size={22} />} title="Rapor Kinerja Guru" description={`Semester ${pk.label} · satu lembar per guru, dibaca dari data kehadiran, jurnal, perangkat, supervisi, PKB, dan masukan rekan`} />
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th className="w-10">No</th><th>Guru</th><th>Jabatan</th><th className="text-right">Pertemuan terjadwal</th><th className="text-right">Jurnal terisi</th><th className="text-right">Keterlaksanaan</th><th className="text-right">Aksi</th></tr></thead>
            <tbody>
              {guru.map((g, i) => {
                const r = ringkas.get(g.id) as { pertemuan: number; jurnal: number } | undefined;
                const p = r?.pertemuan ? Math.round((r.jurnal / r.pertemuan) * 100) : null;
                return (
                  <tr key={g.id}>
                    <td className="angka text-gray-400">{i + 1}</td>
                    <td><span className="font-semibold text-primary-900">{g.user.name}</span>{g.nip && <span className="angka block text-xs text-gray-400">{g.nip}</span>}</td>
                    <td className="text-xs text-gray-500">{g.jabatan.map(j => j.jabatan.name).join(", ") || "Guru"}</td>
                    <td className="angka text-right">{r?.pertemuan ?? "—"}</td>
                    <td className="angka text-right">{r?.jurnal ?? "—"}</td>
                    <td className={`angka text-right font-semibold ${p === null ? "text-gray-400" : p >= 80 ? "text-emerald-700" : p >= 50 ? "text-amber-700" : "text-red-600"}`}>{p === null ? "—" : `${p}%`}</td>
                    <td className="text-right"><Link href={`${basePath}/${g.id}`} className="text-xs font-semibold text-primary-700 hover:text-primary-900">Buka rapor</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {guru.length === 0 && <p className="py-10 text-center text-sm text-gray-400">Belum ada data guru.</p>}
      </div>
    </div>
  );
}
