import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { bolehAturUjian } from "@/lib/kegiatan-ujian-server";
import { logActivity } from "@/lib/activity-log";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const ALASAN_BAWAAN = "Belum menyelesaikan administrasi ujian";

/** PESERTA DITAHAN (src/lib/peserta-ditahan.ts) — dikelola panitia ujian (Admin, Wakakur, pengatur ujian).
 *  GET  ?kegiatanId=&cari=  → daftar kegiatan, peserta ditahan pada kegiatan itu, dan (bila `cari`) calon siswa.
 *  POST { kegiatanId, studentIds, alasan } → tahan (yang sudah ditahan dilewati).
 *  DELETE ?id= → lepas; siswa langsung bisa masuk dengan token selama jadwalnya masih dibuka. */
async function jaga() {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  if (!(await bolehAturUjian(session))) return { session, tolak: Response.json({ error: "Khusus panitia ujian (Wakil Kepala Kurikulum & Admin)." }, { status: 403 }) };
  return { session, tolak: null };
}

export async function GET(req: NextRequest) {
  const { tolak } = await jaga();
  if (tolak) return tolak;
  const sp = new URL(req.url).searchParams;
  const kegiatan = await prisma.kegiatanUjian.findMany({
    select: { id: true, nama: true, singkatan: true, aktif: true },
    orderBy: [{ aktif: "desc" }, { createdAt: "desc" }], take: 30,
  });
  const kegiatanId = sp.get("kegiatanId") || kegiatan.find(k => k.aktif)?.id || kegiatan[0]?.id || "";
  const daftar = kegiatanId ? await prisma.pesertaDitahanUjian.findMany({
    where: { kegiatanId },
    select: {
      id: true, alasan: true, olehNama: true, createdAt: true,
      student: { select: { id: true, nis: true, user: { select: { name: true } }, class: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  }) : [];
  const cari = (sp.get("cari") ?? "").trim();
  const siswa = cari.length >= 2 ? await prisma.student.findMany({
    where: {
      studentStatus: "AKTIF",
      OR: [{ user: { name: { contains: cari, mode: "insensitive" } } }, { nis: { contains: cari } }, { class: { name: { contains: cari, mode: "insensitive" } } }],
    },
    select: { id: true, nis: true, user: { select: { name: true } }, class: { select: { name: true } } },
    orderBy: [{ class: { name: "asc" } }, { user: { name: "asc" } }], take: 40,
  }) : [];
  return Response.json({
    kegiatan, kegiatanId,
    daftar: daftar.map(d => ({ id: d.id, alasan: d.alasan, oleh: d.olehNama, waktu: d.createdAt, studentId: d.student.id, nama: d.student.user.name, nis: d.student.nis, kelas: d.student.class?.name ?? "-" })),
    siswa: siswa.map(s => ({ id: s.id, nama: s.user.name, nis: s.nis, kelas: s.class?.name ?? "-" })),
  });
}

export async function POST(req: NextRequest) {
  const { session, tolak } = await jaga();
  if (tolak) return tolak;
  const b = await req.json().catch(() => ({})) as { kegiatanId?: string; studentIds?: unknown; alasan?: string };
  const kegiatan = b.kegiatanId ? await prisma.kegiatanUjian.findUnique({ where: { id: b.kegiatanId }, select: { id: true, singkatan: true } }) : null;
  if (!kegiatan) return Response.json({ error: "Pilih kegiatan ujian." }, { status: 400 });
  const ids = Array.isArray(b.studentIds) ? [...new Set(b.studentIds.map(String))].slice(0, 200) : [];
  if (!ids.length) return Response.json({ error: "Pilih siswa yang ditahan." }, { status: 400 });
  const alasan = String(b.alasan ?? "").trim().slice(0, 200) || ALASAN_BAWAAN;
  const hasil = await prisma.pesertaDitahanUjian.createMany({
    data: ids.map(studentId => ({ kegiatanId: kegiatan.id, studentId, alasan, olehNama: session.name })),
    skipDuplicates: true,
  });
  await logActivity(session, {
    action: "TAHAN_PESERTA_UJIAN", entity: "KegiatanUjian", entityId: kegiatan.id,
    description: `Menahan ${hasil.count} peserta ${kegiatan.singkatan}: ${alasan}`,
  }).catch(() => {});
  return Response.json({ ok: true, jumlah: hasil.count });
}

export async function DELETE(req: NextRequest) {
  const { session, tolak } = await jaga();
  if (tolak) return tolak;
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const d = await prisma.pesertaDitahanUjian.findUnique({
    where: { id }, select: { id: true, kegiatan: { select: { id: true, singkatan: true } }, student: { select: { user: { select: { name: true } } } } },
  });
  if (!d) return Response.json({ error: "Data tidak ditemukan." }, { status: 404 });
  await prisma.pesertaDitahanUjian.delete({ where: { id } });
  await logActivity(session, {
    action: "LEPAS_PESERTA_UJIAN", entity: "KegiatanUjian", entityId: d.kegiatan.id,
    description: `Melepas penahanan ${d.student.user.name} pada ${d.kegiatan.singkatan}`,
  }).catch(() => {});
  return Response.json({ ok: true, pesan: `${d.student.user.name} dilepas — sekarang bisa masuk ujian dengan token.` });
}
