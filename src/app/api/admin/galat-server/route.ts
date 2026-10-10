import { NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

/** Menghapus catatan galat (satu `id`, atau semuanya bila tanpa id) — khusus Superadmin. Galat yang terjadi lagi tercatat ulang. */
export async function DELETE(req: Request) {
  await verifyRole(["ADMIN"]);
  const id = new URL(req.url).searchParams.get("id");
  const r = await prisma.galatServer.deleteMany({ where: id ? { id } : {} });
  return NextResponse.json({ ok: true, dihapus: r.count });
}
