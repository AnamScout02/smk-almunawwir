import { verifyRole } from "@/lib/dal";
import { antreanPortal } from "@/lib/antrean-portal";
import { getSettings } from "@/lib/site-settings";
import { getImpersonatorSession } from "@/lib/session";
import { getParentChildrenOrRedirect } from "@/lib/parent-guard";
import ParentSidebar from "@/components/parent/ParentSidebar";
import PusatNotifikasiPortal from "@/components/shared/PusatNotifikasiPortal";
import ParentChildSwitcher from "@/components/parent/ParentChildSwitcher";
import ImpersonationBanner from "@/components/shared/ImpersonationBanner";
import { jumlahBelumKonfirmasi } from "@/lib/pengumuman";
import { jumlahSurveiBelumDiisi } from "@/lib/survei";

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const session = await verifyRole(["PARENT"]);
  const impersonator = await getImpersonatorSession();
  const [s, childStudents, belumBaca, belumSurvei] = await Promise.all([
    getSettings(["logo.emblem", "logo.full_white"]),
    getParentChildrenOrRedirect(session),
    jumlahBelumKonfirmasi(session).catch(() => 0),
    jumlahSurveiBelumDiisi(session),
  ]);
  // Satu sumber antrean "Perlu tindakan" (src/lib/antrean-portal.ts) — dipakai lencana notifikasi
  // DAN halaman Pusat Notifikasi supaya isinya tidak pernah berbeda.
  const tindakan = await antreanPortal(session);

  const childOptions = childStudents.map(c => ({
    id: c.id,
    name: c.user.name,
    className: c.class?.name ?? "—",
  }));

  return (
    <div className="dashboard-shell">
      {impersonator && <ImpersonationBanner adminName={impersonator.name} />}
      <div className="flex min-h-dvh">
        <ParentSidebar logoEmblem={s["logo.emblem"]} logoFullWhite={s["logo.full_white"]} impersonating={!!impersonator} tindakan={tindakan} />
        <main className="flex-1 min-w-0 pt-14 lg:pt-0 pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-24 print:pt-0 print:pb-0 min-h-dvh">
          <ParentChildSwitcher childOptions={childOptions} />
          <PusatNotifikasiPortal tindakan={tindakan} />
          {children}
        </main>
      </div>
    </div>
  );
}
