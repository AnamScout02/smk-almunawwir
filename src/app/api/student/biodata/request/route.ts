import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { EDITABLE_TOP_FIELDS, EDITABLE_BUKU_FIELDS, FIELD_LABELS, ChangeMap } from "@/lib/profile-edit-fields";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

function normalize(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return JSON.stringify(v);
  return String(v);
}

export async function POST(req: Request) {
  try {
    const session = await verifyRole(["STUDENT"]);
    const student = await prisma.student.findFirst({
      where: { user: { email: session.email } },
      select: {
        id: true,
        birthPlace: true, birthDate: true, gender: true, religion: true, address: true,
        parentName: true, parentPhone: true, parentJob: true, previousSchool: true,
        bukuIndukData: true,
        profileEditRequests: { where: { status: "PENDING" }, take: 1 },
      },
    });
    if (!student) return Response.json({ error: "Data siswa tidak ditemukan" }, { status: 404 });
    if (student.profileEditRequests.length > 0) {
      return Response.json({ error: "Anda masih punya pengajuan yang belum diproses admin. Tunggu sampai disetujui/ditolak sebelum mengajukan lagi." }, { status: 409 });
    }

    const body = await req.json() as {
      top: Record<string, unknown>;
      buku: Record<string, unknown>;
    };

    const currentTop = student as unknown as Record<string, unknown>;
    const currentBuku = (student.bukuIndukData as Record<string, unknown>) ?? {};

    const changes: ChangeMap = {};

    for (const key of EDITABLE_TOP_FIELDS) {
      if (!(key in body.top)) continue;
      const oldVal = currentTop[key];
      const oldNorm = key === "birthDate" ? normalize(oldVal ? new Date(oldVal as string).toISOString().slice(0, 10) : "") : normalize(oldVal);
      const newNorm = normalize(body.top[key]);
      if (oldNorm !== newNorm) {
        changes[`top:${key}`] = { old: oldVal ?? null, new: body.top[key], label: FIELD_LABELS[key] ?? key };
      }
    }

    for (const key of EDITABLE_BUKU_FIELDS) {
      if (!(key in body.buku)) continue;
      const oldVal = currentBuku[key];
      if (normalize(oldVal) !== normalize(body.buku[key])) {
        changes[`buku:${key}`] = { old: oldVal ?? null, new: body.buku[key], label: FIELD_LABELS[key] ?? key };
      }
    }

    if (Object.keys(changes).length === 0) {
      return Response.json({ error: "Tidak ada perubahan yang diajukan." }, { status: 400 });
    }

    const request = await prisma.profileEditRequest.create({
      data: { studentId: student.id, changes: changes as object, status: "PENDING" },
    });

    return Response.json({ success: true, id: request.id }, { status: 201 });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal mengajukan perubahan" }, { status: 500 });
  }
}
