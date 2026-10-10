export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Denyut untuk pemantau server (scripts/pantau-situs.mjs di host): aplikasi hidup + database menjawab. Tanpa data apa pun. */
export async function GET() {
  const db = await prisma.$queryRaw`select 1`.then(() => true).catch(() => false);
  return NextResponse.json({ ok: db, db }, { status: db ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
