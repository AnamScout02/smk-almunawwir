import { verifyRole } from "@/lib/dal";
import { getSettings } from "@/lib/site-settings";
import TeacherSidebar from "@/components/teacher/TeacherSidebar";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  await verifyRole(["TEACHER", "ADMIN"]);
  const s = await getSettings(["logo.emblem"]);
  return (
    <div className="flex min-h-screen bg-cream">
      <TeacherSidebar logoEmblem={s["logo.emblem"]} />
      <main className="flex-1 lg:ml-56 pt-14 lg:pt-0 overflow-auto">
        {children}
      </main>
    </div>
  );
}
