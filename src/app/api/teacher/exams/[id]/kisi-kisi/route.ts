import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { ujianDalamCakupan } from "@/lib/ujian-server";
import { kisiLengkap, rapikanLevel } from "@/lib/kisi-kisi";

export const dynamic = "force-dynamic";

const teks = (v: unknown, maks: number) => String(v ?? "").trim().slice(0, maks) || null;

/** Simpan kolom kisi-kisi (KD, materi, indikator, level kognitif) banyak butir sekaligus. HANYA kolom itu yang
 * diubah — sengaja tidak lewat PUT ujian (yang menghapus & membuat ulang soal, dan terkunci begitu ujian dikerjakan),
 * jadi kisi-kisi tetap bisa dilengkapi setelah ujian berjalan tanpa menyentuh jawaban/penilaian. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const { id } = await params;
    if (!(await ujianDalamCakupan(session, id, { ubah: true }))) {
      return (await ujianDalamCakupan(session, id))
        ? Response.json({ error: "Kisi-kisi hanya bisa diubah guru pembuat ujian atau Admin/Kurikulum." }, { status: 403 })
        : Response.json({ error: "Ujian tidak ditemukan." }, { status: 404 });
    }
    const body = await req.json().catch(() => ({}));
    const butir: Record<string, unknown>[] = Array.isArray(body.butir) ? body.butir : [];
    const sah = new Set((await prisma.examQuestion.findMany({ where: { examId: id }, select: { id: true } })).map(s => s.id));
    const ubah = butir.filter(b => sah.has(String(b?.id ?? "")));
    if (!ubah.length) return Response.json({ error: "Tidak ada butir soal yang cocok dengan ujian ini." }, { status: 400 });

    await prisma.$transaction(ubah.map(b => prisma.examQuestion.update({
      where: { id: String(b.id) },
      data: { kd: teks(b.kd, 40), materi: teks(b.materi, 200), indikator: teks(b.indikator, 500), levelKognitif: rapikanLevel(b.levelKognitif) },
    })));
    const semua = await prisma.examQuestion.findMany({ where: { examId: id }, select: { kd: true, materi: true, indikator: true, levelKognitif: true } });
    return Response.json({ ok: true, disimpan: ubah.length, lengkap: semua.filter(kisiLengkap).length, total: semua.length });
  } catch {
    return Response.json({ error: "Gagal menyimpan kisi-kisi." }, { status: 500 });
  }
}
