import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { getSettings } from "@/lib/site-settings";
import { isOnDutyToday } from "@/lib/kedisiplinan-guard";
import { hariIniWib, tokenStasiun } from "@/lib/absensi-qr";
import { logActivity } from "@/lib/activity-log";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

type Sesi = Awaited<ReturnType<typeof verifyRole>>;

/** Stasiun yang boleh ditampilkan pengguna ini: ADMIN/TAS & petugas piket hari ini → gerbang + semua kelas;
 * wali kelas → kelas walinya. */
async function aksesStasiun(session: Sesi) {
  const kelas = await prisma.class.findMany({ select: { id: true, name: true, homeroom: { select: { user: { select: { email: true } } } } }, orderBy: { name: "asc" } });
  if (session.role === "ADMIN" || session.role === "TAS" || (session.role === "TEACHER" && await isOnDutyToday(session.email))) {
    return { gerbang: true, kelas: kelas.map(k => ({ id: k.id, name: k.name })) };
  }
  return { gerbang: false, kelas: kelas.filter(k => k.homeroom?.user.email === session.email).map(k => ({ id: k.id, name: k.name })) };
}

/** Layar QR Absen Mandiri (kiosk). `?daftar=1` → stasiun yang boleh dibuka + pengaturan jam. `?stasiun=` → token
 * terbaru + rekap hari ini untuk cakupan stasiun itu. */
export async function GET(req: NextRequest) {
  let session: Sesi;
  try {
    session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const akses = await aksesStasiun(session);
  const sp = new URL(req.url).searchParams;
  const s = await getSettings(["absensiQr.jamBuka", "absensiQr.jamTutup"]);

  if (sp.get("daftar")) {
    if (!akses.gerbang && !akses.kelas.length) return Response.json({ error: "Khusus TU, petugas piket hari ini, dan wali kelas." }, { status: 403 });
    return Response.json({ ...akses, jamBuka: s["absensiQr.jamBuka"], jamTutup: s["absensiQr.jamTutup"], bolehAtur: session.role === "ADMIN" || session.role === "TAS" });
  }

  const stasiun = sp.get("stasiun") ?? "";
  const kelasStasiun = akses.kelas.find(k => k.id === stasiun);
  if (!(stasiun === "GERBANG" ? akses.gerbang : kelasStasiun)) return Response.json({ error: "Anda tidak berhak membuka stasiun ini." }, { status: 403 });

  const h = hariIniWib();
  const cakupan = stasiun === "GERBANG" ? {} : { classId: stasiun };
  const [totalSiswa, hadir, pindai, perangkatGanda] = await Promise.all([
    prisma.student.count({ where: { studentStatus: "AKTIF", ...cakupan } }),
    prisma.attendance.count({ where: { date: { gte: h.awal, lt: h.akhir }, status: "HADIR", student: { studentStatus: "AKTIF", ...cakupan } } }),
    prisma.absensiPindaiLog.findMany({
      where: { tanggal: h.awal, hasil: { in: ["DIBUAT", "SUDAH_ADA"] }, ...(stasiun === "GERBANG" ? {} : { student: { classId: stasiun } }) },
      orderBy: { createdAt: "desc" }, take: 8,
      select: { id: true, metode: true, hasil: true, createdAt: true, student: { select: { user: { select: { name: true } }, class: { select: { name: true } } } } },
    }),
    prisma.absensiPindaiLog.groupBy({
      by: ["perangkatId"], where: { tanggal: h.awal, hasil: "DIBUAT", metode: "QR_MANDIRI", perangkatId: { not: null } },
      _count: { studentId: true }, having: { studentId: { _count: { gt: 1 } } },
    }),
  ]);
  return Response.json({
    token: tokenStasiun(stasiun),
    stasiunLabel: stasiun === "GERBANG" ? "Gerbang Sekolah" : `Kelas ${kelasStasiun!.name}`,
    jamBuka: s["absensiQr.jamBuka"], jamTutup: s["absensiQr.jamTutup"],
    rekap: { totalSiswa, hadir },
    // Nama LENGKAP (keputusan user 18 Sep 2026) — petugas gerbang harus bisa memastikan siapa yang barusan
    // memindai; nama yang dipenggal ("M.") justru menyulitkan.
    pindaiTerakhir: pindai.map(p => ({
      id: p.id, nama: p.student.user.name, kelas: p.student.class?.name ?? "-", metode: p.metode, hasil: p.hasil,
      jam: p.createdAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }),
    })),
    indikasiTitip: perangkatGanda.length,
  });
}

/** Ubah jam buka/tutup absen mandiri (ADMIN/TAS). */
export async function PUT(req: NextRequest) {
  let session: Sesi;
  try {
    session = await verifyRole(["ADMIN", "TAS"]);
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { jamBuka, jamTutup } = (await req.json().catch(() => ({}))) as { jamBuka?: string; jamTutup?: string };
  const JAM = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!JAM.test(jamBuka ?? "") || !JAM.test(jamTutup ?? "") || (jamBuka as string) >= (jamTutup as string)) {
    return Response.json({ error: "Isi jam JJ:MM dan jam buka harus sebelum jam tutup." }, { status: 400 });
  }
  await prisma.$transaction([
    prisma.siteSetting.upsert({ where: { key: "absensiQr.jamBuka" }, update: { value: jamBuka! }, create: { key: "absensiQr.jamBuka", value: jamBuka! } }),
    prisma.siteSetting.upsert({ where: { key: "absensiQr.jamTutup" }, update: { value: jamTutup! }, create: { key: "absensiQr.jamTutup", value: jamTutup! } }),
  ]);
  await logActivity(session, { action: "UBAH_JAM_ABSEN_MANDIRI", entity: "SiteSetting", entityId: "absensiQr", description: `${session.name} mengubah jam absen mandiri QR menjadi ${jamBuka}–${jamTutup}` });
  return Response.json({ ok: true });
}
