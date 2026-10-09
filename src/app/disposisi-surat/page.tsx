import { redirect } from "next/navigation";
import { verifySession } from "@/lib/dal";

export const dynamic = "force-dynamic";

/** Pintu tautan notifikasi disposisi → halaman Disposisi Surat di portal masing-masing (guru tidak bisa membuka portal admin). */
export default async function Page() {
  const s = await verifySession();
  redirect(s.role === "TEACHER" ? "/dashboard/teacher/disposisi-surat" : s.role === "ADMIN" || s.role === "TAS" ? "/dashboard/admin/disposisi-surat" : "/login");
}
