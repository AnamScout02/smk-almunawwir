import { redirect } from "next/navigation";
import { verifySession } from "@/lib/dal";

export const dynamic = "force-dynamic";

/** Pintu tunggal tautan notifikasi → kotak notifikasi di portal masing-masing, supaya halamannya
 * ikut layout portal (sidebar, bottom navbar, latar dashboard). Rute admin memakai nama
 * "kotak-notifikasi" karena /dashboard/admin/notifikasi sudah dipakai PENGATURAN notifikasi push. */
export default async function Page() {
  const s = await verifySession();
  const tujuan: Record<string, string> = {
    STUDENT: "/dashboard/student/notifikasi", PARENT: "/dashboard/parent/notifikasi",
    TEACHER: "/dashboard/teacher/notifikasi",
    TAS: "/dashboard/admin/kotak-notifikasi", ADMIN: "/dashboard/admin/kotak-notifikasi",
  };
  redirect(tujuan[s.role] ?? "/login");
}
