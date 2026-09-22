import { redirect } from "next/navigation";
import { verifySession } from "@/lib/dal";

export const dynamic = "force-dynamic";

/** Pintu tautan notifikasi survei → halaman survei di portal pengguna. */
export default async function Page() {
  const s = await verifySession();
  const tujuan: Record<string, string> = {
    STUDENT: "/dashboard/student/survei", PARENT: "/dashboard/parent/survei", TEACHER: "/dashboard/teacher/survei",
    TAS: "/dashboard/admin/survei-saya", ADMIN: "/dashboard/admin/survei",
  };
  redirect(tujuan[s.role] ?? "/login");
}
