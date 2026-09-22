import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { aksesPanggilan } from "@/lib/panggilan-akses";
import { poinBersih } from "@/lib/panggilan-ortu";
import { semesterBerjalan } from "@/lib/peringatan-dini";

export const dynamic = "force-dynamic";

/** Daftar & buat panggilan orang tua. GET `?status=AKTIF|SEMUA`. POST (Kesiswaan/BK/Admin) = panggilan manual. */
export async function GET(req: Request) {
  const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
  const akses = await aksesPanggilan(session);
  if (!akses) return Response.json({ error: "Khusus Kesiswaan, BK, dan wali kelas." }, { status: 403 });
  const status = new URL(req.url).searchParams.get("status") ?? "AKTIF";
  const daftar = await prisma.panggilanOrangTua.findMany({
    where: {
      ...(status === "AKTIF" ? { status: { in: ["DRAF", "TERBIT"] } } : {}),
      ...(akses.kelas ? { student: { classId: { in: akses.kelas } } } : {}),
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 300,
    include: { student: { select: { id: true, nis: true, user: { select: { name: true } }, class: { select: { name: true } } } } },
  });
  return Response.json({
    kelola: akses.kelola,
    daftar: daftar.map(p => ({
      id: p.id, tingkat: p.tingkat, poin: p.poin, alasan: p.alasan, status: p.status, otomatis: p.otomatis,
      jadwal: p.jadwal, tempat: p.tempat, keperluan: p.keperluan, suratId: p.suratId, catatan: p.catatan, createdAt: p.createdAt,
      siswa: p.student.user.name, nis: p.student.nis, kelas: p.student.class?.name ?? "-", studentId: p.student.id,
    })),
  });
}

export async function POST(req: Request) {
  const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
  const akses = await aksesPanggilan(session);
  if (!akses?.kelola) return Response.json({ error: "Panggilan manual khusus Kesiswaan/BK." }, { status: 403 });
  const b = await req.json().catch(() => null) as { studentId?: unknown; alasan?: unknown; keperluan?: unknown } | null;
  const studentId = typeof b?.studentId === "string" ? b.studentId : "";
  const alasan = typeof b?.alasan === "string" ? b.alasan.trim().slice(0, 500) : "";
  if (!studentId || alasan.length < 5) return Response.json({ error: "Pilih siswa dan tuliskan alasan pemanggilan." }, { status: 400 });
  const siswa = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true } });
  if (!siswa) return Response.json({ error: "Siswa tidak ditemukan." }, { status: 404 });
  const semester = semesterBerjalan();
  const p = await prisma.panggilanOrangTua.create({
    data: {
      studentId, semester, tingkat: "MANUAL", poin: await poinBersih(studentId, semester), alasan, otomatis: false,
      keperluan: typeof b?.keperluan === "string" && b.keperluan.trim() ? b.keperluan.trim().slice(0, 200) : "Pembinaan siswa",
      dibuatOleh: session.name,
    },
  });
  return Response.json({ ok: true, id: p.id }, { status: 201 });
}
