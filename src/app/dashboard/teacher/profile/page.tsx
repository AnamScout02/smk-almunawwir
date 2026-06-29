export const dynamic = "force-dynamic";

import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { UserCircle, Mail, BookOpen, IdCard, Phone } from "lucide-react";
import ChangePasswordForm from "@/components/shared/ChangePasswordForm";

export default async function TeacherProfilePage() {
  const session = await verifyRole(["TEACHER", "ADMIN"]);

  const teacher = await prisma.teacher.findFirst({
    where: { user: { email: session.email } },
    include: {
      user: { select: { name: true, email: true, role: true } },
      homeroomOf: { select: { name: true, grade: true } },
    },
  });

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-primary-900">Profil Saya</h1>
        <p className="text-gray-400 text-sm mt-0.5">Informasi akun dan data guru</p>
      </div>

      {/* Info profil */}
      <div className="bg-white rounded-2xl border shadow-sm p-6 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center shrink-0">
            <UserCircle size={36} className="text-primary-700" />
          </div>
          <div>
            <h2 className="font-heading text-xl font-bold text-primary-900">{session.name}</h2>
            <span className="text-xs bg-primary-100 text-primary-700 font-semibold px-2.5 py-0.5 rounded-full">Guru</span>
          </div>
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
              <p className="text-gray-400 text-xs">NIP</p>
              <p className="font-medium text-gray-800 font-mono">{teacher?.nip ?? "—"}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <BookOpen size={16} className="text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-gray-400 text-xs">Mata Pelajaran</p>
              <p className="font-medium text-gray-800">{teacher?.subject ?? "—"}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Phone size={16} className="text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-gray-400 text-xs">Nomor HP</p>
              <p className="font-medium text-gray-800">{teacher?.phone ?? "—"}</p>
            </div>
          </div>
        </div>

        {teacher?.homeroomOf.length ? (
          <div className="border-t mt-4 pt-4">
            <p className="text-xs text-gray-400 mb-2">Wali Kelas</p>
            <div className="flex flex-wrap gap-2">
              {teacher.homeroomOf.map(cls => (
                <span key={cls.name} className="bg-primary-50 text-primary-700 text-xs font-semibold px-3 py-1.5 rounded-xl">
                  Kelas {cls.name}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Ganti password */}
      <div className="bg-white rounded-2xl border shadow-sm p-6">
        <h3 className="font-heading font-bold text-primary-900 mb-4">Ganti Password</h3>
        <ChangePasswordForm />
      </div>
    </div>
  );
}
