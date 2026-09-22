import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { getParentChildrenOrRedirect } from "@/lib/parent-guard";
import { segarkanAntrean } from "@/lib/antrean-kerja";
import { kirimLatar, kirimNotifikasi } from "@/lib/push-server";
import { MAKS_HARI_IZIN, SAKIT_WAJIB_SURAT_LEBIH_DARI, hariIniWib, hariSekolah, isoTanggal, labelRentang, tanggalUtc } from "@/lib/izin-siswa";

export const dynamic = "force-dynamic";

/** PENGAJUAN IZIN/SAKIT oleh orang tua (17 Sep 2026). GET = riwayat semua anak; POST = ajukan. */
export async function GET() {
  const session = await verifyRole(["PARENT"]);
  const anak = await getParentChildrenOrRedirect(session);
  const daftar = await prisma.izinSiswa.findMany({
    where: { studentId: { in: anak.map(a => a.id) } },
    orderBy: { createdAt: "desc" }, take: 100,
    select: {
      id: true, studentId: true, jenis: true, tanggalMulai: true, tanggalSelesai: true, alasan: true, lampiran: true,
      status: true, namaPemutus: true, diputuskanPada: true, catatanPemutus: true, createdAt: true,
    },
  });
  return Response.json({
    anak: anak.map(a => ({ id: a.id, nama: a.user.name, kelas: a.class?.name ?? "-" })),
    daftar: daftar.map(d => ({ ...d, lampiran: !!d.lampiran, tanggalMulai: isoTanggal(d.tanggalMulai), tanggalSelesai: isoTanggal(d.tanggalSelesai) })),
    aturan: { maksHari: MAKS_HARI_IZIN, sakitWajibSuratLebihDari: SAKIT_WAJIB_SURAT_LEBIH_DARI, hariIni: hariIniWib() },
  });
}

export async function POST(req: Request) {
  const session = await verifyRole(["PARENT"]);
  const anak = await getParentChildrenOrRedirect(session);
  const b = await req.json().catch(() => null) as Record<string, unknown> | null;
  const teks = (k: string) => (typeof b?.[k] === "string" ? (b[k] as string).trim() : "");
  const studentId = teks("studentId"), jenis = teks("jenis"), mulai = teks("tanggalMulai"), selesai = teks("tanggalSelesai") || teks("tanggalMulai");
  const alasan = teks("alasan").slice(0, 500), lampiran = teks("lampiran").replace(/[^A-Za-z0-9.-]/g, "");
  const siswa = anak.find(a => a.id === studentId);
  if (!siswa) return Response.json({ error: "Pilih anak yang diajukan izinnya." }, { status: 400 });
  if (jenis !== "IZIN" && jenis !== "SAKIT") return Response.json({ error: "Pilih jenis: izin atau sakit." }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(mulai) || !/^\d{4}-\d{2}-\d{2}$/.test(selesai) || selesai < mulai) {
    return Response.json({ error: "Tanggal tidak valid." }, { status: 400 });
  }
  if (alasan.length < 5) return Response.json({ error: "Tuliskan alasan singkat (minimal 5 huruf)." }, { status: 400 });
  const hariIni = hariIniWib();
  const kemarin = isoTanggal(new Date(tanggalUtc(hariIni).getTime() - 86400000));
  if (mulai < kemarin) return Response.json({ error: "Pengajuan paling lambat satu hari setelah tanggal tidak masuk (H+1). Untuk tanggal yang lebih lama, hubungi wali kelas." }, { status: 400 });
  const lama = (tanggalUtc(selesai).getTime() - tanggalUtc(mulai).getTime()) / 86400000 + 1;
  if (lama > MAKS_HARI_IZIN) return Response.json({ error: `Rentang izin maksimal ${MAKS_HARI_IZIN} hari.` }, { status: 400 });
  const hari = await hariSekolah(mulai, selesai);
  if (!hari.length) return Response.json({ error: "Rentang tanggal itu seluruhnya hari libur." }, { status: 400 });
  if (jenis === "SAKIT" && hari.length > SAKIT_WAJIB_SURAT_LEBIH_DARI && !lampiran) {
    return Response.json({ error: `Sakit lebih dari ${SAKIT_WAJIB_SURAT_LEBIH_DARI} hari sekolah wajib melampirkan foto surat dokter.` }, { status: 400 });
  }
  const bentrok = await prisma.izinSiswa.findFirst({
    where: { studentId, status: { in: ["MENUNGGU", "DISETUJUI"] }, tanggalMulai: { lte: tanggalUtc(selesai) }, tanggalSelesai: { gte: tanggalUtc(mulai) } },
    select: { id: true },
  });
  if (bentrok) return Response.json({ error: "Sudah ada pengajuan untuk tanggal itu." }, { status: 409 });

  const izin = await prisma.izinSiswa.create({
    data: {
      studentId, jenis, tanggalMulai: tanggalUtc(mulai), tanggalSelesai: tanggalUtc(selesai), alasan, lampiran: lampiran || null,
      diajukanOleh: session.userId, namaPengaju: session.name,
    },
  });
  kirimLatar(async () => {
    const kelas = siswa.classId ? await prisma.class.findUnique({ where: { id: siswa.classId }, select: { homeroom: { select: { userId: true } } } }) : null;
    if (!kelas?.homeroom?.userId) return;
    await kirimNotifikasi({
      userIds: [kelas.homeroom.userId], jenis: "IZIN_SISWA", kunci: `izin-diajukan:${izin.id}`,
      judul: `Pengajuan ${jenis === "SAKIT" ? "sakit" : "izin"}: ${siswa.user.name}`,
      isi: `${siswa.class?.name ?? ""} · ${labelRentang(mulai, selesai)}. Alasan: ${alasan.slice(0, 80)}. Mohon disetujui atau ditolak.`,
      url: "/dashboard/teacher/izin-siswa", tag: `izin-${izin.id}`,
    });
  });
  segarkanAntrean();
  return Response.json({ ok: true, id: izin.id }, { status: 201 });
}
