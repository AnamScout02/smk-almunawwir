import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { rapikanSasaran } from "@/lib/pengumuman";
import { hakSurvei, whereKelola, TEMPLAT_AKPD, JENIS_SURVEI } from "@/lib/survei";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

/** KELOLA SURVEI — daftar yang boleh dikelola + pilihan sasaran; POST membuat draf (AKPD/sosiometri berisi templat). */
export async function GET() {
  const session = await verifySession();
  const hak = await hakSurvei(session);
  if (!hak.boleh) return Response.json({ error: "Tidak berhak membuat survei." }, { status: 403 });
  const [daftar, kelas, jurusan, jabatan] = await Promise.all([
    prisma.survei.findMany({ where: whereKelola(session, hak), orderBy: { createdAt: "desc" }, take: 200, include: { _count: { select: { respons: true, pertanyaan: true } } } }),
    hak.semua ? prisma.class.findMany({ select: { id: true, name: true }, orderBy: [{ grade: "asc" }, { name: "asc" }] }) : Promise.resolve(hak.waliKelas),
    hak.semua ? prisma.major.findMany({ select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
    hak.semua ? prisma.jabatan.findMany({ select: { name: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);
  return Response.json({
    semua: hak.semua, bk: hak.bk, jenis: JENIS_SURVEI,
    kelas, jurusan: jurusan.map(j => ({ id: j.id, name: `${j.code} — ${j.name}` })), jabatan: jabatan.map(j => j.name),
    daftar: daftar.map(({ _count, ...s }) => ({ ...s, jumlahRespons: _count.respons, jumlahPertanyaan: _count.pertanyaan, milikSaya: s.pembuatId === session.userId })),
  });
}

export async function POST(req: Request) {
  const session = await verifySession();
  const hak = await hakSurvei(session);
  if (!hak.boleh) return Response.json({ error: "Tidak berhak membuat survei." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const jenis = JENIS_SURVEI[b.jenis] ? b.jenis : "UMUM";
  if ((jenis === "AKPD" || jenis === "SOSIOMETRI") && !hak.bk && !hak.waliKelas.length) return Response.json({ error: "AKPD & sosiometri untuk Guru BK/wali kelas." }, { status: 403 });
  const judul = String(b.judul ?? "").trim().slice(0, 200) || (jenis === "AKPD" ? "Angket Kebutuhan Peserta Didik (AKPD)" : jenis === "SOSIOMETRI" ? "Sosiometri kelas" : "");
  if (!judul) return Response.json({ error: "Judul wajib diisi." }, { status: 400 });
  const r = rapikanSasaran({ ...b, targetRole: jenis === "AKPD" || jenis === "SOSIOMETRI" ? "STUDENT" : b.targetRole }, hak);
  if (r.galat !== undefined) return Response.json({ error: r.galat }, { status: 400 });
  const pertanyaan = jenis === "AKPD"
    ? TEMPLAT_AKPD.map((t, i) => ({ urutan: i + 1, teks: t.teks, tipe: "PILIHAN", opsi: ["Ya", "Tidak"], kelompok: t.kelompok }))
    : jenis === "SOSIOMETRI"
      ? [
          { urutan: 1, teks: "Siapa teman sekelas yang paling kamu pilih untuk belajar atau kerja kelompok bersama?", tipe: "TEMAN", opsi: [], maksPilih: 3 },
          { urutan: 2, teks: "Siapa teman sekelas yang paling kamu pilih untuk kegiatan di luar pelajaran (olahraga, asrama, organisasi)?", tipe: "TEMAN", opsi: [], maksPilih: 3 },
          { urutan: 3, teks: "Siapa teman sekelas yang paling kamu percaya untuk bercerita?", tipe: "TEMAN", opsi: [], maksPilih: 3, wajib: false },
        ]
      : [];
  const s = await prisma.survei.create({
    data: {
      judul, deskripsi: String(b.deskripsi ?? "").trim().slice(0, 2000) || null, jenis, ...r.sasaran,
      anonim: jenis === "SOSIOMETRI" || jenis === "AKPD" ? false : !!b.anonim,
      hasilRahasia: jenis === "SOSIOMETRI" || jenis === "AKPD" ? true : !!b.hasilRahasia,
      selesai: b.selesai ? new Date(b.selesai) : null,
      pembuatId: session.userId, pembuatNama: session.name,
      pertanyaan: { create: pertanyaan },
    },
  });
  await logActivity(session, { action: "CREATE", entity: "Survei", entityId: s.id, description: `Membuat survei "${judul}"` }).catch(() => null);
  return Response.json({ id: s.id }, { status: 201 });
}
