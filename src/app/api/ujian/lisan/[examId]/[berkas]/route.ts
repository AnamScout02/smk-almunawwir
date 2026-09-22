import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { siswaDariSesi, ujianDalamCakupan } from "@/lib/ujian-server";
import { FOLDER_LISAN, JENIS_MIME, uraiBerkasLisan } from "@/lib/ujian-lisan";
import { stat, open } from "fs/promises";
import { join } from "path";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** Putar rekaman JAWABAN LISAN (src/lib/ujian-lisan.ts). Hanya: siswa pemilik pengerjaan itu, atau guru/admin yang
 * berhak atas ujiannya (`ujianDalamCakupan`). Mendukung Range — Safari/iPhone menolak memutar audio tanpa itu. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ examId: string; berkas: string }> }) {
  const session = await verifySession().catch(() => null);
  if (!session) return new Response("Unauthorized", { status: 401 });
  const { examId, berkas } = await params;
  const info = uraiBerkasLisan(berkas);
  if (!info) return new Response("Tidak ditemukan", { status: 404 });

  if (session.role === "STUDENT") {
    const siswa = await siswaDariSesi(session);
    const milik = siswa ? await prisma.examAttempt.findFirst({ where: { id: info.attemptId, examId, studentId: siswa.id }, select: { id: true } }) : null;
    if (!milik) return new Response("Forbidden", { status: 403 });
  } else if (["TEACHER", "ADMIN", "TAS"].includes(session.role)) {
    if (!(await ujianDalamCakupan(session, examId))) return new Response("Forbidden", { status: 403 });
  } else return new Response("Forbidden", { status: 403 });

  const jalur = join(FOLDER_LISAN, examId, berkas);
  const st = await stat(jalur).catch(() => null);
  if (!st?.isFile()) return new Response("Tidak ditemukan", { status: 404 });
  const tipe = JENIS_MIME[info.ext] ?? "application/octet-stream";
  const umum = { "Content-Type": tipe, "Accept-Ranges": "bytes", "Cache-Control": "private, no-store" };

  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.get("range") ?? "");
  let awal = 0, akhir = st.size - 1, status = 200;
  if (range) {
    awal = range[1] ? Number(range[1]) : Math.max(0, st.size - Number(range[2] || 0));
    akhir = range[1] && range[2] ? Math.min(Number(range[2]), st.size - 1) : st.size - 1;
    if (awal > akhir || awal >= st.size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${st.size}` } });
    status = 206;
  }
  const fh = await open(jalur, "r");
  const panjang = akhir - awal + 1;
  const buf = Buffer.alloc(panjang);
  await fh.read(buf, 0, panjang, awal).finally(() => fh.close());
  return new Response(buf, {
    status,
    headers: { ...umum, "Content-Length": String(panjang), ...(status === 206 ? { "Content-Range": `bytes ${awal}-${akhir}/${st.size}` } : {}) },
  });
}
