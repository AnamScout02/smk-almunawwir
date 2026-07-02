export const dynamic = "force-dynamic";

import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import {
  Users, BookOpen, ClipboardList, CheckSquare, Bell, Calendar,
  UserCog, ArrowRight, Sparkles, TrendingUp, GraduationCap,
} from "lucide-react";
import Link from "next/link";

export default async function TeacherDashboard() {
  const session = await verifyRole(["TEACHER", "ADMIN"]);

  const now = new Date();
  const [teacher, announcements, teachingSchedules] = await Promise.all([
    prisma.teacher.findFirst({
      where: { user: { email: session.email } },
      include: {
        homeroomOf: {
          include: {
            students: { include: { user: { select: { name: true } } } },
            major: true,
          },
        },
        grades: { orderBy: { createdAt: "desc" }, take: 6 },
        _count: { select: { grades: true } },
      },
    }),
    prisma.announcement.findMany({
      where: {
        active: true,
        targetRole: { in: ["ALL", "TEACHER"] },
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: 5,
    }),
    prisma.schedule.findMany({
      where: { teacher: { user: { email: session.email } } },
      include: { class: { include: { major: true } } },
      orderBy: [{ day: "asc" }, { startTime: "asc" }],
    }),
  ]);

  const totalStudents = teacher?.homeroomOf.reduce((acc, c) => acc + c.students.length, 0) ?? 0;
  const totalGradesCount = teacher?._count?.grades ?? 0;

  const DAYS = ["SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
  const DAY_LABEL: Record<string, string> = { SENIN: "Senin", SELASA: "Selasa", RABU: "Rabu", KAMIS: "Kamis", JUMAT: "Jumat", SABTU: "Sabtu" };
  const todayDay = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"][now.getDay()];
  const dateStr = now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="min-h-screen">

      {/* ── Header ── */}
      <div className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0A1030 0%, #0F1A45 50%, #1B2B6B 100%)" }}>
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "120px 120px", backgroundRepeat: "repeat", filter: "invert(1)" }} />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
        <div className="relative px-6 lg:px-8 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={14} className="text-gold" />
              <p className="text-gold/80 text-xs font-semibold tracking-widest uppercase">{dateStr}</p>
            </div>
            <p className="font-arabic text-gold text-2xl mb-1" style={{ lineHeight: 1.8 }}>اَلسَّلَامُ عَلَيْكُمْ</p>
            <h1 className="font-heading text-2xl font-bold text-white">{session.name}</h1>
            <p className="text-white/50 text-sm mt-0.5">
              Mata Pelajaran: <span className="text-white/70">{teacher?.subject ?? "—"}</span>
              {teacher?.nip && <span> · NIP: {teacher.nip}</span>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard/teacher/grades"
              className="flex items-center gap-2 bg-gold/20 border border-gold/30 text-gold text-xs font-semibold px-3 py-2 rounded-xl hover:bg-gold/30 transition-colors">
              <ClipboardList size={14} />
              Input Nilai
            </Link>
            <Link href="/dashboard/teacher/attendance"
              className="flex items-center gap-2 bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold px-3 py-2 rounded-xl hover:bg-emerald-500/30 transition-colors">
              <CheckSquare size={14} />
              Absensi
            </Link>
          </div>
        </div>
      </div>

      <div className="px-6 lg:px-8 py-8 space-y-7">

        {/* ── Announcements ── */}
        {announcements.length > 0 && (
          <div className="space-y-2">
            {announcements.map(ann => (
              <div key={ann.id}
                className={`flex items-start gap-3 p-4 rounded-2xl border ${
                  ann.priority === "URGENT" ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-100"
                }`}>
                <Bell size={15} className={`shrink-0 mt-0.5 ${ann.priority === "URGENT" ? "text-red-500" : "text-amber-600"}`} />
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

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-3 gap-4">
          {[
            {
              icon: Users, label: "Siswa Wali Kelas", value: totalStudents,
              color: "text-primary-700", bg: "bg-primary-50", border: "border-primary-100",
            },
            {
              icon: BookOpen, label: "Kelas Wali", value: teacher?.homeroomOf.length ?? 0,
              color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100",
            },
            {
              icon: TrendingUp, label: "Nilai Diinput", value: totalGradesCount,
              color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100",
            },
          ].map(({ icon: Icon, label, value, color, bg, border }) => (
            <div key={label} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <div className={`w-10 h-10 rounded-2xl ${bg} border ${border} flex items-center justify-center mb-3`}>
                <Icon size={18} className={color} />
              </div>
              <p className="text-gray-400 text-xs font-medium mb-1">{label}</p>
              <p className={`font-heading font-bold text-3xl ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* ── Kelas Wali ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-50">
            <GraduationCap size={16} className="text-primary-700" />
            <h3 className="font-heading font-semibold text-navy">Kelas Wali Saya</h3>
          </div>
          {teacher?.homeroomOf.length ? (
            <div className="p-5 grid md:grid-cols-2 gap-4">
              {teacher.homeroomOf.map((cls) => (
                <div key={cls.id} className="border border-gray-100 rounded-2xl p-5 hover:border-primary-200 hover:shadow-sm transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h4 className="font-heading font-bold text-navy">{cls.name}</h4>
                      <p className="text-gray-400 text-sm mt-0.5">{cls.major.name}</p>
                    </div>
                    <span className="text-xs bg-primary-50 text-primary-700 border border-primary-100 px-3 py-1 rounded-full font-semibold">
                      {cls.students.length} siswa
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/dashboard/teacher/grades/${cls.id}`}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-primary-700 hover:bg-primary-800 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">
                      <ClipboardList size={14} /> Input Nilai
                    </Link>
                    <Link href={`/dashboard/teacher/attendance/${cls.id}`}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">
                      <CheckSquare size={14} /> Absensi
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <UserCog size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Belum menjadi wali kelas manapun.</p>
            </div>
          )}
        </div>

        {/* ── Jadwal + Nilai Terakhir ── */}
        <div className="grid lg:grid-cols-2 gap-6">

          {/* Jadwal Mengajar */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-50">
              <Calendar size={16} className="text-primary-700" />
              <h3 className="font-heading font-semibold text-navy text-sm">Jadwal Mengajar</h3>
            </div>
            {teachingSchedules.length > 0 ? (
              <div className="p-4 space-y-2">
                {DAYS.filter(d => teachingSchedules.some(s => s.day === d)).map(day => {
                  const ds = teachingSchedules.filter(s => s.day === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
                  const isToday = day === todayDay;
                  return (
                    <div key={day} className={`rounded-xl overflow-hidden border ${isToday ? "border-primary-300 ring-1 ring-primary-100" : "border-gray-100"}`}>
                      <div className={`px-4 py-2 text-xs font-semibold flex items-center gap-2 ${isToday ? "bg-primary-700 text-white" : "bg-gray-50 text-gray-500"}`}>
                        {DAY_LABEL[day]}
                        {isToday && <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">Hari ini</span>}
                      </div>
                      <div className="divide-y divide-gray-50">
                        {ds.map(s => (
                          <div key={s.id} className="px-4 py-2.5 flex items-center gap-3 text-xs">
                            <span className="font-mono text-primary-700 font-bold w-20 shrink-0 text-[10px]">{s.startTime}–{s.endTime}</span>
                            <span className="font-medium text-gray-800 flex-1 truncate">{s.subject}</span>
                            <span className="text-[10px] bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full font-semibold shrink-0">{s.class.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10 text-gray-400">
                <Calendar size={28} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Belum ada jadwal tersedia.</p>
              </div>
            )}
          </div>

          {/* Nilai Terakhir Diinput */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-primary-700" />
                <h3 className="font-heading font-semibold text-navy text-sm">Nilai Terakhir Diinput</h3>
              </div>
              <Link href="/dashboard/teacher/grades"
                className="text-xs text-primary-700 font-semibold hover:text-gold transition flex items-center gap-1">
                Lihat semua <ArrowRight size={11} />
              </Link>
            </div>
            {teacher?.grades && teacher.grades.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {teacher.grades.map((g) => (
                  <div key={g.id} className="flex items-center justify-between px-5 py-3 text-xs hover:bg-gray-50/50 transition-colors">
                    <div>
                      <p className="font-semibold text-navy">{g.subject}</p>
                      <p className="text-gray-400 mt-0.5">{g.type} · {g.semester}</p>
                    </div>
                    <span className={`font-heading font-bold text-lg ${g.score >= 75 ? "text-emerald-600" : "text-red-500"}`}>
                      {g.score}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-gray-400">
                <ClipboardList size={28} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Belum ada nilai yang diinput.</p>
              </div>
            )}
            <div className="px-5 py-3 border-t border-gray-50">
              <Link href="/dashboard/teacher/grades"
                className="flex items-center justify-center gap-1.5 text-xs text-primary-700 font-semibold hover:text-gold transition-colors">
                Input nilai baru <ArrowRight size={11} />
              </Link>
            </div>
          </div>

        </div>

        {/* ── Akses Cepat ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-heading font-semibold text-navy text-sm mb-4">Akses Cepat</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Input Nilai",  href: "/dashboard/teacher/grades",     icon: ClipboardList, color: "bg-primary-700 hover:bg-primary-800" },
              { label: "Absensi",      href: "/dashboard/teacher/attendance",  icon: CheckSquare,   color: "bg-emerald-600 hover:bg-emerald-700" },
              { label: "Daftar Siswa", href: "/dashboard/teacher/grades",      icon: Users,         color: "bg-blue-600 hover:bg-blue-700" },
              { label: "Profil Saya",  href: "/dashboard/teacher/profile",     icon: UserCog,       color: "bg-amber-600 hover:bg-amber-700" },
            ].map(({ label, href, icon: Icon, color }) => (
              <Link key={label} href={href}
                className={`flex items-center gap-2.5 ${color} text-white rounded-xl px-4 py-3 text-sm font-semibold transition-all hover:-translate-y-0.5 hover:shadow-md`}>
                <Icon size={16} className="shrink-0" />
                {label}
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
