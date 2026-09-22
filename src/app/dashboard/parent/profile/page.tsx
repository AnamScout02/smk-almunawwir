export const dynamic = "force-dynamic";

import { verifyRole } from "@/lib/dal";
import { getParentChildrenOrRedirect } from "@/lib/parent-guard";
import PageHeader from "@/components/admin/PageHeader";
import ChangePasswordForm from "@/components/shared/ChangePasswordForm";
import PerangkatAktif from "@/components/shared/PerangkatAktif";
import NotifikasiPerangkat from "@/components/shared/NotifikasiPerangkat";
import { UserCircle, Users } from "lucide-react";

export const metadata = { title: "Profil Saya — Portal Orang Tua" };

export default async function ParentProfilePage() {
  const session = await verifyRole(["PARENT"]);
  const children = await getParentChildrenOrRedirect(session);

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<UserCircle size={22} />} title="Profil Saya" description="Data akun & anak yang terhubung" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="panel p-6">
          <h3 className="font-heading font-semibold text-navy mb-1">{session.name}</h3>
          <p className="text-sm text-gray-400 mb-6">{session.email}</p>
          <ChangePasswordForm />
        </div>

        <NotifikasiPerangkat />

        <PerangkatAktif />

        <div className="panel overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-50">
            <Users size={16} className="text-primary-700" />
            <h3 className="font-heading font-semibold text-navy text-sm">Anak Terhubung</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {children.map(c => (
              <div key={c.id} className="px-5 py-3.5">
                <p className="text-sm font-semibold text-primary-900">{c.user.name}</p>
                <p className="text-xs text-gray-400">{c.class?.name ?? "—"} · {c.major.name} · NIS: {c.nis}</p>
              </div>
            ))}
          </div>
          <p className="px-5 py-3 text-xs text-gray-400 border-t border-gray-100">
            Kalau ada anak yang belum/salah terhubung, hubungi Tata Usaha (TU) sekolah.
          </p>
        </div>
      </div>
    </div>
  );
}
