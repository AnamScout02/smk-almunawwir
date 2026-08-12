import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { verifyTasAccess } from "@/lib/tas-access-guard";

export async function GET() {
  try {
    await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    const majors = await prisma.major.findMany({
      include: {
        _count: { select: { students: true, classes: true } },
      },
      orderBy: { name: "asc" },
    });
    return Response.json(majors);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    await verifyTasAccess();
    const { name, code, description, icon, logoUrl, nisCode, bidangKeahlian, programKeahlian, kompetensiKeahlian } = await req.json();
    if (!name?.trim() || !code?.trim() || !description?.trim()) {
      return Response.json({ error: "Nama, kode, dan deskripsi wajib diisi." }, { status: 400 });
    }
    const major = await prisma.major.create({
      data: {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        description: description.trim(),
        icon: icon?.trim() || null,
        logoUrl: logoUrl?.trim() || null,
        nisCode: nisCode?.trim() || null,
        bidangKeahlian: bidangKeahlian?.trim() || null,
        programKeahlian: programKeahlian?.trim() || null,
        kompetensiKeahlian: kompetensiKeahlian?.trim() || null,
      },
    });
    return Response.json(major, { status: 201 });
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002") {
      return Response.json({ error: "Kode jurusan sudah digunakan." }, { status: 409 });
    }
    return Response.json({ error: "Gagal membuat jurusan." }, { status: 500 });
  }
}
