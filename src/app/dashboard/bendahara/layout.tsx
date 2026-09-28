import { verifyBendaharaLayoutAccess } from "@/lib/bendahara-guard";
import { getSettings } from "@/lib/site-settings";
import BendaharaSidebar from "@/components/bendahara/BendaharaSidebar";
import PusatNotifikasiPortal from "@/components/shared/PusatNotifikasiPortal";

export default async function BendaharaLayout({ children }: { children: React.ReactNode }) {
  await verifyBendaharaLayoutAccess();
  const s = await getSettings(["logo.emblem"]);

  return (
    <div className="dashboard-shell">
      <div className="flex min-h-dvh">
        <BendaharaSidebar logoEmblem={s["logo.emblem"]} />
        <main className="flex-1 min-w-0 pt-14 lg:pt-0 pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-24 print:pt-0 print:pb-0 min-h-dvh">
          <PusatNotifikasiPortal />
          {children}
        </main>
      </div>
    </div>
  );
}
