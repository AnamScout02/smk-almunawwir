import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { assertPerpustakaan } from "@/lib/perpustakaan-guard";

export const dynamic = "force-dynamic";

/** Catat kunjungan fisik ke perpustakaan — dipakai petugas scan kartu siswa/guru/pegawai saat
 * mereka datang (terpisah dari peminjaman, siswa boleh berkunjung tanpa pinjam buku). */
export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertPerpustakaan(session);

    const { userId } = await req.json();
    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "userId wajib diisi" }, { status: 400 });
    }
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } });
    if (!user) return NextResponse.json({ error: "Pengguna tidak ditemukan" }, { status: 404 });

    await prisma.libraryVisit.create({ data: { userId } });
    return NextResponse.json({ success: true, name: user.name });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Koordinator/Tim Perpustakaan." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
