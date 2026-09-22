import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { rapikanSasaran } from "@/lib/pengumuman";
import { hakKegiatan } from "@/lib/kegiatan-qr";
import { kirimLatar, kirimNotifikasi } from "@/lib/push-server";

export const dynamic = "force-dynamic";

const JENIS = ["RAPAT", "KEGIATAN", "UPACARA", "PELATIHAN"];

/** Daftar kegiatan yang dikelola (pimpinan/TU: semua; lainnya: buatan sendiri) + pilihan sasaran. */
export async function GET() {
  const session = await verifySession();
  const hak = await hakKegiatan(session);
  if (!hak.boleh) return Response.json({ error: "Tidak berhak." }, { status: 403 });
  const [daftar, kelas, jurusan, jabatan] = await Promise.all([
    prisma.kegiatan.findMany({ where: hak.semua ? {} : { pembuatId: session.userId }, orderBy: { mulai: "desc" }, take: 200, include: { _count: { select: { presensi: true } } } }),
    hak.semua ? prisma.class.findMany({ select: { id: true, name: true }, orderBy: [{ grade: "asc" }, { name: "asc" }] }) : Promise.resolve(hak.waliKelas),
    hak.semua ? prisma.major.findMany({ select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
    prisma.jabatan.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
  ]);
  return Response.json({
    semua: hak.semua, wali: hak.waliKelas.length > 0,
    kelas, jurusan: jurusan.map(j => ({ id: j.id, name: `${j.code} — ${j.name}` })), jabatan: jabatan.map(j => j.name),
    daftar: daftar.map(({ _count, ...k }) => ({ ...k, jumlahHadir: _count.presensi, milikSaya: k.pembuatId === session.userId })),
    bolehMemutus: hak.semua,
  });
}

export async function POST(req: Request) {
  const session = await verifySession();
  const hak = await hakKegiatan(session);
  if (!hak.boleh) return Response.json({ error: "Tidak berhak." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const judul = String(b.judul ?? "").trim().slice(0, 200);
  const mulai = new Date(b.mulai), selesai = new Date(b.selesai);
  if (!judul) return Response.json({ error: "Nama kegiatan wajib diisi." }, { status: 400 });
  if (isNaN(mulai.getTime()) || isNaN(selesai.getTime()) || selesai <= mulai) return Response.json({ error: "Waktu mulai/selesai tidak valid." }, { status: 400 });
  // Guru tanpa hak pengumuman: sasaran hanya guru & staf.
  const hakSasaran = hak.semua || hak.waliKelas.length ? hak : { ...hak, semua: true };
  const r = rapikanSasaran(hak.semua || hak.waliKelas.length ? b : { ...b, targetRole: "TEACHER" }, hakSasaran);
  if (r.galat !== undefined) return Response.json({ error: r.galat }, { status: 400 });
  if (!hak.semua && !hak.waliKelas.length && r.sasaran.targetRole !== "TEACHER") return Response.json({ error: "Sasaran hanya guru & staf." }, { status: 403 });
  // PERSETUJUAN (18 Sep 2026): kegiatan yang dibuat pimpinan/TU langsung berlaku; usulan dari guru
  // biasa/wali kelas menunggu keputusan pemegang hak pengumuman supaya kegiatan sekolah tidak
  // bertabrakan tanpa sepengetahuan pimpinan.
  const k = await prisma.kegiatan.create({
    data: {
      judul, jenis: JENIS.includes(b.jenis) ? b.jenis : "KEGIATAN", tempat: String(b.tempat ?? "").trim().slice(0, 150) || null,
      mulai, selesai, catatan: String(b.catatan ?? "").trim().slice(0, 1000) || null, ...r.sasaran,
      pembuatId: session.userId, pembuatNama: session.name,
      statusPersetujuan: hak.semua ? "DISETUJUI" : "DIAJUKAN",
    },
  });
  if (!hak.semua) {
    kirimLatar(async () => {
      const pemutus = await prisma.teacherJabatan.findMany({
        where: { jabatan: { name: { in: ["Kepala Sekolah", "Wakil Kepala Kesiswaan", "Wakil Kepala Kurikulum"] } } },
        select: { teacher: { select: { userId: true } } },
      }).catch(() => []);
      const userIds = [...new Set(pemutus.map(x => x.teacher.userId))];
      if (userIds.length) {
        await kirimNotifikasi({
          userIds, kunci: `kegiatan-diajukan:${k.id}`, jenis: "KEGIATAN",
          judul: `Usulan kegiatan: ${judul}`, isi: `Diajukan ${session.name} — menunggu persetujuan`,
          url: "/dashboard/teacher/kegiatan",
        });
      }
    });
  }
  return Response.json({ id: k.id }, { status: 201 });
}
