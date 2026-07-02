export const dynamic = "force-dynamic";

import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { Users, GraduationCap, BookOpen } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";

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
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center text-gray-400">
          <Users size={40} className="mx-auto mb-4 opacity-30" />
          <p className="font-semibold text-navy mb-1">Belum Ada Kelas Wali</p>
          <p className="text-sm">Hubungi admin untuk ditugaskan sebagai wali kelas.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {classes.map((cls) => (
            <div key={cls.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Header kelas */}
              <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-3"
                style={{ background: "linear-gradient(135deg, #0F1A45 0%, #1B2B6B 100%)" }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
                    <BookOpen size={18} className="text-gold" />
                  </div>
                  <div>
                    <h2 className="font-heading font-bold text-white">{cls.name}</h2>
                    <p className="text-white/50 text-xs flex items-center gap-1">
                      <GraduationCap size={11} />
                      {cls.major.name} · Kelas {cls.grade}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-gold bg-white/10 border border-white/20 px-3 py-1.5 rounded-full flex items-center gap-1.5">
                  <Users size={12} />
                  {cls.students.length} Siswa
                </span>
              </div>

              {/* Tabel siswa */}
              {cls.students.length === 0 ? (
                <div className="py-10 text-center text-gray-400 text-sm">Belum ada siswa di kelas ini.</div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="w-10">#</th>
                      <th>NIS</th>
                      <th>Nama Siswa</th>
                      <th className="hidden md:table-cell">NISN</th>
                      <th className="hidden lg:table-cell">Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cls.students.map((s, i) => (
                      <tr key={s.id}>
                        <td className="text-gray-400 text-xs">{i + 1}</td>
                        <td className="font-mono text-xs text-gray-600">{s.nis}</td>
                        <td className="font-semibold text-primary-900">{s.user.name}</td>
                        <td className="font-mono text-xs text-gray-400 hidden md:table-cell">{s.nisn ?? "—"}</td>
                        <td className="text-gray-400 text-xs hidden lg:table-cell">{s.user.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
