export const dynamic = "force-dynamic";

import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import {
  Users, GraduationCap, Mail, School, UserCog, ClipboardList,
  Clock, ArrowRight, Newspaper,
  Sparkles, MessageSquare,
} from "lucide-react";
import Link from "next/link";
import DashboardCharts from "@/components/admin/DashboardCharts";
import { getWakilKepalaAgenda } from "@/lib/agenda";

export default async function AdminDashboard() {
  const session = await verifyRole(["ADMIN", "TAS"]);

  const [
    userCount, studentCount, teacherCount, classCount,
    admissionPending, messageUnread, newsCount,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.student.count({ where: { studentStatus: "AKTIF" } }),
    prisma.teacher.count(),
    prisma.class.count(),
    prisma.admission.count({ where: { status: "PENDING" } }),
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

  const now = new Date();

  const [noGenderStudents, noGenderTeachers, unclassedStudents, agenda] = await Promise.all([
    prisma.student.count({ where: { studentStatus: "AKTIF", gender: null } }),
    prisma.teacher.count({ where: { gender: null } }),
    prisma.student.count({ where: { studentStatus: "AKTIF", classId: null } }),
    getWakilKepalaAgenda(),
  ]);

  const dataGaps = [
    { label: "Siswa belum ada Jenis Kelamin", count: noGenderStudents, href: "/dashboard/admin/buku-induk/siswa" },
    { label: "Guru belum ada Jenis Kelamin", count: noGenderTeachers, href: "/dashboard/admin/buku-induk/guru" },
    { label: "Siswa belum punya Kelas", count: unclassedStudents, href: "/dashboard/admin/buku-induk/siswa" },
  ].filter(g => g.count > 0);

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

      <div className="px-6 lg:px-8 py-6 space-y-5">

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { icon: GraduationCap, label: "Total Siswa", value: studentCount, href: "/dashboard/admin/students",
              grad: "from-emerald-500 to-emerald-600", ring: "ring-emerald-100" },
            { icon: UserCog, label: "Tenaga Pendidik", value: teacherCount, href: "/dashboard/admin/teachers",
              grad: "from-blue-500 to-blue-600", ring: "ring-blue-100" },
            { icon: School, label: "Jumlah Kelas", value: classCount, href: "/dashboard/admin/classes",
              grad: "from-primary-500 to-primary-700", ring: "ring-primary-100" },
            { icon: Users, label: "Total Akun", value: userCount, href: "/dashboard/admin/users",
              grad: "from-purple-500 to-purple-600", ring: "ring-purple-100" },
            { icon: Clock, label: "Menunggu Verifikasi", value: admissionPending, href: "/dashboard/admin/admissions",
              grad: "from-amber-500 to-amber-600", ring: "ring-amber-100" },
            { icon: Mail, label: "Pesan Belum Dibaca", value: messageUnread, href: "/dashboard/admin/messages",
              grad: "from-red-500 to-red-600", ring: "ring-red-100" },
          ].map(({ icon: Icon, label, value, href, grad, ring }, i) => (
            <Link key={label} href={href} style={{ animationDelay: `${i * 50}ms` }}
              className={`card-fade-up group relative overflow-hidden rounded-xl p-3.5 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all block bg-gradient-to-br ${grad} ring-1 ${ring}`}>
              <div className="absolute -right-3 -bottom-3 opacity-15 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
                <Icon size={56} className="text-white" />
              </div>
              <div className="relative">
                <p className="font-heading font-bold text-xl leading-tight text-white">{value.toLocaleString()}</p>
                <p className="text-white/75 text-[10px] font-medium leading-tight truncate mt-0.5">{label}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* ── Statistik & Widget ── */}
        <DashboardCharts studentGender={studentGender} teacherGender={teacherGender}
          studentTotal={studentCount} teacherTotal={teacherCount} majorStats={majorStats}
          dataGaps={dataGaps} agenda={agenda} />

        {/* ── Rekapitulasi Jumlah Siswa ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
            <h3 className="font-heading font-semibold text-navy text-xs uppercase tracking-wide">Rekapitulasi Jumlah Siswa</h3>
            <Link href="/dashboard/admin/reports/rekap-siswa"
              className="text-[11px] text-primary-700 font-semibold hover:text-gold transition flex items-center gap-1">
              Detail <ArrowRight size={10} />
            </Link>
          </div>
          <div className="p-3.5 grid grid-cols-4 gap-2.5">
            {gradeRecap.map((g, i) => {
              const grads = ["bg-primary-500", "bg-primary-700", "bg-primary-900"];
              return (
                <div key={g.grade} className="rounded-lg border border-gray-100 overflow-hidden text-center">
                  <div className={`${grads[i]} text-white font-bold text-xs py-1.5`}>{g.label}</div>
                  <div className="bg-primary-50/60 pb-1.5">
                    <p className="font-heading font-bold text-lg text-primary-900 pt-1.5">{g.jml}</p>
                    <div className="flex justify-center gap-2 text-[10px] text-gray-400">
                      <span>L {g.l}</span><span>P {g.p}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="rounded-lg border border-gray-100 overflow-hidden text-center">
              <div className="bg-gold text-primary-900 font-bold text-xs py-1.5">Jumlah</div>
              <div className="bg-amber-50 pb-1.5">
                <p className="font-heading font-bold text-lg text-primary-900 pt-1.5">{recapGrandTotal}</p>
                <p className="text-primary-900/60 text-[10px] font-medium">Siswa</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Messages + Admissions Row ── */}
        <div className="grid lg:grid-cols-5 gap-4">

          {/* Pesan Masuk Panel */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
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
                    className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50/50 transition-colors group">
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
          <div className="lg:col-span-3 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50">
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

        {/* ── Berita Terbaru ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <Newspaper size={15} className="text-primary-700" />
              <h3 className="font-heading font-semibold text-navy text-sm">Berita Terbaru</h3>
            </div>
            <span className="text-xs text-gray-400">{newsCount} dipublikasi</span>
          </div>
          <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 divide-gray-50">
            {recentNews.length ? recentNews.map(n => (
              <Link key={n.id} href="/dashboard/admin/news"
                className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50/50 transition-colors group">
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
              <div className="col-span-2 text-center py-6 text-gray-400 text-sm">Belum ada berita.</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
