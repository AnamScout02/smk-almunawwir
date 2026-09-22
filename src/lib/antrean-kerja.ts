import "server-only";
import { prisma } from "@/lib/prisma";
import { bagianWib } from "@/lib/waktu-wib";
import { getClassesMissingAttendance } from "@/lib/attendance-gaps";
import { semesterRapor } from "@/lib/rapor-verifikasi";
import { KESISWAAN_BK_JABATAN } from "@/lib/kesiswaan-guard";
import { wherePengumumanUntuk } from "@/lib/pengumuman";
import { surveiUntukKonteks } from "@/lib/survei";
import { FILTER_KERUSAKAN_LAB, JABATAN_LAB, JABATAN_SARPRAS } from "@/lib/sarpras-akses";

/** ANTREAN KERJA "PERLU TINDAKAN" PER JABATAN (fondasi, 17 Sep 2026). Tampil di KOTAK NOTIFIKASI (satu pintu — CLAUDE.md #31,
 * jangan dibuat pita/kartu terpisah). Tiap butir = pekerjaan nyata yang menunggu pengguna ini, bisa diklik ke halamannya.
 * Dihitung di layout portal, jadi disimpan sementara 60 detik per akun supaya perpindahan halaman tetap ringan. */

export interface ButirTindakan { label: string; count: number; href: string }

const simpanan = new Map<string, { sampai: number; isi: ButirTindakan[] }>();
const UMUR_MS = 60_000;

export async function antreanGuru(o: {
  userId: string; teacherId: string | null; jabatan: string[]; waliKelasIds: string[];
}): Promise<ButirTindakan[]> {
  const ada = simpanan.get(o.userId);
  if (ada && ada.sampai > Date.now()) return ada.isi;
  const isi = await hitungAntreanGuru(o).catch(() => [] as ButirTindakan[]);
  simpanan.set(o.userId, { sampai: Date.now() + UMUR_MS, isi });
  if (simpanan.size > 500) { const k = simpanan.keys().next().value; if (k) simpanan.delete(k); }
  return isi;
}

/** Hapus simpanan (dipanggil setelah pengguna menyelesaikan tindakan agar lencana langsung berkurang). */
export function segarkanAntrean(userId?: string) {
  if (userId) simpanan.delete(userId); else simpanan.clear();
}

async function hitungAntreanGuru(o: { userId: string; teacherId: string | null; jabatan: string[]; waliKelasIds: string[] }) {
  const punya = (j: string) => o.jabatan.includes(j);
  const tugas: Promise<ButirTindakan | null>[] = [];
  const butir = (label: string, href: string) => (count: number): ButirTindakan | null => (count > 0 ? { label, count, href } : null);

  // Papan tugas antar jabatan (18 Sep 2026): tugas yang ditujukan ke akun ini atau ke jabatannya.
  tugas.push(prisma.tugasInternal.count({
    where: {
      status: { in: ["BARU", "DIKERJAKAN"] },
      OR: [{ penerimaId: o.userId }, ...(o.jabatan.length ? [{ targetJabatan: { hasSome: o.jabatan } }] : [])],
    },
  }).then(butir("Tugas dari pimpinan belum selesai", "/dashboard/teacher/tugas")));

  // Usulan kegiatan menunggu keputusan — hanya untuk pemegang hak keputusan (pimpinan sekolah).
  if (punya("Kepala Sekolah") || punya("Wakil Kepala Kesiswaan") || punya("Wakil Kepala Kurikulum")) {
    tugas.push(prisma.kegiatan.count({ where: { statusPersetujuan: "DIAJUKAN" } })
      .then(butir("Usulan kegiatan menunggu persetujuan", "/dashboard/teacher/kegiatan")));
  }

  if (o.waliKelasIds.length) {
    const hariIni = new Date(`${bagianWib().iso}T00:00:00Z`);
    tugas.push(prisma.izinSiswa.count({ where: { status: "MENUNGGU", student: { classId: { in: o.waliKelasIds } } } })
      .then(butir("Izin/sakit dari orang tua menunggu keputusan", "/dashboard/teacher/izin-siswa")));
    tugas.push(prisma.janjiKonseling.count({ where: { status: "MENUNGGU", tujuan: "WALI_KELAS", student: { classId: { in: o.waliKelasIds } } } })
      .then(butir("Janji temu orang tua menunggu jadwal", "/dashboard/teacher/konseling")));
    tugas.push(getClassesMissingAttendance(hariIni, o.waliKelasIds).then(k => k.length)
      .then(butir("Kelas wali belum diabsen hari ini", "/dashboard/teacher/attendance")));
    // Menjelang akhir semester (Desember/Juni): ingatkan mengunci nilai rapor.
    const { bulan } = bagianWib();
    if (bulan === 12 || bulan === 6) {
      const sem = semesterRapor()[bulan === 12 ? 2 : 3];
      tugas.push(prisma.raporKunci.count({ where: { classId: { in: o.waliKelasIds }, semester: sem } })
        .then(n => o.waliKelasIds.length - n)
        .then(butir(`Nilai rapor ${sem} belum dikunci`, "/dashboard/teacher/rapor-kelas")));
    }
  }
  if (punya("Kepala Sekolah")) {
    tugas.push((async () => {
      // Kelas+semester yang sudah dikunci wali kelas tetapi belum disahkan.
      const sems = semesterRapor();
      const [kunci, sah] = await Promise.all([
        prisma.raporKunci.findMany({ where: { semester: { in: sems } }, select: { classId: true, semester: true } }),
        prisma.raporApproval.findMany({ where: { semester: { in: sems } }, select: { classId: true, semester: true } }),
      ]);
      const s = new Set(sah.map(x => `${x.classId}|${x.semester}`));
      return kunci.filter(k => !s.has(`${k.classId}|${k.semester}`)).length;
    })()
      .then(butir("Rapor siap disahkan", "/dashboard/teacher/kepala-sekolah/rapor")));
    const batas = new Date(Date.now() + 60 * 86400000);
    tugas.push(prisma.industryPartner.count({ where: { mouEndDate: { gte: new Date(), lte: batas } } })
      .then(butir("MoU mitra industri berakhir ≤ 60 hari", "/dashboard/teacher/kepala-sekolah/mitra")));
  }
  if (punya("Operator Sekolah") || punya("Tenaga Administrasi Sekolah") || punya("Kepala Tenaga Administrasi Sekolah")) {
    tugas.push(prisma.arsipSk.count({ where: { berlakuSampai: { gte: new Date(), lte: new Date(Date.now() + 60 * 86400000) } } })
      .then(butir("SK/sertifikat pegawai berakhir ≤60 hari", "/dashboard/teacher/arsip-sk")));
    if (punya("Tenaga Administrasi Sekolah") || punya("Kepala Tenaga Administrasi Sekolah")) {
      tugas.push(prisma.arsip.count({ where: { berlakuSampai: { lte: new Date(Date.now() + 60 * 86400000) } } })
        .then(butir("Dokumen arsip mendekati/lewat masa berlaku", "/dashboard/admin/arsip")));
    }
  }
  if (punya("Kepala UKS")) {
    tugas.push(prisma.uksMedicine.count({ where: { kedaluwarsa: { lte: new Date(Date.now() + 30 * 86400000) } } })
      .then(butir("Obat UKS kedaluwarsa ≤30 hari", "/dashboard/teacher/uks")));
    tugas.push(prisma.$queryRaw<{ n: bigint }[]>`select count(*)::bigint as n from "UksMedicine" where stock <= "stokMinimum"`
      .then(r => Number(r[0]?.n ?? 0)).then(butir("Stok obat UKS menipis", "/dashboard/teacher/uks")));
  }
  if (KESISWAAN_BK_JABATAN.some(punya)) {
    tugas.push(prisma.janjiKonseling.count({ where: { status: "MENUNGGU" } })
      .then(butir("Permintaan konseling menunggu jadwal", "/dashboard/teacher/konseling")));
    tugas.push(prisma.aspirasiSiswa.count({ where: { status: "BARU" } })
      .then(butir("Aspirasi siswa belum dibaca", "/dashboard/teacher/aspirasi")));
  }
  if (punya(JABATAN_SARPRAS) || punya(JABATAN_LAB)) {
    const penuh = punya(JABATAN_SARPRAS);
    const base = penuh ? "/dashboard/teacher/wakasek/sarpras" : "/dashboard/teacher/lab";
    const lingkup = penuh ? {} : { lingkup: "LAB" };
    const besok = new Date(`${bagianWib().iso}T00:00:00+07:00`).getTime() + 86400000;
    tugas.push(prisma.assetDamageReport.count({ where: { status: "BELUM_DIPERBAIKI", ...(penuh ? {} : FILTER_KERUSAKAN_LAB) } })
      .then(butir("Laporan kerusakan belum ditangani", penuh ? `${base}/inventaris` : "/dashboard/teacher/lab/inventaris")));
    tugas.push(prisma.peminjamanSarpras.count({ where: { status: "MENUNGGU", ...lingkup } })
      .then(butir("Permohonan pinjam/ruang menunggu", `${base}/peminjaman`)));
    tugas.push(prisma.peminjamanSarpras.count({ where: { status: "DIPINJAM", selesai: { lt: new Date() }, ...lingkup } })
      .then(butir("Barang belum dikembalikan tepat waktu", `${base}/peminjaman`)));
    tugas.push(prisma.jadwalPerawatan.count({ where: { aktif: true, berikutnya: { lt: new Date(besok) }, ...lingkup } })
      .then(butir("Perawatan berkala jatuh tempo", `${base}/perawatan`)));
    tugas.push(prisma.usulanAlat.count({ where: { status: "DIUSULKAN", ...lingkup } })
      .then(butir("Usulan alat & bahan menunggu", `${base}/usulan-alat`)));
  }
  if (punya("Wakil Kepala Humas")) {
    tugas.push(prisma.pklRegistration.count({ where: { status: "PENDING" } })
      .then(butir("Pendaftaran PKL menunggu diproses", "/dashboard/teacher/humas/pkl-pendaftaran")));
    const batasMou = new Date(Date.now() + 60 * 86400000);
    tugas.push(prisma.industryPartner.count({ where: { mouEndDate: { lte: batasMou } } })
      .then(butir("MoU mitra berakhir ≤60 hari / kedaluwarsa", "/dashboard/teacher/humas")));
  }
  if (punya("Koordinator Perpustakaan") || punya("Tim Perpustakaan")) {
    tugas.push(prisma.bookReservation.count({ where: { status: "MENUNGGU" } })
      .then(butir("Pesanan buku menunggu disiapkan", "/pusat-perpustakaan/sirkulasi")));
  }
  tugas.push(prisma.announcement.count({
    where: { ...wherePengumumanUntuk({ peran: ["ALL", "TEACHER"], kelasIds: [], jurusanIds: [], jabatan: o.jabatan }), wajibKonfirmasi: true, dibaca: { none: { userId: o.userId } } },
  }).then(butir("Pengumuman perlu dikonfirmasi dibaca", "/dashboard/teacher/pengumuman")));
  tugas.push(surveiUntukKonteks(o.userId, { peran: ["ALL", "TEACHER"], kelasIds: [], jurusanIds: [], jabatan: o.jabatan })
    .then(d => d.filter(x => !x.sudahDiisi).length).then(butir("Survei belum diisi", "/dashboard/teacher/survei")));
  if (o.teacherId) {
    tugas.push(prisma.assignmentSubmission.count({ where: { score: null, assignment: { teacherId: o.teacherId } } })
      .then(butir("Tugas siswa belum dinilai", "/dashboard/teacher/materials")));
  }
  return (await Promise.all(tugas)).filter((x): x is ButirTindakan => !!x);
}
