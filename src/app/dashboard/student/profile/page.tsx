export const dynamic = "force-dynamic";

import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { ArrowLeft, Mail, IdCard, BookOpen, School } from "lucide-react";
import Link from "next/link";
import ChangePasswordForm from "@/components/shared/ChangePasswordForm";
import AvatarUpload from "@/components/shared/AvatarUpload";

export default async function StudentProfilePage() {
  const session = await verifyRole(["STUDENT"]);

  const student = await prisma.student.findFirst({
    where: { user: { email: session.email } },
    include: {
      user: { select: { name: true, email: true, avatar: true } },
      class: { select: { name: true, grade: true } },
      major: { select: { name: true, code: true } },
    },
  });

  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-primary-900 text-white px-6 md:px-8 py-5 flex items-center gap-4">
        <Link href="/dashboard/student"
          className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="font-heading text-xl font-bold">Profil Saya</h1>
          <p className="text-white/60 text-sm">Akun & pengaturan</p>
        </div>
      </header>

      <div className="px-6 md:px-8 py-8 max-w-2xl mx-auto space-y-6">
        {/* Info profil */}
        <div className="bg-white rounded-2xl border shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <AvatarUpload currentAvatar={student?.user.avatar} name={session.name} />
            <span className="text-xs bg-primary-100 text-primary-700 font-semibold px-2.5 py-1 rounded-full">Siswa</span>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div className="flex items-start gap-3">
              <Mail size={16} className="text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-gray-400 text-xs">Email</p>
                <p className="font-medium text-gray-800">{session.email}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <IdCard size={16} className="text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-gray-400 text-xs">NIS</p>
                <p className="font-medium text-gray-800 font-mono">{student?.nis ?? "—"}</p>
              </div>
            </div>
            {student?.nisn && (
              <div className="flex items-start gap-3">
                <IdCard size={16} className="text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-gray-400 text-xs">NISN</p>
                  <p className="font-medium text-gray-800 font-mono">{student.nisn}</p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-3">
              <BookOpen size={16} className="text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-gray-400 text-xs">Jurusan</p>
                <p className="font-medium text-gray-800">{student?.major?.name ?? "—"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <School size={16} className="text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-gray-400 text-xs">Kelas</p>
                <p className="font-medium text-gray-800">{student?.class?.name ?? "—"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Ganti password */}
        <div className="bg-white rounded-2xl border shadow-sm p-6">
          <h3 className="font-heading font-bold text-primary-900 mb-4">Ganti Password</h3>
          <ChangePasswordForm />
        </div>

        <div className="text-center">
          <Link href="/dashboard/student" className="text-sm text-primary-600 hover:text-primary-800 font-medium">
            ← Kembali ke Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
