import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { getSettings } from "@/lib/site-settings";
import { logActivity } from "@/lib/activity-log";
import { bolehAturUjian } from "@/lib/kegiatan-ujian-server";
import { NextRequest } from "next/server";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

const KUNCI = [
  "ujian.durasiBawaan", "ujian.acakSoal", "ujian.acakOpsi", "ujian.satuSoalPerHalaman",
  "ujian.tampilkanNilai", "ujian.batasPindahTab", "ujian.petunjukTambahan",
  "ujian.tokenOtomatisMenit", "ujian.batasPutarAudio", "ujian.kunciTerputusMenit",
  "ujian.izinKalkulator", "ujian.izinCoretan",
  // Safe Exam Browser — kunci dari SEB Configuration Tool di komputer sekolah (lihat src/lib/seb.ts).
  "ujian.sebKunci", "ujian.sebConfigKey",
  // Aplikasi Ujian Android: PIN keluar saat mengerjakan (dicek /api/ujian/aplikasi/keluar).
  "ujian.pinAplikasi",
] as const;

/** Pengaturan bawaan ujian baru. GET terbuka untuk semua petugas ujian (penyusun ujian memakai
 * nilainya sebagai isian awal); PUT khusus pengatur ujian. */
export async function GET() {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const [s, bolehAtur] = await Promise.all([getSettings([...KUNCI]), bolehAturUjian(session)]);
    return Response.json({ ...s, bolehAtur });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal memuat pengaturan." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    if (!(await bolehAturUjian(session))) {
      return Response.json({ error: "Hanya Administrator atau Wakil Kepala Kurikulum yang boleh mengubah pengaturan ujian." }, { status: 403 });
    }
    const b = await req.json();
    const bersih: Record<string, string> = {};
    if (b["ujian.durasiBawaan"] !== undefined) bersih["ujian.durasiBawaan"] = String(Math.min(600, Math.max(1, Number(b["ujian.durasiBawaan"]) || 90)));
    if (b["ujian.batasPindahTab"] !== undefined) bersih["ujian.batasPindahTab"] = String(Math.min(99, Math.max(0, Number(b["ujian.batasPindahTab"]) || 0)));
    const angka = (k: string, min: number, maks: number) => { if (b[k] !== undefined) bersih[k] = String(Math.min(maks, Math.max(min, Math.round(Number(b[k]) || 0)))); };
    angka("ujian.tokenOtomatisMenit", 0, 240); angka("ujian.batasPutarAudio", 0, 10); angka("ujian.kunciTerputusMenit", 0, 120);
    for (const k of ["ujian.acakSoal", "ujian.acakOpsi", "ujian.satuSoalPerHalaman", "ujian.tampilkanNilai", "ujian.izinKalkulator", "ujian.izinCoretan"] as const) {
      if (b[k] !== undefined) bersih[k] = b[k] === true || b[k] === "1" ? "1" : "0";
    }
    if (b["ujian.pinAplikasi"] !== undefined) bersih["ujian.pinAplikasi"] = String(b["ujian.pinAplikasi"] ?? "").replace(/\D/g, "").slice(0, 8);
    if (b["ujian.petunjukTambahan"] !== undefined) bersih["ujian.petunjukTambahan"] = String(b["ujian.petunjukTambahan"] ?? "").slice(0, 2000);

    await prisma.$transaction(Object.entries(bersih).map(([key, value]) =>
      prisma.siteSetting.upsert({ where: { key }, update: { value }, create: { key, value } })));
    await logActivity(session, { action: "UBAH_PENGATURAN_UJIAN", entity: "SiteSetting", description: "Mengubah pengaturan bawaan ujian", metadata: { ...bersih, ...(bersih["ujian.pinAplikasi"] !== undefined ? { "ujian.pinAplikasi": bersih["ujian.pinAplikasi"] ? "(diubah)" : "(dikosongkan)" } : {}) } });
    return Response.json({ ok: true });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal menyimpan pengaturan." }, { status: 500 });
  }
}
