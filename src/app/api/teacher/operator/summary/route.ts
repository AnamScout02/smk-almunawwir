import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertJabatan } from "@/lib/jabatan-guard";

export const dynamic = "force-dynamic";

type Obj = Record<string, unknown>;
const ada = (v: unknown) => typeof v === "string" ? /[A-Za-z1-9]/.test(v) : v !== null && v !== undefined;
const bi = (j: unknown, k: string) => (j && typeof j === "object" && !Array.isArray(j) ? (j as Obj)[k] : undefined);

/** RINGKASAN DASHBOARD OPERATOR SEKOLAH (diperbarui 17 Sep 2026 — temuan user: isinya minim dan tautannya ke halaman Admin
 * sehingga guru operator dikembalikan ke dashboard). Tautan kini mengikuti portal pembuka: guru → halaman /dashboard/teacher/*,
 * Admin/TU → /dashboard/admin/*. Butir yang halamannya tidak bisa dibuka guru (SPMB, verifikasi data) hanya untuk Admin/TU. */
export async function GET() {
  try {
    const session = await verifyRole(["TEACHER", "TAS", "ADMIN"]);
    await assertJabatan(session, ["Operator Sekolah"]);
    const guru = session.role === "TEACHER";
    const siswaHref = guru ? "/dashboard/teacher/buku-induk-siswa" : "/dashboard/admin/buku-induk/siswa";
    const guruHref = guru ? "/dashboard/teacher/buku-induk-guru" : "/dashboard/admin/buku-induk/guru";
    const dapodikHref = guru ? "/dashboard/teacher/dapodik" : "/dashboard/admin/dapodik";

    const [siswa, pegawai, pendingAdmissions, pendingProfileEdits, pasangan] = await Promise.all([
      prisma.student.findMany({
        where: { studentStatus: "AKTIF" },
        select: { nisn: true, birthPlace: true, birthDate: true, gender: true, address: true, parentName: true, parentPhone: true, previousSchool: true, classId: true, bukuIndukData: true },
      }),
      prisma.teacher.findMany({
        where: { OR: [{ teacherStatus: "AKTIF" }, { teacherStatus: null }] },
        select: { birthPlace: true, birthDate: true, gender: true, bukuIndukData: true },
      }),
      guru ? Promise.resolve(0) : prisma.admission.count({ where: { status: "PENDING" } }),
      guru ? Promise.resolve(0) : prisma.profileEditRequest.count({ where: { status: "PENDING" } }),
      prisma.dapodikPasangan.count(),
    ]);
    const n = <T,>(daftar: T[], f: (x: T) => boolean) => daftar.filter(f).length;

    const kelompok = [
      {
        judul: "Data siswa aktif", total: siswa.length, href: siswaHref,
        butir: [
          { label: "Belum punya kelas", count: n(siswa, s => !s.classId) },
          { label: "NISN kosong", count: n(siswa, s => !ada(s.nisn)) },
          { label: "NIK kosong", count: n(siswa, s => !ada(bi(s.bukuIndukData, "nik"))) },
          { label: "Tanggal lahir kosong", count: n(siswa, s => !s.birthDate) },
          { label: "Tempat lahir kosong", count: n(siswa, s => !ada(s.birthPlace)) },
          { label: "Jenis kelamin kosong", count: n(siswa, s => !ada(s.gender)) },
          { label: "Alamat kosong", count: n(siswa, s => !ada(s.address)) },
          { label: "Nama ibu kandung kosong", count: n(siswa, s => !ada(bi(s.bukuIndukData, "motherName"))) },
          { label: "Nama orang tua/wali kosong", count: n(siswa, s => !ada(s.parentName)) },
          { label: "No. HP orang tua kosong", count: n(siswa, s => !ada(s.parentPhone)) },
          { label: "Sekolah asal kosong", count: n(siswa, s => !ada(s.previousSchool)) },
        ],
      },
      {
        judul: "Data guru & tendik aktif", total: pegawai.length, href: guruHref,
        butir: [
          { label: "NIK kosong", count: n(pegawai, g => !ada(bi(g.bukuIndukData, "nik"))) },
          { label: "NUPTK kosong", count: n(pegawai, g => !ada(bi(g.bukuIndukData, "nuptk"))) },
          { label: "Tanggal lahir kosong", count: n(pegawai, g => !g.birthDate) },
          { label: "Tempat lahir kosong", count: n(pegawai, g => !ada(g.birthPlace)) },
          { label: "Jenis kelamin kosong", count: n(pegawai, g => !ada(g.gender)) },
        ],
      },
    ].map(k => ({ ...k, butir: k.butir.filter(b => b.count > 0).map(b => ({ ...b, href: k.href })) }));

    const lainnya = guru ? [] : [
      { label: "Pendaftaran (SPMB) menunggu diproses", count: pendingAdmissions, href: "/dashboard/admin/admissions" },
      { label: "Pengajuan perubahan data menunggu verifikasi", count: pendingProfileEdits, href: "/dashboard/admin/verifikasi-data" },
    ].filter(c => c.count > 0);

    const checklist = [...kelompok.flatMap(k => k.butir), ...lainnya];
    return Response.json({
      totalItems: checklist.reduce((a, c) => a + c.count, 0),
      siswaAktif: siswa.length, pegawaiAktif: pegawai.length, pasanganManual: pasangan,
      kelompok, lainnya, checklist,
      tautan: { siswa: siswaHref, guru: guruHref, dapodik: dapodikHref },
    });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return Response.json({ error: "Khusus Operator Sekolah." }, { status: 403 });
    }
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
