import { NextResponse } from "next/server";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { jalankanPemeriksaan } from "@/lib/pemeriksa-data";

export const dynamic = "force-dynamic";

export async function GET() {
  await verifyTasAccess();
  const hasil = await jalankanPemeriksaan();
  return NextResponse.json(hasil);
}
