import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { assertEvent } from "@/lib/event-guard";
import { susunEvent } from "@/lib/event-server";
import { logActivity } from "@/lib/activity-log";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

/** Daftar event yang dikelola + pilihan jurusan untuk sasaran. */
export async function GET() {
  try {
    const session = await verifySession();
    await assertEvent(session);
    const [daftar, jurusan] = await Promise.all([
      prisma.event.findMany({
        orderBy: [{ aktif: "desc" }, { tutupDaftar: "asc" }, { createdAt: "desc" }],
        take: 200,
        include: { _count: { select: { pendaftaran: true } } },
      }),
      prisma.major.findMany({ select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }).catch(() => []),
    ]);
    return Response.json({
      jurusan: jurusan.map(j => ({ id: j.id, name: `${j.code} — ${j.name}` })),
      daftar: daftar.map(({ _count, ...e }) => ({ ...e, jumlahDaftar: _count.pendaftaran })),
    });
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Khusus Humas, Publikasi, Kesiswaan, dan Pembina OSIS." }, { status: 403 });
    return Response.json({ error: "Gagal memuat event." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await verifySession();
    await assertEvent(session);
    const b = await req.json().catch(() => ({}));
    const hasil = await susunEvent(b);
    if ("galat" in hasil) return Response.json({ error: hasil.galat }, { status: 400 });
    const e = await prisma.event.create({
      data: { ...hasil.data, pembuatId: session.userId, pembuatNama: session.name },
      select: { id: true, slug: true },
    });
    await logActivity(session, { action: "CREATE", entity: "Event", entityId: e.id, description: `Membuat event ${hasil.data.judul}` }).catch(() => {});
    return Response.json({ id: e.id, slug: e.slug }, { status: 201 });
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Tidak berhak." }, { status: 403 });
    return Response.json({ error: "Gagal menyimpan event." }, { status: 500 });
  }
}
