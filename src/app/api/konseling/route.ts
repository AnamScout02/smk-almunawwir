import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { peranBk } from "@/lib/bk-akses";
import { segarkanAntrean } from "@/lib/antrean-kerja";
import { userKesiswaanBk } from "@/lib/peringatan-dini";
import { kirimLatar, kirimNotifikasi } from "@/lib/push-server";

export const dynamic = "force-dynamic";

const TOPIK = ["BELAJAR", "PRIBADI", "SOSIAL", "KARIR", "LAINNYA"];
const TUJUAN = ["BK", "WALI_KELAS"];

/** JANJI TEMU KONSELING. GET: siswa = miliknya; wali kelas = rujukannya; BK/Kesiswaan/Admin = semua (+ catatan rahasia). POST: ajukan. */
export async function GET() {
  const session = await verifyRole(["STUDENT", "TEACHER", "ADMIN", "TAS", "PARENT"]);
  const p = await peranBk(session);
  // Orang tua hanya melihat permintaannya sendiri; wali kelas melihat rujukannya + janji temu yang ditujukan kepadanya.
  const where = p.bk ? {}
    : p.siswaId ? { studentId: p.siswaId }
    : p.anak.length ? { pengajuId: session.userId }
    : p.waliKelas.length ? { OR: [{ sumber: "WALI_KELAS", pengajuId: session.userId }, { tujuan: "WALI_KELAS", student: { classId: { in: p.waliKelas } } }] }
    : null;
  if (!where) return Response.json({ error: "Tidak berhak." }, { status: 403 });
  const daftar = await prisma.janjiKonseling.findMany({
    where, orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 300,
    include: { student: { select: { nis: true, user: { select: { name: true } }, class: { select: { name: true } } } } },
  });
  const siswaWali = p.waliKelas.length && !p.bk
    ? await prisma.student.findMany({ where: { classId: { in: p.waliKelas }, studentStatus: "AKTIF" }, select: { id: true, user: { select: { name: true } }, class: { select: { name: true } } }, orderBy: { user: { name: "asc" } } })
    : [];
  return Response.json({
    peran: p.bk ? "BK" : p.siswaId ? "SISWA" : p.anak.length ? "ORTU" : "WALI",
    anak: p.anak,
    siswaWali: siswaWali.map(s => ({ id: s.id, nama: s.user.name, kelas: s.class?.name ?? "-" })),
    daftar: daftar.map(d => ({
      id: d.id, sumber: d.sumber, tujuan: d.tujuan, pengajuNama: d.pengajuNama, topik: d.topik, pesan: d.pesan, waktuUsul: d.waktuUsul, status: d.status,
      jadwal: d.jadwal, tempat: d.tempat, konselorNama: d.konselorNama, createdAt: d.createdAt,
      siswa: d.student.user.name, nis: d.student.nis, kelas: d.student.class?.name ?? "-",
      ...(p.bk ? { catatanKonselor: d.catatanKonselor } : {}),
    })),
  });
}

export async function POST(req: Request) {
  const session = await verifyRole(["STUDENT", "TEACHER", "ADMIN", "PARENT"]);
  const p = await peranBk(session);
  const b = await req.json().catch(() => ({})) as { studentId?: string; topik?: string; pesan?: string; waktuUsul?: string; tujuan?: string };
  const topik = TOPIK.includes(b.topik ?? "") ? b.topik! : "LAINNYA";
  const pesan = (b.pesan ?? "").trim().slice(0, 1500);
  if (pesan.length < 5) return Response.json({ error: "Ceritakan singkat hal yang ingin dibicarakan." }, { status: 400 });
  let studentId: string, sumber: string;
  let tujuan = TUJUAN.includes(b.tujuan ?? "") ? b.tujuan! : "BK";
  if (p.siswaId) { studentId = p.siswaId; sumber = "SISWA"; tujuan = "BK"; }
  else if (p.anak.length) {
    const anak = p.anak.find(a => a.id === b.studentId) ?? (p.anak.length === 1 ? p.anak[0] : null);
    if (!anak) return Response.json({ error: "Pilih anak yang dimaksud." }, { status: 400 });
    studentId = anak.id; sumber = "ORANG_TUA";
  }
  else {
    const s = b.studentId ? await prisma.student.findFirst({ where: { id: b.studentId, ...(session.role === "ADMIN" || p.bk ? {} : { classId: { in: p.waliKelas } }) }, select: { id: true } }) : null;
    if (!s) return Response.json({ error: "Pilih siswa dari kelas wali Anda." }, { status: 403 });
    studentId = s.id; sumber = "WALI_KELAS"; tujuan = "BK";
  }
  const aktif = await prisma.janjiKonseling.count({ where: { studentId, status: { in: ["MENUNGGU", "DIJADWALKAN"] } } });
  if (aktif >= 3) return Response.json({ error: "Masih ada 3 permintaan konseling yang belum selesai untuk siswa ini." }, { status: 409 });
  const j = await prisma.janjiKonseling.create({
    data: { studentId, sumber, tujuan, pengajuId: session.userId, pengajuNama: session.name, topik, pesan, waktuUsul: (b.waktuUsul ?? "").trim().slice(0, 100) || null },
  });
  kirimLatar(async () => {
    // Janji temu yang ditujukan ke wali kelas dikabarkan ke wali kelasnya; selain itu ke Guru BK/Wakasek Kesiswaan.
    let penerima: string[] = [];
    if (tujuan === "WALI_KELAS") {
      const w = await prisma.student.findUnique({ where: { id: studentId }, select: { class: { select: { homeroom: { select: { userId: true } } } } } });
      penerima = w?.class?.homeroom?.userId ? [w.class.homeroom.userId] : [];
    }
    if (!penerima.length) penerima = await userKesiswaanBk();
    await kirimNotifikasi({
      userIds: penerima, jenis: "KONSELING", kunci: `konseling-baru:${j.id}`,
      judul: sumber === "SISWA" ? "Permintaan konseling baru dari siswa" : sumber === "ORANG_TUA" ? "Permintaan janji temu dari orang tua" : "Rujukan konseling dari wali kelas",
      isi: `${session.name} · topik ${topik.toLowerCase()}. Buka untuk menetapkan jadwal.`,
      url: tujuan === "WALI_KELAS" ? "/dashboard/teacher/konseling" : "/dashboard/teacher/konseling", tag: `konseling-${j.id}`,
    });
  });
  segarkanAntrean();
  return Response.json({ ok: true }, { status: 201 });
}
