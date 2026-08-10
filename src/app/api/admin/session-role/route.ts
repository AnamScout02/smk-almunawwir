import { NextResponse } from "next/server";
import { verifyTasAccess } from "@/lib/tas-access-guard";

/** Info role sesi saat ini — dipakai halaman Akun Pengguna (client component) buat menampilkan
 * tombol "Masuk sebagai" cuma utk ADMIN sungguhan (TAS/guru-TU juga bisa buka halaman ini via
 * verifyTasAccess, tapi impersonasi dibatasi lebih ketat — lihat impersonate/route.ts). */
export async function GET() {
  const session = await verifyTasAccess();
  return NextResponse.json({ role: session.role });
}
