import { verifyRole } from "@/lib/dal";
import { antreanPortal } from "@/lib/antrean-portal";
import { getSettings } from "@/lib/site-settings";
import { prisma } from "@/lib/prisma";
import { getOverdueLoanCount } from "@/lib/perpustakaan-notif";
import { getImpersonatorSession } from "@/lib/session";
import StudentSidebar from "@/components/student/StudentSidebar";
import PusatNotifikasiPortal from "@/components/shared/PusatNotifikasiPortal";
import ImpersonationBanner from "@/components/shared/ImpersonationBanner";
import { jumlahBelumKonfirmasi } from "@/lib/pengumuman";
import { jumlahSurveiBelumDiisi } from "@/lib/survei";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await verifyRole(["STUDENT"]);
  const impersonator = await getImpersonatorSession();
  const [s, pendingEdit, kelasAdminOf, overdueBooks, belumBaca, belumSurvei] = await Promise.all([
    getSettings(["logo.emblem", "logo.full_white"]),
    prisma.profileEditRequest.findFirst({
      where: { status: "PENDING", student: { user: { email: session.email } } },
      select: { id: true },
    }),
    prisma.student.findFirst({
      where: { user: { email: session.email } },
      select: { ketuaKelasOf: { select: { id: true } }, sekretarisOf: { select: { id: true } }, class: { select: { grade: true } } },
    }),
    getOverdueLoanCount(session.userId),
    jumlahBelumKonfirmasi(session).catch(() => 0),
    jumlahSurveiBelumDiisi(session),
  ]);
  // Satu sumber antrean "Perlu tindakan" (src/lib/antrean-portal.ts) — dipakai lencana notifikasi
  // DAN halaman Pusat Notifikasi supaya isinya tidak pernah berbeda.
  const tindakan = await antreanPortal(session);
  const isKelasAdmin = !!(kelasAdminOf && (kelasAdminOf.ketuaKelasOf.length > 0 || kelasAdminOf.sekretarisOf.length > 0));
  return (
    <div className="dashboard-shell">
      {impersonator && <ImpersonationBanner adminName={impersonator.name} />}
      <div className="flex min-h-dvh">
        <StudentSidebar logoEmblem={s["logo.emblem"]} logoFullWhite={s["logo.full_white"]} hasPendingBiodata={!!pendingEdit} isKelasAdmin={isKelasAdmin} overdueBooks={overdueBooks} impersonating={!!impersonator} tindakan={tindakan} kelasXII={kelasAdminOf?.class?.grade === 12} />
        {/* pb-[...]: ruang utk bottom nav bar mobile (fixed, MobileBottomNav di StudentSidebar) —
            pakai calc(4rem + safe-area-inset-bottom), BUKAN pb-16 polos, supaya di device
            ber-notch/home-indicator (iPhone dll) konten paling bawah tidak ketutup strip aman nav
            yang jadi lebih tinggi dari 64px di situ (temuan responsif 2026-08-23). */}
        <main className="flex-1 min-w-0 pt-14 lg:pt-0 pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-24 print:pt-0 print:pb-0 min-h-dvh">
          <PusatNotifikasiPortal tindakan={tindakan} />
          {children}
        </main>
      </div>
    </div>
  );
}
