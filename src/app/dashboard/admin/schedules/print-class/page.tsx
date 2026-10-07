export const dynamic = "force-dynamic";

import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import Link from "next/link";
import { TautanIkon } from "@/components/shared/IkonNama";
import PrintButton from "@/components/shared/PrintButton";
import PrintKop from "@/components/shared/PrintKop";
import { weekLabel, weekTypesOverlap } from "@/lib/schedule-week";
import { buildPrintFilename } from "@/lib/print-filename";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ classId?: string; week?: string }> }) {
  const { classId, week } = await searchParams;
  const cls = classId ? await prisma.class.findUnique({ where: { id: classId }, select: { name: true } }) : null;
  return { title: { absolute: buildPrintFilename("Jadwal", cls?.name, week ? `Minggu-${week}` : null) } };
}

const DAYS = ["SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
const DAY_LABEL: Record<string, string> = {
  SENIN: "SENIN", SELASA: "SELASA", RABU: "RABU", KAMIS: "KAMIS", JUMAT: "JUMAT", SABTU: "SABTU",
};

export default async function ClassSchedulePrintPage({ searchParams }: { searchParams: Promise<{ classId?: string; week?: string }> }) {
  await verifyTasAccess();
  const { classId, week } = await searchParams;
  const weekType = week === "A" || week === "B" ? week : "SEMUA";

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
            style={{ backgroundImage: "url('/images/pattern-smk-miring.png')", backgroundSize: "197.99px 197.99px", backgroundRepeat: "repeat", filter: "invert(1)" }} />
          <TautanIkon href="/dashboard/admin/schedules" ikon="kembali" ukuran={16} className="relative flex items-center gap-1.5 h-8 px-3 rounded-full bg-white/10 hover:bg-white/20 text-xs font-semibold transition shrink-0">Kembali</TautanIkon>
          <h1 className="relative font-heading font-bold">Cetak Jadwal per Kelas</h1>
        </div>
        <p className="text-sm text-gray-500 mb-3">Pilih kelas yang mau dicetak:</p>
        <div className="flex flex-wrap gap-2">
          {classes.map(c => (
            <Link key={c.id} href={`/dashboard/admin/schedules/print-class?classId=${c.id}&week=SEMUA`}
              className="btn-modal-cancel">
              {c.name} — {c.major.name}
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const rotating = activeClass.grade === 10 || activeClass.grade === 11;

  const [periods, schedules, settings] = await Promise.all([
    prisma.schoolPeriod.findMany({ orderBy: [{ day: "asc" }, { order: "asc" }] }),
    prisma.schedule.findMany({
      where: { classId: activeClass.id, scheduleType: "BLOK" },
      include: { teacher: { select: { user: { select: { name: true } } } } },
    }),
    getSettings(["logo.full_white"]),
  ]);
  const logoUrl = settings["logo.full_white"];

  const periodsByDay = new Map<string, typeof periods>();
  for (const day of DAYS) periodsByDay.set(day, periods.filter(p => p.day === day));
  const periodStartsByDay = new Map<string, string[]>();
  for (const day of DAYS) periodStartsByDay.set(day, (periodsByDay.get(day) ?? []).filter(p => !p.isBreak).map(p => p.startTime));

  // PERBAIKAN 2026-08-11 (akar masalah sama dgn tabel gabungan) — baris block-merge (mencakup
  // beberapa periode sekaligus) dulu cuma terdaftar di startTime-nya sendiri, periode LANJUTAN
  // yg ikut tercakup blok itu kelihatan "Kosong". Sekarang didaftarkan ke SEMUA periode yg
  // startTime-nya jatuh dalam rentang [s.startTime, s.endTime) hari itu.
  const scheduleIndex = new Map<string, (typeof schedules)[number]>();
  for (const s of schedules) {
    if (rotating && !weekTypesOverlap(s.weekType, weekType === "SEMUA" ? "SEMUA" : weekType)) continue;
    const starts = (periodStartsByDay.get(s.day) ?? []).filter(t => t >= s.startTime && t < s.endTime);
    for (const st of (starts.length > 0 ? starts : [s.startTime])) scheduleIndex.set(`${s.day}|${st}`, s);
  }

  const today = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

  return (
    <>
      <div className="print:hidden sticky top-0 z-30 relative overflow-hidden text-white px-6 py-4 flex items-center justify-between"
        style={{ background: "linear-gradient(135deg, #0A1030 0%, #0F1A45 40%, #1B2B6B 100%)" }}>
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{ backgroundImage: "url('/images/pattern-smk-miring.png')", backgroundSize: "197.99px 197.99px", backgroundRepeat: "repeat", filter: "invert(1)" }} />
        <div className="relative flex items-center gap-3">
          <TautanIkon href="/dashboard/admin/schedules" ikon="kembali" ukuran={16} className="flex items-center gap-1.5 h-8 px-3 rounded-full bg-white/10 hover:bg-white/20 text-xs font-semibold transition shrink-0">Kembali</TautanIkon>
          <div>
            <h1 className="font-heading font-bold">Cetak Jadwal — {activeClass.name}</h1>
            <div className="flex flex-wrap gap-2 mt-1">
              <Link href="/dashboard/admin/schedules/print-class"
                className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20">
                Ganti Kelas
              </Link>
              {rotating ? (
                <>
                  <Link href={`/dashboard/admin/schedules/print-class?classId=${activeClass.id}&week=A`}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${weekType === "A" ? "bg-white text-primary-900" : "bg-white/10 hover:bg-white/20"}`}>
                    Minggu 1
                  </Link>
                  <Link href={`/dashboard/admin/schedules/print-class?classId=${activeClass.id}&week=B`}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${weekType === "B" ? "bg-white text-primary-900" : "bg-white/10 hover:bg-white/20"}`}>
                    Minggu 2
                  </Link>
                </>
              ) : (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white text-primary-900">Setiap Minggu</span>
              )}
            </div>
          </div>
        </div>
        <div className="relative"><PrintButton /></div>
      </div>

      <div className="print-doc bg-white relative p-6 print:p-2">
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none -z-10"
          style={{ backgroundImage: "url('/images/pattern-smk-miring.png')", backgroundSize: "127.28px 127.28px", backgroundRepeat: "repeat" }} />
        <PrintKop title={`Jadwal Pelajaran — ${activeClass.name}`} subtitle="SMK Al Munawwir IIBS" logoUrl={logoUrl} />
        <div className="text-center mb-4 print:mb-3">
          <p className="text-xs text-gray-500">
            {activeClass.major.name} · {rotating ? weekLabel(activeClass.grade, weekType === "SEMUA" ? "A" : weekType) : "Setiap Minggu"} · Dicetak {today}
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
