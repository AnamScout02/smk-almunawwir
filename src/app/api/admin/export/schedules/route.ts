import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { balasanExcel } from "@/lib/ekspor-excel";
import { NextRequest } from "next/server";
import { weekLabel } from "@/lib/schedule-week";

const DAY_ORDER: Record<string, number> = { SENIN: 1, SELASA: 2, RABU: 3, KAMIS: 4, JUMAT: 5, SABTU: 6 };

export async function GET(req: NextRequest) {
  try {
    await verifyTasAccess();

    const classId = req.nextUrl.searchParams.get("classId");
    const weekType = req.nextUrl.searchParams.get("weekType");

    const records = await prisma.schedule.findMany({
      where: { scheduleType: "BLOK", ...(classId ? { classId } : {}), ...(weekType ? { weekType } : {}) },
      include: {
        class: { include: { major: { select: { code: true } } } },
        teacher: { include: { user: { select: { name: true } } } },
      },
    });

    records.sort((a, b) => {
      const classCmp = a.class.name.localeCompare(b.class.name);
      if (classCmp !== 0) return classCmp;
      const dayCmp = (DAY_ORDER[a.day] ?? 99) - (DAY_ORDER[b.day] ?? 99);
      if (dayCmp !== 0) return dayCmp;
      return a.startTime.localeCompare(b.startTime);
    });

    const headers = ["No", "Kelas", "Jurusan", "Minggu", "Hari", "Jam Mulai", "Jam Selesai", "Mata Pelajaran", "Guru Pengampu", "Ruang"];

    const rows = records.map((r, i) => [
      i + 1,
      r.class.name,
      r.class.major.code,
      weekLabel(r.class.grade, r.weekType),
      r.day,
      r.startTime,
      r.endTime,
      r.subject,
      r.teacher?.user.name ?? "—",
      r.room ?? "—",
    ]);

    return balasanExcel({
      namaFile: `jadwal-pelajaran-${new Date().toISOString().slice(0, 10)}`,
      namaSheet: "Jadwal Pelajaran",
      headers, rows,
    });
  } catch {
    return Response.json({ error: "Gagal mengekspor data" }, { status: 500 });
  }
}
