import { readFile } from "fs/promises";
import { join, normalize } from "path";
import { NextRequest } from "next/server";

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
};

// Melayani file yang di-upload saat runtime secara langsung dari disk.
// File statis di folder public/ hanya di-scan sekali saat server start,
// jadi file yang baru di-upload tidak akan muncul lewat static serving
// bawaan Next.js sampai server di-restart. Route ini membaca file langsung
// per-request sehingga upload baru langsung bisa diakses tanpa restart.
export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const relPath = normalize(join(...segments));

  if (relPath.startsWith("..")) {
    return new Response("Forbidden", { status: 403 });
  }

  const ext = relPath.split(".").pop()?.toLowerCase() ?? "";
  const mime = MIME[ext];
  if (!mime) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const filePath = join(process.cwd(), "public", "uploads", relPath);
    const buffer = await readFile(filePath);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
