import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { teacherIdDariSesi } from "@/lib/ujian-server";
import { siapkanButir } from "@/lib/soal-butir-server";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

async function milik(session: { role: string; email: string }, id: string) {
  const teacherId = await teacherIdDariSesi(session);
  if (session.role === "TEACHER" && !teacherId) return null;
  return prisma.questionBankItem.findFirst({ where: { id, ...(teacherId ? { teacherId } : {}) } });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const { id } = await params;
    if (!(await milik(session, id))) return Response.json({ error: "Soal tidak ditemukan" }, { status: 404 });
    const body = await req.json();
    const { data, error } = siapkanButir(body);
    if (error) return Response.json({ error }, { status: 400 });
    const item = await prisma.questionBankItem.update({
      where: { id },
      data: {
        tipe: data.tipe, pertanyaan: data.pertanyaan, opsi: data.opsi as object,
        kunci: (data.kunci ?? undefined) as object | undefined, skor: data.skor ?? 1,
        kd: data.kd ?? null, pembahasan: data.pembahasan ?? null, stimulusId: data.stimulusId ?? null,
        materi: data.materi ?? null, indikator: data.indikator ?? null, levelKognitif: data.levelKognitif ?? null,
        ...(body.subject ? { subject: String(body.subject).trim() } : {}),
      },
    });
    return Response.json(item);
  } catch {
    return Response.json({ error: "Gagal memperbarui soal." }, { status: 500 });
  }
}

/** Bagikan / tarik soal dari bank bersama (hanya pemiliknya). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const { id } = await params;
    if (!(await milik(session, id))) return Response.json({ error: "Soal tidak ditemukan" }, { status: 404 });
    const b = await req.json().catch(() => ({}));
    await prisma.questionBankItem.update({ where: { id }, data: { dibagikan: !!b.dibagikan } });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Gagal menyimpan." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const { id } = await params;
    if (!(await milik(session, id))) return Response.json({ error: "Soal tidak ditemukan" }, { status: 404 });
    await prisma.questionBankItem.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Gagal menghapus soal." }, { status: 500 });
  }
}
