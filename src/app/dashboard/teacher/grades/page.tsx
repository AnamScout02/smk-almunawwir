export const dynamic = "force-dynamic";

import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ClipboardList, ChevronRight, Users, TrendingUp, AlertTriangle, Download } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";

export default async function GradesPage() {
  const session = await verifyRole(["TEACHER", "ADMIN"]);

  const teacher = await prisma.teacher.findFirst({
    where: { user: { email: session.email } },
    include: {
      homeroomOf: {
        include: {
          students: { select: { id: true } },
          major: true,
        },
        orderBy: { grade: "asc" },
      },
      grades: {
        orderBy: { createdAt: "desc" },
        take: 30,
        include: {
          student: {
            include: {
              user: { select: { name: true } },
              class: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  const recentGrades = teacher?.grades ?? [];

  const subjects = [...new Set(recentGrades.map((g) => g.subject))];
  const avgBySubject = subjects.map((subject) => {
    const sg = recentGrades.filter((g) => g.subject === subject);
    const avg = sg.reduce((a, g) => a + g.score, 0) / sg.length;
    const below = sg.filter((g) => g.score < 75).length;
    return { subject, avg: avg.toFixed(1), count: sg.length, below };
  });

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<ClipboardList size={22} />}
        title="Nilai Siswa"
        description="Pilih kelas untuk input nilai, atau lihat rekap di bawah."
        actions={
          (teacher?.homeroomOf.length ?? 0) > 0 ? (
            <a href="/api/teacher/export/grades"
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
              <Download size={15} /> Export CSV
            </a>
          ) : undefined
        }
      />

      {/* Kelas wali */}
      <div className="mb-8">
        <h2 className="font-heading font-semibold text-lg text-primary-800 mb-4">Kelas Wali Saya</h2>
        {teacher?.homeroomOf.length ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {teacher.homeroomOf.map((cls) => (
              <Link key={cls.id} href={`/dashboard/teacher/grades/${cls.id}`}
                className="group bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:border-primary-200 hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center shrink-0">
                  <ClipboardList size={20} className="text-primary-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-heading font-bold text-primary-900">{cls.name}</p>
                  <p className="text-gray-400 text-xs truncate">{cls.major.name}</p>
                  <p className="text-gray-500 text-xs mt-0.5 flex items-center gap-1">
                    <Users size={11} /> {cls.students.length} siswa
                  </p>
                </div>
                <ChevronRight size={18} className="text-gray-300 group-hover:text-primary-500 transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border p-8 text-center text-gray-400 text-sm">
            Anda belum menjadi wali kelas manapun.
          </div>
        )}
      </div>

      {/* Rekap per mapel */}
      {avgBySubject.length > 0 && (
        <div className="mb-8">
          <h2 className="font-heading font-semibold text-lg text-primary-800 mb-4">Rekap Nilai per Mata Pelajaran</h2>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-primary-100"
                    style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.05) 0%, rgba(27,43,107,0.03) 100%)" }}>
                    <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Mata Pelajaran</th>
                    <th className="text-center px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Jumlah Nilai</th>
                    <th className="text-center px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Rata-rata</th>
                    <th className="text-center px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Di Bawah KKM</th>
                  </tr>
                </thead>
                <tbody>
                  {avgBySubject.map(({ subject, avg, count, below }) => (
                    <tr key={subject} className="border-b border-gray-50 last:border-0 hover:bg-primary-50/30 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-primary-900">{subject}</td>
                      <td className="px-5 py-3.5 text-center text-gray-600">{count}</td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`font-bold ${Number(avg) >= 75 ? "text-emerald-600" : "text-red-500"}`}>
                          {avg}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {below > 0 ? (
                          <span className="inline-flex items-center gap-1 text-amber-600 font-semibold">
                            <AlertTriangle size={13} /> {below}
                          </span>
                        ) : (
                          <span className="text-emerald-500 font-semibold">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Nilai terbaru */}
      {recentGrades.length > 0 && (
        <div>
          <h2 className="font-heading font-semibold text-lg text-primary-800 mb-4">
            <TrendingUp size={18} className="inline mr-2 text-primary-700" />
            Nilai Terakhir Diinput
          </h2>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-primary-100"
                    style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.05) 0%, rgba(27,43,107,0.03) 100%)" }}>
                    <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Siswa</th>
                    <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Kelas</th>
                    <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Mapel · Jenis</th>
                    <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Semester</th>
                    <th className="text-right px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Nilai</th>
                  </tr>
                </thead>
                <tbody>
                  {recentGrades.map((g) => (
                    <tr key={g.id} className="border-b border-gray-50 last:border-0 hover:bg-primary-50/30 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-primary-900">{g.student.user.name}</td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs">{g.student.class?.name ?? "—"}</td>
                      <td className="px-5 py-3.5 text-gray-600">{g.subject} <span className="text-gray-400">· {g.type}</span></td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs">{g.semester}</td>
                      <td className="px-5 py-3.5 text-right">
                        <span className={`font-bold ${g.score >= 75 ? "text-emerald-600" : "text-red-500"}`}>
                          {g.score}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
