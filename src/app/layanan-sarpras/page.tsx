import { redirect } from "next/navigation";
import { verifySession } from "@/lib/dal";

export const dynamic = "force-dynamic";

/** Pintu tautan notifikasi Layanan Sarpras → halaman di portal pengguna. */
export default async function Page() {
  const s = await verifySession();
  redirect(s.role === "TEACHER" ? "/dashboard/teacher/layanan-sarpras" : s.role === "ADMIN" || s.role === "TAS" ? "/dashboard/admin/layanan-sarpras" : "/login");
}
