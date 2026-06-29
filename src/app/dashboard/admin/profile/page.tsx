export const dynamic = "force-dynamic";

import { verifyRole } from "@/lib/dal";
import { UserCircle, Mail, ShieldCheck } from "lucide-react";
import ChangePasswordForm from "@/components/shared/ChangePasswordForm";

export default async function AdminProfilePage() {
  const session = await verifyRole(["ADMIN"]);

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-primary-900">Profil Admin</h1>
        <p className="text-gray-400 text-sm mt-0.5">Informasi akun administrator</p>
      </div>

      {/* Info profil */}
      <div className="bg-white rounded-2xl border shadow-sm p-6 mb-6">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center shrink-0">
            <UserCircle size={36} className="text-primary-700" />
          </div>
          <div>
            <h2 className="font-heading text-xl font-bold text-primary-900">{session.name}</h2>
            <span className="text-xs bg-gold/20 text-amber-700 font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1 w-fit mt-1">
              <ShieldCheck size={11} /> Administrator
            </span>
          </div>
        </div>

        <div className="flex items-start gap-3 text-sm">
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
