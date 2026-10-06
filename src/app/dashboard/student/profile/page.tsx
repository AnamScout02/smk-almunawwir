export const dynamic = "force-dynamic";

import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { ArrowLeft, Mail, IdCard, BookOpen, School, UserCircle, Hash } from "lucide-react";
import Link from "next/link";
import ChangePasswordForm from "@/components/shared/ChangePasswordForm";
import PerangkatAktif from "@/components/shared/PerangkatAktif";
import KunciAplikasi from "@/components/shared/KunciAplikasi";
import NotifikasiPerangkat from "@/components/shared/NotifikasiPerangkat";
import AvatarUpload from "@/components/shared/AvatarUpload";
import PageHeader from "@/components/admin/PageHeader";
import TombolKembali from "@/components/shared/TombolKembali";

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
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<UserCircle size={22} />}
        title="Profil Saya"
        description="Akun & pengaturan"
      />

      <div className="alat-aksi justify-end mb-5">
        <TombolKembali href={"/dashboard/student"} />
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Info profil */}
        <div className="panel p-6">
          <div className="flex items-center justify-between mb-6">
            <AvatarUpload currentAvatar={student?.user.avatar} name={session.name} />
            <span className="text-xs bg-primary-50 text-primary-700 font-semibold px-2.5 py-1 rounded-full border border-primary-100">Siswa</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
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
                <Hash size={16} className="text-gray-400 mt-0.5 shrink-0" />
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
        <div className="panel p-6">
          <h3 className="font-heading font-semibold text-primary-900 mb-4">Ganti Password</h3>
          <ChangePasswordForm />
        </div>

        <NotifikasiPerangkat />

        <PerangkatAktif />
        <KunciAplikasi />
      </div>
    </div>
  );
}
