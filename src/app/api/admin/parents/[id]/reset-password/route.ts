import { verifyRole } from "@/lib/dal";
import { cabutSemuaSesiPengguna } from "@/lib/sesi-server";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { DEFAULT_PASSWORD } from "@/lib/constants";
import bcrypt from "bcryptjs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyRole(["ADMIN"]);
  const { id } = await params;

  const parent = await prisma.parent.findUnique({ where: { id }, include: { user: { select: { id: true, name: true, email: true } } } });
  if (!parent) return Response.json({ error: "Akun Orang Tua tidak ditemukan" }, { status: 404 });

  await prisma.user.update({ where: { id: parent.user.id }, data: { password: await bcrypt.hash(DEFAULT_PASSWORD, 12) } });
  await cabutSemuaSesiPengguna(parent.user.id, "GANTI_PASSWORD");

  await logActivity(session, {
    action: "RESET_PASSWORD", entity: "Parent", entityId: id,
    description: `${session.name} mereset password akun Orang Tua "${parent.user.name}" (${parent.user.email}) ke default`,
  });

  return Response.json({ success: true });
}
