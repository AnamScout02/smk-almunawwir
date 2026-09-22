import { NextRequest } from "next/server";
import { IKON_CADANGAN, VARIAN_IKON, ikonAplikasi, type NamaIkon } from "@/lib/ikon-aplikasi";

export const dynamic = "force-dynamic";

/** Ikon aplikasi terpasang (PWA) dari Logo Lambang — lihat src/lib/ikon-aplikasi.ts. Publik (dipakai
 * manifest & apple-touch-icon sebelum login). Kalau logo gagal diolah, alihkan ke gambar cadangan statis. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ berkas: string }> }) {
  const { berkas } = await params;
  if (!Object.hasOwn(VARIAN_IKON, berkas)) return new Response("Tidak ditemukan", { status: 404 });
  const nama = berkas as NamaIkon;
  try {
    const { png, versi } = await ikonAplikasi(nama);
    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        ETag: `"${versi}-${nama}"`,
      },
    });
  } catch {
    return new Response(null, { status: 307, headers: { Location: IKON_CADANGAN[nama] } });
  }
}
