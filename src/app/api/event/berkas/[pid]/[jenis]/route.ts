import { readFile } from "fs/promises";
import { join } from "path";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { FOLDER_EVENT, MIME_EVENT, bolehLihatBerkasEvent } from "@/lib/event-server";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

/** Buka karya / bukti bayar pendaftaran event — pengelola event atau siswa pemiliknya saja.
 *  Peserta LUAR tidak punya akun, jadi berkas mereka hanya bisa dibuka panitia. */
export async function GET(_req: Request, { params }: { params: Promise<{ pid: string; jenis: string }> }) {
  try {
    const session = await verifySession();
    const { pid, jenis } = await params;
    if (jenis !== "karya" && jenis !== "bukti") return new Response("Not found", { status: 404 });
    const p = await prisma.pendaftaranEvent.findUnique({ where: { id: pid }, select: { studentId: true, karyaBerkas: true, buktiBayar: true } });
    const berkas = jenis === "karya" ? p?.karyaBerkas : p?.buktiBayar;
    if (!p || !berkas || !(await bolehLihatBerkasEvent(session, p))) return new Response("Not found", { status: 404 });
    const nama = berkas.replace(/[^A-Za-z0-9.-]/g, "");
    const ext = nama.split(".").pop() ?? "";
    if (!MIME_EVENT[ext]) return new Response("Not found", { status: 404 });
    const isi = await readFile(join(FOLDER_EVENT, nama));
    const tampil = ["jpg", "png", "webp", "pdf", "mp4"].includes(ext);
    return new Response(new Uint8Array(isi), {
      headers: {
        "Content-Type": MIME_EVENT[ext], "Cache-Control": "private, no-store",
        "Content-Disposition": `${tampil ? "inline" : "attachment"}; filename="${jenis}-${pid}.${ext}"`,
      },
    });
  } catch (e) {
    lemparBilaPengalihan(e);
    return new Response("Not found", { status: 404 });
  }
}
