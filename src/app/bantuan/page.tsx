export const dynamic = "force-dynamic";

import { verifySession } from "@/lib/dal";
import PusatBantuan from "@/components/bantuan/PusatBantuan";

export const metadata = { title: "Pusat Bantuan" };

/** Pusat Bantuan untuk semua peran (di luar /dashboard supaya satu alamat dipakai bersama). */
export default async function Page() {
  await verifySession();
  return <main className="min-h-dvh bg-cream"><PusatBantuan /></main>;
}
