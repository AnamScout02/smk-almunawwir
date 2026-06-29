export const dynamic = "force-dynamic";

import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { Users, BookOpen, ClipboardList, CheckSquare, Bell } from "lucide-react";
import Link from "next/link";

export default async function TeacherDashboard() {
  const session = await verifyRole(["TEACHER", "ADMIN"]);

  const now = new Date();
  const [teacher, announcements] = await Promise.all([prisma.teacher.findFirst({
    where: { user: { email: session.email } },
    include: {
      homeroomOf: {
        include: {
          students: { include: { user: { select: { name: true } } } },
          major: true,
        },
      },
      grades: { orderBy: { createdAt: "desc" }, take: 5 },
      _count: { select: { grades: true } },
    },
  }), prisma.announcement.findMany({
    where: {
      active: true,
      targetRole: { in: ["ALL", "TEACHER"] },
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    take: 5,
  })]);

  const totalStudents = teacher?.homeroomOf.reduce((acc, c) => acc + c.students.length, 0) ?? 0;
  const totalGradesCount = teacher?._count?.grades ?? 0;

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      {/* Greeting */}
      <div className="mb-8">
        <p className="font-arabic text-primary-700 text-xl mb-1">اَلسَّلَامُ عَلَيْكُمْ</p>
        <h2 className="font-heading text-3xl font-bold text-primary-900">Halo, {session.name.split(" ")[0]}!</h2>
        <p className="text-gray-500 mt-1 text-sm">Mata Pelajaran: {teacher?.subject ?? "—"} · NIP: {teacher?.nip ?? "—"}</p>
      </div>

      {/* Pengumuman */}
      {announcements.length > 0 && (
        <div className="mb-6 space-y-2">
          {announcements.map(ann => (
            <div key={ann.id} className={`flex items-start gap-3 p-4 rounded-xl border ${
              ann.priority === "URGENT"
                ? "bg-red-50 border-red-200"
                : "bg-amber-50 border-amber-100"
            }`}>
              <Bell size={16} className={`shrink-0 mt-0.5 ${ann.priority === "URGENT" ? "text-red-500" : "text-amber-600"}`} />
              <div>
                <p className={`font-semibold text-sm ${ann.priority === "URGENT" ? "text-red-800" : "text-amber-900"}`}>
                  {ann.priority === "URGENT" && <span className="text-red-500 mr-1">[URGENT]</span>}
                  {ann.title}
                </p>
                <p className="text-xs mt-0.5 text-gray-600 leading-relaxed">{ann.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {[
          { icon: Users, label: "Siswa Wali Kelas", value: totalStudents, color: "text-primary-700", bg: "bg-primary-50" },
          { icon: BookOpen, label: "Kelas Wali", value: teacher?.homeroomOf.length ?? 0, color: "text-amber-600", bg: "bg-amber-50" },
          { icon: ClipboardList, label: "Total Nilai Diinput", value: totalGradesCount, color: "text-emerald-600", bg: "bg-emerald-50" },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className="bg-white rounded-2xl p-5 shadow-sm">
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
              <Icon size={18} className={color} />
            </div>
            <p className="text-gray-400 text-xs mb-1">{label}</p>
            <p className={`font-heading font-bold text-3xl ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Kelas Wali */}
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
        <h3 className="font-heading font-semibold text-xl text-primary-900 mb-5">Kelas Wali Saya</h3>
        {teacher?.homeroomOf.length ? (
          <div className="grid md:grid-cols-2 gap-4">
            {teacher.homeroomOf.map((cls) => (
              <div key={cls.id} className="border border-gray-100 rounded-xl p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="font-heading font-bold text-primary-900">{cls.name}</h4>
                    <p className="text-gray-400 text-sm">{cls.major.name}</p>
                  </div>
                  <span className="text-xs bg-primary-50 text-primary-700 px-3 py-1 rounded-full font-semibold">
                    {cls.students.length} siswa
                  </span>
                </div>
                <div className="flex gap-2">
                  <Link href={`/dashboard/teacher/grades/${cls.id}`}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-primary-700 hover:bg-primary-800 text-white text-sm font-semibold py-2 rounded-lg transition">
                    <ClipboardList size={14} /> Input Nilai
                  </Link>
                  <Link href={`/dashboard/teacher/attendance/${cls.id}`}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2 rounded-lg transition">
                    <CheckSquare size={14} /> Absensi
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm text-center py-8">Anda belum menjadi wali kelas manapun.</p>
        )}
      </div>

      {/* Nilai Terakhir */}
      {teacher?.grades && teacher.grades.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h3 className="font-heading font-semibold text-xl text-primary-900 mb-4">Nilai Terakhir Diinput</h3>
          <div className="space-y-2">
            {teacher.grades.map((g) => (
              <div key={g.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0 text-sm">
                <span className="text-gray-600">{g.subject} — {g.type} ({g.semester})</span>
                <span className={`font-bold ${g.score >= 75 ? "text-emerald-600" : "text-red-500"}`}>{g.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
