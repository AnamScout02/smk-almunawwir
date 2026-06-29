import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import AdminSidebar from "@/components/admin/AdminSidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await verifyRole(["ADMIN"]);

  const [[unreadMessages, pendingAdmissions], settings] = await Promise.all([
    Promise.all([
      prisma.contactMessage.count({ where: { isRead: false } }),
      prisma.admission.count({ where: { status: "PENDING" } }),
    ]),
    getSettings(["logo.emblem"]),
  ]);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <AdminSidebar
        unreadMessages={unreadMessages}
        pendingAdmissions={pendingAdmissions}
        logoEmblem={settings["logo.emblem"]}
      />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
