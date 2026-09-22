import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";

export const dynamic = "force-dynamic";

/** Cari siswa untuk modul Tata Usaha (Buku Tamu & Legalisir). BEDA dari
 * /api/admin/student-points/students-lookup: yang itu guard-nya piket/BK dan HANYA siswa AKTIF —
 * di sini WAJIB ikut siswa LULUS/KELUAR/PINDAH, karena pemohon legalisir mayoritas justru ALUMNI.
 *
 * Ikut mengembalikan nomor dokumen dari bukuIndukData supaya form Legalisir bisa auto-isi:
 * - graduationIjazahNo (K. Kelulusan) = ijazah SMK sekolah INI — ini yang dilegalisir alumni.
 * - skhunNo (K. Kelulusan) = SKHUN.
 * `ijazahNo` (D. Pendidikan Sebelumnya) SENGAJA TIDAK dipakai — itu ijazah SMP/MTs sekolah lama,
 * bukan dokumen terbitan sekolah ini, jadi tidak pernah dilegalisir di sini. */
export async function GET(req: Request) {
  try {
    await verifyTasAccess();
    const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
    if (q.length < 2) return Response.json([]);

    const students = await prisma.student.findMany({
      where: {
        OR: [
          { nis: { contains: q, mode: "insensitive" } },
          { nisn: { contains: q, mode: "insensitive" } },
          { user: { name: { contains: q, mode: "insensitive" } } },
        ],
      },
      select: {
        id: true, nis: true, enrollYear: true, studentStatus: true, bukuIndukData: true,
        nisn: true, birthPlace: true, birthDate: true, gender: true, address: true, parentName: true,
        user: { select: { name: true } },
        class: { select: { name: true } },
        major: { select: { code: true, name: true } },
      },
      orderBy: { user: { name: "asc" } },
      take: 20,
    });

    return Response.json(students.map(s => {
      const d = (s.bukuIndukData ?? {}) as Record<string, unknown>;
      const str = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : null);
      return {
        id: s.id,
        name: s.user.name,
        nis: s.nis,
        className: s.class?.name ?? null,
        majorCode: s.major.code,
        enrollYear: s.enrollYear,
        status: s.studentStatus ?? "AKTIF",
        graduationIjazahNo: str("graduationIjazahNo"),
        skhunNo: str("skhunNo"),
        // Dipakai formulir template surat supaya identitas siswa tidak perlu diketik ulang.
        nisn: s.nisn,
        majorName: s.major.name,
        gender: s.gender,
        address: s.address,
        parentName: s.parentName,
        nik: str("nik"),
        motherName: str("motherName"),
        fatherName: str("fatherName"),
        birthPlace: s.birthPlace,
        birthDate: s.birthDate ? new Date(s.birthDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : null,
      };
    }));
  } catch {
    return Response.json({ error: "Gagal mencari siswa" }, { status: 500 });
  }
}
