import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    await verifyRole(["ADMIN"]);
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return Response.json(users);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    await verifyRole(["ADMIN"]);
    const body = await req.json();
    const { name, email, password, role, nip, subject, phone, nis, nisn, majorId, classId } = body;
    if (!name || !email || !password) return Response.json({ error: "Data tidak lengkap" }, { status: 400 });

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return Response.json({ error: "Email sudah terdaftar" }, { status: 400 });

    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({ data: { name, email, password: hashed, role } });

    if (role === "TEACHER" && nip) {
      await prisma.teacher.create({ data: { userId: user.id, nip, subject: subject || "—", phone: phone || null } });
    }
    if (role === "STUDENT" && nis && majorId) {
      await prisma.student.create({ data: { userId: user.id, nis, nisn: nisn || null, majorId, classId: classId || null } });
    }

    return Response.json(user, { status: 201 });
  } catch {
    return Response.json({ error: "Gagal membuat pengguna" }, { status: 500 });
  }
}
