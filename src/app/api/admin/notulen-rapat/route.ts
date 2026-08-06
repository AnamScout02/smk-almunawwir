import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";

export async function GET() {
  try {
    await verifyTasAccess();
    const meetings = await prisma.meetingMinutes.findMany({
      include: { attendees: { orderBy: { order: "asc" } } },
      orderBy: { date: "desc" },
    });
    return Response.json(meetings);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

interface AttendeeInput { name: string }

export async function POST(req: Request) {
  try {
    await verifyTasAccess();
    const body = await req.json();
    const { date, time, place, leader, topic, openedBy, greetings, decisions, notulis, photos, attendees } = body;
    if (!date) return Response.json({ error: "Tanggal rapat wajib diisi." }, { status: 400 });

    const meeting = await prisma.meetingMinutes.create({
      data: {
        date: new Date(date), time: time || null, place: place || null, leader: leader || null, topic: topic || null,
        openedBy: openedBy || null, greetings: Array.isArray(greetings) ? greetings.filter((g: string) => g?.trim()) : [],
        decisions: decisions || null, notulis: notulis || null, photos: Array.isArray(photos) ? photos : [],
        attendees: {
          create: ((attendees ?? []) as AttendeeInput[])
            .filter(a => a.name?.trim())
            .map((a, i) => ({ name: a.name.trim(), order: i })),
        },
      },
      include: { attendees: { orderBy: { order: "asc" } } },
    });
    return Response.json(meeting, { status: 201 });
  } catch {
    return Response.json({ error: "Gagal menyimpan notulen rapat." }, { status: 500 });
  }
}
