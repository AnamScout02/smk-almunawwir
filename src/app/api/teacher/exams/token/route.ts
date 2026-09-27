import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { filterDaftarUjian, tokenTampilUjian, type TokenTampil } from "@/lib/ujian-server";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** TOKEN TERKINI beberapa ujian sekaligus — dipanggil berkala oleh layar petugas (halaman detail ujian, Daftar
 * Ujian) lewat `useTokenLangsung`. Dulu kedua layar itu hanya mengambil token sekali saat dibuka, sehingga setelah
 * token berganti otomatis mereka tetap menampilkan token lama sampai halaman dimuat ulang (temuan user 21 Sep 2026).
 * Isi & perputarannya satu sumber dengan papan pantau (`tokenTampilUjian`). */
export async function GET(req: NextRequest) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const ids = [...new Set((new URL(req.url).searchParams.get("ids") ?? "").split(",").map(x => x.trim()).filter(Boolean))].slice(0, 100);
    if (!ids.length) return Response.json({});
    const filterGuru = await filterDaftarUjian(session);
    const exams = await prisma.exam.findMany({
      where: { AND: [{ id: { in: ids } }, filterGuru ?? {}] },
      select: { id: true, token: true, tokenOtomatisMenit: true, tokenDiperbarui: true, isPublished: true, kegiatanId: true, endTime: true },
    });
    const singgahKeg = new Map<string, { token: string | null; berganti: string | null }>();
    const hasil: Record<string, TokenTampil> = {};
    for (const e of exams) hasil[e.id] = await tokenTampilUjian(e, singgahKeg);
    return Response.json(hasil, { headers: { "Cache-Control": "no-store" } });
  } catch (galat) {
    lemparBilaPengalihan(galat);
    return Response.json({ error: "Tidak diizinkan" }, { status: 403 });
  }
}
