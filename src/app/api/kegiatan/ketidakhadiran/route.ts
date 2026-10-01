import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { ketidakhadiranKegiatan } from "@/lib/kegiatan-tidak-hadir";
import { hakKegiatan } from "@/lib/kegiatan-qr";
import { KESISWAAN_BK_JABATAN } from "@/lib/kesiswaan-guard";
import { getJabatanNames } from "@/lib/jabatan-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

/** Siapa yang belum/tidak ikut kegiatan yang sudah lewat.
 *
 *  Cakupannya BERTINGKAT dan dibatasi di SERVER:
 *  - SISWA  → hanya dirinya sendiri.
 *  - Guru   → kelas walinya; Kesiswaan/BK & pemegang hak pengumuman → semua.
 *  - Admin/TAS → semua.
 *  Tanpa pembatasan ini, daftar "siapa bolos" seluruh sekolah terbuka untuk guru mana pun. */
export async function GET(req: Request) {
  try {
    const session = await verifySession();
    const sp = new URL(req.url).searchParams;
    const sejakHari = Math.min(365, Math.max(7, Number(sp.get("hari") ?? 120) || 120));

    if (session.role === "STUDENT") {
      const hasil = await ketidakhadiranKegiatan({ userIds: [session.userId], sejakHari });
      return Response.json({ cakupan: "SAYA", daftar: hasil });
    }
    if (session.role === "PARENT") {
      const anak = await prisma.parentStudent.findMany({
        where: { parent: { userId: session.userId } },
        select: { student: { select: { userId: true } } },
      });
      const ids = anak.map(a => a.student.userId);
      const hasil = ids.length ? await ketidakhadiranKegiatan({ userIds: ids, sejakHari }) : [];
      return Response.json({ cakupan: "ANAK", daftar: hasil });
    }

    const hak = await hakKegiatan(session);
    const jabatan = session.role === "ADMIN" ? [] : await getJabatanNames(session.email).catch(() => []);
    const semua = session.role === "ADMIN" || session.role === "TAS" || hak.semua
      || KESISWAAN_BK_JABATAN.some(j => jabatan.includes(j));

    if (semua) {
      const kelasId = sp.get("kelasId") ?? "";
      let userIds: string[] | undefined;
      if (kelasId) {
        const siswa = await prisma.student.findMany({ where: { classId: kelasId, studentStatus: "AKTIF" }, select: { userId: true } });
        userIds = siswa.map(s => s.userId);
      }
      return Response.json({ cakupan: "SEMUA", daftar: await ketidakhadiranKegiatan({ userIds, sejakHari }) });
    }

    const kelasWali = hak.waliKelas.map(k => k.id);
    if (!kelasWali.length) return Response.json({ error: "Khusus wali kelas, Kesiswaan/BK, dan Admin." }, { status: 403 });
    const siswa = await prisma.student.findMany({
      where: { classId: { in: kelasWali }, studentStatus: "AKTIF" }, select: { userId: true },
    });
    return Response.json({
      cakupan: "WALI",
      daftar: await ketidakhadiranKegiatan({ userIds: siswa.map(s => s.userId), sejakHari }),
    });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal memuat ketidakhadiran kegiatan." }, { status: 500 });
  }
}
