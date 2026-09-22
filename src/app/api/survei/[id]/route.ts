import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { konteksPenerima, syaratSasaran } from "@/lib/pengumuman";
import { kelasSiswa, penandaRespons } from "@/lib/survei";
import { segarkanAntrean } from "@/lib/antrean-kerja";

export const dynamic = "force-dynamic";

async function ambilUntukResponden(id: string) {
  const session = await verifySession();
  const k = await konteksPenerima(session);
  const sy = syaratSasaran(k);
  const s = await prisma.survei.findFirst({
    where: { id, status: "DIBUKA", targetRole: sy.targetRole, AND: [...sy.AND, { OR: [{ selesai: null }, { selesai: { gte: new Date() } }] }] },
    include: { pertanyaan: { orderBy: { urutan: "asc" } } },
  });
  return { session, s };
}

/** Isi survei untuk responden (+ daftar teman sekelas untuk pertanyaan sosiometri). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, s } = await ambilUntukResponden(id);
  if (!s) return Response.json({ error: "Survei tidak tersedia atau sudah ditutup." }, { status: 404 });
  const sudah = await prisma.surveiRespons.findUnique({ where: { surveiId_penanda: { surveiId: id, penanda: penandaRespons(session.userId, id) } }, select: { id: true } });
  let teman: { id: string; nama: string }[] = [];
  if (s.pertanyaan.some(p => p.tipe === "TEMAN") && session.role === "STUDENT") {
    const saya = await kelasSiswa(session.userId);
    if (saya?.classId) {
      const t = await prisma.student.findMany({ where: { classId: saya.classId, studentStatus: "AKTIF", id: { not: saya.id } }, select: { id: true, user: { select: { name: true } } }, orderBy: { user: { name: "asc" } } });
      teman = t.map(x => ({ id: x.id, nama: x.user.name }));
    }
  }
  return Response.json({
    survei: { id: s.id, judul: s.judul, deskripsi: s.deskripsi, jenis: s.jenis, anonim: s.anonim, selesai: s.selesai, pembuatNama: s.pembuatNama },
    pertanyaan: s.pertanyaan.map(p => ({ id: p.id, teks: p.teks, tipe: p.tipe, opsi: p.opsi, kelompok: p.kelompok, wajib: p.wajib, maksPilih: p.maksPilih })),
    teman, sudahDiisi: !!sudah,
  });
}

/** Kirim jawaban — sekali per akun (penanda), divalidasi per tipe pertanyaan. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, s } = await ambilUntukResponden(id);
  if (!s) return Response.json({ error: "Survei tidak tersedia atau sudah ditutup." }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  const masuk = (b.jawaban ?? {}) as Record<string, unknown>;
  const saya = session.role === "STUDENT" ? await kelasSiswa(session.userId) : null;
  let temanSah = new Set<string>();
  if (s.pertanyaan.some(p => p.tipe === "TEMAN") && saya?.classId) {
    const t = await prisma.student.findMany({ where: { classId: saya.classId, studentStatus: "AKTIF", id: { not: saya.id } }, select: { id: true } });
    temanSah = new Set(t.map(x => x.id));
  }
  const jawaban: Record<string, unknown> = {};
  for (const p of s.pertanyaan) {
    const v = masuk[p.id];
    let nilai: unknown = null;
    if (p.tipe === "PILIHAN" && typeof v === "string" && p.opsi.includes(v)) nilai = v;
    else if (p.tipe === "CENTANG" && Array.isArray(v)) { const a = [...new Set(v.filter((x): x is string => typeof x === "string" && p.opsi.includes(x)))]; nilai = a.length ? a : null; }
    else if (p.tipe === "SKALA") { const n = Math.round(Number(v)); const maks = p.opsi.length || 5; nilai = n >= 1 && n <= maks ? n : null; }
    else if (p.tipe === "TEKS" && typeof v === "string" && v.trim()) nilai = v.trim().slice(0, 1000);
    else if (p.tipe === "TEMAN" && Array.isArray(v)) { const a = [...new Set(v.filter((x): x is string => typeof x === "string" && temanSah.has(x)))].slice(0, p.maksPilih); nilai = a.length ? a : null; }
    if (nilai === null && p.wajib && !(p.tipe === "TEMAN" && temanSah.size === 0)) {
      return Response.json({ error: `Pertanyaan "${p.teks.slice(0, 60)}" wajib dijawab.` }, { status: 400 });
    }
    if (nilai !== null) jawaban[p.id] = nilai;
  }
  try {
    await prisma.surveiRespons.create({
      data: {
        surveiId: id, penanda: penandaRespons(session.userId, id), peran: session.role, jawaban: jawaban as object,
        userId: s.anonim ? null : session.userId,
        studentId: s.anonim ? null : saya?.id ?? null,
        kelasId: s.anonim ? null : saya?.classId ?? null,
      },
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return Response.json({ error: "Anda sudah mengisi survei ini." }, { status: 409 });
    throw e;
  }
  segarkanAntrean(session.userId);
  return Response.json({ ok: true }, { status: 201 });
}
