import { unlink } from "fs/promises";
import { kirimLatar } from "@/lib/push-server";
import { beritahuPoin } from "@/lib/notifikasi-kejadian";
import { bagianWib } from "@/lib/waktu-wib";
import { join } from "path";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { assertEvent, STATUS_DAFTAR } from "@/lib/event-guard";
import { FOLDER_EVENT } from "@/lib/event-server";
import { logActivity } from "@/lib/activity-log";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

const tolak = (e: unknown, pesan: string) => {
  lemparBilaPengalihan(e);
  if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Tidak berhak." }, { status: 403 });
  return Response.json({ error: pesan }, { status: 500 });
};

/** Daftar pendaftar satu event (siswa: kelas & NIS ikut, peserta luar: asal sekolah). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifySession();
    await assertEvent(session);
    const { id } = await params;
    const daftar = await prisma.pendaftaranEvent.findMany({
      where: { eventId: id },
      orderBy: { createdAt: "asc" },
      include: { student: { select: { nis: true, class: { select: { name: true } } } } },
    });
    // Jenis prestasi aktif — dipakai jendela status untuk mencatat juara sebagai poin prestasi siswa (tautan data 10 Okt 2026).
    const jenisPrestasi = await prisma.studentAchievementType.findMany({ where: { active: true }, select: { id: true, name: true, pointsMin: true, pointsMax: true }, orderBy: { order: "asc" } }).catch(() => []);
    return Response.json({
      jenisPrestasi,
      daftar: daftar.map(({ student, karyaBerkas, buktiBayar, ...p }) => ({
        ...p, nis: student?.nis ?? null, kelas: student?.class?.name ?? null,
        adaKarya: !!karyaBerkas, adaBukti: !!buktiBayar,
      })),
    });
  } catch (e) { return tolak(e, "Gagal memuat pendaftar."); }
}

/** Ubah status / juara / catatan panitia satu pendaftar. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifySession();
    await assertEvent(session);
    const { id } = await params;
    const b = await req.json().catch(() => ({}));
    const p = await prisma.pendaftaranEvent.findFirst({ where: { id: String(b.pid ?? ""), eventId: id }, select: { id: true, namaPeserta: true, studentId: true, prestasiId: true, status: true, juara: true, event: { select: { judul: true } } } });
    if (!p) return Response.json({ error: "Pendaftar tidak ditemukan." }, { status: 404 });
    const status = STATUS_DAFTAR.includes(String(b.status)) ? String(b.status) : undefined;
    const juara = typeof b.juara === "string" ? b.juara.trim().slice(0, 60) || null : undefined;
    if (status === "JUARA" && juara === null) return Response.json({ error: "Isi peringkat juara (mis. Juara 1)." }, { status: 400 });
    await prisma.pendaftaranEvent.update({
      where: { id: p.id },
      data: {
        ...(status ? { status } : {}),
        ...(juara !== undefined ? { juara } : {}),
        ...(typeof b.catatanPanitia === "string" ? { catatanPanitia: b.catatanPanitia.trim().slice(0, 1000) || null } : {}),
      },
    });
    // JUARA → POIN PRESTASI SISWA. Hanya bila panitia memilih jenis prestasinya (poin tidak ditebak), pendaftarnya siswa
    // sekolah, dan juara ini BELUM pernah dicatat (prestasiId). Orang tua dikabari lewat jalur poin yang sama.
    let prestasiDicatat = false;
    const pr = b.prestasi as { achievementTypeId?: string; points?: number } | undefined;
    const statusAkhir = status ?? p.status, juaraAkhir = juara !== undefined ? juara : p.juara;
    if (pr?.achievementTypeId && p.studentId && !p.prestasiId && statusAkhir === "JUARA") {
      const jenis = await prisma.studentAchievementType.findUnique({ where: { id: String(pr.achievementTypeId) } });
      const poin = Math.round(Number(pr.points));
      if (!jenis || !jenis.active) return Response.json({ error: "Status tersimpan, tetapi jenis prestasi tidak ditemukan." }, { status: 400 });
      if (!(poin >= jenis.pointsMin && poin <= jenis.pointsMax)) return Response.json({ error: `Status tersimpan, tetapi poin prestasi harus ${jenis.pointsMin}–${jenis.pointsMax} untuk jenis ini.` }, { status: 400 });
      const { tahun, bulan } = bagianWib();
      const semester = bulan >= 7 ? `Ganjil ${tahun}/${tahun + 1}` : `Genap ${tahun - 1}/${tahun}`;
      const catat = await prisma.studentPointRecord.create({
        data: { studentId: p.studentId, kind: "PRESTASI", achievementTypeId: jenis.id, points: poin, note: `${juaraAkhir ?? "Juara"} — ${p.event.judul}`.slice(0, 300), semester, recordedByName: session.name, recordedByRole: "Panitia Lomba & Event" },
      });
      const kunci = await prisma.pendaftaranEvent.updateMany({ where: { id: p.id, prestasiId: null }, data: { prestasiId: catat.id } });
      if (kunci.count === 0) await prisma.studentPointRecord.delete({ where: { id: catat.id } }).catch(() => null); // dua petugas bersamaan
      else { prestasiDicatat = true; kirimLatar(() => beritahuPoin(catat.id)); }
    }
    await logActivity(session, { action: "UPDATE", entity: "PendaftaranEvent", entityId: p.id, description: `Memperbarui pendaftaran ${p.namaPeserta}${status ? ` → ${status}` : ""}` }).catch(() => {});
    return Response.json({ ok: true, prestasiDicatat });
  } catch (e) { return tolak(e, "Gagal menyimpan."); }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifySession();
    await assertEvent(session);
    const { id } = await params;
    const pid = new URL(req.url).searchParams.get("pid") ?? "";
    const p = await prisma.pendaftaranEvent.findFirst({ where: { id: pid, eventId: id }, select: { id: true, namaPeserta: true, karyaBerkas: true, buktiBayar: true } });
    if (!p) return Response.json({ error: "Pendaftar tidak ditemukan." }, { status: 404 });
    await prisma.pendaftaranEvent.delete({ where: { id: p.id } });
    for (const b of [p.karyaBerkas, p.buktiBayar]) if (b) await unlink(join(FOLDER_EVENT, b.replace(/[^A-Za-z0-9.-]/g, ""))).catch(() => {});
    await logActivity(session, { action: "DELETE", entity: "PendaftaranEvent", entityId: p.id, description: `Menghapus pendaftaran ${p.namaPeserta}` }).catch(() => {});
    return Response.json({ ok: true });
  } catch (e) { return tolak(e, "Gagal menghapus."); }
}
