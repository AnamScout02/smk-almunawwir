import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Loader2 } from "lucide-react";
import { verifyRole } from "@/lib/dal";
import { aksesSarpras } from "@/lib/sarpras-akses";
import { bolehJaringan } from "@/lib/jaringan-guard";
import { bolehCctv } from "@/lib/cctv-guard";
import PusatJaringanManager from "@/components/shared/PusatJaringanManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Jaringan & Layar" };

/** JARINGAN & LAYAR — gabungan Papan & TV, Perangkat Jaringan, Jaringan Sekolah, dan Mode Ujian Jaringan
 * (27 September 2026, permintaan user). Hak aksesnya dihitung di SERVER supaya tab yang tidak berhak tidak
 * pernah sampai ke browser; tiap API di belakangnya tetap memeriksa haknya masing-masing. */
export default async function Page() {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  const [akses, jaringan, cctv] = await Promise.all([aksesSarpras(session), bolehJaringan(session), bolehCctv(session)]);
    /* `aksesSarpras().masuk` bernilai true untuk SETIAP guru & staf — itu gerbang "boleh melapor kerusakan",
     bukan "boleh mengelola". Yang menentukan tab Layar & Perangkat adalah `kelola` (Wakil Kepala Sarana
     Prasarana, Kepala Laboratorium, staf TU penuh, Administrator) — persis kalangan yang dulu melihat menu
     Papan & TV dan Perangkat Jaringan di sidebar. */
  if (!akses.kelola && !jaringan && !cctv) redirect("/dashboard/admin");
  return (
    <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center text-gray-400"><Loader2 size={24} className="animate-spin" /></div>}>
      <PusatJaringanManager sarpras={akses.kelola} jaringan={jaringan} cctv={cctv} basePath="/dashboard/admin" />
    </Suspense>
  );
}
