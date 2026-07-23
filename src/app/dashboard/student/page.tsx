export const dynamic = "force-dynamic";

import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getCurrentWeekType } from "@/lib/schedule-week.server";
import {
  BookOpen, CheckCircle, Briefcase, Award, LogOut, AlertTriangle,
  CalendarDays, UserCircle, Printer, Newspaper, Bell, Calendar,
  TrendingUp, Star, ArrowRight, Sparkles,
} from "lucide-react";
import Link from "next/link";
import { logout } from "@/app/actions/auth";

const STATUS_COLOR: Record<string, string> = {
  HADIR: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  IZIN:  "bg-blue-50 text-blue-700 border border-blue-200",
  SAKIT: "bg-amber-50 text-amber-700 border border-amber-200",
  ALPHA: "bg-red-50 text-red-600 border border-red-200",
};
const STATUS_DOT: Record<string, string> = {
  HADIR: "bg-emerald-500", IZIN: "bg-blue-500", SAKIT: "bg-amber-500", ALPHA: "bg-red-500",
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

  const currentWeekType = await getCurrentWeekType();
  const [latestNews, announcements, schedules] = await Promise.all([
    prisma.news.findMany({
      where: { published: true },
      orderBy: { createdAt: "desc" },
      take: 4,
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
          where: { classId: student.classId, weekType: { in: ["SEMUA", currentWeekType] }, scheduleType: "BLOK" },
          include: { teacher: { include: { user: { select: { name: true } } } } },
          orderBy: [{ day: "asc" }, { startTime: "asc" }],
        })
      : Promise.resolve([]),
  ]);

  const grades = student?.grades ?? [];
  const attendance = student?.attendance ?? [];

  const avgScore = grades.length
    ? parseFloat((grades.reduce((a, g) => a + g.score, 0) / grades.length).toFixed(1))
    : 0;

  const presentCount = attendance.filter(a => a.status === "HADIR").length;
  const attendancePct = attendance.length ? Math.round((presentCount / attendance.length) * 100) : 0;

  const gradesBySemester = [...new Set(grades.map(g => g.semester))].sort().map(sem => {
    const sg = grades.filter(g => g.semester === sem);
    const subjects = [...new Set(sg.map(g => g.subject))];
    const bySubject = subjects.map(subject => {
      const rows = sg.filter(g => g.subject === subject);
      const avg = rows.reduce((a, g) => a + g.score, 0) / rows.length;
      return { subject, rows, avg };
    });
    return { sem, bySubject };
  });

  const thisMonthAtt = attendance.filter(a => {
    const d = new Date(a.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const thisMonthSummary = ["HADIR", "IZIN", "SAKIT", "ALPHA"].map(s => ({
    status: s, count: thisMonthAtt.filter(a => a.status === s).length,
  }));
  const thisMonthPresent = thisMonthAtt.filter(a => a.status === "HADIR").length;
  const thisMonthPct = thisMonthAtt.length ? Math.round((thisMonthPresent / thisMonthAtt.length) * 100) : 0;
  const recentAtt = attendance.slice(0, 10);

  const scoreColor = (s: number) => s >= 85 ? "text-emerald-600" : s >= 75 ? "text-blue-600" : "text-red-500";
  const scoreBg = (s: number) => s >= 85 ? "bg-emerald-50" : s >= 75 ? "bg-blue-50" : "bg-red-50";

  const DAYS = ["SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
  const DAY_LABEL: Record<string, string> = { SENIN: "Senin", SELASA: "Selasa", RABU: "Rabu", KAMIS: "Kamis", JUMAT: "Jumat", SABTU: "Sabtu" };
  const todayDay = ["MINGGU","SENIN","SELASA","RABU","KAMIS","JUMAT","SABTU"][now.getDay()];

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f0f2f7" }}>

      {/* ── Header ── */}
      <div className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0A1030 0%, #0F1A45 50%, #1B2B6B 100%)" }}>
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "120px 120px", backgroundRepeat: "repeat", filter: "invert(1)" }} />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />

        <div className="relative px-5 md:px-8 py-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-white/40 text-xs tracking-widest uppercase font-medium flex items-center gap-1.5 mb-1">
              <Sparkles size={11} className="text-gold" />
              Portal Siswa
            </p>
            <h1 className="font-heading text-xl font-bold text-white">{session.name}</h1>
            <p className="text-white/50 text-xs mt-0.5">
              {student?.class?.name ?? "—"}{student?.major?.code ? ` · ${student.major.code}` : ""} · NIS: {student?.nis ?? "—"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/student/rapor" title="Cetak Rapor"
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition border border-white/10">
              <Printer size={16} className="text-white/80" />
            </Link>
            <Link href="/dashboard/student/profile" title="Profil"
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition border border-white/10">
              <UserCircle size={18} className="text-white/80" />
            </Link>
            <form action={logout}>
              <button type="submit" title="Keluar"
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-red-500/30 flex items-center justify-center transition border border-white/10">
                <LogOut size={16} className="text-white/80" />
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="px-5 md:px-8 py-6 space-y-6">

        {/* ── Greeting ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-arabic text-primary-700 text-2xl">اَلسَّلَامُ عَلَيْكُمْ</p>
            <h2 className="font-heading text-2xl font-bold text-navy mt-1">
              Halo, {session.name.split(" ")[0]}! 👋
            </h2>
            <p className="text-gray-400 text-sm mt-0.5">
              {now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          {avgScore >= 80 && (
            <div className="hidden sm:flex items-center gap-2 bg-gold/10 border border-gold/20 rounded-2xl px-4 py-2.5">
              <Star size={16} className="text-gold fill-gold" />
              <div>
                <p className="text-xs font-bold text-gold">Prestasi Baik!</p>
                <p className="text-xs text-gray-500">Rata-rata {avgScore}</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Announcements ── */}
        {announcements.length > 0 && (
          <div className="space-y-2">
            {announcements.map(ann => (
              <div key={ann.id}
                className={`flex items-start gap-3 p-4 rounded-2xl border ${
                  ann.priority === "URGENT"
                    ? "bg-red-50 border-red-200"
                    : "bg-amber-50 border-amber-100"
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              icon: Award, label: "Rata-rata Nilai", value: avgScore || "—",
              color: "text-gold", bg: "bg-gold/10", border: "border-gold/20",
              sub: avgScore >= 80 ? "Di atas rata-rata" : avgScore >= 75 ? "Memenuhi KKM" : "Perlu ditingkatkan",
              subColor: avgScore >= 80 ? "text-emerald-600" : avgScore >= 75 ? "text-blue-600" : "text-red-500",
            },
            {
              icon: CheckCircle, label: "Kehadiran", value: `${attendancePct}%`,
              color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100",
              sub: `${presentCount} dari ${attendance.length} hari`,
              subColor: "text-gray-400",
            },
            {
              icon: BookOpen, label: "Total Nilai", value: grades.length,
              color: "text-primary-700", bg: "bg-primary-50", border: "border-primary-100",
              sub: `${[...new Set(grades.map(g => g.semester))].length} semester`,
              subColor: "text-gray-400",
            },
            {
              icon: Briefcase, label: "Status PKL", value: student?.internship?.status ?? "Belum",
              color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-100",
              sub: student?.internship?.company ?? "Belum ada data",
              subColor: "text-gray-400",
            },
          ].map(({ icon: Icon, label, value, color, bg, border, sub, subColor }) => (
            <div key={label} className="stat-card">
              <div className={`w-10 h-10 rounded-2xl ${bg} border ${border} flex items-center justify-center mb-3`}>
                <Icon size={18} className={color} />
              </div>
              <p className="text-gray-400 text-xs font-medium mb-1">{label}</p>
              <p className={`font-heading font-bold text-2xl ${color}`}>{value}</p>
              <p className={`text-xs mt-1 ${subColor}`}>{sub}</p>
            </div>
          ))}
        </div>

        {/* ── Attendance + Schedule Row ── */}
        <div className="grid md:grid-cols-2 gap-5">

          {/* Absensi bulan ini */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <CalendarDays size={16} className="text-primary-700" />
              <h3 className="font-heading font-semibold text-navy">
                Absensi {now.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
              </h3>
            </div>

            {/* Donut visual */}
            <div className="flex items-center gap-5 mb-4">
              <div className="relative w-20 h-20 shrink-0">
                <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90">
                  <circle cx="40" cy="40" r="30" fill="none" stroke="#f1f5f9" strokeWidth="12" />
                  {thisMonthAtt.length > 0 && (
                    <circle cx="40" cy="40" r="30" fill="none"
                      stroke="#10b981"
                      strokeWidth="12"
                      strokeDasharray={`${(thisMonthPct / 100) * 188.5} ${188.5}`}
                    />
                  )}
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-heading font-bold text-sm text-navy">{thisMonthPct}%</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 flex-1">
                {thisMonthSummary.map(({ status, count }) => (
                  <div key={status} className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${STATUS_DOT[status] ?? "bg-gray-300"}`} />
                    <div>
                      <p className="text-xs font-bold text-navy">{count}</p>
                      <p className="text-[10px] text-gray-400">{status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent attendance */}
            {recentAtt.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-2">Catatan Terakhir</p>
                {recentAtt.map(a => (
                  <div key={a.id} className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
                    <span className="text-xs text-gray-500">
                      {new Date(a.date).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" })}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_COLOR[a.status] ?? "bg-gray-50 border-gray-100 text-gray-500"}`}>
                      <span className={`w-1 h-1 rounded-full ${STATUS_DOT[a.status] ?? "bg-gray-400"}`} />
                      {a.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Jadwal hari ini */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <Calendar size={16} className="text-primary-700" />
              <h3 className="font-heading font-semibold text-navy">Jadwal Pelajaran</h3>
            </div>
            {schedules.length > 0 ? (
              <div className="space-y-2">
                {DAYS.filter(d => schedules.some(s => s.day === d)).map(day => {
                  const daySchedules = schedules.filter(s => s.day === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
                  const isToday = day === todayDay;
                  return (
                    <div key={day} className={`rounded-xl overflow-hidden border ${isToday ? "border-primary-300 ring-1 ring-primary-100" : "border-gray-100"}`}>
                      <div className={`px-3 py-2 flex items-center gap-2 text-xs font-semibold ${isToday ? "bg-primary-700 text-white" : "bg-gray-50 text-gray-500"}`}>
                        {DAY_LABEL[day]}
                        {isToday && <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">Hari ini</span>}
                      </div>
                      <div className="divide-y divide-gray-50">
                        {daySchedules.map(s => (
                          <div key={s.id} className="px-3 py-2 flex items-center gap-2.5 text-xs">
                            <span className="font-mono text-primary-700 font-bold w-20 shrink-0 text-[10px]">{s.startTime}–{s.endTime}</span>
                            <span className="font-medium text-gray-800 flex-1 truncate">{s.subject}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <Calendar size={28} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Jadwal belum tersedia.</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Nilai per Semester ── */}
        {gradesBySemester.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-50">
              <TrendingUp size={16} className="text-primary-700" />
              <h3 className="font-heading font-semibold text-navy">Rekap Nilai per Semester</h3>
            </div>
            <div className="p-6 space-y-6">
              {gradesBySemester.map(({ sem, bySubject }) => {
                const semAvg = bySubject.reduce((a, s) => a + s.avg, 0) / bySubject.length;
                return (
                  <div key={sem}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-primary-800 bg-primary-50 px-3 py-1 rounded-full">{sem}</span>
                      <span className={`text-sm font-bold ${scoreColor(semAvg)}`}>
                        Rata-rata: {semAvg.toFixed(1)}
                      </span>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-gray-100">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="text-left px-4 py-2.5 text-gray-500 font-semibold">Mata Pelajaran</th>
                            {["Tugas", "Ulangan Harian", "UTS", "UAS"].map(t => (
                              <th key={t} className="text-center px-3 py-2.5 text-gray-500 font-semibold whitespace-nowrap">{t}</th>
                            ))}
                            <th className="text-center px-4 py-2.5 text-gray-500 font-semibold">Rata-rata</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bySubject.map(({ subject, rows, avg }) => {
                            function getScore(type: string) {
                              return rows.find(g => g.type === type)?.score ?? null;
                            }
                            return (
                              <tr key={subject} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                                <td className="px-4 py-3 font-medium text-navy">{subject}</td>
                                {["Tugas", "Ulangan Harian", "UTS", "UAS"].map(type => {
                                  const s = getScore(type);
                                  return (
                                    <td key={type} className="px-3 py-3 text-center">
                                      {s !== null ? (
                                        <span className={`inline-block w-10 py-0.5 rounded-lg font-bold text-center ${scoreBg(s)} ${scoreColor(s)}`}>{s}</span>
                                      ) : (
                                        <span className="text-gray-300">—</span>
                                      )}
                                    </td>
                                  );
                                })}
                                <td className="px-4 py-3 text-center">
                                  <span className={`inline-flex items-center gap-1 font-bold ${scoreColor(avg)}`}>
                                    {avg.toFixed(1)}
                                    {avg < 75 && <AlertTriangle size={10} className="text-amber-500" />}
                                  </span>
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
            <div className="px-6 pb-4">
              <Link href="/dashboard/student/rapor"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-primary-200 text-primary-700 text-sm font-semibold hover:bg-primary-50 transition-colors">
                <Printer size={15} />
                Cetak Rapor Lengkap
              </Link>
            </div>
          </div>
        )}

        {/* ── PKL + News Row ── */}
        <div className="grid md:grid-cols-2 gap-5">

          {/* PKL */}
          {student?.internship ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <Briefcase size={16} className="text-purple-600" />
                <h3 className="font-heading font-semibold text-navy">Informasi PKL</h3>
                <span className={`ml-auto text-xs font-bold px-2.5 py-1 rounded-full border ${
                  student.internship.status === "COMPLETED"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }`}>
                  {student.internship.status === "COMPLETED" ? "Selesai" : "Berlangsung"}
                </span>
              </div>
              <div className="space-y-3">
                {[
                  { label: "Perusahaan", value: student.internship.company },
                  { label: "Posisi", value: student.internship.position },
                  { label: "Supervisor", value: student.internship.supervisor },
                  { label: "Periode", value: `${new Date(student.internship.startDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })} — ${new Date(student.internship.endDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}` },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-start gap-3">
                    <span className="text-xs text-gray-400 w-20 shrink-0 pt-0.5">{label}</span>
                    <span className="text-sm font-semibold text-navy">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-purple-50 border border-purple-100 rounded-2xl p-5 flex flex-col items-center justify-center text-center min-h-36">
              <Briefcase size={28} className="text-purple-300 mb-3" />
              <p className="font-semibold text-purple-700 text-sm">Belum Ada Data PKL</p>
              <p className="text-purple-400 text-xs mt-1">Informasi PKL akan muncul setelah diinput oleh wali kelas.</p>
            </div>
          )}

          {/* Berita terbaru */}
          {latestNews.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
                <div className="flex items-center gap-2">
                  <Newspaper size={15} className="text-primary-700" />
                  <h3 className="font-heading font-semibold text-navy text-sm">Berita & Pengumuman</h3>
                </div>
                <Link href="/news" className="text-xs text-primary-700 font-semibold hover:text-gold transition flex items-center gap-1">
                  Lihat semua <ArrowRight size={11} />
                </Link>
              </div>
              <div className="divide-y divide-gray-50">
                {latestNews.map(n => (
                  <Link key={n.id} href={`/news/${n.slug}`}
                    className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50/50 transition-colors group">
                    <div className="w-2 h-2 rounded-full bg-primary-300 shrink-0 mt-1.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-navy font-medium line-clamp-1 group-hover:text-primary-700 transition-colors">{n.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-gray-400">
                          {new Date(n.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                        </span>
                        <span className="text-[10px] bg-primary-50 text-primary-700 px-1.5 py-0.5 rounded font-medium">{n.category}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
