import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { peranBk } from "@/lib/bk-akses";
import { segarkanAntrean } from "@/lib/antrean-kerja";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const KATEGORI = ["SARANA", "PEMBELAJARAN", "KEGIATAN", "PERUNDUNGAN", "LAINNYA"];

/** KOTAK ASPIRASI. GET: BK/Kesiswaan/Admin = semua (nama pengirim hanya bila tidak anonim); siswa = miliknya yang tidak anonim.
 * POST (siswa): kirim, boleh anonim — anonim berarti TIDAK ada kaitan ke akun sama sekali. Dibatasi 5 kiriman/jam per akun. */
export async function GET() {
  const session = await verifyRole(["STUDENT", "TEACHER", "ADMIN", "TAS"]);
  const p = await peranBk(session);
  if (!p.bk && !p.siswaId) return Response.json({ error: "Tidak berhak." }, { status: 403 });
  const daftar = await prisma.aspirasiSiswa.findMany({
    where: p.bk ? {} : { studentId: p.siswaId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 300,
    include: { student: { select: { user: { select: { name: true } }, class: { select: { name: true } } } } },
  });
  return Response.json({
    peran: p.bk ? "BK" : "SISWA",
    daftar: daftar.map(a => ({
      id: a.id, kategori: a.kategori, isi: a.isi, status: a.status, tanggapan: a.tanggapan, createdAt: a.createdAt,
      pengirim: a.student ? `${a.student.user.name} (${a.student.class?.name ?? "-"})` : "Anonim",
    })),
  });
}

export async function POST(req: Request) {
  const session = await verifyRole(["STUDENT"]);
  const p = await peranBk(session);
  if (!p.siswaId) return Response.json({ error: "Akun siswa tidak ditemukan." }, { status: 403 });
  if (!checkRateLimit(`aspirasi:${session.userId}`, 5, 3600_000)) return Response.json({ error: "Batas 5 aspirasi per jam — coba lagi nanti." }, { status: 429 });
  const b = await req.json().catch(() => ({})) as { kategori?: string; isi?: string; anonim?: boolean };
  const isi = (b.isi ?? "").trim().slice(0, 2000);
  if (isi.length < 10) return Response.json({ error: "Tuliskan aspirasi minimal 10 huruf." }, { status: 400 });
  await prisma.aspirasiSiswa.create({ data: { studentId: b.anonim ? null : p.siswaId, kategori: KATEGORI.includes(b.kategori ?? "") ? b.kategori! : "LAINNYA", isi } });
  segarkanAntrean();
  return Response.json({ ok: true }, { status: 201 });
}
