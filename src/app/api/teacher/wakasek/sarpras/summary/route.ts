import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertJabatan } from "@/lib/jabatan-guard";
import { weekTypesOverlap } from "@/lib/schedule-week";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

function timeOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
  return s1 < e2 && s2 < e1;
}

export async function GET() {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    await assertJabatan(session, ["Wakil Kepala Sarana Prasarana"]);

    const schedules = await prisma.schedule.findMany({
      // scheduleType: "BLOK" saja — "NONBLOK" itu dataset terpisah khusus upload Dapodik (lihat
      // CLAUDE.md), bukan penggunaan ruangan nyata. Tanpa filter ini, deteksi bentrok ruangan
      // salah nuduh "bentrok" padahal itu cuma 2 dataset independen numpuk di jam yang sama.
      where: { scheduleType: "BLOK" },
      select: {
        id: true, room: true, day: true, startTime: true, endTime: true, weekType: true,
        classId: true, class: { select: { name: true } },
      },
    });

    const withRoom = schedules.filter(s => s.room && s.room.trim());
    const withoutRoomCount = schedules.length - withRoom.length;

    const byRoom = new Map<string, number>();
    for (const s of withRoom) {
      byRoom.set(s.room!, (byRoom.get(s.room!) ?? 0) + 1);
    }
    const roomUtilization = Array.from(byRoom.entries())
      .map(([room, count]) => ({ room, count }))
      .sort((a, b) => b.count - a.count);

    const conflicts: { room: string; day: string; time: string; classA: string; classB: string }[] = [];
    const byRoomDay = new Map<string, typeof withRoom>();
    for (const s of withRoom) {
      const key = `${s.room}::${s.day}`;
      const arr = byRoomDay.get(key) ?? [];
      arr.push(s);
      byRoomDay.set(key, arr);
    }
    for (const arr of byRoomDay.values()) {
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const a = arr[i], b = arr[j];
          if (a.classId === b.classId) continue;
          if (!timeOverlap(a.startTime, a.endTime, b.startTime, b.endTime)) continue;
          if (!weekTypesOverlap(a.weekType, b.weekType)) continue;
          conflicts.push({
            room: a.room!, day: a.day,
            time: `${a.startTime}-${a.endTime} / ${b.startTime}-${b.endTime}`,
            classA: a.class.name, classB: b.class.name,
          });
        }
      }
    }

    return Response.json({
      totalRooms: byRoom.size, withoutRoomCount, conflictCount: conflicts.length,
      roomUtilization, conflicts,
    });
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return Response.json({ error: "Khusus Wakil Kepala Sarana Prasarana." }, { status: 403 });
    }
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
