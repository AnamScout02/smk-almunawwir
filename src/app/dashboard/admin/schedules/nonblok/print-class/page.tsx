export const dynamic = "force-dynamic";

import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PrintButton from "@/components/shared/PrintButton";
import PrintKop from "@/components/shared/PrintKop";
import { buildPrintFilename } from "@/lib/print-filename";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ classId?: string }> }) {
  const { classId } = await searchParams;
  const cls = classId ? await prisma.class.findUnique({ where: { id: classId }, select: { name: true } }) : null;
  return { title: { absolute: buildPrintFilename("Jadwal-NonBlok", cls?.name) } };
}

const DAYS = ["SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
const DAY_LABEL: Record<string, string> = {
  SENIN: "SENIN", SELASA: "SELASA", RABU: "RABU", KAMIS: "KAMIS", JUMAT: "JUMAT", SABTU: "SABTU",
};

export default async function NonBlokClassPrintPage({ searchParams }: { searchParams: Promise<{ classId?: string }> }) {
  await verifyTasAccess();
  const { classId } = await searchParams;

  const classes = await prisma.class.findMany({
    include: { major: { select: { name: true, code: true } } },
    orderBy: [{ grade: "asc" }, { major: { code: "asc" } }, { name: "asc" }],
  });
  const activeClass = classId ? classes.find(c => c.id === classId) : undefined;

  if (!activeClass) {
    return (
      <div className="p-8">
        <div className="print:hidden sticky top-0 z-30 relative overflow-hidden text-white px-6 py-4 flex items-center gap-3 -mx-8 -mt-8 mb-6"
          style={{ background: "linear-gradient(135deg, #0A1030 0%, #0F1A45 40%, #1B2B6B 100%)" }}>
          <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
            style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "140px 140px", backgroundRepeat: "repeat", filter: "invert(1)" }} />
          <Link href="/dashboard/admin/schedules/nonblok" className="relative flex items-center gap-1.5 h-8 px-3 rounded-full bg-white/10 hover:bg-white/20 text-xs font-semibold transition shrink-0">
            <ArrowLeft size={16} /> Kembali
          </Link>
          <h1 className="relative font-heading font-bold">Cetak Jadwal Non-Blok per Kelas</h1>
        </div>
        <p className="text-sm text-gray-500 mb-3">Pilih kelas yang mau dicetak:</p>
        <div className="flex flex-wrap gap-2">
          {classes.map(c => (
            <Link key={c.id} href={`/dashboard/admin/schedules/nonblok/print-class?classId=${c.id}`}
              className="text-sm font-semibold px-3 py-2 rounded-xl border border-gray-200 hover:bg-primary-50 hover:border-primary-300 transition">
              {c.name} — {c.major.name}
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const [periods, schedules, settings] = await Promise.all([
    prisma.schoolPeriod.findMany({ orderBy: [{ day: "asc" }, { order: "asc" }] }),
    prisma.schedule.findMany({
      where: { classId: activeClass.id, scheduleType: "NONBLOK" },
      include: { teacher: { select: { user: { select: { name: true } } } } },
    }),
    getSettings(["logo.full_white"]),
  ]);
  const logoUrl = settings["logo.full_white"];

  const periodsByDay = new Map<string, typeof periods>();
  for (const day of DAYS) periodsByDay.set(day, periods.filter(p => p.day === day));
  const periodStartsByDay = new Map<string, string[]>();
  for (const day of DAYS) periodStartsByDay.set(day, (periodsByDay.get(day) ?? []).filter(p => !p.isBreak).map(p => p.startTime));

  // PERBAIKAN 2026-08-11 (akar masalah sama dgn tabel gabungan/print-class BLOK) — daftarkan baris
  // ke SEMUA periode yg tercakup rentangnya, bukan cuma startTime-nya sendiri.
  const scheduleIndex = new Map<string, (typeof schedules)[number]>();
  for (const s of schedules) {
    const starts = (periodStartsByDay.get(s.day) ?? []).filter(t => t >= s.startTime && t < s.endTime);
    for (const st of (starts.length > 0 ? starts : [s.startTime])) scheduleIndex.set(`${s.day}|${st}`, s);
  }

  const today = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

  return (
    <>
      <div className="print:hidden sticky top-0 z-30 relative overflow-hidden text-white px-6 py-4 flex items-center justify-between"
        style={{ background: "linear-gradient(135deg, #0A1030 0%, #0F1A45 40%, #1B2B6B 100%)" }}>
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "140px 140px", backgroundRepeat: "repeat", filter: "invert(1)" }} />
        <div className="relative flex items-center gap-3">
          <Link href="/dashboard/admin/schedules/nonblok" className="flex items-center gap-1.5 h-8 px-3 rounded-full bg-white/10 hover:bg-white/20 text-xs font-semibold transition shrink-0">
            <ArrowLeft size={16} /> Kembali
          </Link>
          <div>
            <h1 className="font-heading font-bold">Cetak Jadwal Non-Blok — {activeClass.name}</h1>
            <Link href="/dashboard/admin/schedules/nonblok/print-class"
              className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 inline-block mt-1">
              Ganti Kelas
            </Link>
          </div>
        </div>
        <div className="relative"><PrintButton /></div>
      </div>

      <div className="print-doc bg-white relative p-6 print:p-2">
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none -z-10"
          style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "90px 90px", backgroundRepeat: "repeat" }} />
        <PrintKop title={`Jadwal Pelajaran (Non-Blok) — ${activeClass.name}`} subtitle="SMK Al Munawwir IIBS" logoUrl={logoUrl} />
        <div className="text-center mb-4 print:mb-3">
          <p className="text-xs text-gray-500">
            {activeClass.major.name} · 1 Minggu (Dapodik) · Dicetak {today}
          </p>
        </div>

        <table className="border-collapse w-full text-xs print:text-[10px]">
          <thead>
            <tr className="bg-primary-900 text-white">
              <th className="border border-gray-300 px-2 py-2 w-20">Hari</th>
              <th className="border border-gray-300 px-2 py-2 w-24">Waktu</th>
              <th className="border border-gray-300 px-2 py-2">Mata Pelajaran</th>
              <th className="border border-gray-300 px-2 py-2">Guru Pengampu</th>
            </tr>
          </thead>
          <tbody>
            {DAYS.map(day => {
              const dayPeriods = periodsByDay.get(day) ?? [];
              return dayPeriods.map((p, idx) => {
                const sched = p.isBreak ? undefined : scheduleIndex.get(`${day}|${p.startTime}`);
                return (
                  <tr key={p.id} className={p.isBreak ? "bg-violet-50" : "even:bg-gray-50/50"}>
                    {idx === 0 && (
                      <td rowSpan={dayPeriods.length} className="border border-gray-300 px-2 py-1 text-center font-bold align-middle bg-primary-50">
                        {DAY_LABEL[day]}
                      </td>
                    )}
                    <td className="border border-gray-300 px-2 py-1 text-center font-mono whitespace-nowrap text-gray-400">{p.startTime}</td>
                    {p.isBreak ? (
                      <td colSpan={2} className="border border-gray-300 px-2 py-1 text-center font-bold text-violet-700 bg-violet-50">
                        {p.label ?? "Istirahat"}
                      </td>
                    ) : (
                      <>
                        <td className="border border-gray-300 px-2 py-1">{sched?.subject ?? ""}</td>
                        <td className="border border-gray-300 px-2 py-1">{sched?.teacher?.user.name ?? ""}</td>
                      </>
                    )}
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
      </div>

      <style>{`
        @page { size: A4 portrait; margin: 8mm 2cm; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
      `}</style>
    </>
  );
}
