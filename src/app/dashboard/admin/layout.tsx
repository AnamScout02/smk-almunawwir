import React from "react";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import AdminSidebar from "@/components/admin/AdminSidebar";
import TasSidebar from "@/components/admin/TasSidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await verifyRole(["ADMIN", "TAS"]);

  const [settings] = await Promise.all([
    getSettings(["logo.emblem", "logo.full_white"]),
  ]);

  const logoEmblem = settings["logo.emblem"];
  const logoFullWhite = settings["logo.full_white"];

  if (session.role === "TAS") {
    return (
      <div className="flex min-h-screen" style={{ backgroundColor: "#f0f2f7" }}>
        <TasSidebar logoEmblem={logoEmblem} logoFullWhite={logoFullWhite} />
        <main className="flex-1 min-w-0 min-h-screen lg:pt-0 pt-14">
          {children}
        </main>
      </div>
    );
  }

  // Role ADMIN: load badge counts and show full AdminSidebar
  const [unreadMessages, pendingAdmissions] = await Promise.all([
    prisma.contactMessage.count({ where: { isRead: false } }),
    prisma.admission.count({ where: { status: "PENDING" } }),
  ]);

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: "#f0f2f7" }}>
      <AdminSidebar
        unreadMessages={unreadMessages}
        pendingAdmissions={pendingAdmissions}
        logoEmblem={logoEmblem}
        logoFullWhite={logoFullWhite}
      />
      <main className="flex-1 min-w-0 min-h-screen">
        {children}
      </main>
    </div>
  );
}
