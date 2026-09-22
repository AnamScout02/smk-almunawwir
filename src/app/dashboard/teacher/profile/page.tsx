export const dynamic = "force-dynamic";

import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { Mail, BookOpen, IdCard, Phone, UserCircle, Award } from "lucide-react";
import ChangePasswordForm from "@/components/shared/ChangePasswordForm";
import PerangkatAktif from "@/components/shared/PerangkatAktif";
import NotifikasiPerangkat from "@/components/shared/NotifikasiPerangkat";
import AvatarUpload from "@/components/shared/AvatarUpload";
import PageHeader from "@/components/admin/PageHeader";

export default async function TeacherProfilePage() {
  const session = await verifyRole(["TEACHER", "ADMIN"]);

  const teacher = await prisma.teacher.findFirst({
    where: { user: { email: session.email } },
    include: {
      user: { select: { name: true, email: true, role: true, avatar: true } },
      homeroomOf: { select: { name: true, grade: true } },
      jabatan: { select: { jabatan: { select: { id: true, name: true } } } },
      _count: { select: { internshipsSupervised: true } },
      teachingLoad: { include: { subject: { select: { name: true } } }, distinct: ["subjectId"] },
    },
  });

  const mataPelajaran = teacher?.teachingLoad.length
    ? teacher.teachingLoad.map(t => t.subject.name).join(", ")
    : (teacher?.subject && teacher.subject !== "—" ? teacher.subject : "Belum ada penugasan mengajar");

  const jabatanBadges = [
    ...teacher?.jabatan.map(j => j.jabatan.name) ?? [],
    ...(teacher?.homeroomOf.map(c => `Wali Kelas ${c.name}`) ?? []),
    ...((teacher?._count.internshipsSupervised ?? 0) > 0 ? [`Pembimbing PKL (${teacher?._count.internshipsSupervised} siswa)`] : []),
  ];

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<UserCircle size={22} />} title="Profil Saya" description="Informasi akun dan data guru" />

      <div className="max-w-2xl">
      {/* Info profil */}
      <div className="panel p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <AvatarUpload currentAvatar={teacher?.user.avatar} name={session.name} />
          <span className="text-xs bg-primary-50 text-primary-700 font-semibold px-2.5 py-1 rounded-full border border-primary-100">Guru</span>
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
              <p className="text-gray-400 text-xs">NIP</p>
              <p className="font-medium text-gray-800 font-mono">{teacher?.nip ?? "—"}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <BookOpen size={16} className="text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-gray-400 text-xs">Mata Pelajaran</p>
              <p className="font-medium text-gray-800">{mataPelajaran}</p>
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

        {jabatanBadges.length > 0 && (
          <div className="border-t mt-4 pt-4">
            <p className="text-xs text-gray-400 mb-2 flex items-center gap-1.5"><Award size={12} /> Jabatan Saya</p>
            <div className="flex flex-wrap gap-2">
              {jabatanBadges.map(label => (
                <span key={label} className="bg-primary-50 text-primary-700 border border-primary-100 text-xs font-semibold px-3 py-1.5 rounded-xl">
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Ganti password */}
      <div className="panel p-6">
        <h3 className="font-heading font-bold text-primary-900 mb-4">Ganti Password</h3>
        <ChangePasswordForm />
      </div>

      <NotifikasiPerangkat />

      <PerangkatAktif />
      </div>
    </div>
  );
}
