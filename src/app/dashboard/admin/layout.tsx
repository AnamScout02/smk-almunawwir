import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import AdminSidebar from "@/components/admin/AdminSidebar";
import TasSidebar from "@/components/admin/TasSidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await verifyRole(["ADMIN", "TAS"]);

  const [settings] = await Promise.all([
    getSettings(["logo.emblem"]),
  ]);

  const logoEmblem = settings["logo.emblem"];

  if (session.role === "TAS") {
    return (
      <div className="min-h-screen bg-gray-50 flex">
        <TasSidebar logoEmblem={logoEmblem} />
        <main className="flex-1 overflow-auto lg:pt-0 pt-14">
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
    <div className="min-h-screen bg-gray-50 flex">
      <AdminSidebar
        unreadMessages={unreadMessages}
        pendingAdmissions={pendingAdmissions}
        logoEmblem={logoEmblem}
      />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
