export const dynamic = "force-dynamic";

import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { Users, GraduationCap, BookOpen } from "lucide-react";

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
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-bold text-primary-900">Daftar Siswa</h1>
        <p className="text-gray-500 text-sm mt-1">Daftar siswa dari kelas yang Anda ampu sebagai wali kelas.</p>
      </div>

      {classes.length === 0 ? (
        <div className="bg-white rounded-2xl border p-16 text-center text-gray-400">
          <Users size={40} className="mx-auto mb-4 opacity-30" />
          <p className="font-semibold text-navy mb-1">Belum Ada Kelas Wali</p>
          <p className="text-sm">Hubungi admin untuk ditugaskan sebagai wali kelas.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {classes.map((cls) => (
            <div key={cls.id} className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              {/* Header kelas */}
              <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-700 flex items-center justify-center shrink-0">
                    <BookOpen size={18} className="text-gold" />
                  </div>
                  <div>
                    <h2 className="font-heading font-bold text-primary-900">{cls.name}</h2>
                    <p className="text-gray-500 text-xs flex items-center gap-1">
                      <GraduationCap size={11} />
                      {cls.major.name} · Kelas {cls.grade}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-primary-700 bg-primary-50 px-3 py-1.5 rounded-full flex items-center gap-1.5">
                  <Users size={14} />
                  {cls.students.length} Siswa
                </span>
              </div>

              {/* Tabel siswa */}
              {cls.students.length === 0 ? (
                <div className="py-10 text-center text-gray-400 text-sm">Belum ada siswa di kelas ini.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left px-6 py-3 text-gray-500 font-medium w-10">#</th>
                      <th className="text-left px-6 py-3 text-gray-500 font-medium">NIS</th>
                      <th className="text-left px-6 py-3 text-gray-500 font-medium">Nama Siswa</th>
                      <th className="text-left px-6 py-3 text-gray-500 font-medium hidden md:table-cell">NISN</th>
                      <th className="text-left px-6 py-3 text-gray-500 font-medium hidden lg:table-cell">Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cls.students.map((s, i) => (
                      <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-6 py-3 text-gray-400 text-xs">{i + 1}</td>
                        <td className="px-6 py-3 font-mono text-xs text-gray-600">{s.nis}</td>
                        <td className="px-6 py-3 font-semibold text-primary-900">{s.user.name}</td>
                        <td className="px-6 py-3 font-mono text-xs text-gray-400 hidden md:table-cell">{s.nisn ?? "—"}</td>
                        <td className="px-6 py-3 text-gray-400 text-xs hidden lg:table-cell">{s.user.email}</td>
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
