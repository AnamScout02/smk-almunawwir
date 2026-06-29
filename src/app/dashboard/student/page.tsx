export const dynamic = "force-dynamic";

import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { BookOpen, CheckCircle, Briefcase, Award, LogOut, AlertTriangle, CalendarDays, UserCircle, Printer, Newspaper, Bell, Calendar } from "lucide-react";
import Link from "next/link";
import { logout } from "@/app/actions/auth";

const STATUS_COLOR: Record<string, string> = {
  HADIR: "bg-emerald-100 text-emerald-700",
  IZIN:  "bg-blue-100 text-blue-700",
  SAKIT: "bg-amber-100 text-amber-700",
  ALPHA: "bg-red-100 text-red-600",
};

export default async function StudentDashboard() {
  const session = await verifyRole(["STUDENT"]);

  const now = new Date();
  const student = await prisma.student.findFirst({
    where: { user: { email: session.email } },
    include: {
      grades: { orderBy: { createdAt: "desc" } },
      attendance: { orderBy: { date: "desc" } },
      internship: true,
      class: true,
      major: true,
    },
  });

  const [latestNews, announcements, schedules] = await Promise.all([
    prisma.news.findMany({
      where: { published: true },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { id: true, slug: true, title: true, category: true, createdAt: true },
    }),
    prisma.announcement.findMany({
      where: {
        active: true,
        targetRole: { in: ["ALL", "STUDENT"] },
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: 5,
    }),
    student?.classId
      ? prisma.schedule.findMany({
          where: { classId: student.classId },
          include: { teacher: { include: { user: { select: { name: true } } } } },
          orderBy: [{ day: "asc" }, { startTime: "asc" }],
        })
      : Promise.resolve([]),
  ]);

  const grades = student?.grades ?? [];
  const attendance = student?.attendance ?? [];

  const avgScore = grades.length
    ? (grades.reduce((a, g) => a + g.score, 0) / grades.length).toFixed(1)
    : "-";

  const presentCount = attendance.filter(a => a.status === "HADIR").length;
  const attendancePct = attendance.length
    ? Math.round((presentCount / attendance.length) * 100)
    : 0;

  // Nilai per semester
  const semesters = [...new Set(grades.map(g => g.semester))].sort();
  const gradesBySemester = semesters.map(sem => {
    const sg = grades.filter(g => g.semester === sem);
    const subjects = [...new Set(sg.map(g => g.subject))];
    const bySubject = subjects.map(subject => {
      const rows = sg.filter(g => g.subject === subject);
      const avg = rows.reduce((a, g) => a + g.score, 0) / rows.length;
      return { subject, rows, avg };
    });
    return { sem, bySubject };
  });

  // Absensi bulan ini
  const thisMonthAtt = attendance.filter(a => {
    const d = new Date(a.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const thisMonthSummary = ["HADIR", "IZIN", "SAKIT", "ALPHA"].map(s => ({
    status: s, count: thisMonthAtt.filter(a => a.status === s).length,
  }));

  // Absensi 10 hari terakhir
  const recentAtt = attendance.slice(0, 10);

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="bg-primary-900 text-white px-6 md:px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-xl font-bold">Portal Siswa</h1>
          <p className="text-white/60 text-sm">SMK Al-Munawwir IIBS</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="font-semibold text-sm">{session.name}</p>
            <p className="text-white/60 text-xs">
              {student?.class?.name ?? ""}{student?.major?.code ? ` · ${student.major.code}` : ""}
            </p>
          </div>
          <Link href="/dashboard/student/rapor"
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
            title="Cetak Rapor Nilai">
            <Printer size={16} />
          </Link>
          <Link href="/dashboard/student/profile"
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
            title="Profil & Ganti Password">
            <UserCircle size={18} />
          </Link>
          <form action={logout}>
            <button type="submit"
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
              title="Keluar">
              <LogOut size={16} />
            </button>
          </form>
        </div>
      </header>

      <div className="px-6 md:px-8 py-8 max-w-6xl mx-auto space-y-8">
        {/* Greeting */}
        <div>
          <p className="font-arabic text-primary-700 text-xl mb-1">اَلسَّلَامُ عَلَيْكُمْ</p>
          <h2 className="font-heading text-3xl font-bold text-navy">
            Halo, {session.name.split(" ")[0]}!
          </h2>
          <p className="text-gray-500 mt-1 text-sm">NIS: {student?.nis ?? "—"}</p>
        </div>

        {/* Pengumuman */}
        {announcements.length > 0 && (
          <div className="space-y-2">
            {announcements.map(ann => (
              <div key={ann.id} className={`flex items-start gap-3 p-4 rounded-xl border ${
                ann.priority === "URGENT"
                  ? "bg-red-50 border-red-200"
                  : "bg-amber-50 border-amber-100"
              }`}>
                <Bell size={16} className={`shrink-0 mt-0.5 ${ann.priority === "URGENT" ? "text-red-500" : "text-amber-600"}`} />
                <div className="flex-1 min-w-0">
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

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Award,       label: "Rata-rata Nilai", value: avgScore,           color: "text-gold",        bg: "bg-gold/10" },
            { icon: CheckCircle, label: "Kehadiran",       value: `${attendancePct}%`, color: "text-emerald-600", bg: "bg-emerald-50" },
            { icon: BookOpen,    label: "Total Nilai",     value: String(grades.length), color: "text-primary-700", bg: "bg-primary-50" },
            { icon: Briefcase,   label: "Status PKL",      value: student?.internship?.status ?? "Belum", color: "text-purple-600", bg: "bg-purple-50" },
          ].map(({ icon: Icon, label, value, color, bg }) => (
            <div key={label} className="bg-white rounded-2xl p-5 shadow-sm">
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                <Icon size={18} className={color} />
              </div>
              <p className="text-gray-400 text-xs mb-1">{label}</p>
              <p className={`font-heading font-bold text-2xl ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Rekap Absensi Bulan Ini */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h3 className="font-heading font-semibold text-xl text-navy mb-5 flex items-center gap-2">
            <CalendarDays size={18} className="text-primary-700" />
            Absensi Bulan {now.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {thisMonthSummary.map(({ status, count }) => (
              <div key={status} className={`rounded-xl p-4 text-center ${STATUS_COLOR[status].replace("text-", "border-l-4 border-").split(" ")[0]} bg-gray-50`}>
                <p className="text-2xl font-heading font-bold text-navy">{count}</p>
                <p className="text-xs text-gray-500 mt-1">{status}</p>
              </div>
            ))}
          </div>
          {recentAtt.length > 0 ? (
            <div>
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-3">10 Catatan Terakhir</p>
              <div className="space-y-1.5">
                {recentAtt.map(a => (
                  <div key={a.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                    <span className="text-sm text-gray-600">
                      {new Date(a.date).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLOR[a.status] ?? "bg-gray-100 text-gray-500"}`}>
                      {a.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-gray-400 text-sm text-center py-4">Belum ada data absensi bulan ini.</p>
          )}
        </div>

        {/* Nilai per Semester */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h3 className="font-heading font-semibold text-xl text-navy mb-5">Rekap Nilai per Semester</h3>
          {gradesBySemester.length ? (
            <div className="space-y-6">
              {gradesBySemester.map(({ sem, bySubject }) => {
                const semAvg = (bySubject.reduce((a, s) => a + s.avg, 0) / bySubject.length).toFixed(1);
                return (
                  <div key={sem}>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-primary-800 text-sm">{sem}</h4>
                      <span className={`text-sm font-bold ${Number(semAvg) >= 75 ? "text-emerald-600" : "text-red-500"}`}>
                        Rata-rata: {semAvg}
                      </span>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-gray-100">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-100">
                          <tr>
                            <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Mata Pelajaran</th>
                            <th className="text-center px-4 py-2.5 text-gray-500 font-medium">Tugas</th>
                            <th className="text-center px-4 py-2.5 text-gray-500 font-medium">UH</th>
                            <th className="text-center px-4 py-2.5 text-gray-500 font-medium">UTS</th>
                            <th className="text-center px-4 py-2.5 text-gray-500 font-medium">UAS</th>
                            <th className="text-center px-4 py-2.5 text-gray-500 font-medium">Rata-rata</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bySubject.map(({ subject, rows, avg }) => {
                            function getScore(type: string) {
                              const r = rows.find(g => g.type === type);
                              return r ? r.score : null;
                            }
                            return (
                              <tr key={subject} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                                <td className="px-4 py-2.5 font-medium text-primary-900">{subject}</td>
                                {["Tugas", "Ulangan Harian", "UTS", "UAS"].map(type => {
                                  const s = getScore(type);
                                  return (
                                    <td key={type} className="px-4 py-2.5 text-center">
                                      {s !== null ? (
                                        <span className={`font-semibold ${s >= 75 ? "text-emerald-600" : "text-red-500"}`}>{s}</span>
                                      ) : (
                                        <span className="text-gray-300">—</span>
                                      )}
                                    </td>
                                  );
                                })}
                                <td className="px-4 py-2.5 text-center">
                                  <span className={`font-bold ${avg >= 75 ? "text-emerald-600" : "text-red-500"}`}>
                                    {avg.toFixed(1)}
                                  </span>
                                  {avg < 75 && (
                                    <AlertTriangle size={12} className="inline ml-1 text-amber-500" aria-label="Di bawah KKM" />
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-400 text-sm text-center py-8">Belum ada data nilai.</p>
          )}
        </div>

        {/* Berita & Pengumuman Terbaru */}
        {latestNews.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-heading font-semibold text-xl text-navy flex items-center gap-2">
                <Newspaper size={18} className="text-primary-700" />
                Berita & Pengumuman
              </h3>
              <Link href="/news" className="text-sm text-primary-700 font-semibold hover:text-gold transition">
                Lihat Semua →
              </Link>
            </div>
            <div className="space-y-3">
              {latestNews.map(n => (
                <Link key={n.id} href={`/news/${n.slug}`}
                  className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition group">
                  <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center shrink-0 mt-0.5">
                    <Newspaper size={14} className="text-primary-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-primary-900 group-hover:text-gold transition line-clamp-1">{n.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">
                        {new Date(n.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{n.category}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Jadwal Pelajaran */}
        {schedules.length > 0 && (() => {
          const DAYS = ["SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
          const DAY_LABEL: Record<string, string> = { SENIN: "Senin", SELASA: "Selasa", RABU: "Rabu", KAMIS: "Kamis", JUMAT: "Jumat", SABTU: "Sabtu" };
          const todayDay = ["MINGGU","SENIN","SELASA","RABU","KAMIS","JUMAT","SABTU"][now.getDay()];
          return (
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="font-heading font-semibold text-xl text-navy mb-5 flex items-center gap-2">
                <Calendar size={18} className="text-primary-700" /> Jadwal Pelajaran
              </h3>
              <div className="space-y-3">
                {DAYS.filter(d => schedules.some(s => s.day === d)).map(day => {
                  const daySchedules = schedules.filter(s => s.day === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
                  const isToday = day === todayDay;
                  return (
                    <div key={day} className={`rounded-xl overflow-hidden border ${isToday ? "border-primary-300 ring-1 ring-primary-200" : "border-gray-100"}`}>
                      <div className={`px-4 py-2 flex items-center gap-2 ${isToday ? "bg-primary-700 text-white" : "bg-gray-50 text-gray-600"}`}>
                        <span className="font-semibold text-sm">{DAY_LABEL[day]}</span>
                        {isToday && <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">Hari ini</span>}
                      </div>
                      <div className="divide-y divide-gray-50">
                        {daySchedules.map(s => (
                          <div key={s.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                            <span className="font-mono text-xs text-primary-700 font-bold w-24 shrink-0">{s.startTime}–{s.endTime}</span>
                            <span className="font-medium text-gray-800 flex-1">{s.subject}</span>
                            {s.room && <span className="text-xs text-gray-400 hidden sm:block">{s.room}</span>}
                            {s.teacher && <span className="text-xs text-gray-400 hidden md:block">{s.teacher.user.name}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* PKL Info */}
        {student?.internship && (
          <div className="bg-primary-50 border border-primary-100 rounded-2xl p-6">
            <h3 className="font-heading font-semibold text-lg text-navy mb-4 flex items-center gap-2">
              <Briefcase size={18} className="text-primary-700" />
              Informasi PKL / Prakerin
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-400 text-xs block mb-0.5">Perusahaan</span>
                <span className="font-semibold text-navy">{student.internship.company}</span>
              </div>
              <div>
                <span className="text-gray-400 text-xs block mb-0.5">Posisi / Bidang</span>
                <span className="font-semibold text-navy">{student.internship.position}</span>
              </div>
              <div>
                <span className="text-gray-400 text-xs block mb-0.5">Supervisor</span>
                <span className="font-semibold text-navy">{student.internship.supervisor}</span>
              </div>
              <div>
                <span className="text-gray-400 text-xs block mb-0.5">Mulai</span>
                <span className="font-semibold text-navy">
                  {new Date(student.internship.startDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                </span>
              </div>
              <div>
                <span className="text-gray-400 text-xs block mb-0.5">Selesai</span>
                <span className="font-semibold text-navy">
                  {new Date(student.internship.endDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                </span>
              </div>
              <div>
                <span className="text-gray-400 text-xs block mb-0.5">Status</span>
                <span className={`font-bold text-sm px-2.5 py-1 rounded-full ${
                  student.internship.status === "COMPLETED"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                }`}>
                  {student.internship.status === "COMPLETED" ? "Selesai" : "Sedang Berlangsung"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
