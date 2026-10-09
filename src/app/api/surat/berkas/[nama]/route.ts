import { readFile } from "fs/promises";
import { join } from "path";
import { verifySession } from "@/lib/dal";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { FOLDER_SURAT, MIME_SURAT, bolehBukaSurat } from "@/lib/surat-berkas";

export const dynamic = "force-dynamic";

/** Buka pindaian surat masuk — hanya TU, pimpinan, Admin, atau orang yang dituju disposisinya. */
export async function GET(_req: Request, { params }: { params: Promise<{ nama: string }> }) {
  try {
    const session = await verifySession();
    const nama = (await params).nama.replace(/[^A-Za-z0-9.-]/g, "");
    const ext = nama.split(".").pop() ?? "";
    if (!MIME_SURAT[ext] || nama.includes("..") || !(await bolehBukaSurat(session, nama))) return new Response("Not found", { status: 404 });
    const isi = await readFile(join(FOLDER_SURAT, nama));
    return new Response(new Uint8Array(isi), { headers: { "Content-Type": MIME_SURAT[ext], "Content-Disposition": "inline", "Cache-Control": "private, no-store" } });
  } catch (e) { lemparBilaPengalihan(e); return new Response("Not found", { status: 404 }); }
}
