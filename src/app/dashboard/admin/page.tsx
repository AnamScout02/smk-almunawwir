export const dynamic = "force-dynamic";

import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import {
  Users, GraduationCap, Mail, School, UserCog, ClipboardList,
  Clock, CalendarCheck, ArrowRight, Newspaper, BarChart3,
  Sparkles, TrendingUp, CheckCircle2, MessageSquare, MapPin,
} from "lucide-react";
import Link from "next/link";
import DashboardCharts from "@/components/admin/DashboardCharts";

export default async function AdminDashboard() {
  const session = await verifyRole(["ADMIN", "TAS"]);

  const [
    userCount, studentCount, teacherCount, classCount,
    admissionTotal, admissionPending, admissionWawancara, admissionAccepted,
    messageUnread, newsCount,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.student.count({ where: { studentStatus: "AKTIF" } }),
    prisma.teacher.count(),
    prisma.class.count(),
    prisma.admission.count(),
    prisma.admission.count({ where: { status: "PENDING" } }),
    prisma.admission.count({ where: { status: "WAWANCARA" } }),
    prisma.admission.count({ where: { status: "ACCEPTED" } }),
    prisma.contactMessage.count({ where: { isRead: false } }),
    prisma.news.count({ where: { published: true } }),
  ]);

  const [studentGenderRaw, teacherGenderRaw, majorsWithCount, studentsForGradeRecap] = await Promise.all([
    prisma.student.groupBy({ by: ["gender"], where: { studentStatus: "AKTIF" }, _count: { _all: true } }),
    prisma.teacher.groupBy({ by: ["gender"], _count: { _all: true } }),
    prisma.major.findMany({
      select: { code: true, name: true, themeColor: true, _count: { select: { students: { where: { studentStatus: "AKTIF" } } } } },
      orderBy: { students: { _count: "desc" } },
    }),
    prisma.student.findMany({ where: { studentStatus: "AKTIF" }, select: { gender: true, class: { select: { grade: true } } } }),
  ]);

  const GRADE_LABEL: Record<number, string> = { 10: "X", 11: "XI", 12: "XII" };
  const gradeRecap = [10, 11, 12].map(grade => {
    const rows = studentsForGradeRecap.filter(s => s.class?.grade === grade);
    const l = rows.filter(s => s.gender === "L").length;
    const p = rows.filter(s => s.gender === "P").length;
    return { grade, label: GRADE_LABEL[grade], l, p, jml: l + p };
  });
  const recapGrandTotal = gradeRecap.reduce((s, g) => s + g.jml, 0);

  const genderCount = (rows: { gender: string | null; _count: { _all: number } }[]) => ({
    L: rows.find(r => r.gender === "L")?._count._all ?? 0,
    P: rows.find(r => r.gender === "P")?._count._all ?? 0,
  });
  const studentGender = genderCount(studentGenderRaw);
  const teacherGender = genderCount(teacherGenderRaw);
  const majorStats = majorsWithCount
    .filter(m => m._count.students > 0)
    .map(m => ({ code: m.code, name: m.name, count: m._count.students, color: m.themeColor || "#1B2B6B" }));

  const [recentAdmissions, recentNews, recentMessages] = await Promise.all([
    prisma.admission.findMany({ orderBy: { createdAt: "desc" }, take: 6 }),
    prisma.news.findMany({
      where: { published: true },
      orderBy: { createdAt: "desc" },
      take: 4,
      select: { id: true, title: true, category: true, createdAt: true, slug: true },
    }),
    prisma.contactMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, email: true, subject: true, message: true, isRead: true, createdAt: true },
    }),
  ]);

  const statusConfig: Record<string, { label: string; color: string; bg: string; dot: string }> = {
    PENDING:   { label: "Menunggu",  color: "text-amber-700",   bg: "bg-amber-50 border-amber-200",    dot: "bg-amber-500" },
    WAWANCARA: { label: "Wawancara", color: "text-blue-700",    bg: "bg-blue-50 border-blue-200",      dot: "bg-blue-500" },
    ACCEPTED:  { label: "Diterima",  color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", dot: "bg-emerald-500" },
    REJECTED:  { label: "Ditolak",   color: "text-red-600",     bg: "bg-red-50 border-red-200",        dot: "bg-red-500" },
  };

  const now = new Date();
  const dateStr = now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  function timeAgo(date: Date) {
    const diff = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);
    if (diff < 60) return "baru saja";
    if (diff < 3600) return `${Math.floor(diff / 60)} mnt lalu`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
    return `${Math.floor(diff / 86400)} hari lalu`;
  }

  return (
    <div className="min-h-screen pt-16 lg:pt-0">

      {/* ── Top Header Bar ── */}
      <div className="relative overflow-hidden sticky top-16 lg:top-0 z-20"
        style={{ background: "linear-gradient(135deg, #0A1030 0%, #0F1A45 40%, #1B2B6B 100%)" }}>
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "140px 140px", backgroundRepeat: "repeat", filter: "invert(1)" }}
        />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
        <div className="relative px-6 lg:px-8 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={14} className="text-gold" />
              <p className="text-gold/80 text-xs font-semibold tracking-widest uppercase">{dateStr}</p>
            </div>
            <h1 className="font-heading text-2xl font-bold text-white">Dashboard Administrator</h1>
            <p className="text-white/50 text-sm mt-0.5">
              Selamat datang, <span className="text-white/80 font-medium">{session.name}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            {messageUnread > 0 && (
              <Link href="/dashboard/admin/messages"
                className="relative flex items-center gap-2 bg-red-500/20 border border-red-400/30 text-red-300 text-xs font-semibold px-3 py-2 rounded-xl hover:bg-red-500/30 transition-colors">
                <Mail size={14} />
                {messageUnread} pesan baru
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
              </Link>
            )}
            <Link href="/dashboard/admin/admissions"
              className="flex items-center gap-2 bg-gold/20 border border-gold/30 text-gold text-xs font-semibold px-3 py-2 rounded-xl hover:bg-gold/30 transition-colors">
              <ClipboardList size={14} />
              {admissionPending} menunggu
            </Link>
          </div>
        </div>
      </div>

      <div className="px-6 lg:px-8 py-8 space-y-8">

        {/* ── Stat Cards ── */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={16} className="text-primary-700" />
            <h2 className="font-heading font-semibold text-navy text-sm uppercase tracking-widest">Ringkasan Data</h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                icon: GraduationCap, label: "Total Siswa", value: studentCount,
                color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100",
                gradient: "from-emerald-500/10 to-emerald-600/5", href: "/dashboard/admin/students",
              },
              {
                icon: UserCog, label: "Tenaga Pendidik", value: teacherCount,
                color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100",
                gradient: "from-blue-500/10 to-blue-600/5", href: "/dashboard/admin/teachers",
              },
              {
                icon: School, label: "Jumlah Kelas", value: classCount,
                color: "text-primary-700", bg: "bg-primary-50", border: "border-primary-100",
                gradient: "from-primary-500/10 to-primary-700/5", href: "/dashboard/admin/classes",
              },
              {
                icon: Users, label: "Total Akun", value: userCount,
                color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-100",
                gradient: "from-purple-500/10 to-purple-600/5", href: "/dashboard/admin/users",
              },
            ].map(({ icon: Icon, label, value, color, bg, border, href }) => (
              <Link key={label} href={href}
                className="group bg-white rounded-[1.25rem] p-6 border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-gray-200 transition-all block"
                style={{ position: "relative" }}>
                <div className={`w-11 h-11 rounded-2xl ${bg} border ${border} flex items-center justify-center mb-4`}>
                  <Icon size={20} className={color} />
                </div>
                <p className="text-gray-400 text-xs font-medium mb-1">{label}</p>
                <p className={`font-heading font-bold text-3xl ${color}`}>{value.toLocaleString()}</p>
                <div className="flex items-center gap-1 mt-2 text-gray-400 text-xs group-hover:text-primary-700 transition-colors">
                  <span>Lihat detail</span>
                  <ArrowRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ── Statistik Siswa & Guru ── */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={16} className="text-primary-700" />
            <h2 className="font-heading font-semibold text-navy text-sm uppercase tracking-widest">Statistik Siswa &amp; Guru</h2>
          </div>
          <DashboardCharts studentGender={studentGender} teacherGender={teacherGender} majorStats={majorStats} />
        </div>

        {/* ── Rekapitulasi Jumlah Siswa ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <GraduationCap size={15} className="text-primary-700" />
              <h3 className="font-heading font-semibold text-navy text-sm">Rekapitulasi Jumlah Siswa</h3>
            </div>
            <Link href="/dashboard/admin/reports/rekap-siswa"
              className="text-xs text-primary-700 font-semibold hover:text-gold transition flex items-center gap-1">
              Lihat detail lengkap <ArrowRight size={11} />
            </Link>
          </div>
          <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {gradeRecap.map(g => (
              <div key={g.grade} className="rounded-xl border border-gray-100 overflow-hidden text-center">
                <div className="bg-primary-900 text-white font-bold text-sm py-2">{g.label}</div>
                <p className="font-heading font-bold text-2xl text-primary-900 pt-2">{g.jml}</p>
                <div className="flex justify-center gap-3 text-xs text-gray-400 pb-2.5 pt-0.5">
                  <span>L {g.l}</span><span>P {g.p}</span>
                </div>
              </div>
            ))}
            <div className="rounded-xl overflow-hidden text-center" style={{ background: "linear-gradient(135deg, #0F1A45 0%, #1B2B6B 100%)" }}>
              <div className="bg-gold text-primary-900 font-bold text-sm py-2">Total</div>
              <p className="font-heading font-bold text-2xl text-white pt-2">{recapGrandTotal}</p>
              <p className="text-white/50 text-xs pb-2.5 pt-0.5">Seluruh Siswa</p>
            </div>
          </div>
        </div>

        {/* ── Alert + Quick Actions Row ── */}
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            {
              icon: Clock, label: "Menunggu Verifikasi", value: admissionPending,
              color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200",
              href: "/dashboard/admin/admissions",
            },
            {
              icon: CalendarCheck, label: "Tahap Wawancara", value: admissionWawancara,
              color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200",
              href: "/dashboard/admin/admissions",
            },
            {
              icon: Mail, label: "Pesan Belum Dibaca", value: messageUnread,
              color: "text-red-600", bg: "bg-red-50", border: "border-red-200",
              href: "/dashboard/admin/messages",
            },
          ].map(({ icon: Icon, label, value, color, bg, border, href }) => (
            <Link key={label} href={href}
              className={`flex items-center gap-4 p-4 rounded-2xl border ${bg} ${border} hover:shadow-md transition-all group`}>
              <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-sm shrink-0">
                <Icon size={20} className={color} />
              </div>
              <div>
                <p className={`font-heading font-bold text-2xl ${color}`}>{value}</p>
                <p className="text-xs text-gray-500 leading-tight">{label}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* ── Quick Actions ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-heading font-semibold text-navy text-sm mb-4">Akses Cepat</h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
            {[
              { label: "Pendaftaran", href: "/dashboard/admin/admissions", icon: ClipboardList, color: "bg-amber-600 hover:bg-amber-700", badge: admissionPending > 0 ? admissionPending : null },
              { label: "Siswa",       href: "/dashboard/admin/students",   icon: GraduationCap, color: "bg-emerald-600 hover:bg-emerald-700", badge: null },
              { label: "Guru",        href: "/dashboard/admin/teachers",   icon: UserCog,       color: "bg-blue-600 hover:bg-blue-700",     badge: null },
              { label: "Berita",      href: "/dashboard/admin/news",       icon: Newspaper,     color: "bg-primary-700 hover:bg-primary-900", badge: null },
              { label: "Kelas",       href: "/dashboard/admin/classes",    icon: School,        color: "bg-purple-600 hover:bg-purple-700",  badge: null },
              { label: "Pesan",       href: "/dashboard/admin/messages",   icon: Mail,          color: "bg-red-500 hover:bg-red-600",        badge: messageUnread > 0 ? messageUnread : null },
              { label: "Laporan",     href: "/dashboard/admin/reports",    icon: BarChart3,     color: "bg-indigo-600 hover:bg-indigo-700",  badge: null },
              { label: "Jadwal",      href: "/dashboard/admin/schedules",  icon: CalendarCheck, color: "bg-teal-600 hover:bg-teal-700",      badge: null },
            ].map(({ label, href, icon: Icon, color, badge }) => (
              <Link key={label} href={href}
                className={`relative flex flex-col items-center gap-1.5 ${color} text-white rounded-xl px-2 py-3 text-xs font-semibold transition-all hover:-translate-y-0.5 hover:shadow-md text-center`}>
                <Icon size={18} className="shrink-0" />
                {label}
                {badge !== null && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gold text-primary-900 text-[10px] font-bold rounded-full flex items-center justify-center">
                    {badge}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>

        {/* ── Messages + Admissions Row ── */}
        <div className="grid lg:grid-cols-5 gap-6">

          {/* Pesan Masuk Panel */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
              <div className="flex items-center gap-2">
                <MessageSquare size={15} className="text-primary-700" />
                <h3 className="font-heading font-semibold text-navy text-sm">Pesan Masuk</h3>
                {messageUnread > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{messageUnread}</span>
                )}
              </div>
              <Link href="/dashboard/admin/messages"
                className="text-xs text-primary-700 font-semibold hover:text-gold transition flex items-center gap-1">
                Lihat semua <ArrowRight size={11} />
              </Link>
            </div>

            {recentMessages.length ? (
              <div className="divide-y divide-gray-50">
                {recentMessages.map(msg => (
                  <Link key={msg.id} href="/dashboard/admin/messages"
                    className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50/50 transition-colors group">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-xs ${
                      msg.isRead ? "bg-gray-100 text-gray-500" : "bg-primary-100 text-primary-700"
                    }`}>
                      {msg.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-xs font-semibold truncate ${msg.isRead ? "text-gray-500" : "text-navy"}`}>
                          {msg.name}
                          {!msg.isRead && <span className="inline-block w-1.5 h-1.5 bg-red-500 rounded-full ml-1.5 align-middle" />}
                        </p>
                        <span className="text-[10px] text-gray-400 shrink-0">{timeAgo(msg.createdAt)}</span>
                      </div>
                      <p className="text-xs text-gray-600 font-medium truncate mt-0.5">{msg.subject}</p>
                      <p className="text-[10px] text-gray-400 line-clamp-1 mt-0.5">{msg.message}</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-gray-400">
                <MessageSquare size={28} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Belum ada pesan masuk.</p>
              </div>
            )}
          </div>

          {/* Recent Admissions Table */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
              <div className="flex items-center gap-2">
                <ClipboardList size={16} className="text-primary-700" />
                <h3 className="font-heading font-semibold text-navy">Pendaftaran Terbaru</h3>
              </div>
              <Link href="/dashboard/admin/admissions"
                className="text-xs text-primary-700 font-semibold hover:text-gold transition flex items-center gap-1">
                Lihat semua <ArrowRight size={11} />
              </Link>
            </div>
            {recentAdmissions.length ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50/50">
                      <th className="text-left px-6 py-3 text-xs text-gray-400 font-semibold uppercase tracking-wider">Pendaftar</th>
                      <th className="text-left px-4 py-3 text-xs text-gray-400 font-semibold uppercase tracking-wider hidden sm:table-cell">Jurusan</th>
                      <th className="text-right px-6 py-3 text-xs text-gray-400 font-semibold uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {recentAdmissions.map((a) => {
                      const cfg = statusConfig[a.status];
                      return (
                        <tr key={a.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                                <span className="text-primary-700 font-bold text-xs">{a.fullName.charAt(0)}</span>
                              </div>
                              <div>
                                <p className="font-semibold text-sm text-navy leading-tight">{a.fullName}</p>
                                <p className="text-xs text-gray-400">{a.phone}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 hidden sm:table-cell">
                            <span className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-lg font-medium">{a.chosenMajor}</span>
                          </td>
                          <td className="px-6 py-3.5 text-right">
                            <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold border ${cfg?.bg ?? "bg-gray-50 border-gray-200"} ${cfg?.color ?? "text-gray-600"}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${cfg?.dot ?? "bg-gray-400"}`} />
                              {cfg?.label ?? a.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <ClipboardList size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">Belum ada pendaftaran masuk.</p>
              </div>
            )}
          </div>
        </div>

        {/* ── News + Summary Row ── */}
        <div className="grid lg:grid-cols-3 gap-6">

          {/* Recent News */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
              <div className="flex items-center gap-2">
                <Newspaper size={15} className="text-primary-700" />
                <h3 className="font-heading font-semibold text-navy text-sm">Berita Terbaru</h3>
              </div>
              <span className="text-xs text-gray-400">{newsCount} dipublikasi</span>
            </div>
            <div className="divide-y divide-gray-50">
              {recentNews.length ? recentNews.map(n => (
                <Link key={n.id} href="/dashboard/admin/news"
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
              )) : (
                <div className="text-center py-6 text-gray-400 text-sm">Belum ada berita.</div>
              )}
            </div>
            <div className="px-5 py-3 border-t border-gray-50">
              <Link href="/dashboard/admin/news"
                className="flex items-center justify-center gap-1.5 text-xs text-primary-700 font-semibold hover:text-gold transition-colors">
                Kelola berita <ArrowRight size={11} />
              </Link>
            </div>
          </div>

          {/* Summary card */}
          <div className="space-y-4">
            <div className="rounded-2xl p-5 text-white overflow-hidden relative"
              style={{ background: "linear-gradient(135deg, #0F1A45 0%, #1B2B6B 100%)" }}>
              <div className="absolute inset-0 opacity-[0.06]"
                style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "100px 100px", backgroundRepeat: "repeat", filter: "invert(1)" }} />
              <div className="relative">
                <p className="font-arabic text-gold text-xl mb-2">فَإِنَّ مَعَ الْعُسْرِ يُسْرًا</p>
                <p className="text-white/50 text-xs mb-5 italic">"Sesungguhnya bersama kesulitan ada kemudahan."</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/10 rounded-xl p-3 text-center">
                    <CheckCircle2 size={16} className="text-emerald-400 mx-auto mb-1" />
                    <p className="font-bold text-xl text-white">{admissionAccepted}</p>
                    <p className="text-white/50 text-[10px]">Siswa Diterima</p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-3 text-center">
                    <TrendingUp size={16} className="text-gold mx-auto mb-1" />
                    <p className="font-bold text-xl text-white">
                      {admissionTotal > 0 ? Math.round(admissionAccepted / admissionTotal * 100) : 0}%
                    </p>
                    <p className="text-white/50 text-[10px]">Tingkat Penerimaan</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Lokasi */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <MapPin size={14} className="text-primary-700" />
                <p className="font-semibold text-navy text-sm">Informasi Sekolah</p>
              </div>
              <div className="space-y-2 text-xs text-gray-500">
                <p><span className="font-semibold text-navy">SMK Al Munawwir IIBS</span></p>
                <p>Singojuruh, Banyuwangi, Jawa Timur</p>
                <p>NPSN: 69896523</p>
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-primary-700 font-semibold">Total Pendaftar: {admissionTotal}</p>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
