import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { logActivity } from "@/lib/activity-log";
import { bolehAturUjian, ringkasKegiatan, SELECT_KEGIATAN } from "@/lib/kegiatan-ujian-server";
import { bacaIsianKegiatan } from "@/lib/kegiatan-ujian-input";
import { pastikanTokenKegiatan, putarTokenKegiatanBilaPerlu } from "@/lib/ujian-server";
import { POLA_KALENDER } from "@/lib/kegiatan-ujian";
import { NextRequest } from "next/server";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

/** Daftar Kegiatan Ujian (STS/SAS/PSAJ/...). Semua petugas ujian boleh MELIHAT (dipakai untuk
 * memilih kegiatan saat menyusun ujian); hanya pengatur ujian yang boleh menambah/mengubah.
 * Ikut dikirim: usulan dari Kalender Pendidikan tahun aktif, supaya nama & tanggal kegiatan
 * tidak diketik ulang (dan tidak berbeda dari kalender resmi sekolah). */
export async function GET() {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const [daftar, tahun, bolehAtur] = await Promise.all([
      prisma.kegiatanUjian.findMany({
        select: { ...SELECT_KEGIATAN, _count: { select: { exams: true } } },
        orderBy: [{ aktif: "desc" }, { tanggalMulai: "desc" }, { createdAt: "desc" }],
      }),
      prisma.academicYear.findMany({ select: { id: true, name: true, isActive: true }, orderBy: { name: "desc" } }),
      bolehAturUjian(session),
    ]);

    // Putar token kegiatan yang berjangka — halaman ini memang dibuka petugas ujian selama
    // kegiatan berlangsung, sama seperti Ruang Kendali memutar token per-ujian.
    for (const k of daftar) {
      if (!k.token && k.aktif) k.token = await pastikanTokenKegiatan(k).catch(() => null);
      if (k.token && k.tokenOtomatisMenit > 0) {
        const hasil = await putarTokenKegiatanBilaPerlu(k).catch(() => null);
        if (hasil?.token && hasil.token !== k.token) { k.token = hasil.token; k.tokenDiperbarui = hasil.tokenDiperbarui; }
      }
    }

    const aktif = tahun.find(t => t.isActive);
    const agenda = aktif ? await prisma.schoolEvent.findMany({
      where: { academicYearId: aktif.id, jenis: "UJIAN" },
      select: { judul: true, tanggalMulai: true, tanggalSelesai: true },
      orderBy: { tanggalMulai: "asc" },
    }) : [];
    const usulanKalender = agenda.flatMap(a => {
      const jenis = Object.entries(POLA_KALENDER).find(([, re]) => re.test(a.judul))?.[0];
      if (!jenis) return [];
      const bulan = a.tanggalMulai.getUTCMonth() + 1;
      return [{
        judul: a.judul, jenis,
        semester: /genap/i.test(a.judul) ? "GENAP" : /ganj/i.test(a.judul) ? "GANJIL" : bulan >= 7 ? "GANJIL" : "GENAP",
        tanggalMulai: a.tanggalMulai.toISOString().slice(0, 10),
        tanggalSelesai: a.tanggalSelesai.toISOString().slice(0, 10),
        academicYearId: aktif!.id,
      }];
    });

    return Response.json({
      daftar: daftar.map(k => ({ ...ringkasKegiatan(k), jumlahUjian: k._count.exams })),
      tahunAjaran: tahun, bolehAtur, usulanKalender,
    });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal memuat kegiatan ujian." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    if (!(await bolehAturUjian(session))) {
      return Response.json({ error: "Hanya Administrator atau Wakil Kepala Kurikulum yang boleh mengatur kegiatan ujian." }, { status: 403 });
    }
    const { data, error } = bacaIsianKegiatan(await req.json());
    if (error) return Response.json({ error }, { status: 400 });
    const k = await prisma.kegiatanUjian.create({ data: data as never, select: SELECT_KEGIATAN });
    await logActivity(session, { action: "TAMBAH_KEGIATAN_UJIAN", entity: "KegiatanUjian", entityId: k.id, description: `Menambah kegiatan ujian "${k.nama}"` });
    return Response.json(ringkasKegiatan(k));
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal menyimpan kegiatan ujian." }, { status: 500 });
  }
}
