import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";

interface AttendeeInput { name: string }

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyTasAccess();
    const { id } = await params;
    const meeting = await prisma.meetingMinutes.findUnique({ where: { id }, include: { attendees: { orderBy: { order: "asc" } } } });
    if (!meeting) return Response.json({ error: "Notulen tidak ditemukan" }, { status: 404 });
    return Response.json(meeting);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyTasAccess();
    const { id } = await params;
    const body = await req.json();
    const { date, time, place, leader, topic, openedBy, greetings, decisions, notulis, photos, attendees } = body;
    if (!date) return Response.json({ error: "Tanggal rapat wajib diisi." }, { status: 400 });

    await prisma.$transaction(async (tx) => {
      await tx.meetingAttendee.deleteMany({ where: { meetingId: id } });
      await tx.meetingMinutes.update({
        where: { id },
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
      });
    });

    const meeting = await prisma.meetingMinutes.findUnique({ where: { id }, include: { attendees: { orderBy: { order: "asc" } } } });
    return Response.json(meeting);
  } catch {
    return Response.json({ error: "Gagal mengupdate notulen rapat." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyTasAccess();
    const { id } = await params;
    await prisma.meetingMinutes.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Gagal menghapus notulen rapat." }, { status: 500 });
  }
}
