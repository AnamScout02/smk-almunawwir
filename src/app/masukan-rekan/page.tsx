import { redirect } from "next/navigation";
import { verifySession } from "@/lib/dal";

export const dynamic = "force-dynamic";

/** Pintu dari tautan notifikasi — mengalihkan ke rute portal penggunanya (pola CLAUDE.md #58). */
export default async function Page() {
  const s = await verifySession().catch(() => null);
  if (!s) redirect("/login");
  redirect(s.role === "TEACHER" ? "/dashboard/teacher/masukan-rekan" : "/dashboard/admin/masukan-rekan");
}
