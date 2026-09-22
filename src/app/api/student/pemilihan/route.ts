import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { statusEfektif } from "@/lib/osis-guard";

export const dynamic = "force-dynamic";

async function siswa(email: string) {
  return prisma.student.findFirst({ where: { user: { email }, studentStatus: "AKTIF" }, select: { id: true, classId: true } });
}

/** Pemilihan OSIS untuk SISWA: GET = pemilihan yang sedang/akan berlangsung & status sudah memilih; POST = memilih sekali. */
export async function GET() {
  const session = await verifyRole(["STUDENT"]);
  const s = await siswa(session.email);
  if (!s) return Response.json([]);
  const daftar = await prisma.pemilihanOsis.findMany({
    where: { status: { in: ["BUKA", "TUTUP"] }, selesai: { gte: new Date(Date.now() - 7 * 86400000) } },
    include: { calon: { orderBy: { nomor: "asc" }, select: { id: true, nomor: true, ketua: true, wakil: true, kelas: true, foto: true, visi: true, misi: true } } },
    orderBy: { mulai: "desc" },
  });
  const boleh = daftar.filter(p => !p.kelasIds.length || (s.classId && p.kelasIds.includes(s.classId)));
  const sudah = await prisma.pemilihOsis.findMany({ where: { studentId: s.id, pemilihanId: { in: boleh.map(p => p.id) } }, select: { pemilihanId: true, waktu: true } });
  return Response.json(boleh.map(p => ({
    id: p.id, judul: p.judul, mulai: p.mulai, selesai: p.selesai, status: statusEfektif(p), calon: p.calon,
    sudahMemilih: sudah.find(x => x.pemilihanId === p.id)?.waktu ?? null,
  })));
}

export async function POST(req: Request) {
  const session = await verifyRole(["STUDENT"]);
  const s = await siswa(session.email);
  if (!s) return Response.json({ error: "Akun siswa aktif tidak ditemukan." }, { status: 403 });
  const b = await req.json().catch(() => ({})) as { pemilihanId?: string; calonId?: string };
  const p = await prisma.pemilihanOsis.findUnique({ where: { id: b.pemilihanId ?? "" }, include: { calon: { select: { id: true } } } });
  if (!p || statusEfektif(p) !== "BUKA") return Response.json({ error: "Pemilihan tidak sedang dibuka." }, { status: 409 });
  if (p.kelasIds.length && !(s.classId && p.kelasIds.includes(s.classId))) return Response.json({ error: "Kelasmu tidak termasuk pemilih." }, { status: 403 });
  if (!p.calon.some(c => c.id === b.calonId)) return Response.json({ error: "Calon tidak dikenal." }, { status: 400 });
  try {
    // Satu transaksi: catat SIAPA memilih (unik) dan tambahkan suara TANPA kaitan ke pemilih.
    await prisma.$transaction([
      prisma.pemilihOsis.create({ data: { pemilihanId: p.id, studentId: s.id, classId: s.classId } }),
      prisma.suaraOsis.create({ data: { pemilihanId: p.id, calonId: b.calonId! } }),
    ]);
  } catch {
    return Response.json({ error: "Kamu sudah memilih pada pemilihan ini." }, { status: 409 });
  }
  return Response.json({ ok: true });
}
