import { NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { kodeTaut, setelanTelegram } from "@/lib/telegram";

/** Keadaan Telegram akun sendiri (guru, staf, admin). `tautan` = alamat sekali pakai untuk menautkan, berlaku 15 menit. */
export async function GET() {
  const session = await verifyRole(["TEACHER", "TAS", "ADMIN"]);
  const [s, t] = await Promise.all([setelanTelegram(), prisma.tautanTelegram.findUnique({ where: { userId: session.userId }, select: { nama: true, aktif: true, createdAt: true } })]);
  return NextResponse.json({
    tersedia: !!s?.bot, bot: s?.bot ?? "", tertaut: t,
    tautan: s?.bot && !t ? `https://t.me/${s.bot}?start=${kodeTaut(session.userId)}` : null,
  });
}

export async function PUT(req: Request) {
  const session = await verifyRole(["TEACHER", "TAS", "ADMIN"]);
  const b = await req.json().catch(() => ({})) as { aktif?: boolean };
  await prisma.tautanTelegram.updateMany({ where: { userId: session.userId }, data: { aktif: b.aktif !== false } });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const session = await verifyRole(["TEACHER", "TAS", "ADMIN"]);
  await prisma.tautanTelegram.deleteMany({ where: { userId: session.userId } });
  return NextResponse.json({ ok: true });
}
