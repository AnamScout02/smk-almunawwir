export const dynamic = "force-dynamic";

import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { weekTypesOverlap } from "@/lib/schedule-week";
import { Calendar } from "lucide-react";

const DAYS = ["SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
const DAY_LABEL: Record<string, string> = { SENIN: "Senin", SELASA: "Selasa", RABU: "Rabu", KAMIS: "Kamis", JUMAT: "Jumat", SABTU: "Sabtu" };

export default async function TeacherSchedulePage() {
  const session = await verifyRole(["TEACHER", "ADMIN"]);

  const teacher = await prisma.teacher.findFirst({ where: { user: { email: session.email } } });

  // Jadwal BLOK guru ini — kelas X/XI ikut sistem 2 minggu bergantian (weekType A/B), kelas
  // XII tetap (weekType SEMUA, otomatis muncul di kedua minggu via weekTypesOverlap). Kedua
  // minggu ditampilkan sekaligus terpisah per hari, tidak perlu toggle.
  const allSchedules = teacher
    ? await prisma.schedule.findMany({
        where: { teacherId: teacher.id, scheduleType: "BLOK" },
        include: { class: { include: { major: true } } },
        orderBy: [{ day: "asc" }, { startTime: "asc" }],
      })
    : [];

  const totalHours = allSchedules.length;
  const classNames = [...new Set(allSchedules.map(s => s.class.name))].sort();

  function weekSection(weekType: "A" | "B", label: string) {
    const schedules = allSchedules.filter(s => weekTypesOverlap(s.weekType, weekType));
    const byDay = DAYS.reduce<Record<string, typeof schedules>>((acc, d) => {
      acc[d] = schedules.filter(s => s.day === d);
      return acc;
    }, {} as Record<string, typeof schedules>);

    return (
      <div>
        <h2 className="font-heading text-sm font-bold text-primary-900 mb-3 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-primary-700 text-white flex items-center justify-center text-[11px]">{weekType === "A" ? "1" : "2"}</span>
          {label}
        </h2>
        {schedules.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center text-xs text-gray-400">
            Belum ada jadwal di minggu ini.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {DAYS.filter(d => byDay[d].length > 0).map(day => (
              <div key={day} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 bg-primary-900 text-white text-sm font-bold">{DAY_LABEL[day]}</div>
                <div className="divide-y divide-gray-50">
                  {byDay[day].map(s => (
                    <div key={s.id} className="px-4 py-2.5 text-xs">
                      <p className="font-mono text-gray-400">{s.startTime}–{s.endTime}</p>
                      <p className="font-semibold text-gray-800">{s.subject}</p>
                      <p className="text-gray-500">{s.class.name} · {s.class.major.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-11 h-11 rounded-2xl bg-primary-900 text-white flex items-center justify-center">
          <Calendar size={20} />
        </div>
        <div>
          <h1 className="font-heading text-xl font-bold text-primary-900">Jadwal Mengajar Saya</h1>
          <p className="text-sm text-gray-500">{totalHours} jam pelajaran · {classNames.length} kelas ({classNames.join(", ") || "belum ada"})</p>
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-6">
        Kelas X &amp; XI memakai jadwal blok (bergantian Minggu 1/2, jam digandakan) — ditampilkan terpisah per minggu di bawah. Kelas XII tetap sama, muncul di kedua minggu.
      </p>

      <div className="space-y-8">
        {weekSection("A", "Minggu 1")}
        {weekSection("B", "Minggu 2")}
      </div>
    </div>
  );
}
