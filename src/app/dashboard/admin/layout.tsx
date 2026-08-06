import React from "react";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { getJabatanNames } from "@/lib/jabatan-guard";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import AdminSidebar from "@/components/admin/AdminSidebar";
import TasSidebar from "@/components/admin/TasSidebar";
import AdminTopBar from "@/components/admin/AdminTopBar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // verifyTasAccess juga meloloskan guru (role TEACHER) berjabatan "Tenaga Administrasi
  // Sekolah"/"Kepala Tenaga Administrasi Sekolah" — lihat tas-access-guard.ts.
  const session = await verifyTasAccess();

  const [settings] = await Promise.all([
    getSettings(["logo.emblem", "logo.full_white"]),
  ]);

  const logoEmblem = settings["logo.emblem"];
  const logoFullWhite = settings["logo.full_white"];

  if (session.role === "TAS" || session.role === "TEACHER") {
    const [pendingProfileEdits, jabatanNames] = await Promise.all([
      prisma.profileEditRequest.count({ where: { status: "PENDING" } }),
      getJabatanNames(session.email),
    ]);
    return (
      <div className="flex min-h-screen" style={{ backgroundColor: "#f0f2f7" }}>
        <TasSidebar logoEmblem={logoEmblem} logoFullWhite={logoFullWhite} pendingProfileEdits={pendingProfileEdits} jabatanNames={jabatanNames} isFullTas={session.role === "TAS"} />
        <main className="flex-1 min-w-0 min-h-screen lg:pt-0 pt-14">
          <AdminTopBar pendingProfileEdits={pendingProfileEdits} />
          {children}
        </main>
      </div>
    );
  }

  // Role ADMIN: load badge counts and show full AdminSidebar
  const [unreadMessages, pendingAdmissions, pendingProfileEdits] = await Promise.all([
    prisma.contactMessage.count({ where: { isRead: false } }),
    prisma.admission.count({ where: { status: "PENDING" } }),
    prisma.profileEditRequest.count({ where: { status: "PENDING" } }),
  ]);

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: "#f0f2f7" }}>
      <AdminSidebar
        unreadMessages={unreadMessages}
        pendingAdmissions={pendingAdmissions}
        pendingProfileEdits={pendingProfileEdits}
        logoEmblem={logoEmblem}
        logoFullWhite={logoFullWhite}
      />
      <main className="flex-1 min-w-0 min-h-screen">
        {children}
      </main>
    </div>
  );
}
