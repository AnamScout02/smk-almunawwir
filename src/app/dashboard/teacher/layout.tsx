import { verifyRole } from "@/lib/dal";
import { getSettings } from "@/lib/site-settings";
import TeacherSidebar from "@/components/teacher/TeacherSidebar";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  await verifyRole(["TEACHER", "ADMIN"]);
  const s = await getSettings(["logo.emblem", "logo.full_white"]);
  return (
    <div className="flex min-h-screen" style={{ backgroundColor: "#f0f2f7" }}>
      <TeacherSidebar logoEmblem={s["logo.emblem"]} logoFullWhite={s["logo.full_white"]} />
      <main className="flex-1 min-w-0 lg:ml-56 pt-14 lg:pt-0 min-h-screen">
        {children}
      </main>
    </div>
  );
}
