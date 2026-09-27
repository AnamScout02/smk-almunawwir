import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { ujianDalamCakupan, buatTokenUnik } from "@/lib/ujian-server";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** Ganti token ujian. Dipakai kalau token telanjur bocor ke luar ruang ujian - siswa yang SUDAH
 * masuk tidak terganggu (mereka sudah punya attempt), yang belum masuk butuh token baru. Token
 * sebelumnya masih diterima 2 menit (lihat route join) & hitungan token berjangka mulai ulang. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const { id } = await params;
    const exam = await ujianDalamCakupan(session, id);
    if (!exam) return Response.json({ error: "Ujian tidak ditemukan" }, { status: 404 });
    const token = await buatTokenUnik();
    await prisma.exam.update({ where: { id }, data: { token, tokenLama: exam.token, tokenDiperbarui: new Date() } });
    return Response.json({ ok: true, token });
  } catch (galat) {
    lemparBilaPengalihan(galat);
    return Response.json({ error: "Gagal mengganti token." }, { status: 500 });
  }
}
