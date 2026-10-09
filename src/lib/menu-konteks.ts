import "server-only";
import { PENANDA_PANITIA_PKL, anggotaPanitiaPkl } from "@/lib/pkl-humas";
import { anggotaPanitia, jabatanUntukMenu } from "@/lib/spmb";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getWeekTypeForDate } from "@/lib/schedule-week.server";
import { getOverdueLoanCount } from "@/lib/perpustakaan-notif";
import { bagianWib } from "@/lib/waktu-wib";
import type { SessionPayload } from "@/types";

const HARI = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];

/** KONTEKS MENU (18 September 2026) — keadaan akun yang menentukan menu apa saja yang tampil
 * (jabatan, wali kelas, mengajar, buku terlambat). Dipakai layout portal DAN halaman "Semua Menu"
 * supaya isi sidebar, bottom nav, dan kisi menu tidak pernah berbeda. `cache()` membuat query-nya
 * hanya sekali per request walau dipanggil di dua tempat. */

export const konteksMenuGuru = cache(async (session: SessionPayload) => {
  const [guru, overdueBooks] = await Promise.all([
    prisma.teacher.findFirst({
      where: { user: { email: session.email } },
      select: {
        id: true, userId: true,
        jabatan: { select: { jabatan: { select: { name: true } } } },
        _count: { select: { internshipsSupervised: true, homeroomOf: true, teachingLoad: true } },
      },
    }).catch(() => null),
    getOverdueLoanCount(session.userId).catch(() => 0),
  ]);
  let isGuruPiketOnDutyToday = false;
  if (guru) {
    const hariIni = new Date();
    const weekType = await getWeekTypeForDate(hariIni).catch(() => "SEMUA");
    const duty = await prisma.dutyRoster.findFirst({
      where: { userId: guru.userId, day: HARI[bagianWib(hariIni).hariKe], OR: [{ weekType: "SEMUA" }, { weekType }] },
    }).catch(() => null);
    isGuruPiketOnDutyToday = !!duty;
  }
  return {
    jabatanNames: [...(guru?.jabatan.map(j => j.jabatan.name) ?? []), ...((await anggotaPanitiaPkl().catch(() => [] as string[])).includes(session.userId) ? [PENANDA_PANITIA_PKL] : [])],
    hasInternshipBimbingan: (guru?._count.internshipsSupervised ?? 0) > 0,
    hasHomeroom: (guru?._count.homeroomOf ?? 0) > 0,
    hasTeaching: (guru?._count.teachingLoad ?? 0) > 0,
    isGuruPiketOnDutyToday,
    overdueBooks,
    panitiaSpmb: (await anggotaPanitia().catch(() => [] as string[])).includes(session.userId),
  };
});

export const konteksMenuSiswa = cache(async (session: SessionPayload) => {
  const [siswa, overdueBooks, pendingEdit] = await Promise.all([
    prisma.student.findFirst({
      where: { userId: session.userId },
      select: { ketuaKelasOf: { select: { id: true } }, sekretarisOf: { select: { id: true } }, class: { select: { grade: true } } },
    }).catch(() => null),
    getOverdueLoanCount(session.userId).catch(() => 0),
    prisma.profileEditRequest.findFirst({ where: { status: "PENDING", student: { userId: session.userId } }, select: { id: true } }).catch(() => null),
  ]);
  return {
    isKelasAdmin: !!siswa && (siswa.ketuaKelasOf.length > 0 || siswa.sekretarisOf.length > 0),
    overdueBooks,
    kelasXII: siswa?.class?.grade === 12,
    hasPendingBiodata: !!pendingEdit,
  };
});

export const konteksMenuTas = cache(async (session: SessionPayload) => {
  const jabatan = await prisma.teacher.findFirst({
    where: { user: { email: session.email } },
    select: { jabatan: { select: { jabatan: { select: { name: true } } } } },
  }).catch(() => null);
  const staf = await prisma.staffJabatan.findMany({
    where: { user: { email: session.email } }, select: { jabatan: { select: { name: true } } },
  }).catch(() => []);
  const nama = [...(jabatan?.jabatan.map(j => j.jabatan.name) ?? []), ...staf.map(s => s.jabatan.name)];
  return { jabatanNames: await jabatanUntukMenu([...new Set(nama)], session.userId) };
});

/** MENU CEPAT pilihan akun — dibaca di SERVER supaya kisi menu langsung tampil sesuai aturan
 * pengguna pada render pertama. Dulu hanya di-fetch dari klien sesudah mount, jadi tiap kali
 * halaman dimuat ulang kisi bawaan sempat berkedip dulu sebelum diganti pilihan sendiri
 * (temuan user 18 Sep 2026). `null` = belum pernah diatur → pakai urutan bawaan portal. */
export const menuFavoritAkun = cache(async (session: SessionPayload): Promise<string[] | null> => {
  const baris = await prisma.menuFavorit
    .findUnique({ where: { userId: session.userId }, select: { hrefs: true } })
    .catch(() => null);
  return baris?.hrefs?.length ? baris.hrefs : null;
});
