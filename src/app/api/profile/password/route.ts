import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const session = await verifyRole(["ADMIN", "TEACHER", "STUDENT"]);
    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return Response.json({ error: "Password lama dan baru wajib diisi." }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return Response.json({ error: "Password baru minimal 6 karakter." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: session.email } });
    if (!user) return Response.json({ error: "User tidak ditemukan." }, { status: 404 });

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      return Response.json({ error: "Password lama tidak sesuai." }, { status: 400 });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Gagal mengubah password." }, { status: 500 });
  }
}
