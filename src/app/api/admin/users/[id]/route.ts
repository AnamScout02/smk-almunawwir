import { prisma } from "@/lib/prisma";
import { cabutSemuaSesiPengguna } from "@/lib/sesi-server";
import { verifyRole } from "@/lib/dal";
import { logActivity } from "@/lib/activity-log";
import bcrypt from "bcryptjs";
import { toProperCaseName } from "@/lib/text";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN"]);
    const { id } = await params;
    const { name, email, password, role } = await req.json();

    const data: Record<string, string> = { name: toProperCaseName(name), email, role };
    if (password) data.password = await bcrypt.hash(password, 12);

    const user = await prisma.user.update({ where: { id }, data });

    if (password) {
      // Password direset admin → semua sesi akun itu dicabut, pemiliknya harus login ulang.
      await cabutSemuaSesiPengguna(user.id, "GANTI_PASSWORD");
      await logActivity(session, {
        action: "RESET_PASSWORD", entity: "User", entityId: user.id,
        description: `${session.name} mereset password akun "${user.name}" (${user.email})`,
      });
    }
    await logActivity(session, {
      action: "UPDATE_USER", entity: "User", entityId: user.id,
      description: `${session.name} mengubah data akun "${user.name}" (${user.email}, role ${user.role})`,
    });

    return Response.json(user);
  } catch {
    return Response.json({ error: "Gagal memperbarui pengguna" }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN"]);
    const { id } = await params;
    const user = await prisma.user.delete({ where: { id } });
    await logActivity(session, {
      action: "DELETE_USER", entity: "User", entityId: id,
      description: `${session.name} menghapus akun "${user.name}" (${user.email}, role ${user.role})`,
    });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Gagal menghapus pengguna" }, { status: 500 });
  }
}
