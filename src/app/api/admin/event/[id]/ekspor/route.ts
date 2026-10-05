import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { assertEvent } from "@/lib/event-guard";
import { STATUS_DAFTAR_INFO } from "@/lib/event-label";
import { balasanExcel } from "@/lib/ekspor-excel";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

/** Unduh daftar pendaftar satu event (.xlsx, CLAUDE.md "Export data → Excel"). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifySession();
    await assertEvent(session);
    const { id } = await params;
    const e = await prisma.event.findUnique({
      where: { id },
      select: {
        judul: true, slug: true,
        pendaftaran: { orderBy: { createdAt: "asc" }, include: { student: { select: { nis: true, class: { select: { name: true } } } } } },
      },
    });
    if (!e) return new Response("Not found", { status: 404 });
    const tgl = (d: Date) => d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });
    return balasanExcel({
      namaFile: `pendaftar-${e.slug}`,
      namaSheet: "Pendaftar",
      headers: ["No", "Nama Peserta", "NIS", "Kelas", "Asal Sekolah", "Kontak", "Catatan Peserta", "Karya", "Bukti Bayar", "Status", "Juara", "Catatan Panitia", "Mendaftar"],
      rows: e.pendaftaran.map((p, i) => [
        i + 1, p.namaPeserta, p.student?.nis ?? "", p.student?.class?.name ?? "", p.asalSekolah ?? "", p.kontak,
        p.catatan ?? "", p.karyaBerkas ? "Ada" : "", p.buktiBayar ? "Ada" : "",
        STATUS_DAFTAR_INFO[p.status]?.label ?? p.status, p.juara ?? "", p.catatanPanitia ?? "", tgl(p.createdAt),
      ]),
    });
  } catch (err) {
    lemparBilaPengalihan(err);
    return new Response("Tidak berhak", { status: 403 });
  }
}
