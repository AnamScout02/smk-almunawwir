import { verifyRole } from "@/lib/dal";
import { getSettings } from "@/lib/site-settings";
import { prisma } from "@/lib/prisma";
import { getOverdueLoanCount } from "@/lib/perpustakaan-notif";
import StudentSidebar from "@/components/student/StudentSidebar";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await verifyRole(["STUDENT"]);
  const [s, pendingEdit, kelasAdminOf, overdueBooks] = await Promise.all([
    getSettings(["logo.emblem", "logo.full_white"]),
    prisma.profileEditRequest.findFirst({
      where: { status: "PENDING", student: { user: { email: session.email } } },
      select: { id: true },
    }),
    prisma.student.findFirst({
      where: { user: { email: session.email } },
      select: { ketuaKelasOf: { select: { id: true } }, sekretarisOf: { select: { id: true } } },
    }),
    getOverdueLoanCount(session.userId),
  ]);
  const isKelasAdmin = !!(kelasAdminOf && (kelasAdminOf.ketuaKelasOf.length > 0 || kelasAdminOf.sekretarisOf.length > 0));
  return (
    <div className="flex min-h-screen" style={{ backgroundColor: "#f0f2f7" }}>
      <StudentSidebar logoEmblem={s["logo.emblem"]} logoFullWhite={s["logo.full_white"]} hasPendingBiodata={!!pendingEdit} isKelasAdmin={isKelasAdmin} overdueBooks={overdueBooks} />
      <main className="flex-1 min-w-0 lg:ml-56 pt-14 lg:pt-0 min-h-screen">
        {children}
      </main>
    </div>
  );
}
