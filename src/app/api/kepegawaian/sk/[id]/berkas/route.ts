import { readFile } from "fs/promises";
import { join } from "path";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { FOLDER_SK, guruSaya, kelolaKepegawaian } from "@/lib/arsip-sk";

export const dynamic = "force-dynamic";

const TIPE: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

/** Buka berkas SK — hanya pengelola kepegawaian dan guru pemilik dokumen itu. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  const { id } = await params;
  const a = await prisma.arsipSk.findUnique({ where: { id }, select: { berkas: true, teacherId: true, judul: true } });
  if (!a?.berkas || !/^[\w.-]{5,120}$/.test(a.berkas)) return new Response("Tidak ditemukan", { status: 404 });
  const saya = await guruSaya(session.userId);
  if (!(await kelolaKepegawaian(session)) && saya?.id !== a.teacherId) return new Response("Tidak berhak", { status: 403 });
  const isi = await readFile(join(FOLDER_SK, a.berkas)).catch(() => null);
  if (!isi) return new Response("Berkas tidak ada", { status: 404 });
  const ext = a.berkas.split(".").pop() ?? "";
  return new Response(new Uint8Array(isi), {
    headers: { "Content-Type": TIPE[ext] ?? "application/octet-stream", "Content-Disposition": `inline; filename="${a.judul.replace(/[^\w -]/g, "").slice(0, 60)}.${ext}"`, "Cache-Control": "private, no-store" },
  });
}
