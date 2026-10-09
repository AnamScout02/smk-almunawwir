import { redirect } from "next/navigation";
import { verifyRole } from "@/lib/dal";
import { aksesPusatPkl } from "@/lib/pkl-humas";

export const dynamic = "force-dynamic";

/** PINTU tautan notifikasi laporan PKL: Humas ke Pusat PKL, guru pembimbing ke portal guru (CLAUDE.md #45, #58). */
export default async function Page() {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  redirect((await aksesPusatPkl(session)) ? "/pusat-pkl/masalah" : "/dashboard/teacher/pkl/masalah");
}
