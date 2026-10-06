export const dynamic = "force-dynamic";

import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { Mail, ShieldCheck, UserCircle } from "lucide-react";
import ChangePasswordForm from "@/components/shared/ChangePasswordForm";
import PerangkatAktif from "@/components/shared/PerangkatAktif";
import KunciAplikasi from "@/components/shared/KunciAplikasi";
import KelolaPasskey from "@/components/shared/KelolaPasskey";
import TandaTanganSaya from "@/components/shared/TandaTanganSaya";
import NotifikasiPerangkat from "@/components/shared/NotifikasiPerangkat";
import AvatarUpload from "@/components/shared/AvatarUpload";
import PageHeader from "@/components/admin/PageHeader";
import TwoFactorSetup from "@/components/admin/TwoFactorSetup";

export default async function AdminProfilePage() {
  const session = await verifyRole(["ADMIN", "TAS"]);
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { avatar: true, totpEnabled: true },
  });

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<UserCircle size={22} />}
        title="Profil Admin"
        description="Informasi akun administrator"
      />

      {/* Info profil */}
      <div className="panel overflow-hidden mb-6">
        <div className="px-6 py-4 flex items-center justify-between"
          style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.04) 0%, rgba(27,43,107,0.02) 100%)", borderBottom: "1px solid rgba(15,26,69,0.06)" }}>
          <h3 className="font-heading font-semibold text-primary-900 text-sm">Informasi Akun</h3>
          <span className="text-xs bg-gold/20 text-amber-700 font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 border border-gold/30">
            <ShieldCheck size={11} /> Administrator
          </span>
        </div>
        <div className="p-6">
          <div className="mb-5">
            <AvatarUpload currentAvatar={user?.avatar} name={session.name} />
          </div>
          <div className="flex items-start gap-3 text-sm pt-4 border-t border-gray-100">
            <Mail size={16} className="text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-gray-400 text-xs">Email</p>
              <p className="font-medium text-gray-800">{session.email}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Ganti password */}
      <div className="panel overflow-hidden mb-6">
        <div className="px-6 py-4"
          style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.04) 0%, rgba(27,43,107,0.02) 100%)", borderBottom: "1px solid rgba(15,26,69,0.06)" }}>
          <h3 className="font-heading font-semibold text-primary-900 text-sm">Ganti Password</h3>
        </div>
        <div className="p-6">
          <ChangePasswordForm />
        </div>
      </div>

      <div className="mt-6"><NotifikasiPerangkat /></div>
      <div className="mt-6"><PerangkatAktif /></div>
      <div className="mt-6"><TandaTanganSaya /></div>
      <div className="mt-6"><KelolaPasskey /></div>
      <div className="mt-6"><KunciAplikasi /></div>

      {/* 2FA — KHUSUS role ADMIN (superadmin), bukan TAS. Impersonasi (fitur paling sensitif di
          sistem ini) cuma bisa dipakai ADMIN, jadi lapis tambahan ini juga dibatasi situ saja —
          lihat komentar di src/lib/totp.ts. */}
      {session.role === "ADMIN" && <TwoFactorSetup initialEnabled={!!user?.totpEnabled} />}
    </div>
  );
}
