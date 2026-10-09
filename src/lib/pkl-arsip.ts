import "server-only";
import { prisma } from "@/lib/prisma";
import { penempatanBelumPasti } from "@/lib/pkl-tempat";

/** Tahun ajaran sebuah tanggal (Juli+ = tahun ajaran baru), dihitung di WIB. 2026 berarti "2026/2027". */
export function tahunAjaranPkl(d: Date) {
  const w = new Date(d.getTime() + 7 * 3600_000);
  return w.getUTCMonth() >= 6 ? w.getUTCFullYear() : w.getUTCFullYear() - 1;
}
export const labelTa = (ta: number) => `${ta}/${ta + 1}`;

/** ARSIP PKL PER ANGKATAN (9 Okt 2026) — `Internship` satu baris per siswa dan TIDAK dihapus saat siswa lulus, jadi
 *  arsip = seluruh baris (status siswa apa pun) dikelompokkan menurut tahun ajaran tanggal MULAI. Tidak ada tabel arsip
 *  terpisah: salinan kedua bisa berbeda dari data aslinya. Yang belum dapat DUDI tetap dihitung sebagai peserta. */
export async function muatArsipPkl() {
  const baris = await prisma.internship.findMany({
    select: {
      id: true, studentId: true, company: true, mitraId: true, position: true, startDate: true, endDate: true, status: true, lamaBulan: true,
      nilaiIndustriRata: true, nilaiAkhirRata: true, sertifikatNomor: true,
      student: { select: { nis: true, studentStatus: true, user: { select: { name: true } }, class: { select: { name: true } }, major: { select: { code: true } } } },
      teacher: { select: { user: { select: { name: true } } } },
      _count: { select: { journal: true, monitoring: true, mutasi: true } },
    },
    orderBy: [{ startDate: "desc" }, { student: { user: { name: "asc" } } }],
  });
  return baris.map(b => ({
    id: b.id, studentId: b.studentId, ta: tahunAjaranPkl(b.startDate), nama: b.student.user.name, nis: b.student.nis,
    kelas: b.student.class?.name ?? null, jurusan: b.student.major?.code ?? "", statusSiswa: b.student.studentStatus ?? "AKTIF",
    tempat: b.mitraId || !penempatanBelumPasti(b.company) ? b.company : null, mitraId: b.mitraId,
    posisi: b.position === "—" ? "" : b.position, mulai: b.startDate, selesai: b.endDate, lamaBulan: b.lamaBulan, status: b.status,
    guru: b.teacher?.user.name ?? null, nilaiIndustri: b.nilaiIndustriRata, nilaiAkhir: b.nilaiAkhirRata, sertifikat: b.sertifikatNomor,
    jurnal: b._count.journal, monitoring: b._count.monitoring, mutasi: b._count.mutasi,
  }));
}
export type BarisArsip = Awaited<ReturnType<typeof muatArsipPkl>>[number];

const rata = (a: number[]) => (a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : null);

/** Ringkasan satu angkatan — dipakai layar DAN Excel supaya angkanya sama. */
export function ringkasAngkatan(b: BarisArsip[]) {
  const aktif = b.filter(x => x.status !== "CANCELLED");
  const ditempatkan = aktif.filter(x => x.tempat);
  const perDudi = new Map<string, { nama: string; siswa: number; selesai: number; nilai: number[] }>();
  for (const x of ditempatkan) {
    const k = x.mitraId ?? `teks:${(x.tempat as string).trim().toLowerCase()}`;
    const d = perDudi.get(k) ?? { nama: x.tempat as string, siswa: 0, selesai: 0, nilai: [] };
    d.siswa++; if (x.status === "COMPLETED") d.selesai++; if (x.nilaiIndustri != null) d.nilai.push(x.nilaiIndustri);
    perDudi.set(k, d);
  }
  return {
    peserta: aktif.length, ditempatkan: ditempatkan.length, selesai: aktif.filter(x => x.status === "COMPLETED").length,
    batal: b.length - aktif.length, dudi: perDudi.size, mutasi: aktif.reduce((a, x) => a + x.mutasi, 0),
    sertifikat: aktif.filter(x => x.sertifikat).length, rataIndustri: rata(aktif.flatMap(x => (x.nilaiIndustri != null ? [x.nilaiIndustri] : []))),
    perDudi: [...perDudi.values()].map(d => ({ nama: d.nama, siswa: d.siswa, selesai: d.selesai, rata: rata(d.nilai) })).sort((a, z) => z.siswa - a.siswa || a.nama.localeCompare(z.nama, "id")),
  };
}
