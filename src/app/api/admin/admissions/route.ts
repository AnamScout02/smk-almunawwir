import { prisma } from "@/lib/prisma";
import { verifySpmbAccess } from "@/lib/spmb";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export async function GET() {
  try {
    await verifySpmbAccess();
    const items = await prisma.admission.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        gelombang: { select: { nama: true } },
        perujuk: { select: { nama: true, kode: true, jenis: true } },
        berkasSpmb: { select: { id: true, berkas: true, diverifikasi: true, syarat: { select: { nama: true } } } },
      },
    });
    return Response.json(items);
  } catch (e) { lemparBilaPengalihan(e); return Response.json({ error: "Gagal memuat" }, { status: 500 }); }
}
