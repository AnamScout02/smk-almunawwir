import { readFile } from "fs/promises";
import { join } from "path";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { FOLDER_BUKTI, MIME_BUKTI, bolehLihatBukti } from "@/lib/izin-keluar";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

/** Buka bukti foto izin keluar — siswanya sendiri, orang tuanya, wali kelasnya, petugas
 *  piket/Kesiswaan/BK, pencatatnya, atau Admin. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifySession();
    const { id } = await params;
    const izin = await prisma.izinKeluarSiswa.findUnique({
      where: { id }, select: { studentId: true, dicatatId: true, buktiFoto: true },
    });
    if (!izin?.buktiFoto || !(await bolehLihatBukti(session, izin))) return new Response("Not found", { status: 404 });
    const nama = izin.buktiFoto.replace(/[^A-Za-z0-9.-]/g, "");
    const ext = nama.split(".").pop() ?? "";
    if (!MIME_BUKTI[ext]) return new Response("Not found", { status: 404 });
    const isi = await readFile(join(FOLDER_BUKTI, nama));
    return new Response(new Uint8Array(isi), {
      headers: { "Content-Type": MIME_BUKTI[ext], "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    lemparBilaPengalihan(e);
    return new Response("Not found", { status: 404 });
  }
}
