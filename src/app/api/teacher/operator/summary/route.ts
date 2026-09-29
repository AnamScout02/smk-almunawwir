import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertJabatan } from "@/lib/jabatan-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

type Obj = Record<string, unknown>;
const ada = (v: unknown) => typeof v === "string" ? /[A-Za-z1-9]/.test(v) : v !== null && v !== undefined;
const bi = (j: unknown, k: string) => (j && typeof j === "object" && !Array.isArray(j) ? (j as Obj)[k] : undefined);

/** RINGKASAN DASHBOARD OPERATOR SEKOLAH (diperbarui 17 Sep 2026 — temuan user: isinya minim dan tautannya ke halaman Admin
 * sehingga guru operator dikembalikan ke dashboard). Tautan kini mengikuti portal pembuka: guru → halaman /dashboard/teacher/*,
 * Admin/TU → /dashboard/admin/*. Butir yang halamannya tidak bisa dibuka guru (SPMB, verifikasi data) hanya untuk Admin/TU.
 *
 * 28 Sep 2026 (permintaan user: "harusnya di klik muncul dulu nama-nama dari data tersebut, baru kemudian
 * di klik diarahkan ke editnya"): tiap butir punya `kunci`, dan `?rincian=<kunci>` mengembalikan DAFTAR NAMA-nya.
 * Syarat "kosong" ditulis SEKALI di peta di bawah lalu dipakai untuk menghitung MAUPUN mendaftar — kalau
 * dipisah, angka di kartu dan isi daftarnya bisa berbeda tanpa ketahuan. */

type Siswa = { nisn: string | null; birthPlace: string | null; birthDate: Date | null; gender: string | null;
  address: string | null; parentName: string | null; parentPhone: string | null; previousSchool: string | null;
  classId: string | null; bukuIndukData: unknown };
type Pegawai = { birthPlace: string | null; birthDate: Date | null; gender: string | null; bukuIndukData: unknown };

const SYARAT_SISWA: { kunci: string; label: string; kosong: (s: Siswa) => boolean }[] = [
  { kunci: "siswa:kelas", label: "Belum punya kelas", kosong: s => !s.classId },
  { kunci: "siswa:nisn", label: "NISN kosong", kosong: s => !ada(s.nisn) },
  { kunci: "siswa:nik", label: "NIK kosong", kosong: s => !ada(bi(s.bukuIndukData, "nik")) },
  { kunci: "siswa:tglLahir", label: "Tanggal lahir kosong", kosong: s => !s.birthDate },
  { kunci: "siswa:tmpLahir", label: "Tempat lahir kosong", kosong: s => !ada(s.birthPlace) },
  { kunci: "siswa:jk", label: "Jenis kelamin kosong", kosong: s => !ada(s.gender) },
  { kunci: "siswa:alamat", label: "Alamat kosong", kosong: s => !ada(s.address) },
  { kunci: "siswa:ibu", label: "Nama ibu kandung kosong", kosong: s => !ada(bi(s.bukuIndukData, "motherName")) },
  { kunci: "siswa:ortu", label: "Nama orang tua/wali kosong", kosong: s => !ada(s.parentName) },
  { kunci: "siswa:hpOrtu", label: "No. HP orang tua kosong", kosong: s => !ada(s.parentPhone) },
  { kunci: "siswa:asal", label: "Sekolah asal kosong", kosong: s => !ada(s.previousSchool) },
];

const SYARAT_GURU: { kunci: string; label: string; kosong: (g: Pegawai) => boolean }[] = [
  { kunci: "guru:nik", label: "NIK kosong", kosong: g => !ada(bi(g.bukuIndukData, "nik")) },
  { kunci: "guru:nuptk", label: "NUPTK kosong", kosong: g => !ada(bi(g.bukuIndukData, "nuptk")) },
  { kunci: "guru:tglLahir", label: "Tanggal lahir kosong", kosong: g => !g.birthDate },
  { kunci: "guru:tmpLahir", label: "Tempat lahir kosong", kosong: g => !ada(g.birthPlace) },
  { kunci: "guru:jk", label: "Jenis kelamin kosong", kosong: g => !ada(g.gender) },
];

const PILIH_SISWA = { nisn: true, birthPlace: true, birthDate: true, gender: true, address: true,
  parentName: true, parentPhone: true, previousSchool: true, classId: true, bukuIndukData: true } as const;
const PILIH_GURU = { birthPlace: true, birthDate: true, gender: true, bukuIndukData: true } as const;

export async function GET(req: Request) {
  try {
    const session = await verifyRole(["TEACHER", "TAS", "ADMIN"]);
    await assertJabatan(session, ["Operator Sekolah"]);
    const guru = session.role === "TEACHER";
    const siswaHref = guru ? "/dashboard/teacher/buku-induk-siswa" : "/dashboard/admin/buku-induk/siswa";
    const guruHref = guru ? "/dashboard/teacher/buku-induk-guru" : "/dashboard/admin/buku-induk/guru";
    const dapodikHref = guru ? "/dashboard/teacher/dapodik" : "/dashboard/admin/dapodik";

    /* ── Rincian: daftar NAMA untuk satu butir. Dipanggil saat baris di dashboard diketuk. ── */
    const rincian = new URL(req.url).searchParams.get("rincian");
    if (rincian) {
      const sSyarat = SYARAT_SISWA.find(x => x.kunci === rincian);
      if (sSyarat) {
        const rows = await prisma.student.findMany({
          where: { studentStatus: "AKTIF" },
          select: { ...PILIH_SISWA, id: true, nis: true, user: { select: { name: true } }, class: { select: { name: true } } },
          orderBy: { user: { name: "asc" } },
        });
        return Response.json({
          judul: sSyarat.label, editHref: siswaHref,
          daftar: rows.filter(r => sSyarat.kosong(r)).map(r => ({
            id: r.id, nama: r.user.name, ket: [r.nis, r.class?.name ?? "Belum ada kelas"].filter(Boolean).join(" · "),
          })),
        });
      }
      const gSyarat = SYARAT_GURU.find(x => x.kunci === rincian);
      if (gSyarat) {
        const rows = await prisma.teacher.findMany({
          where: { OR: [{ teacherStatus: "AKTIF" }, { teacherStatus: null }] },
          select: { ...PILIH_GURU, id: true, nip: true, subject: true, user: { select: { name: true } } },
          orderBy: { user: { name: "asc" } },
        });
        return Response.json({
          judul: gSyarat.label, editHref: guruHref,
          daftar: rows.filter(r => gSyarat.kosong(r)).map(r => ({
            id: r.id, nama: r.user.name, ket: [r.nip, r.subject].filter(Boolean).join(" · "),
          })),
        });
      }
      return Response.json({ error: "Butir tidak dikenal." }, { status: 404 });
    }

    const [siswa, pegawai, pendingAdmissions, pendingProfileEdits, pasangan] = await Promise.all([
      prisma.student.findMany({ where: { studentStatus: "AKTIF" }, select: PILIH_SISWA }),
      prisma.teacher.findMany({ where: { OR: [{ teacherStatus: "AKTIF" }, { teacherStatus: null }] }, select: PILIH_GURU }),
      guru ? Promise.resolve(0) : prisma.admission.count({ where: { status: "PENDING" } }),
      guru ? Promise.resolve(0) : prisma.profileEditRequest.count({ where: { status: "PENDING" } }),
      prisma.dapodikPasangan.count(),
    ]);

    const kelompok = [
      {
        judul: "Data siswa aktif", total: siswa.length, href: siswaHref,
        butir: SYARAT_SISWA.map(x => ({ label: x.label, kunci: x.kunci, count: siswa.filter(x.kosong).length, href: siswaHref })),
      },
      {
        judul: "Data guru & tendik aktif", total: pegawai.length, href: guruHref,
        butir: SYARAT_GURU.map(x => ({ label: x.label, kunci: x.kunci, count: pegawai.filter(x.kosong).length, href: guruHref })),
      },
    ].map(k => ({ ...k, butir: k.butir.filter(b => b.count > 0) }));

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
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return Response.json({ error: "Khusus Operator Sekolah." }, { status: 403 });
    }
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
