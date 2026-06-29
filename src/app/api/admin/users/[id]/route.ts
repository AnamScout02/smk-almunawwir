import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import bcrypt from "bcryptjs";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyRole(["ADMIN"]);
    const { id } = await params;
    const { name, email, password, role } = await req.json();

    const data: Record<string, string> = { name, email, role };
    if (password) data.password = await bcrypt.hash(password, 12);

    const user = await prisma.user.update({ where: { id }, data });
    return Response.json(user);
  } catch {
    return Response.json({ error: "Gagal memperbarui pengguna" }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyRole(["ADMIN"]);
    const { id } = await params;
    await prisma.user.delete({ where: { id } });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Gagal menghapus pengguna" }, { status: 500 });
  }
}
