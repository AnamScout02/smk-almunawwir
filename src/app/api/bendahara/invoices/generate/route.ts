import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertBendahara } from "@/lib/bendahara-guard";
import { logActivity } from "@/lib/activity-log";
import { generateInvoicesForScope } from "@/lib/billing-schedule";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

/** Generate tagihan massal — satu FeeType + satu periode, utk satu kelas ATAU semua siswa aktif.
 * Logika inti (per-siswa try/catch, skip yg sudah ada) diekstrak ke `generateInvoicesForScope`
 * (`src/lib/billing-schedule.ts`) supaya dipakai ULANG oleh scheduler Tagihan Terjadwal. */
export async function POST(req: Request) {
  try {
    const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
    await assertBendahara(session);
    const { feeTypeId, period, classId } = await req.json();
    if (!feeTypeId || !period?.trim()) {
      return Response.json({ error: "Jenis biaya dan periode wajib diisi" }, { status: 400 });
    }

    const feeType = await prisma.feeType.findUnique({ where: { id: feeTypeId } });
    if (!feeType) return Response.json({ error: "Jenis biaya tidak ditemukan" }, { status: 404 });

    const { created, skipped } = await generateInvoicesForScope({
      feeTypeId, period: period.trim(), classId, amount: feeType.defaultAmount,
      recordedByName: session.name,
    });

    await logActivity(session, {
      action: "GENERATE_INVOICES", entity: "Invoice",
      description: `${session.name} generate tagihan massal "${feeType.name}" (${period.trim()}) — ${created} dibuat, ${skipped} dilewati (sudah ada)`,
      metadata: { feeTypeId, period: period.trim(), classId: classId || null, created, skipped },
    });

    return Response.json({ created, skipped });
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Khusus Bendahara." }, { status: 403 });
    return Response.json({ error: "Gagal generate tagihan" }, { status: 500 });
  }
}
