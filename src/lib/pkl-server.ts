import { potretSiswa, catatRiwayatSiswa, PELAKU_SISTEM } from "@/lib/riwayat-induk";
import "server-only";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { aksesPusatPkl } from "@/lib/pkl-humas";
import { penempatanBelumPasti } from "@/lib/pkl-tempat";

/** PUSAT PKL (9 Okt 2026) — portal Humas untuk seluruh urusan PKL. Akses = `aksesPusatPkl`: Admin, staf Tata Usaha
 *  penuh, dan Wakil Kepala Humas. Guru pembimbing tetap memakai halaman pembimbingannya di portal guru. */
export async function sesiPkl() {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  if (!(await aksesPusatPkl(session))) throw new Error("FORBIDDEN");
  return session;
}

export const balasTolak = (e: unknown) =>
  Response.json({ error: e instanceof Error && e.message === "FORBIDDEN" ? "Khusus Admin, Tata Usaha, atau Wakil Kepala Humas." : "Terjadi kesalahan." },
    { status: e instanceof Error && e.message === "FORBIDDEN" ? 403 : 500 });

/** Tengah malam UTC dari "YYYY-MM-DD" — cara semua tanggal PKL disimpan. null bila tidak sah. */
export function tanggalDari(v: unknown): Date | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(v)) return null;
  const d = new Date(v.slice(0, 10) + "T00:00:00Z");
  return Number.isNaN(+d) ? null : d;
}

/** Siswa yang SEDANG menempati tiap DUDI (status ONGOING) — dasar hitungan kuota. */
export async function terisiPerDudi(): Promise<Map<string, number>> {
  const g = await prisma.internship.groupBy({ by: ["mitraId"], where: { status: "ONGOING", mitraId: { not: null } }, _count: { _all: true } });
  return new Map(g.map(x => [x.mitraId as string, x._count._all]));
}

/** SATU sumber data peserta PKL untuk layar Penempatan, dasbor, dan Excel. */
export async function muatPeserta() {
  const baris = await prisma.internship.findMany({
    where: { student: { studentStatus: "AKTIF" } },
    select: {
      id: true, studentId: true, company: true, position: true, supervisor: true, startDate: true, endDate: true, status: true,
      teacherId: true, mitraId: true, lamaBulan: true, diantarPada: true, diantarOleh: true, diterimaOleh: true, dijemputPada: true, dijemputOleh: true,
      nilaiIndustriRata: true,
      student: { select: { nis: true, gender: true, majorId: true, user: { select: { name: true } }, class: { select: { name: true, grade: true } }, major: { select: { code: true, name: true } } } },
      teacher: { select: { user: { select: { name: true } } } },
      _count: { select: { journal: true, monitoring: true, mutasi: true } },
    },
    orderBy: [{ student: { class: { name: "asc" } } }, { student: { user: { name: "asc" } } }],
  });
  return baris.map(b => ({
    id: b.id, studentId: b.studentId, nama: b.student.user.name, nis: b.student.nis, jk: b.student.gender,
    kelas: b.student.class?.name ?? null, jurusanId: b.student.majorId, jurusan: b.student.major?.code ?? "",
    mitraId: b.mitraId, tempat: b.mitraId || !penempatanBelumPasti(b.company) ? b.company : null,
    /** Tempat diketik bebas di layar lama dan belum dihubungkan ke katalog DUDI. */
    tanpaKatalog: !b.mitraId && !penempatanBelumPasti(b.company),
    posisi: b.position === "—" ? "" : b.position, pembimbingIndustri: b.supervisor === "—" ? "" : b.supervisor,
    mulai: b.startDate.toISOString().slice(0, 10), selesai: b.endDate.toISOString().slice(0, 10), lamaBulan: b.lamaBulan,
    status: b.status, guruId: b.teacherId, guru: b.teacher?.user.name ?? null,
    diantarPada: b.diantarPada?.toISOString().slice(0, 10) ?? null, diantarOleh: b.diantarOleh, diterimaOleh: b.diterimaOleh,
    dijemputPada: b.dijemputPada?.toISOString().slice(0, 10) ?? null, dijemputOleh: b.dijemputOleh,
    nilaiIndustri: b.nilaiIndustriRata, jurnal: b._count.journal, monitoring: b._count.monitoring, mutasi: b._count.mutasi,
  }));
}
export type PesertaPkl = Awaited<ReturnType<typeof muatPeserta>>[number];

/** Periksa DUDI tujuan sebelum menempatkan `studentIds` di sana: ada & aktif, kuota, dan jurusan yang diterima.
 *  `peringatan` tidak menolak — pemanggil mengembalikannya 409 dan layar bertanya dulu (kirim ulang dengan `paksa`). */
export async function periksaDudi(mitraId: string, studentIds: string[]) {
  const [mitra, terisi, siswa] = await Promise.all([
    prisma.industryPartner.findUnique({ where: { id: mitraId }, select: { id: true, name: true, quota: true, aktif: true, jurusanIds: true, contactPerson: true } }),
    // Yang SUDAH di DUDI itu tidak dihitung dua kali bila ikut dipilih lagi.
    prisma.internship.count({ where: { mitraId, status: "ONGOING", studentId: { notIn: studentIds } } }),
    prisma.student.findMany({ where: { id: { in: studentIds } }, select: { id: true, majorId: true, user: { select: { name: true } } } }),
  ]);
  if (!mitra) return { mitra: null, peringatan: [] as string[] };
  const peringatan: string[] = [];
  if (!mitra.aktif) peringatan.push(`${mitra.name} sedang dinonaktifkan.`);
  if (mitra.quota != null && terisi + studentIds.length > mitra.quota) {
    peringatan.push(`Kuota ${mitra.name} ${mitra.quota} siswa; sudah terisi ${terisi}, ditambah ${studentIds.length} menjadi ${terisi + studentIds.length}.`);
  }
  if (mitra.jurusanIds.length) {
    const luar = siswa.filter(s => !mitra.jurusanIds.includes(s.majorId));
    if (luar.length) peringatan.push(`${luar.length} siswa berasal dari jurusan yang tidak tercatat diterima ${mitra.name}: ${luar.slice(0, 5).map(s => s.user.name).join(", ")}${luar.length > 5 ? ", …" : ""}.`);
  }
  return { mitra, peringatan };
}

/** Akun yang dikabari saat ada laporan masalah PKL: Wakil Kepala Humas + guru pembimbing siswa itu. */
export async function penerimaLaporan(guruUserId?: string | null): Promise<string[]> {
  const humas = await prisma.teacherJabatan.findMany({ where: { jabatan: { name: "Wakil Kepala Humas" } }, select: { teacher: { select: { userId: true } } } }).catch(() => []);
  return [...new Set([...humas.map(h => h.teacher.userId), ...(guruUserId ? [guruUserId] : [])])];
}

/** PUSAT PKL → BUKU INDUK (9 Okt 2026, temuan user: "pkl dan buku induk sudah sinkron kah?"). Bagian "J. PKL" di Buku Induk
 *  dulu isian manual yang tidak pernah tahu penempatan di Pusat PKL. Sekarang Pusat PKL adalah SUMBERNYA: setiap perubahan
 *  penempatan / guru pembimbing / tanggal / nilai menyalin ke kunci `pkl*` di `bukuIndukData`, sehingga semua pembaca Buku Induk
 *  (tabel, cetak, Excel, halaman depan rapor) ikut benar tanpa diubah satu per satu.
 *  - Hanya siswa yang SUDAH punya DUDI dan PKL-nya tidak dibatalkan. Yang belum ditempatkan tidak disentuh, jadi isian manual
 *    lama (alumni yang PKL-nya dicatat sebelum ada Pusat PKL) tetap utuh.
 *  - `pklDariPusat: "1"` menandai isian itu milik Pusat PKL — formulir Buku Induk memperingatkan agar diubah di sana.
 *  Dipanggil lewat `sinkronLatar` SETELAH data tersimpan; kegagalan di sini tidak boleh menggagalkan penempatan. */
export async function sinkronBukuIndukPkl(studentIds: string[]) {
  const ids = [...new Set(studentIds.filter(Boolean))];
  if (!ids.length) return 0;
  const pkl = await prisma.internship.findMany({
    where: { studentId: { in: ids }, mitraId: { not: null }, status: { not: "CANCELLED" } },
    select: {
      studentId: true, company: true, startDate: true, endDate: true, lamaBulan: true, nilaiAkhirRata: true, nilaiIndustriRata: true,
      mitra: { select: { address: true, kecamatan: true, kabupaten: true, lat: true, lng: true } },
      teacher: { select: { user: { select: { name: true } } } },
      student: { select: { bukuIndukData: true } },
    },
  });
  const tgl = (d: Date) => d.toISOString().slice(0, 10);
  for (const p of pkl) {
    const lama = (p.student.bukuIndukData ?? {}) as Record<string, unknown>;
    const alamat = [p.mitra?.address, p.mitra?.kecamatan, p.mitra?.kabupaten].filter(Boolean).join(", ");
    const nilai = p.nilaiAkhirRata ?? p.nilaiIndustriRata;
    const baru = {
      ...lama, pklDariPusat: "1", pklPlace: p.company, pklAddress: alamat, pklStartDate: tgl(p.startDate), pklEndDate: tgl(p.endDate),
      pklLama: p.lamaBulan ? `${p.lamaBulan} bulan` : "", pklSupervisor: p.teacher?.user.name ?? "",
      pklLatitude: p.mitra?.lat != null ? String(p.mitra.lat) : "", pklLongitude: p.mitra?.lng != null ? String(p.mitra.lng) : "",
      // Nilai hanya ditimpa bila Pusat PKL memang sudah punya nilainya — nilai yang diketik TU tidak dikosongkan.
      ...(nilai != null ? { pklScore: String(nilai) } : {}),
    };
    const sebelumRiwayat = await potretSiswa(p.studentId);
    await prisma.student.update({ where: { id: p.studentId }, data: { bukuIndukData: baru } });
    await catatRiwayatSiswa(PELAKU_SISTEM, p.studentId, sebelumRiwayat, "disalin dari Pusat PKL").catch(() => 0);
  }
  return pkl.length;
}
/** Jalankan sinkron tanpa menahan balasan dan tanpa menggagalkan pemanggil. */
export function sinkronLatar(studentIds: string[] | (() => Promise<string[]>)) {
  void (async () => sinkronBukuIndukPkl(typeof studentIds === "function" ? await studentIds() : studentIds))().catch(() => {});
}
/** Semua siswa di satu DUDI — dipakai saat nama/alamat/titik DUDI berubah. */
export const siswaDiDudi = (mitraId: string) => prisma.internship.findMany({ where: { mitraId }, select: { studentId: true } }).then(x => x.map(y => y.studentId));
