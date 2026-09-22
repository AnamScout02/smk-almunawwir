import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

/** Generate tagihan utk satu FeeType+periode, ke satu kelas ATAU semua siswa aktif — diekstrak
 * dari `POST /api/bendahara/invoices/generate` (endpoint manual) supaya dipakai ULANG oleh
 * scheduler otomatis (`runDueBillingSchedules` di bawah) tanpa duplikasi logic. Per-siswa
 * dibungkus try/catch sendiri (pola sama naik-kelas/route.ts) supaya siswa yang SUDAH punya
 * tagihan kombinasi sama (kena `@@unique`) di-skip, bukan menggagalkan seluruh proses. */
export async function generateInvoicesForScope(opts: {
  feeTypeId: string; period: string; classId?: string | null;
  amount: number; dueDate?: Date | null; recordedByName: string;
}): Promise<{ created: number; skipped: number }> {
  const students = await prisma.student.findMany({
    where: { studentStatus: "AKTIF", ...(opts.classId ? { classId: opts.classId } : {}) },
    select: { id: true },
  });

  let created = 0, skipped = 0;
  for (const s of students) {
    try {
      await prisma.invoice.create({
        data: {
          studentId: s.id, feeTypeId: opts.feeTypeId, period: opts.period, amount: opts.amount,
          dueDate: opts.dueDate ?? null, recordedByName: opts.recordedByName,
        },
      });
      created++;
    } catch {
      skipped++; // sudah ada kombinasi studentId+feeTypeId+period yang sama (@@unique)
    }
  }
  return { created, skipped };
}

function addCycle(d: Date, periodType: string): Date {
  const r = new Date(d);
  if (periodType === "MONTHLY") r.setMonth(r.getMonth() + 1);
  else r.setDate(r.getDate() + 1);
  return r;
}

function formatPeriod(d: Date, periodType: string): string {
  return periodType === "MONTHLY"
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    : d.toISOString().slice(0, 10);
}

/** Dipanggil scheduler in-process (lihat instrumentation.ts) tiap jam — cek semua
 * BillingSchedule aktif yang siklus berikutnya sudah jatuh tempo (<=sekarang), generate tagihan,
 * lalu majukan `lastGeneratedAt`/`generatedCount`. Proses SEMUA siklus yang tertunggak dalam satu
 * panggilan (jaga2 server sempat mati beberapa hari) — dibatasi sisa `frequency` supaya tidak
 * infinite loop. Aman dipanggil berkali-kali (idempoten): begitu satu siklus sukses, siklus
 * berikutnya otomatis di masa depan, jadi panggilan ulang di jam yang sama tidak generate dobel. */
export async function runDueBillingSchedules(): Promise<void> {
  const schedules = await prisma.billingSchedule.findMany({
    where: { active: true },
    include: { feeType: true },
  });

  for (const sch of schedules) {
    if (sch.generatedCount >= sch.frequency) continue;

    let next = sch.lastGeneratedAt ? addCycle(sch.lastGeneratedAt, sch.periodType) : sch.startDate;
    let generatedCount = sch.generatedCount;
    let lastGeneratedAt = sch.lastGeneratedAt;

    while (next <= new Date() && generatedCount < sch.frequency) {
      const period = formatPeriod(next, sch.periodType);
      const dueDate = new Date(next.getTime() + sch.dueDateOffsetDays * 86400000);
      const { created, skipped } = await generateInvoicesForScope({
        feeTypeId: sch.feeTypeId, period, classId: sch.classId,
        amount: sch.feeType.defaultAmount, dueDate,
        recordedByName: `Sistem (Jadwal: ${sch.name})`,
      });

      generatedCount++;
      lastGeneratedAt = next;
      await prisma.billingSchedule.update({
        where: { id: sch.id },
        data: { generatedCount, lastGeneratedAt: next },
      });

      await logActivity({ userId: "SYSTEM", name: "Sistem (Jadwal Tagihan)", role: "SYSTEM" }, {
        action: "GENERATE_INVOICES", entity: "Invoice",
        description: `Sistem generate tagihan terjadwal "${sch.name}" — "${sch.feeType.name}" (${period}) — ${created} dibuat, ${skipped} dilewati (sudah ada)`,
        metadata: { scheduleId: sch.id, feeTypeId: sch.feeTypeId, period, classId: sch.classId, created, skipped },
      });

      next = addCycle(next, sch.periodType);
    }
  }
}
