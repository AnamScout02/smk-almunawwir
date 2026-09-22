import { prisma } from "@/lib/prisma";
import { balasanExcel } from "@/lib/ekspor-excel";
import { verifyRole } from "@/lib/dal";
import { assertBendahara } from "@/lib/bendahara-guard";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
    await assertBendahara(session);

    const classId = req.nextUrl.searchParams.get("classId");
    const period = req.nextUrl.searchParams.get("period"); // "YYYY-MM"

    const invoices = await prisma.invoice.findMany({
      where: {
        ...(period ? { period } : {}),
        ...(classId ? { student: { classId } } : {}),
      },
      include: {
        student: {
          include: { user: { select: { name: true } }, class: { select: { name: true } } },
        },
        feeType: { select: { name: true } },
      },
      orderBy: [{ createdAt: "asc" }],
    });

    const headers = ["No", "Nama Siswa", "NIS", "Kelas", "Jenis Biaya", "Periode", "Jumlah", "Dibayar", "Status", "Tanggal Bayar"];

    const rows = invoices.map((inv, i) => {
      const status = inv.paidAmount >= inv.amount ? "LUNAS" : inv.dueDate && inv.dueDate < new Date() ? "TERLAMBAT" : "BELUM_LUNAS";
      return [
        i + 1,
        inv.student.user.name,
        inv.student.nis,
        inv.student.class?.name ?? "—",
        inv.feeType.name,
        inv.period,
        inv.amount,
        inv.paidAmount,
        status,
        inv.paidAt ? new Date(inv.paidAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "—",
      ];
    });

    return balasanExcel({
      namaFile: period ? `tagihan-${period}` : `tagihan-${new Date().toISOString().slice(0, 10)}`,
      namaSheet: "Tagihan",
      headers, rows,
    });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Khusus Bendahara." }, { status: 403 });
    return Response.json({ error: "Gagal mengekspor data" }, { status: 500 });
  }
}
