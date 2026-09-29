import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { resolveTeacherId } from "@/lib/teacher-context";
import { teacherIdDariSesi } from "@/lib/ujian-server";
import { siapkanButir } from "@/lib/soal-butir-server";
import { NextRequest } from "next/server";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

/** Bank soal: ADMIN/TAS melihat semua, guru hanya miliknya. `?subject=` menyaring per mapel,
 * `?tipe=` per jenis, `?q=` cari teks. */
export async function GET(req: NextRequest) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const sp = new URL(req.url).searchParams;
    const subject = sp.get("subject") || undefined;
    const tipe = sp.get("tipe") || undefined;
    const q = sp.get("q")?.trim() || undefined;
    const teacherId = await teacherIdDariSesi(session);
    if (session.role === "TEACHER" && !teacherId) return Response.json([]);

    // Bank soal bersama (18 Sep 2026): selain miliknya, guru juga melihat soal yang DIBAGIKAN guru lain
    // untuk mapel yang sama-sama diampu — hanya untuk disalin, tidak bisa diubah/dihapus.
    const bersama = sp.get("bersama") === "1";
    let mapelSaya: string[] = [];
    if (teacherId && bersama) {
      const [t, tugas] = await Promise.all([
        prisma.teacher.findUnique({ where: { id: teacherId }, select: { subject: true } }),
        prisma.teachingAssignment.findMany({ where: { teacherId }, select: { subject: { select: { name: true } } }, distinct: ["subjectId"] }),
      ]);
      mapelSaya = [...new Set([t?.subject, ...tugas.map(x => x.subject?.name)].filter((x): x is string => !!x))];
    }
    const items = await prisma.questionBankItem.findMany({
      where: {
        ...(teacherId ? (bersama && mapelSaya.length
          ? { OR: [{ teacherId }, { dibagikan: true, subject: { in: mapelSaya } }] }
          : { teacherId }) : {}),
        ...(subject ? { subject } : {}),
        ...(tipe ? { tipe } : {}),
        ...(q ? { pertanyaan: { contains: q, mode: "insensitive" } } : {}),
      },
      include: { stimulus: { select: { id: true, judul: true } }, teacher: { select: { user: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    return Response.json(items.map(i => ({ ...i, milikSaya: !teacherId || i.teacherId === teacherId })));
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const body = await req.json();
    const subject = String(body.subject ?? "").trim();
    if (!subject) return Response.json({ error: "Mata pelajaran wajib diisi." }, { status: 400 });
    const { data, error } = siapkanButir(body);
    if (error) return Response.json({ error }, { status: 400 });

    const teacherId = await resolveTeacherId(session, { subject });
    if (!teacherId) return Response.json({ error: "Tidak ditemukan guru pengampu mapel ini." }, { status: 400 });

    const item = await prisma.questionBankItem.create({
      data: {
        teacherId, subject, tipe: data.tipe, pertanyaan: data.pertanyaan,
        opsi: data.opsi as object, kunci: (data.kunci ?? undefined) as object | undefined,
        skor: data.skor ?? 1, kd: data.kd ?? null, pembahasan: data.pembahasan ?? null, stimulusId: data.stimulusId ?? null,
        materi: data.materi ?? null, indikator: data.indikator ?? null, levelKognitif: data.levelKognitif ?? null,
      },
    });
    return Response.json(item, { status: 201 });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal menyimpan soal." }, { status: 500 });
  }
}
