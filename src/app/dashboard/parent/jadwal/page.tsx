export const dynamic = "force-dynamic";

import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getParentChildrenOrRedirect, resolveSelectedChild } from "@/lib/parent-guard";
import { getCurrentWeekType } from "@/lib/schedule-week.server";
import { groupConsecutiveSchedules } from "@/lib/schedule-grouping";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import { hariIniWib } from "@/lib/absensi-qr";
import { CalendarClock, Calendar } from "lucide-react";

export const metadata = { title: "Jadwal Pelajaran — Portal Orang Tua" };

const DAYS = ["SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
const DAY_LABEL: Record<string, string> = { SENIN: "Senin", SELASA: "Selasa", RABU: "Rabu", KAMIS: "Kamis", JUMAT: "Jumat", SABTU: "Sabtu" };

export default async function ParentJadwalPage({ searchParams }: { searchParams: Promise<{ studentId?: string }> }) {
  const session = await verifyRole(["PARENT"]);
  const { studentId } = await searchParams;
  const children = await getParentChildrenOrRedirect(session);
  const child = resolveSelectedChild(children, studentId);

  const currentWeekType = await getCurrentWeekType();
  // Hari ini menurut WIB — server berjalan di UTC (dulu pukul 00.00–07.00 WIB menandai hari kemarin).
  const todayDay = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"][hariIniWib().hariKe];

  const schedules = child.classId
    ? await prisma.schedule.findMany({
        where: { classId: child.classId, weekType: { in: ["SEMUA", currentWeekType] }, scheduleType: "BLOK" },
        include: { teacher: { include: { user: { select: { name: true } } } } },
        orderBy: [{ day: "asc" }, { startTime: "asc" }],
      })
    : [];

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<CalendarClock size={22} />} title="Jadwal Pelajaran" description={`Jadwal kelas ${child.class?.name ?? "—"} — minggu ${currentWeekType === "A" ? "1" : "2"}`} />

      {schedules.length === 0 ? (
        <EmptyState icon={Calendar} title="Jadwal Belum Tersedia" description="Jadwal pelajaran untuk kelas ini belum diatur admin." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {DAYS.filter(d => schedules.some(s => s.day === d)).map(day => {
            const blocks = groupConsecutiveSchedules(
              schedules.filter(s => s.day === day),
              s => `${s.subject}__${s.teacherId}`,
            );
            const isToday = day === todayDay;
            return (
              <div key={day} className={`rounded-xl overflow-hidden border min-w-0 ${isToday ? "border-primary-300 ring-1 ring-primary-100" : "border-gray-100"}`}>
                <div className={`px-3 py-2 flex items-center gap-2 text-xs font-semibold ${isToday ? "bg-primary-700 text-white" : "border-b border-gray-100 bg-[#f5f6fa] text-primary-900"}`}>
                  {DAY_LABEL[day]}
                  {isToday && <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded-full">Hari ini</span>}
                </div>
                <div className="divide-y divide-gray-50 bg-white">
                  {blocks.map(b => (
                    <div key={b.first.id} className="px-3 py-2.5 text-xs">
                      <span className="font-mono text-primary-700 font-bold text-xs">{b.first.startTime}–{b.last.endTime}</span>
                      <p className="font-medium text-gray-800 truncate mt-0.5">{b.first.subject}</p>
                      <p className="text-gray-400 truncate">{b.first.teacher?.user.name ?? "—"}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
