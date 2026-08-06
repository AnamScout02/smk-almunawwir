import { NextRequest, NextResponse } from "next/server";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { formatNomorSurat, parseNomorUrut } from "@/lib/nomor-surat";

export async function GET(req: NextRequest) {
  try {
    await verifyTasAccess();
    const { searchParams } = new URL(req.url);
    const klasifikasi = (searchParams.get("klasifikasi") || "").trim();
    if (!klasifikasi) return NextResponse.json({ error: "Klasifikasi wajib diisi untuk membuat nomor otomatis." }, { status: 400 });

    const activeYear = await prisma.academicYear.findFirst({ where: { isActive: true } });
    if (!activeYear) return NextResponse.json({ error: "Tahun ajaran aktif belum diatur." }, { status: 400 });

    const [existing, settings] = await Promise.all([
      prisma.surat.findMany({ where: { tipe: "KELUAR", tanggal: { gte: activeYear.startDate } }, select: { nomor: true } }),
      getSettings(["school.kode"]),
    ]);
    // Lanjutkan dari nomor urut tertinggi yang sudah ada (termasuk yang diimpor dari catatan manual)
    // — bukan dari jumlah baris, karena jumlah baris di database tidak selalu sama dengan urutan asli.
    const maxUrut = existing.reduce((max, s) => Math.max(max, parseNomorUrut(s.nomor)), 0);

    const nomor = formatNomorSurat(maxUrut + 1, klasifikasi, settings["school.kode"], new Date());
    return NextResponse.json({ nomor });
  } catch {
    return NextResponse.json({ error: "Gagal membuat nomor otomatis." }, { status: 500 });
  }
}
