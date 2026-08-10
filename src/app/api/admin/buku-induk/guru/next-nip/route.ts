import { NextResponse } from "next/server";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** NIP asli (18 digit) belum ada satupun guru yang punya — semua masih placeholder "TMP-001",
 * "TMP-002", dst (dipakai sementara sampai NIP resmi terbit/didata). Endpoint ini cuma
 * melanjutkan nomor urut placeholder itu, sama pola dgn next-nis siswa. Kalau suatu saat NIP asli
 * mulai diisi, nomor itu otomatis diabaikan (tidak match pola TMP-nnn) — tidak mempengaruhi urutan. */
export async function GET() {
  await verifyTasAccess();

  const teachers = await prisma.teacher.findMany({ where: { nip: { startsWith: "TMP-" } }, select: { nip: true } });
  let max = 0;
  for (const t of teachers) {
    const m = t.nip.match(/^TMP-(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const nip = `TMP-${String(max + 1).padStart(3, "0")}`;
  return NextResponse.json({ nip });
}
