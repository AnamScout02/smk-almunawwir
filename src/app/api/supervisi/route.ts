import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { aspekUntuk, bolehSupervisi, nilaiSupervisi, ASPEK_PKG, ASPEK_SUPERVISI } from "@/lib/supervisi";
import { semesterRapor } from "@/lib/rapor-verifikasi";
import { kirimLatar, kirimNotifikasi } from "@/lib/push-server";

export const dynamic = "force-dynamic";

/** SUPERVISI & PKG — penilai melihat semua; guru melihat hasil dirinya sendiri. */
export async function GET(req: Request) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  const penilai = await bolehSupervisi(session);
  const saya = await prisma.teacher.findFirst({ where: { userId: session.userId }, select: { id: true } });
  const u = new URL(req.url);
  const teacherId = penilai ? (u.searchParams.get("teacherId") || undefined) : saya?.id;
  if (!penilai && !teacherId) return Response.json({ error: "Data guru tidak ditemukan." }, { status: 403 });
  const [daftar, guru] = await Promise.all([
    prisma.supervisiGuru.findMany({
      where: teacherId ? { teacherId } : {}, orderBy: { tanggal: "desc" }, take: 300,
      include: { teacher: { select: { user: { select: { name: true } }, subject: true } } },
    }),
    penilai ? prisma.teacher.findMany({ where: { teacherStatus: "AKTIF" }, select: { id: true, subject: true, user: { select: { name: true } } }, orderBy: { user: { name: "asc" } } }) : Promise.resolve([]),
  ]);
  return Response.json({
    penilai, semester: semesterRapor(), aspek: { SUPERVISI: ASPEK_SUPERVISI, PKG: ASPEK_PKG },
    guru: guru.map(g => ({ id: g.id, nama: g.user.name, mapel: g.subject })),
    daftar: daftar.map(d => ({ ...d, guruNama: d.teacher.user.name, guruMapel: d.teacher.subject, teacher: undefined })),
  });
}

export async function POST(req: Request) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  if (!(await bolehSupervisi(session))) return Response.json({ error: "Khusus Kepala Sekolah, Wakil Kepala Kurikulum, dan Penjamin Mutu." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const jenis = b.jenis === "PKG" ? "PKG" : "SUPERVISI";
  const guru = await prisma.teacher.findUnique({ where: { id: String(b.teacherId ?? "") }, select: { id: true, userId: true, user: { select: { name: true } } } });
  const tanggal = new Date(b.tanggal);
  if (!guru) return Response.json({ error: "Pilih guru yang disupervisi." }, { status: 400 });
  if (isNaN(tanggal.getTime())) return Response.json({ error: "Tanggal tidak valid." }, { status: 400 });
  const skor: Record<string, number> = {};
  for (const a of aspekUntuk(jenis)) {
    const n = Math.round(Number(b.skor?.[a.kunci]));
    if (n >= 1 && n <= 4) skor[a.kunci] = n;
  }
  if (!Object.keys(skor).length) return Response.json({ error: "Isi minimal satu aspek penilaian (skala 1–4)." }, { status: 400 });
  const { nilai, predikat } = nilaiSupervisi(skor, jenis);
  const s = await prisma.supervisiGuru.create({
    data: {
      teacherId: guru.id, jenis, tanggal, semester: String(b.semester ?? "").slice(0, 40) || null,
      mapel: String(b.mapel ?? "").trim().slice(0, 100) || null, kelas: String(b.kelas ?? "").trim().slice(0, 50) || null,
      penilaiId: session.userId, penilaiNama: session.name, skor, nilaiAkhir: nilai, predikat,
      catatan: String(b.catatan ?? "").trim().slice(0, 2000) || null, tindakLanjut: String(b.tindakLanjut ?? "").trim().slice(0, 2000) || null,
    },
  });
  kirimLatar(() => kirimNotifikasi({
    userIds: [guru.userId], jenis: "PENGUMUMAN", kunci: `supervisi:${s.id}`,
    judul: jenis === "PKG" ? "Hasil Penilaian Kinerja Guru" : "Hasil supervisi akademik",
    isi: `${predikat ?? ""}${nilai != null ? ` (${nilai})` : ""} — ${session.name}. Buka untuk melihat catatan & tindak lanjut.`,
    url: "/dashboard/teacher/supervisi", tag: `supervisi-${s.id}`,
  }));
  return Response.json({ ok: true }, { status: 201 });
}
