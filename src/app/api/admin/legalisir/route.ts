import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";

export const dynamic = "force-dynamic";

/** `?month=YYYY-MM` menyaring per bulan (dipakai cetak rekap). Tanpa parameter: 300 terakhir. */
export async function GET(req: Request) {
  try {
    await verifyTasAccess();
    const month = new URL(req.url).searchParams.get("month");

    let where = {};
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split("-").map(Number);
      where = { requestDate: { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) } };
    }

    const rows = await prisma.legalisirRequest.findMany({
      where,
      include: {
        student: {
          select: {
            id: true, nis: true, enrollYear: true, studentStatus: true,
            user: { select: { name: true } }, major: { select: { code: true } },
          },
        },
      },
      orderBy: [{ requestDate: "desc" }, { createdAt: "desc" }],
      ...(month ? {} : { take: 300 }),
    });
    return Response.json(rows);
  } catch {
    return Response.json({ error: "Gagal memuat data legalisir" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await verifyTasAccess();
    const b = await req.json();
    if (!b.applicantName?.trim()) return Response.json({ error: "Nama pemohon wajib diisi." }, { status: 400 });
    if (!b.purpose?.trim()) return Response.json({ error: "Keperluan wajib diisi." }, { status: 400 });

    const row = await prisma.legalisirRequest.create({
      data: {
        requestDate: b.requestDate ? new Date(b.requestDate) : new Date(),
        studentId: b.studentId || null,
        applicantName: b.applicantName.trim(),
        documentType: b.documentType || "IJAZAH",
        documentNo: b.documentNo?.trim() || null,
        copies: Number(b.copies) > 0 ? Number(b.copies) : 1,
        purpose: b.purpose.trim(),
        signedBy: b.signedBy?.trim() || null,
        status: b.status || "DIPROSES",
        pickupDate: b.pickupDate ? new Date(b.pickupDate) : null,
        notes: b.notes?.trim() || null,
        inputById: session.userId,
      },
      include: {
        student: {
          select: {
            id: true, nis: true, enrollYear: true, studentStatus: true,
            user: { select: { name: true } }, major: { select: { code: true } },
          },
        },
      },
    });
    return Response.json(row, { status: 201 });
  } catch {
    return Response.json({ error: "Gagal menyimpan permintaan legalisir." }, { status: 500 });
  }
}
