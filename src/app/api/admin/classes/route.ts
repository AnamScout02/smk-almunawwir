import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertKurikulum } from "@/lib/kurikulum-guard";
import { getJabatanNames } from "@/lib/jabatan-guard";

const TAS_JABATAN = ["Tenaga Administrasi Sekolah", "Kepala Tenaga Administrasi Sekolah"];

// GET dipakai luas (Buku Induk Siswa, Reports, Absensi, Users, dst) selain oleh halaman Kurikulum
// (Jadwal/Penugasan) — jadi selain Wakasek Kurikulum, guru berjabatan TU (TAS via jabatan) juga
// perlu lolos utk keperluan Buku Induk. `assertKurikulum` sendiri TIDAK diubah (masih dipakai ketat
// oleh endpoint schedule/teaching-assignment lain) — pengecualian TAS ditambahkan cuma di sini.
async function assertClassesReadAccess(session: { role: string; email: string }) {
  if (session.role !== "TEACHER") return;
  const names = await getJabatanNames(session.email);
  if (names.some(n => TAS_JABATAN.includes(n))) return;
  await assertKurikulum(session);
}

export async function GET() {
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
    return Response.json(classes);
  } catch {
    return Response.json({ error: "Gagal memuat kelas" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await verifyRole(["ADMIN", "TAS"]);
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
  } catch {
    return Response.json({ error: "Gagal membuat kelas" }, { status: 500 });
  }
}
