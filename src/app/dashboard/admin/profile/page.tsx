export const dynamic = "force-dynamic";

import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { Mail, ShieldCheck } from "lucide-react";
import ChangePasswordForm from "@/components/shared/ChangePasswordForm";
import AvatarUpload from "@/components/shared/AvatarUpload";

export default async function AdminProfilePage() {
  const session = await verifyRole(["ADMIN", "TAS"]);
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { avatar: true },
  });

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-primary-900">Profil Admin</h1>
        <p className="text-gray-400 text-sm mt-0.5">Informasi akun administrator</p>
      </div>

      {/* Info profil */}
      <div className="bg-white rounded-2xl border shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-5">
          <AvatarUpload currentAvatar={user?.avatar} name={session.name} />
          <span className="text-xs bg-gold/20 text-amber-700 font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
            <ShieldCheck size={11} /> Administrator
          </span>
        </div>
        <div className="flex items-start gap-3 text-sm pt-4 border-t border-gray-100">
          <Mail size={16} className="text-gray-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-gray-400 text-xs">Email</p>
            <p className="font-medium text-gray-800">{session.email}</p>
          </div>
        </div>
      </div>

      {/* Ganti password */}
      <div className="bg-white rounded-2xl border shadow-sm p-6">
        <h3 className="font-heading font-bold text-primary-900 mb-4">Ganti Password</h3>
        <ChangePasswordForm />
      </div>
    </div>
  );
}
