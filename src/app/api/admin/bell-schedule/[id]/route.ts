import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyTasAccess();
    const { id } = await params;
    const body = await req.json();
    const { label, time, days, audioUrl, active } = body as {
      label?: string; time?: string; days?: string[]; audioUrl?: string | null; active?: boolean;
    };
    if (time && !/^\d{2}:\d{2}$/.test(time)) return Response.json({ error: "Format waktu tidak valid (HH:mm)." }, { status: 400 });

    const updated = await prisma.bellSchedule.update({
      where: { id },
      data: {
        ...(label?.trim() ? { label: label.trim() } : {}),
        ...(time ? { time } : {}),
        ...(days && days.length > 0 ? { days: days.join(",") } : {}),
        ...(audioUrl !== undefined ? { audioUrl: audioUrl?.trim() || null } : {}),
        ...(active !== undefined ? { active } : {}),
      },
    });
    return Response.json(updated);
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Khusus staf Tata Usaha." }, { status: 403 });
    return Response.json({ error: "Gagal menyimpan perubahan" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyTasAccess();
    const { id } = await params;
    await prisma.bellSchedule.delete({ where: { id } });
    return Response.json({ success: true });
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Khusus staf Tata Usaha." }, { status: 403 });
    return Response.json({ error: "Gagal menghapus" }, { status: 500 });
  }
}
