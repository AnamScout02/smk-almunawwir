export const dynamic = "force-dynamic";

import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { Users, GraduationCap } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import GroupedSection from "@/components/admin/GroupedSection";
import EmptyState from "@/components/admin/EmptyState";
import Link from "next/link";
import Alert from "@/components/admin/Alert";
import { alamatKurang } from "@/lib/analisis-sebaran";

export default async function TeacherStudentsPage() {
  const session = await verifyRole(["TEACHER", "ADMIN"]);

  const teacher = await prisma.teacher.findFirst({
    where: { user: { email: session.email } },
    include: {
      homeroomOf: {
        include: {
          major: true,
          students: {
            where: { studentStatus: "AKTIF" },
            include: { user: { select: { name: true, email: true } } },
            orderBy: { user: { name: "asc" } },
          },
        },
        orderBy: { grade: "asc" },
      },
    },
  });

  const classes = teacher?.homeroomOf ?? [];
  // Alamat yang belum terpetakan sampai kecamatan (8 Okt 2026) — aturan yang sama dengan Peta Sebaran → Alamat Belum Lengkap,
  // tetapi wali kelas hanya melihat kelas walinya. Buku Induk tidak dikirim ke layar, hanya keterangan apa yang kurang.
  const kurang = new Map<string, string>();
  for (const c of classes) for (const s of c.students) { const k = await alamatKurang(s.bukuIndukData); if (k) kurang.set(s.id, k); }

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<Users size={22} />}
        title="Daftar Siswa"
        description="Daftar siswa dari kelas yang Anda ampu sebagai wali kelas."
      />

      {kurang.size > 0 && (
        <div className="mb-5">
          <Alert variant="warning" title={`${kurang.size} siswa alamat rumahnya belum lengkap`}>
            Ditandai di bawah namanya. Minta siswanya melengkapi lewat menu Biodata di portal siswa (diverifikasi Tata Usaha),
            atau sampaikan alamatnya ke Tata Usaha.
          </Alert>
        </div>
      )}

      {classes.length === 0 ? (
        <EmptyState icon={Users} title="Belum Ada Kelas Wali" description="Hubungi admin untuk ditugaskan sebagai wali kelas." />
      ) : (
        <div className="space-y-6">
          {classes.map((cls) => (
            <GroupedSection key={cls.id} title={cls.name} subtitle={`${cls.major.name} · Kelas ${cls.grade}`}
              count={cls.students.length} icon={GraduationCap}>
              {cls.students.length === 0 ? (
                <div className="py-10 text-center text-gray-400 text-sm">Belum ada siswa di kelas ini.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th className="w-10">#</th>
                        <th>NIS</th>
                        <th>Nama Siswa</th>
                        <th className="hidden md:table-cell">NISN</th>
                        <th className="hidden lg:table-cell">Email</th>
                        <th className="text-right">Catatan SPMB</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cls.students.map((s, i) => (
                        <tr key={s.id}>
                          <td className="text-gray-400 text-xs">{i + 1}</td>
                          <td className="font-mono text-xs text-gray-600">{s.nis}</td>
                          <td>
                            <p className="font-semibold text-primary-900">{s.user.name}</p>
                            {kurang.has(s.id) && <p className="text-xs text-amber-700">{kurang.get(s.id)}</p>}
                          </td>
                          <td className="font-mono text-xs text-gray-400 hidden md:table-cell">{s.nisn ?? "—"}</td>
                          <td className="text-gray-400 text-xs hidden lg:table-cell">{s.user.email}</td>
                          <td className="text-right">
                            <Link href={`/dashboard/teacher/students/${s.id}/spmb`} className="text-sm font-medium text-primary-700 hover:underline">Lihat</Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </GroupedSection>
          ))}
        </div>
      )}
    </div>
  );
}
