import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { aksesPusatPkl } from "@/lib/pkl-humas";
import { kirimLatar, kirimNotifikasi } from "@/lib/push-server";
import { penerimaLaporan } from "@/lib/pkl-server";
import { JENIS_LAPORAN } from "@/lib/pkl-label";

export const dynamic = "force-dynamic";

/** Laporan masalah PKL. Humas melihat semua; guru pembimbing hanya siswa bimbingannya. */
export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    const humas = await aksesPusatPkl(session);
    const laporan = await prisma.laporanPkl.findMany({
      where: humas ? {} : { internship: { teacher: { userId: session.userId } } },
      orderBy: [{ createdAt: "desc" }], take: 500,
      select: {
        id: true, pelapor: true, pelaporNama: true, jenis: true, isi: true, fotoUrl: true, status: true, tindakLanjut: true, ditanganiOleh: true,
        ditanganiPada: true, selesaiPada: true, createdAt: true,
        internship: { select: { studentId: true, company: true, mitraId: true, student: { select: { nis: true, user: { select: { name: true } }, class: { select: { name: true } } } }, teacher: { select: { user: { select: { name: true } } } } } },
      },
    });
    return Response.json({
      humas,
      laporan: laporan.map(l => ({
        id: l.id, pelapor: l.pelapor, pelaporNama: l.pelaporNama, jenis: l.jenis, isi: l.isi, fotoUrl: l.fotoUrl, status: l.status, tindakLanjut: l.tindakLanjut,
        ditanganiOleh: l.ditanganiOleh, ditanganiPada: l.ditanganiPada, selesaiPada: l.selesaiPada, dibuat: l.createdAt,
        studentId: l.internship.studentId, siswa: l.internship.student.user.name, nis: l.internship.student.nis, kelas: l.internship.student.class?.name ?? null,
        tempat: l.internship.company, adaDudi: !!l.internship.mitraId, guru: l.internship.teacher?.user.name ?? null,
      })),
    });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Tidak berwenang" }, { status: 403 });
  }
}

/** Guru pembimbing / Humas mencatat masalah yang ia temukan sendiri (mis. saat monitoring). */
export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    const b = await req.json().catch(() => ({})) as Record<string, unknown>;
    const studentId = typeof b.studentId === "string" ? b.studentId : "";
    const jenis = typeof b.jenis === "string" && JENIS_LAPORAN[b.jenis] ? b.jenis : "";
    const isi = typeof b.isi === "string" ? b.isi.trim().slice(0, 2000) : "";
    if (!studentId || !jenis || isi.length < 10) return Response.json({ error: "Siswa, jenis masalah, dan uraian (min. 10 huruf) wajib diisi." }, { status: 400 });
    const pkl = await prisma.internship.findUnique({ where: { studentId }, select: { id: true, company: true, teacher: { select: { userId: true } }, student: { select: { user: { select: { name: true } } } } } });
    if (!pkl) return Response.json({ error: "Siswa itu bukan peserta PKL." }, { status: 404 });
    const humas = await aksesPusatPkl(session);
    if (!humas && pkl.teacher?.userId !== session.userId) return Response.json({ error: "Hanya Humas atau guru pembimbing siswa itu." }, { status: 403 });
    const l = await prisma.laporanPkl.create({ data: { internshipId: pkl.id, pelapor: "GURU", pelaporNama: session.name, jenis, isi } });
    kirimLatar(async () => kirimNotifikasi({
      userIds: (await penerimaLaporan(pkl.teacher?.userId)).filter(id => id !== session.userId), jenis: "PKL", kunci: `pkl-laporan:${l.id}`,
      judul: `Laporan PKL: ${JENIS_LAPORAN[jenis]}`, isi: `${pkl.student.user.name} (${pkl.company}) — ${isi.slice(0, 120)}`, url: "/pkl/laporan",
    }));
    return Response.json({ ok: true }, { status: 201 });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal menyimpan laporan." }, { status: 500 });
  }
}
