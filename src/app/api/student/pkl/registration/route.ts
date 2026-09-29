import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { prisma } from "@/lib/prisma";
import { izinDaftarPkl } from "@/lib/pkl-pendaftar";

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

    const [requirements, registration, izin] = await Promise.all([
      prisma.pklDocumentRequirement.findMany({ where: { active: true }, orderBy: { order: "asc" } }),
      prisma.pklRegistration.findUnique({
        where: { studentId: student.id },
        include: { documents: true },
      }),
      izinDaftarPkl(student.class?.grade),
    ]);

    return NextResponse.json({
      bolehDaftar: izin.boleh, alasanTutup: izin.alasan ?? null,
      requirements, registration,
    });
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["STUDENT"]);
    const student = await getStudent(session.email);
    if (!student) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // Tingkat yang boleh mendaftar diatur sekolah (SiteSetting `pkl.tingkatPendaftar`), bukan
    // tertulis mati seperti dulu — tetap divalidasi di SERVER, bukan cuma disembunyikan di UI.
    const izin = await izinDaftarPkl(student.class?.grade);
    if (!izin.boleh) {
      return NextResponse.json({ error: izin.alasan ?? "Pendaftaran PKL sedang ditutup." }, { status: 403 });
    }

    const body = await req.json() as { documents?: { requirementId: string; fileUrl: string }[] };
    const documents = Array.isArray(body.documents) ? body.documents : [];

    const requirements = await prisma.pklDocumentRequirement.findMany({ where: { active: true }, select: { id: true } });
    // Sekolah belum menetapkan dokumen syarat apa pun → pendaftaran TIDAK diblokir, siswa cukup
    // menyatakan diri mendaftar. Dulu `documents.length === 0` ditolak, jadi selama tabel syarat
    // kosong tidak ada yang bisa mendaftar sama sekali.
    if (requirements.length > 0) {
      const missing = requirements.filter(r => !documents.some(d => d.requirementId === r.id && d.fileUrl));
      if (missing.length > 0) {
        return NextResponse.json({ error: "Semua dokumen syarat wajib dilampirkan." }, { status: 400 });
      }
    }

    const registration = await prisma.$transaction(async (tx) => {
      const reg = await tx.pklRegistration.upsert({
        where: { studentId: student.id },
        create: { studentId: student.id, status: "PENDING" },
        // Ajukan ulang setelah ditolak → balik ke PENDING, bersihkan catatan review lama.
        update: { status: "PENDING", reviewNote: null, reviewedByName: null, reviewedAt: null, submittedAt: new Date() },
      });
      for (const d of documents) {
        if (!d.fileUrl) continue;
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
    lemparBilaPengalihan(e);
    console.error("[student pkl registration POST]", e);
    return NextResponse.json({ error: "Gagal mengajukan pendaftaran PKL." }, { status: 500 });
  }
}
