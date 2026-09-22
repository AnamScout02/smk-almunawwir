import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { JENIS_LOWONGAN, kelolaBkk, pembacaLowongan, rapikanLowongan } from "@/lib/bkk";
import { kirimLatar, kirimNotifikasi } from "@/lib/push-server";

export const dynamic = "force-dynamic";

const aktifSekarang = () => ({ aktif: true, OR: [{ batas: null }, { batas: { gte: new Date() } }] });

/** GET: pengelola = semua lowongan + jumlah peminat; siswa XII = lowongan aktif sesuai jurusan + status minatnya. */
export async function GET() {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS", "STUDENT"]);
  if (await kelolaBkk(session)) {
    const [daftar, jurusan, mitra] = await Promise.all([
      prisma.lowonganKerja.findMany({ orderBy: { createdAt: "desc" }, take: 300, include: { _count: { select: { minat: true } } } }),
      prisma.major.findMany({ select: { id: true, code: true, name: true }, orderBy: { name: "asc" } }),
      prisma.industryPartner.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    ]);
    return Response.json({ kelola: true, jenis: JENIS_LOWONGAN, jurusan, mitra, daftar: daftar.map(({ _count, ...l }) => ({ ...l, jumlahMinat: _count.minat })) });
  }
  const saya = await pembacaLowongan(session);
  if (!saya) return Response.json({ error: "Lowongan kerja khusus siswa kelas XII." }, { status: 403 });
  const daftar = await prisma.lowonganKerja.findMany({
    where: { ...aktifSekarang(), OR: [{ jurusanIds: { isEmpty: true } }, ...(saya.majorId ? [{ jurusanIds: { has: saya.majorId } }] : [])] },
    orderBy: [{ batas: "asc" }, { createdAt: "desc" }],
    include: { minat: { where: { studentId: saya.id }, select: { status: true, catatan: true } } },
  });
  return Response.json({ kelola: false, jenis: JENIS_LOWONGAN, daftar: daftar.map(({ minat, ...l }) => ({ ...l, minatSaya: minat[0] ?? null })) });
}

export async function POST(req: Request) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  if (!(await kelolaBkk(session))) return Response.json({ error: "Khusus pengelola BKK." }, { status: 403 });
  const d = rapikanLowongan(await req.json().catch(() => ({})));
  if (!d.judul || !d.perusahaan || !d.kualifikasi) return Response.json({ error: "Posisi, perusahaan, dan kualifikasi wajib diisi." }, { status: 400 });
  if (d.batas && isNaN(d.batas.getTime())) return Response.json({ error: "Batas lamaran tidak valid." }, { status: 400 });
  const l = await prisma.lowonganKerja.create({ data: { ...d, pembuatNama: session.name } });
  if (l.aktif) {
    kirimLatar(async () => {
      const siswa = await prisma.student.findMany({
        where: { studentStatus: "AKTIF", class: { grade: 12 }, ...(l.jurusanIds.length ? { majorId: { in: l.jurusanIds } } : {}) },
        select: { userId: true },
      });
      await kirimNotifikasi({
        userIds: siswa.map(s => s.userId), jenis: "PENGUMUMAN", kunci: `lowongan:${l.id}`,
        judul: `Lowongan: ${l.judul} — ${l.perusahaan}`, isi: `${JENIS_LOWONGAN[l.jenis]}${l.lokasi ? ` · ${l.lokasi}` : ""}${l.batas ? ` · lamar sebelum ${l.batas.toLocaleDateString("id-ID", { day: "numeric", month: "long", timeZone: "Asia/Jakarta" })}` : ""}`,
        url: "/dashboard/student/lowongan", tag: `lowongan-${l.id}`,
      });
    });
  }
  return Response.json({ id: l.id }, { status: 201 });
}

