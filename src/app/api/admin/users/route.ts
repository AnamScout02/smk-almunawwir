import { prisma } from "@/lib/prisma";
import { jsonBesar } from "@/lib/json-besar";
import { verifyRole } from "@/lib/dal";
import { logActivity } from "@/lib/activity-log";
import bcrypt from "bcryptjs";
import { toProperCaseName } from "@/lib/text";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export async function GET(req: Request) {
  try {
    await verifyRole(["ADMIN"]);
    const users = await prisma.user.findMany({
      select: {
        id: true, name: true, email: true, role: true, createdAt: true,
        staffJabatan: { select: { jabatan: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });
    return jsonBesar(users, req);
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await verifyRole(["ADMIN"]);
    const body = await req.json();
    const { name, email, password, role, nip, subject, phone, nis, nisn, majorId, classId } = body;
    if (!name || !email || !password) return Response.json({ error: "Data tidak lengkap" }, { status: 400 });

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return Response.json({ error: "Email sudah terdaftar" }, { status: 400 });

    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({ data: { name: toProperCaseName(name), email, password: hashed, role } });

    if (role === "TEACHER" && nip) {
      await prisma.teacher.create({ data: { userId: user.id, nip, subject: subject || "—", phone: phone || null } });
    }
    if (role === "STUDENT" && nis && majorId) {
      await prisma.student.create({ data: { userId: user.id, nis, nisn: nisn || null, majorId, classId: classId || null } });
    }

    await logActivity(session, {
      action: "CREATE_USER", entity: "User", entityId: user.id,
      description: `${session.name} membuat akun baru "${user.name}" (${email}, role ${role})`,
    });

    return Response.json(user, { status: 201 });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal membuat pengguna" }, { status: 500 });
  }
}
