import "server-only";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { aturanTahapan, denganBayar, PILIH_TAHAPAN, ringkasBayar, setelanBayar } from "@/lib/spmb-tahapan-server";
import { bacaMpls, susunTahapan } from "@/lib/spmb-tahapan";

/** PAKET MPLS (7 Okt 2026) — presensi MPLS memakai modul Kegiatan yang sudah ada (berhari-hari, QR per hari,
 *  CLAUDE.md #100), pesertanya OTOMATIS dari calon yang tuntas seluruh tahapan. Kegiatan hanya bisa menyasar
 *  AKUN, jadi yang ikut adalah calon resmi yang sudah dijadikan siswa (menu Jadi Siswa); sisanya dilaporkan. */
export async function keadaanMpls() {
  const [mentah, aturan, setBayar, s] = await Promise.all([
    prisma.admission.findMany({
      where: { status: { notIn: ["DITOLAK", "REJECTED"] } },
      select: { ...PILIH_TAHAPAN, id: true, nomor: true, fullName: true, chosenMajor: true, studentId: true },
    }),
    aturanTahapan(), setelanBayar(), getSettings(["spmb.mpls", "spmb.mplsKegiatanId"]),
  ]);
  const peta = await ringkasBayar(mentah.map(m => m.id));
  const resmi = mentah.map(m => denganBayar(m, setBayar, peta)).filter(a => susunTahapan(a, aturan).tuntas);
  // Admission hanya menyimpan studentId (tanpa relasi) — akun siswanya diambil sekali untuk semua.
  const siswa = await prisma.student.findMany({
    where: { id: { in: resmi.map(a => a.studentId).filter((x): x is string => !!x) } }, select: { id: true, userId: true },
  });
  const akun = new Map(siswa.map(x => [x.id, x.userId]));
  const pesertaUserIds = resmi.map(a => (a.studentId ? akun.get(a.studentId) : undefined)).filter((x): x is string => !!x);
  const belumSiswa = resmi.filter(a => !a.studentId || !akun.has(a.studentId)).map(a => ({ id: a.id, nomor: a.nomor, nama: a.fullName, jurusan: a.chosenMajor }));
  const kegiatanId = s["spmb.mplsKegiatanId"] || "";
  const kegiatan = kegiatanId
    ? await prisma.kegiatan.findUnique({
        where: { id: kegiatanId },
        select: { id: true, judul: true, mulai: true, selesai: true, sampaiTanggal: true, tempat: true, targetUserIds: true, pembuatNama: true, _count: { select: { presensi: true } } },
      }).catch(() => null)
    : null;
  return {
    mpls: bacaMpls(s["spmb.mpls"]), resmi: resmi.length, pesertaUserIds,
    belumSiswa, kegiatan,
  };
}
