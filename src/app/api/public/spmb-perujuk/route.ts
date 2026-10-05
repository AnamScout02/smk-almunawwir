import { NextRequest } from "next/server";
import { bolehCariKode, cariPerujukPublik } from "@/lib/spmb-perujuk";

// Route publik polos yang menyentuh Prisma WAJIB dynamic (CLAUDE.md #1).
export const dynamic = "force-dynamic";

/** Memeriksa satu kode referral dari halaman pendaftaran. Jawabannya SENGAJA minim: kode yang
 *  dirapikan, nama yang DISAMARKAN, dan jenis perujuknya — cukup bagi calon untuk yakin kodenya
 *  benar, tetapi tidak cukup untuk memanen nama siswa. Dibatasi per IP. */
export async function GET(req: NextRequest) {
  const kode = req.nextUrl.searchParams.get("kode") ?? "";
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "tanpa-ip";

  if (!bolehCariKode(ip)) {
    return Response.json({ error: "Terlalu banyak percobaan. Coba lagi beberapa menit lagi." }, { status: 429 });
  }
  const r = await cariPerujukPublik(kode);
  // Tidak ditemukan dan tidak aktif dijawab SAMA — supaya tidak bisa dipakai membedakan keduanya.
  if (!r) return Response.json({ ketemu: false });
  return Response.json({ ketemu: true, ...r });
}
