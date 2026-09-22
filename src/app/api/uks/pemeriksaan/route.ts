import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertUks } from "@/lib/uks-guard";
import { hitungGizi } from "@/lib/uks-akses";

export const dynamic = "force-dynamic";

/** PEMERIKSAAN KESEHATAN BERKALA (Kepala UKS & Admin). GET ?classId= : siswa kelas + pemeriksaan terakhir. */
export async function GET(req: Request) {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  try { await assertUks(session); } catch { return Response.json({ error: "Khusus Kepala UKS." }, { status: 403 }); }
  const classId = new URL(req.url).searchParams.get("classId");
  const [kelas, rekap] = await Promise.all([
    prisma.class.findMany({ select: { id: true, name: true }, orderBy: [{ grade: "asc" }, { name: "asc" }] }),
    prisma.pemeriksaanKesehatan.groupBy({ by: ["statusGizi"], where: { tanggal: { gte: new Date(Date.now() - 365 * 86400000) } }, _count: { _all: true } }),
  ]);
  if (!classId) return Response.json({ kelas, rekap });
  const siswa = await prisma.student.findMany({ where: { classId, studentStatus: "AKTIF" }, select: { id: true, nis: true, gender: true, user: { select: { name: true } } }, orderBy: { user: { name: "asc" } } });
  const periksa = await prisma.pemeriksaanKesehatan.findMany({ where: { studentId: { in: siswa.map(s => s.id) } }, orderBy: { tanggal: "desc" } });
  const terakhir = new Map<string, typeof periksa[number]>();
  for (const p of periksa) if (!terakhir.has(p.studentId)) terakhir.set(p.studentId, p);
  return Response.json({ kelas, rekap, siswa: siswa.map(s => ({ id: s.id, nama: s.user.name, nis: s.nis, jk: s.gender, terakhir: terakhir.get(s.id) ?? null })) });
}

/** Simpan banyak pemeriksaan sekaligus: {tanggal, baris: [{studentId, tinggiCm, beratKg, tensi, penglihatan, catatan}]}. */
export async function POST(req: Request) {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  try { await assertUks(session); } catch { return Response.json({ error: "Khusus Kepala UKS." }, { status: 403 }); }
  const b = await req.json().catch(() => ({}));
  const tanggal = new Date(b.tanggal);
  if (isNaN(tanggal.getTime())) return Response.json({ error: "Tanggal tidak valid." }, { status: 400 });
  const angka = (v: unknown) => (v === "" || v == null ? null : Number.isFinite(Number(v)) ? Number(v) : null);
  const baris = (Array.isArray(b.baris) ? b.baris : []).slice(0, 60)
    .map((x: Record<string, unknown>) => ({ studentId: String(x.studentId ?? ""), tinggiCm: angka(x.tinggiCm), beratKg: angka(x.beratKg), tensi: String(x.tensi ?? "").trim().slice(0, 20) || null, penglihatan: String(x.penglihatan ?? "").trim().slice(0, 50) || null, catatan: String(x.catatan ?? "").trim().slice(0, 300) || null }))
    .filter((x: { studentId: string; tinggiCm: number | null; beratKg: number | null; tensi: string | null }) => x.studentId && (x.tinggiCm || x.beratKg || x.tensi));
  if (!baris.length) return Response.json({ error: "Belum ada hasil pemeriksaan yang diisi." }, { status: 400 });
  const sah = new Set((await prisma.student.findMany({ where: { id: { in: baris.map((x: { studentId: string }) => x.studentId) } }, select: { id: true } })).map(s => s.id));
  const data = baris.filter((x: { studentId: string }) => sah.has(x.studentId)).map((x: { studentId: string; tinggiCm: number | null; beratKg: number | null; tensi: string | null; penglihatan: string | null; catatan: string | null }) => {
    const g = hitungGizi(x.tinggiCm, x.beratKg);
    return { ...x, tanggal, imt: g.imt, statusGizi: g.status, olehNama: session.name };
  });
  await prisma.pemeriksaanKesehatan.createMany({ data });
  return Response.json({ ok: true, jumlah: data.length }, { status: 201 });
}
