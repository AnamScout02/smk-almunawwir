import { readFile } from "fs/promises";
import { join } from "path";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { FOLDER_LAMPIRAN, bolehLihatIzin } from "@/lib/izin-siswa";

export const dynamic = "force-dynamic";

const MIME: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf" };

/** Buka lampiran pengajuan izin — hanya orang tua siswa itu, wali kelasnya, Kesiswaan/BK, dan Admin. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession();
  const { id } = await params;
  const izin = await prisma.izinSiswa.findUnique({ where: { id }, select: { studentId: true, diajukanOleh: true, lampiran: true } });
  if (!izin?.lampiran || !(await bolehLihatIzin(session, izin))) return new Response("Not found", { status: 404 });
  const nama = izin.lampiran.replace(/[^A-Za-z0-9.-]/g, "");
  const ext = nama.split(".").pop() ?? "";
  if (!MIME[ext]) return new Response("Not found", { status: 404 });
  try {
    const isi = await readFile(join(FOLDER_LAMPIRAN, nama));
    return new Response(new Uint8Array(isi), { headers: { "Content-Type": MIME[ext], "Cache-Control": "private, no-store" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
