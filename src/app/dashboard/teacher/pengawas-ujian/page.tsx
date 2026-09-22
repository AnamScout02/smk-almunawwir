export const dynamic = "force-dynamic";

import { UserCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import { tugasPengawasKelasGuru } from "@/lib/pengawas-kelas";

export const metadata = { title: "Jadwal Pengawas Ujian" };

/** Jadwal mengawas milik guru yang sedang login. */
export default async function Page() {
  const session = await verifyRole(["TEACHER"]);
  const guru = await prisma.teacher.findFirst({ where: { userId: session.userId }, select: { id: true } });
  const jadwal = guru ? await prisma.pengawasUjian.findMany({
    where: { teacherId: guru.id, tanggal: { gte: new Date(Date.now() - 30 * 86400000) } },
    orderBy: [{ tanggal: "asc" }, { sesi: "asc" }],
    include: { ruang: { select: { nama: true, lokasi: true } }, kegiatan: { select: { nama: true, singkatan: true } } },
  }) : [];
  // Kegiatan PER KELAS (21 September 2026): tugas mengawas = ujian mapel yang diampu di kelasnya, pada jam kelas itu.
  const perKelas = guru ? await tugasPengawasKelasGuru(guru.id).catch(() => []) : [];
  const jam = (s: string) => new Date(s).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
  const tanggal = (s: string) => new Date(s).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<UserCheck size={22} />} title="Jadwal Pengawas Ujian" description="Tugas mengawas Anda (30 hari terakhir dan mendatang)" />
      {perKelas.length > 0 && (
        <div className="panel overflow-x-auto mb-5">
          <p className="px-4 pt-3 pb-2 font-heading font-bold text-sm text-primary-900">Mengawas di kelas (ujian per kelas)</p>
          <table className="data-table">
            <thead><tr><th>Tanggal</th><th>Jam</th><th>Kelas</th><th>Mata pelajaran</th><th>Kegiatan</th></tr></thead>
            <tbody>{perKelas.map(t => (
              <tr key={`${t.examId}-${t.classId}`}>
                <td className="whitespace-nowrap">{tanggal(t.mulai)}</td>
                <td className="angka whitespace-nowrap">{jam(t.mulai)} – {jam(t.selesai)}</td>
                <td className="font-semibold">{t.kelas}</td>
                <td>{t.mapel}{t.pengganti && <span className="block text-xs text-amber-700">Menggantikan {t.otomatis?.nama ?? "guru mapel"}</span>}</td>
                <td className="text-sm">{t.kegiatan}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {jadwal.length === 0 && perKelas.length > 0 ? null : jadwal.length === 0 ? <EmptyState icon={UserCheck} title="Belum ada tugas mengawas" description="Pembagian pengawas disusun Wakil Kepala Kurikulum di Pusat Ujian." /> : (
        <div className="panel overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Tanggal</th><th>Sesi</th><th>Ruang</th><th>Kegiatan</th></tr></thead>
            <tbody>{jadwal.map(j => (
              <tr key={j.id}>
                <td className="whitespace-nowrap">{j.tanggal.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}</td>
                <td className="angka text-center">{j.sesi}</td>
                <td>{j.ruang.nama}{j.ruang.lokasi ? <span className="block text-xs text-gray-500">{j.ruang.lokasi}</span> : null}</td>
                <td className="text-sm">{j.kegiatan.singkatan} — {j.kegiatan.nama}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
