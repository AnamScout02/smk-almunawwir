import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { cakupanIzin, isoTanggal } from "@/lib/izin-siswa";

export const dynamic = "force-dynamic";

/** Daftar pengajuan izin/sakit untuk portal guru/admin. Wali kelas: kelas walinya (boleh memutuskan). Wakasek Kesiswaan & Guru BK:
 * semua kelas (memantau; memutuskan hanya untuk kelas walinya sendiri). `?status=MENUNGGU|SEMUA`. */
export async function GET(req: Request) {
  const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
  const c = await cakupanIzin(session);
  const status = new URL(req.url).searchParams.get("status") ?? "MENUNGGU";
  const daftar = await prisma.izinSiswa.findMany({
    where: {
      ...(status === "SEMUA" ? {} : { status }),
      ...(c.kelas ? { student: { classId: { in: c.kelas } } } : {}),
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 300,
    select: {
      id: true, jenis: true, tanggalMulai: true, tanggalSelesai: true, alasan: true, lampiran: true, status: true,
      namaPengaju: true, namaPemutus: true, diputuskanPada: true, catatanPemutus: true, createdAt: true,
      student: { select: { id: true, nis: true, classId: true, user: { select: { name: true } }, class: { select: { name: true } } } },
    },
  });
  return Response.json({
    bolehSemua: c.ubahKelas === null,
    daftar: daftar.map(d => ({
      id: d.id, jenis: d.jenis, status: d.status, alasan: d.alasan, lampiran: !!d.lampiran,
      tanggalMulai: isoTanggal(d.tanggalMulai), tanggalSelesai: isoTanggal(d.tanggalSelesai),
      namaPengaju: d.namaPengaju, namaPemutus: d.namaPemutus, diputuskanPada: d.diputuskanPada, catatanPemutus: d.catatanPemutus,
      createdAt: d.createdAt, siswa: d.student.user.name, nis: d.student.nis, kelas: d.student.class?.name ?? "-",
      bolehPutuskan: d.status === "MENUNGGU" && (c.ubahKelas === null || (!!d.student.classId && c.ubahKelas.includes(d.student.classId))),
    })),
  });
}
