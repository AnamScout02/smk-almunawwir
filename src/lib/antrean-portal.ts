import "server-only";
import { hitungPengajuanBiodata } from "@/lib/biodata-pegawai";
import { JAM_BATAS_BUKTI } from "@/lib/izin-keluar";
import { prisma } from "@/lib/prisma";
import { getOverdueLoanCount } from "@/lib/perpustakaan-notif";
import { getClassesMissingAttendance } from "@/lib/attendance-gaps";
import { jumlahBelumKonfirmasi } from "@/lib/pengumuman";
import { jumlahSurveiBelumDiisi } from "@/lib/survei";
import { antreanGuru } from "@/lib/antrean-kerja";
import { konteksMenuGuru } from "@/lib/menu-konteks";
import type { SessionPayload } from "@/types";

export interface ButirAntrean { label: string; count: number; href: string }

/** ANTREAN "PERLU TINDAKAN" PER PERAN (18 September 2026) — satu sumber untuk lencana notifikasi
 * DAN halaman Pusat Notifikasi (/notifikasi). Sebelumnya daftar ini dirakit terpisah di tiap
 * layout portal sehingga halaman lain tidak bisa memakainya. */
export async function antreanPortal(session: SessionPayload): Promise<ButirAntrean[]> {
  const pakai = (butir: ButirAntrean[]) => butir.filter(b => b.count > 0);

  if (session.role === "STUDENT" || session.role === "PARENT") {
    const basis = session.role === "STUDENT" ? "/dashboard/student" : "/dashboard/parent";
    const [belumBaca, belumSurvei, buktiIzinKeluar] = await Promise.all([
      jumlahBelumKonfirmasi(session).catch(() => 0),
      jumlahSurveiBelumDiisi(session).catch(() => 0),
      // Bukti foto izin keluar hanya kewajiban SISWA yang keluar, bukan orang tuanya.
      session.role === "STUDENT"
        ? prisma.izinKeluarSiswa.count({
            where: {
              student: { user: { email: session.email } }, perluFoto: true, buktiFoto: null,
              keluarPada: { gte: new Date(Date.now() - JAM_BATAS_BUKTI * 3600_000) },
            },
          }).catch(() => 0)
        : Promise.resolve(0),
    ]);
    return pakai([
      { label: "Bukti foto izin keluar belum diunggah", count: buktiIzinKeluar, href: `${basis}/izin-keluar` },
      { label: "Pengumuman perlu dikonfirmasi dibaca", count: belumBaca, href: `${basis}/pengumuman` },
      { label: "Survei belum diisi", count: belumSurvei, href: `${basis}/survei` },
    ]);
  }

  if (session.role === "TEACHER") {
    const k = await konteksMenuGuru(session);
    const guru = await prisma.teacher.findFirst({
      where: { user: { email: session.email } },
      select: { id: true, homeroomOf: { select: { id: true } } },
    }).catch(() => null);
    return antreanGuru({
      userId: session.userId, teacherId: guru?.id ?? null, jabatan: k.jabatanNames,
      waliKelasIds: guru?.homeroomOf.map(c => c.id) ?? [],
    }).catch(() => []);
  }

  // ADMIN & staf TU: hitungan yang sama dengan yang dipakai lencana sidebar admin.
  const now = new Date();
  const tengahMalamUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const [pesan, pendaftar, verifikasi, bukuTerlambat, kelasBelumAbsen, surat, legalisir, suratMasuk, sudahDisposisi] = await Promise.all([
    prisma.contactMessage.count({ where: { isRead: false } }).catch(() => 0),
    prisma.admission.count({ where: { verifikasiStatus: "BELUM", status: { notIn: ["DITOLAK", "REJECTED"] } } }).catch(() => 0),
    hitungPengajuanBiodata().catch(() => 0),
    getOverdueLoanCount(session.userId).catch(() => 0),
    getClassesMissingAttendance(tengahMalamUtc).then((k: unknown[]) => k.length).catch(() => 0),
    prisma.suratKeterangan.count({ where: { requestStatus: "DIAJUKAN" } }).catch(() => 0),
    prisma.legalisirRequest.count({ where: { requestStatus: "DIAJUKAN" } }).catch(() => 0),
    prisma.surat.findMany({ where: { tipe: "MASUK" }, select: { id: true } }).catch(() => []),
    prisma.disposisi.findMany({ select: { suratId: true }, distinct: ["suratId"] }).catch(() => []),
  ]);
  const kegiatanDiajukan = await prisma.kegiatan.count({ where: { statusPersetujuan: "DIAJUKAN" } }).catch(() => 0);
  const sudah = new Set(sudahDisposisi.map((d: { suratId: string }) => d.suratId));
  const belumDisposisi = suratMasuk.filter((x: { id: string }) => !sudah.has(x.id)).length;
  return pakai([
    { label: "Pesan masuk belum dibaca", count: pesan, href: "/dashboard/admin/messages" },
    { label: "Pendaftaran SPMB baru", count: pendaftar, href: "/pusat-spmb/tahapan?saring=VERIFIKASI" },
    { label: "Perubahan data menunggu verifikasi", count: verifikasi, href: "/dashboard/admin/verifikasi-data" },
    { label: "Kelas belum absen hari ini", count: kelasBelumAbsen, href: "/dashboard/admin/absensi-siswa" },
    { label: "Permintaan surat menunggu diproses", count: surat + legalisir, href: "/dashboard/admin/permintaan-surat" },
    { label: "Surat masuk belum didisposisi", count: belumDisposisi, href: "/dashboard/admin/disposisi" },
    { label: "Buku terlambat dikembalikan", count: bukuTerlambat, href: "/dashboard/admin/buku-saya" },
    { label: "Usulan kegiatan menunggu persetujuan", count: kegiatanDiajukan, href: "/dashboard/admin/kegiatan" },
  ]);
}
