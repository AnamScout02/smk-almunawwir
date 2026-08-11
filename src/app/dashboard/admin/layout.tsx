import React from "react";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { getJabatanNames } from "@/lib/jabatan-guard";
import { verifyAdminLayoutAccess, isFullTasJabatan } from "@/lib/tas-access-guard";
import { getOverdueLoanCount } from "@/lib/perpustakaan-notif";
import { getImpersonatorSession } from "@/lib/session";
import AdminSidebar from "@/components/admin/AdminSidebar";
import TasSidebar from "@/components/admin/TasSidebar";
import AdminTopBar from "@/components/admin/AdminTopBar";
import ImpersonationBanner from "@/components/shared/ImpersonationBanner";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // verifyAdminLayoutAccess: ADMIN & SEMUA staf TAS boleh masuk layout (menu discoped via
  // TasSidebar jabatanNames), guru (TEACHER) cuma kalau merangkap jabatan TU — lihat
  // tas-access-guard.ts. BEDA dgn verifyTasAccess() yg dipakai modul/endpoint TU spesifik.
  const session = await verifyAdminLayoutAccess();
  const impersonator = await getImpersonatorSession();

  const [settings] = await Promise.all([
    getSettings(["logo.emblem", "logo.full_white"]),
  ]);

  const logoEmblem = settings["logo.emblem"];
  const logoFullWhite = settings["logo.full_white"];

  if (session.role === "TAS" || session.role === "TEACHER") {
    const [pendingProfileEdits, jabatanNames, overdueBooks] = await Promise.all([
      prisma.profileEditRequest.count({ where: { status: "PENDING" } }),
      getJabatanNames(session.email),
      getOverdueLoanCount(session.userId),
    ]);
    return (
      <div style={{ backgroundColor: "#f0f2f7" }}>
        {impersonator && <ImpersonationBanner adminName={impersonator.name} />}
        <div className="flex min-h-screen">
          <TasSidebar logoEmblem={logoEmblem} logoFullWhite={logoFullWhite} pendingProfileEdits={pendingProfileEdits} overdueBooks={overdueBooks} jabatanNames={jabatanNames} isFullTas={isFullTasJabatan(jabatanNames)} />
          <main className="flex-1 min-w-0 min-h-screen lg:pt-0 pt-14">
            <AdminTopBar pendingProfileEdits={pendingProfileEdits} overdueBooks={overdueBooks} />
            {children}
          </main>
        </div>
      </div>
    );
  }

  // Role ADMIN: load badge counts and show full AdminSidebar
  const [unreadMessages, pendingAdmissions, pendingProfileEdits, overdueBooks] = await Promise.all([
    prisma.contactMessage.count({ where: { isRead: false } }),
    prisma.admission.count({ where: { status: "PENDING" } }),
    prisma.profileEditRequest.count({ where: { status: "PENDING" } }),
    getOverdueLoanCount(session.userId),
  ]);

  return (
    <div style={{ backgroundColor: "#f0f2f7" }}>
      {impersonator && <ImpersonationBanner adminName={impersonator.name} />}
      <div className="flex min-h-screen">
        <AdminSidebar
          unreadMessages={unreadMessages}
          pendingAdmissions={pendingAdmissions}
          pendingProfileEdits={pendingProfileEdits}
          overdueBooks={overdueBooks}
          logoEmblem={logoEmblem}
          logoFullWhite={logoFullWhite}
        />
        <main className="flex-1 min-w-0 min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
}
