export const dynamic = "force-dynamic";

import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { Users, GraduationCap, FileText, Mail, LogOut, Settings, School, UserCog, ClipboardList } from "lucide-react";
import Link from "next/link";
import { logout } from "@/app/actions/auth";

export default async function AdminDashboard() {
  const session = await verifyRole(["ADMIN"]);

  const [userCount, studentCount, teacherCount, classCount, admissionCount, admissionWawancara, messageUnread, newsCount] = await Promise.all([
    prisma.user.count(),
    prisma.student.count(),
    prisma.teacher.count(),
    prisma.class.count(),
    prisma.admission.count({ where: { status: "PENDING" } }),
    prisma.admission.count({ where: { status: "WAWANCARA" } }),
    prisma.contactMessage.count({ where: { isRead: false } }),
    prisma.news.count({ where: { published: true } }),
  ]);

  const recentAdmissions = await prisma.admission.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const statusColor: Record<string, string> = {
    PENDING:    "bg-amber-50 text-amber-700",
    WAWANCARA:  "bg-blue-50 text-blue-700",
    ACCEPTED:   "bg-emerald-50 text-emerald-700",
    REJECTED:   "bg-red-50 text-red-600",
  };

  const statusLabel: Record<string, string> = {
    PENDING: "Menunggu", WAWANCARA: "Wawancara", ACCEPTED: "Diterima", REJECTED: "Ditolak",
  };

  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-primary-900 text-white px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings size={20} className="text-gold" />
          <div>
            <h1 className="font-heading text-xl font-bold">Panel Admin</h1>
            <p className="text-white/60 text-sm">SMK Al-Munawwir IIBS</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="font-semibold text-sm">{session.name}</p>
            <p className="text-white/60 text-xs">Administrator</p>
          </div>
          <form action={logout}>
            <button type="submit"
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition">
              <LogOut size={16} />
            </button>
          </form>
        </div>
      </header>

      <div className="px-8 py-8 max-w-6xl mx-auto">
        <div className="mb-8">
          <p className="font-arabic text-primary-700 text-xl mb-1">بِسْمِ اللَّهِ</p>
          <h2 className="font-heading text-3xl font-bold text-navy">Dashboard Administrator</h2>
          <p className="text-gray-500 mt-1 text-sm">Kelola seluruh data SMK Al-Munawwir IIBS</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          {[
            { icon: GraduationCap, label: "Total Siswa", value: studentCount, color: "text-emerald-600", bg: "bg-emerald-50", href: "/dashboard/admin/students" },
            { icon: UserCog, label: "Total Guru", value: teacherCount, color: "text-blue-600", bg: "bg-blue-50", href: "/dashboard/admin/teachers" },
            { icon: School, label: "Total Kelas", value: classCount, color: "text-primary-700", bg: "bg-primary-50", href: "/dashboard/admin/classes" },
            { icon: Users, label: "Total Akun", value: userCount, color: "text-purple-600", bg: "bg-purple-50", href: "/dashboard/admin/users" },
          ].map(({ icon: Icon, label, value, color, bg, href }) => (
            <Link key={label} href={href} className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                <Icon size={16} className={color} />
              </div>
              <p className="text-gray-400 text-xs mb-0.5">{label}</p>
              <p className={`font-heading font-bold text-2xl ${color}`}>{value}</p>
            </Link>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          {[
            { icon: ClipboardList, label: "Pendaftaran Menunggu", value: admissionCount, color: "text-amber-600", bg: "bg-amber-50", href: "/dashboard/admin/admissions" },
            { icon: ClipboardList, label: "Tahap Wawancara", value: admissionWawancara, color: "text-blue-600", bg: "bg-blue-50", href: "/dashboard/admin/admissions" },
            { icon: Mail, label: "Pesan Belum Dibaca", value: messageUnread, color: "text-red-500", bg: "bg-red-50", href: "/dashboard/admin/messages" },
          ].map(({ icon: Icon, label, value, color, bg, href }) => (
            <Link key={label} href={href} className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                <Icon size={16} className={color} />
              </div>
              <p className="text-gray-400 text-xs mb-0.5">{label}</p>
              <p className={`font-heading font-bold text-2xl ${color}`}>{value}</p>
            </Link>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { label: "Kelola Pendaftaran", href: "/dashboard/admin/admissions", color: "bg-amber-600" },
            { label: "Kelola Siswa", href: "/dashboard/admin/students", color: "bg-emerald-600" },
            { label: "Kelola Kelas", href: "/dashboard/admin/classes", color: "bg-primary-700" },
            { label: "Kelola Berita", href: "/dashboard/admin/news", color: "bg-blue-600" },
          ].map((a) => (
            <Link key={a.label} href={a.href}
              className={`${a.color} text-white rounded-xl px-4 py-3 text-sm font-semibold text-center hover:opacity-90 transition`}>
              {a.label}
            </Link>
          ))}
        </div>

        {/* Recent Admissions */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-heading font-semibold text-xl text-navy">Pendaftaran Terbaru</h3>
            <Link href="/dashboard/admin/admissions"
              className="text-sm text-primary-700 font-semibold hover:text-gold transition">
              Lihat Semua →
            </Link>
          </div>
          {recentAdmissions.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 text-gray-400 font-medium">Nama</th>
                    <th className="text-left py-3 text-gray-400 font-medium">Jurusan</th>
                    <th className="text-left py-3 text-gray-400 font-medium">Kontak</th>
                    <th className="text-right py-3 text-gray-400 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAdmissions.map((a) => (
                    <tr key={a.id} className="border-b border-gray-50 last:border-0">
                      <td className="py-3 font-medium text-navy">{a.fullName}</td>
                      <td className="py-3 text-gray-500 text-xs">{a.chosenMajor}</td>
                      <td className="py-3 text-gray-500 text-xs">{a.phone}</td>
                      <td className="py-3 text-right">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${statusColor[a.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {statusLabel[a.status] ?? a.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-400 text-sm text-center py-8">Belum ada pendaftaran masuk.</p>
          )}
        </div>
      </div>
    </div>
  );
}
