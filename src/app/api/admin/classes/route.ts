import { prisma } from "@/lib/prisma";
import { jsonBesar } from "@/lib/json-besar";
import { verifyRole } from "@/lib/dal";
import { verifyTasAccess, TAS_JABATAN } from "@/lib/tas-access-guard";
import { assertKurikulum } from "@/lib/kurikulum-guard";
import { getJabatanNames } from "@/lib/jabatan-guard";
import { KESISWAAN_BK_JABATAN } from "@/lib/kesiswaan-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

// GET dipakai luas (Buku Induk Siswa, Reports, Absensi, Users, dst) selain oleh halaman Kurikulum
// (Jadwal/Penugasan) — jadi selain Wakasek Kurikulum, guru/staf berjabatan TU (TAS via jabatan)
// dan Wakasek Kesiswaan/Guru BK (perlu daftar kelas utk Rekap Absensi Siswa) juga perlu lolos.
// `assertKurikulum` sendiri TIDAK diubah (masih dipakai ketat oleh endpoint schedule/teaching-
// assignment lain) — pengecualian ditambahkan cuma di sini.
//
// PERBAIKAN KRITIS 2026-08-10 (temuan user): dulu `role !== "TEACHER"` return duluan di baris
// pertama — ADMIN *dan* TAS ikut lolos tanpa cek jabatan sama sekali, jadi security/kebersihan
// (role TAS tapi jabatan tidak relevan) bisa baca SELURUH data kelas+siswa. Sekarang role TAS
// diperlakukan sama seperti TEACHER: wajib py salah satu jabatan yg relevan.
async function assertClassesReadAccess(session: { role: string; email: string }) {
  if (session.role === "ADMIN") return;
  const names = await getJabatanNames(session.email);
  if (names.some(n => TAS_JABATAN.includes(n) || KESISWAAN_BK_JABATAN.includes(n))) return;
  await assertKurikulum(session);
}

export async function GET(req: Request) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertClassesReadAccess(session);
    const classes = await prisma.class.findMany({
      include: {
        major: true,
        homeroom: { include: { user: { select: { name: true } } } },
        students: {
          select: { id: true, nis: true, user: { select: { name: true } } },
          where: { studentStatus: "AKTIF" },
          orderBy: { user: { name: "asc" } },
        },
        ketuaKelas: { select: { id: true, user: { select: { name: true } } } },
        sekretaris: { select: { id: true, user: { select: { name: true } } } },
      },
      orderBy: [{ grade: "asc" }, { name: "asc" }],
    });
    return jsonBesar(classes, req);
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal memuat kelas" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await verifyTasAccess();
    const body = await req.json();
    const cls = await prisma.class.create({
      data: {
        name: body.name,
        grade: Number(body.grade),
        majorId: body.majorId,
        homeroomId: body.homeroomId || null,
      },
      include: {
        major: true,
        homeroom: { include: { user: { select: { name: true } } } },
        students: { select: { id: true }, where: { studentStatus: "AKTIF" } },
      },
    });
    return Response.json(cls, { status: 201 });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal membuat kelas" }, { status: 500 });
  }
}
