import { redirect } from "next/navigation";
import { verifySession } from "@/lib/dal";

export const dynamic = "force-dynamic";

/** Pintu tunggal tautan notifikasi pengumuman → kotak pengumuman di portal masing-masing. */
export default async function Page() {
  const s = await verifySession();
  const tujuan: Record<string, string> = {
    STUDENT: "/dashboard/student/pengumuman", PARENT: "/dashboard/parent/pengumuman",
    TEACHER: "/dashboard/teacher/pengumuman", TAS: "/dashboard/admin/pengumuman", ADMIN: "/dashboard/admin/pengumuman",
  };
  redirect(tujuan[s.role] ?? "/login");
}
