import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";

export async function POST(req: Request) {
  try {
    const session = await verifyRole(["STUDENT"]);
    const student = await prisma.student.findFirst({
      where: { user: { email: session.email } },
      select: { internship: { select: { id: true } } },
    });
    if (!student?.internship) {
      return Response.json({ error: "Anda belum memiliki data PKL. Hubungi admin/wali kelas." }, { status: 404 });
    }

    const body = await req.json() as { date: string; activity: string; photoUrl?: string };
    if (!body.date || !body.activity?.trim()) {
      return Response.json({ error: "Tanggal dan kegiatan wajib diisi." }, { status: 400 });
    }

    const entry = await prisma.internshipJournal.create({
      data: {
        internshipId: student.internship.id,
        date: new Date(body.date),
        activity: body.activity.trim(),
        photoUrl: body.photoUrl || null,
      },
    });
    return Response.json(entry, { status: 201 });
  } catch {
    return Response.json({ error: "Gagal menyimpan jurnal PKL" }, { status: 500 });
  }
}
