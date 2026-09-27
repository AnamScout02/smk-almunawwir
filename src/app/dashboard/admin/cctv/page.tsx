import { redirect } from "next/navigation";

/** Modul ini sudah dilebur ke halaman **Jaringan & Layar** (27 September 2026). Alamat lamanya tetap
 * bekerja supaya tautan, penanda peramban, dan catatan petugas tidak mati — cukup dialihkan ke tabnya. */
export const dynamic = "force-dynamic";

export default function Page() {
  redirect("/dashboard/admin/jaringan?bagian=perangkat");
}
