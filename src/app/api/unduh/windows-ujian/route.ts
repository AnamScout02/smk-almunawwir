import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { join } from "path";
import { Readable } from "stream";

export const dynamic = "force-dynamic";

/** Unduhan MyAlwis Ujian untuk Windows (±115 MB). Berkasnya di volume unggahan
 *  (`public/uploads/unduh`, dipasang windows-ujian/bangun-exe.sh) — SENGAJA tidak di dalam image supaya
 *  tiap build situs tidak menyalin 115 MB. Dialirkan dari disk, bukan dibaca utuh ke memori seperti
 *  /api/uploads. */
const BERKAS = join(process.cwd(), "public", "uploads", "unduh", "myalwis-ujian-windows.zip");

export async function GET() {
  const info = await stat(BERKAS).catch(() => null);
  if (!info) return new Response("Berkas belum tersedia.", { status: 404 });
  const aliran = Readable.toWeb(createReadStream(BERKAS)) as ReadableStream;
  return new Response(aliran, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Length": String(info.size),
      "Content-Disposition": 'attachment; filename="MyAlwisUjian-Windows.zip"',
      "Cache-Control": "public, max-age=3600",
    },
  });
}
