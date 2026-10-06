export const dynamic = "force-dynamic";

import { verifyBendaharaLayoutAccess } from "@/lib/bendahara-guard";
import PageHeader from "@/components/admin/PageHeader";
import ChangePasswordForm from "@/components/shared/ChangePasswordForm";
import PerangkatAktif from "@/components/shared/PerangkatAktif";
import KunciAplikasi from "@/components/shared/KunciAplikasi";
import KelolaPasskey from "@/components/shared/KelolaPasskey";
import NotifikasiPerangkat from "@/components/shared/NotifikasiPerangkat";
import { UserCircle } from "lucide-react";

export const metadata = { title: "Profil Saya — Portal Bendahara" };

export default async function BendaharaProfilePage() {
  const session = await verifyBendaharaLayoutAccess();

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<UserCircle size={22} />} title="Profil Saya" description="Data akun & ganti password" />

      <div className="panel p-6 max-w-lg">
        <h3 className="font-heading font-semibold text-navy mb-1">{session.name}</h3>
        <p className="text-sm text-gray-400 mb-6">{session.email}</p>
        <ChangePasswordForm />
      </div>

      <div className="mt-6 max-w-lg"><NotifikasiPerangkat /></div>
      <div className="mt-6 max-w-lg"><PerangkatAktif /></div>
      <div className="mt-6 max-w-lg"><KelolaPasskey /></div>
      <div className="mt-6 max-w-lg"><KunciAplikasi /></div>
    </div>
  );
}
