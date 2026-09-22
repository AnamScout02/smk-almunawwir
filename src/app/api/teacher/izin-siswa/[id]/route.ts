import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { logActivity } from "@/lib/activity-log";
import { segarkanAntrean } from "@/lib/antrean-kerja";
import { kirimLatar, kirimNotifikasi } from "@/lib/push-server";
import { cakupanIzin, hariSekolah, isoTanggal, labelRentang, tanggalUtc } from "@/lib/izin-siswa";

export const dynamic = "force-dynamic";

/** Wali kelas (atau Admin) memutuskan pengajuan. DISETUJUI → Attendance tiap hari sekolah dalam rentang diisi IZIN/SAKIT
 * (menggantikan catatan hari itu, termasuk ALPHA). Orang tua diberi tahu hasilnya. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyRole(["TEACHER", "ADMIN"]);
  const { id } = await params;
  const b = await req.json().catch(() => null) as { keputusan?: unknown; catatan?: unknown } | null;
  const keputusan = b?.keputusan === "DISETUJUI" ? "DISETUJUI" : b?.keputusan === "DITOLAK" ? "DITOLAK" : null;
  const catatan = typeof b?.catatan === "string" ? b.catatan.trim().slice(0, 300) : "";
  if (!keputusan) return Response.json({ error: "Pilih setujui atau tolak." }, { status: 400 });
  if (keputusan === "DITOLAK" && catatan.length < 3) return Response.json({ error: "Tuliskan alasan penolakan untuk orang tua." }, { status: 400 });

  const izin = await prisma.izinSiswa.findUnique({
    where: { id },
    include: { student: { select: { id: true, classId: true, user: { select: { name: true } }, class: { select: { name: true } } } } },
  });
  if (!izin) return Response.json({ error: "Pengajuan tidak ditemukan." }, { status: 404 });
  const c = await cakupanIzin(session);
  if (c.ubahKelas !== null && !(izin.student.classId && c.ubahKelas.includes(izin.student.classId))) {
    return Response.json({ error: "Hanya wali kelas siswa ini yang dapat memutuskan." }, { status: 403 });
  }
  if (izin.status !== "MENUNGGU") return Response.json({ error: "Pengajuan ini sudah diputuskan atau dibatalkan." }, { status: 409 });

  const mulai = isoTanggal(izin.tanggalMulai), selesai = isoTanggal(izin.tanggalSelesai);
  const hari = keputusan === "DISETUJUI" ? await hariSekolah(mulai, selesai) : [];
  await prisma.$transaction(async tx => {
    const ubah = await tx.izinSiswa.updateMany({
      where: { id, status: "MENUNGGU" },
      data: { status: keputusan, diputuskanOleh: session.userId, namaPemutus: session.name, diputuskanPada: new Date(), catatanPemutus: catatan || null },
    });
    if (!ubah.count) throw new Error("SUDAH_DIPUTUSKAN");
    for (const h of hari) {
      const tgl = tanggalUtc(h);
      await tx.attendance.deleteMany({ where: { studentId: izin.studentId, date: { gte: tgl, lt: new Date(tgl.getTime() + 86400000) } } });
      await tx.attendance.create({ data: { studentId: izin.studentId, date: tgl, status: izin.jenis } });
    }
  }).catch(e => { if ((e as Error).message !== "SUDAH_DIPUTUSKAN") throw e; });

  await logActivity(session, {
    action: keputusan === "DISETUJUI" ? "SETUJUI_IZIN_SISWA" : "TOLAK_IZIN_SISWA", entity: "IzinSiswa", entityId: id,
    description: `${keputusan === "DISETUJUI" ? "Menyetujui" : "Menolak"} ${izin.jenis.toLowerCase()} ${izin.student.user.name} (${izin.student.class?.name ?? "-"}) ${labelRentang(mulai, selesai)}${hari.length ? ` — ${hari.length} hari absensi diisi` : ""}`,
  }).catch(() => {});
  kirimLatar(() => kirimNotifikasi({
    userIds: [izin.diajukanOleh], jenis: "IZIN_SISWA", kunci: `izin-diputuskan:${id}`,
    judul: `Pengajuan ${izin.jenis === "SAKIT" ? "sakit" : "izin"} ${keputusan === "DISETUJUI" ? "disetujui" : "ditolak"}`,
    isi: `${izin.student.user.name} · ${labelRentang(mulai, selesai)}${catatan ? `. Catatan wali kelas: ${catatan}` : ""}`,
    url: "/dashboard/parent/izin", tag: `izin-${id}`,
  }));
  segarkanAntrean();
  return Response.json({ ok: true, hariDiisi: hari.length });
}
