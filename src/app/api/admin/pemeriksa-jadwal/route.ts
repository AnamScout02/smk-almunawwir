import { NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { jalankanPemeriksaanJadwal } from "@/lib/pemeriksa-jadwal";

export const dynamic = "force-dynamic";

export async function GET() {
  await verifyRole(["ADMIN", "TAS"]);
  return NextResponse.json(await jalankanPemeriksaanJadwal());
}
