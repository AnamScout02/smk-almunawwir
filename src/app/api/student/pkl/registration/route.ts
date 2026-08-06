import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function getStudent(email: string) {
  return prisma.student.findFirst({
    where: { user: { email } },
    select: { id: true, class: { select: { grade: true } } },
  });
}

export async function GET() {
  try {
    const session = await verifyRole(["STUDENT"]);
    const student = await getStudent(session.email);
    if (!student) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [requirements, registration] = await Promise.all([
      prisma.pklDocumentRequirement.findMany({ where: { active: true }, orderBy: { order: "asc" } }),
      prisma.pklRegistration.findUnique({
        where: { studentId: student.id },
        include: { documents: true },
      }),
    ]);

    return NextResponse.json({
      isGradeXi: student.class?.grade === 11,
      requirements,
      registration,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["STUDENT"]);
    const student = await getStudent(session.email);
    if (!student) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // Pendaftaran PKL khusus siswa kelas XI (semester 2, sebelum naik ke XII) — divalidasi di
    // server, bukan cuma disembunyikan di UI, supaya tidak bisa disiasati lewat request langsung.
    if (student.class?.grade !== 11) {
      return NextResponse.json({ error: "Pendaftaran PKL hanya untuk siswa kelas XI." }, { status: 403 });
    }

    const { documents } = await req.json() as { documents: { requirementId: string; fileUrl: string }[] };
    if (!Array.isArray(documents) || documents.length === 0) {
      return NextResponse.json({ error: "Lampirkan dokumen syarat terlebih dahulu." }, { status: 400 });
    }

    const requirements = await prisma.pklDocumentRequirement.findMany({ where: { active: true }, select: { id: true } });
    const requiredIds = new Set(requirements.map(r => r.id));
    const missing = [...requiredIds].filter(id => !documents.some(d => d.requirementId === id && d.fileUrl));
    if (missing.length > 0) {
      return NextResponse.json({ error: "Semua dokumen syarat wajib dilampirkan." }, { status: 400 });
    }

    const registration = await prisma.$transaction(async (tx) => {
      const reg = await tx.pklRegistration.upsert({
        where: { studentId: student.id },
        create: { studentId: student.id, status: "PENDING" },
        // Ajukan ulang setelah ditolak → balik ke PENDING, bersihkan catatan review lama.
        update: { status: "PENDING", reviewNote: null, reviewedByName: null, reviewedAt: null, submittedAt: new Date() },
      });
      for (const d of documents) {
        await tx.pklRegistrationDocument.upsert({
          where: { registrationId_requirementId: { registrationId: reg.id, requirementId: d.requirementId } },
          create: { registrationId: reg.id, requirementId: d.requirementId, fileUrl: d.fileUrl },
          update: { fileUrl: d.fileUrl, uploadedAt: new Date() },
        });
      }
      return tx.pklRegistration.findUnique({ where: { id: reg.id }, include: { documents: true } });
    });

    return NextResponse.json(registration, { status: 201 });
  } catch (e) {
    console.error("[student pkl registration POST]", e);
    return NextResponse.json({ error: "Gagal mengajukan pendaftaran PKL." }, { status: 500 });
  }
}
