import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

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

    const body = await req.json() as { date: string; activity: string; photoUrl?: string; lat?: number; lng?: number; akurasi?: number };
    // Lokasi opsional (izin lokasi HP) — hanya disimpan bila koordinatnya sah.
    const lokasiSah = typeof body.lat === "number" && typeof body.lng === "number" && Math.abs(body.lat) <= 90 && Math.abs(body.lng) <= 180;
    if (!body.date || !body.activity?.trim()) {
      return Response.json({ error: "Tanggal dan kegiatan wajib diisi." }, { status: 400 });
    }

    const entry = await prisma.internshipJournal.create({
      data: {
        internshipId: student.internship.id,
        date: new Date(body.date),
        activity: body.activity.trim(),
        photoUrl: body.photoUrl || null,
        lat: lokasiSah ? body.lat : null,
        lng: lokasiSah ? body.lng : null,
        akurasi: lokasiSah && typeof body.akurasi === "number" ? Math.round(body.akurasi) : null,
      },
    });
    return Response.json(entry, { status: 201 });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal menyimpan jurnal PKL" }, { status: 500 });
  }
}
