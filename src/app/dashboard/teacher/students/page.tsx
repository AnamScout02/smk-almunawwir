export const dynamic = "force-dynamic";

import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { Users, GraduationCap } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import GroupedSection from "@/components/admin/GroupedSection";
import EmptyState from "@/components/admin/EmptyState";

export default async function TeacherStudentsPage() {
  const session = await verifyRole(["TEACHER", "ADMIN"]);

  const teacher = await prisma.teacher.findFirst({
    where: { user: { email: session.email } },
    include: {
      homeroomOf: {
        include: {
          major: true,
          students: {
            include: { user: { select: { name: true, email: true } } },
            orderBy: { user: { name: "asc" } },
          },
        },
        orderBy: { grade: "asc" },
      },
    },
  });

  const classes = teacher?.homeroomOf ?? [];

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<Users size={22} />}
        title="Daftar Siswa"
        description="Daftar siswa dari kelas yang Anda ampu sebagai wali kelas."
      />

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
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-primary-100"
                        style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.05) 0%, rgba(27,43,107,0.03) 100%)" }}>
                        <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 w-10">#</th>
                        <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">NIS</th>
                        <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Nama Siswa</th>
                        <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 hidden md:table-cell">NISN</th>
                        <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 hidden lg:table-cell">Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cls.students.map((s, i) => (
                        <tr key={s.id} className="border-b border-gray-50 last:border-0 hover:bg-primary-50/30 transition-colors">
                          <td className="px-5 py-3.5 text-gray-400 text-xs">{i + 1}</td>
                          <td className="px-5 py-3.5 font-mono text-xs text-gray-600">{s.nis}</td>
                          <td className="px-5 py-3.5 font-semibold text-primary-900">{s.user.name}</td>
                          <td className="px-5 py-3.5 font-mono text-xs text-gray-400 hidden md:table-cell">{s.nisn ?? "—"}</td>
                          <td className="px-5 py-3.5 text-gray-400 text-xs hidden lg:table-cell">{s.user.email}</td>
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
