import { readFile, unlink } from "fs/promises";
import { join } from "path";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { logActivity } from "@/lib/activity-log";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { FOLDER_BERKAS_SISWA, hakBerkasSiswa } from "@/lib/berkas-siswa";
import { labelBerkasSiswa } from "@/lib/berkas-siswa-jenis";

export const dynamic = "force-dynamic";
const cari = (id: string) => prisma.berkasSiswa.findUnique({ where: { id }, select: { id: true, studentId: true, jenis: true, berkas: true, mime: true, student: { select: { nis: true, user: { select: { name: true } } } } } });

/** Buka satu berkas siswa — TU/Operator Sekolah/Admin atau wali kelas siswa itu. Yang lain mendapat 404 (bukan 403),
 *  supaya id berkas tidak bisa dipakai menebak ada-tidaknya dokumen seseorang. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifySession();
    const b = await cari((await params).id);
    if (!b || !(await hakBerkasSiswa(session, b.studentId)).lihat || !/^[A-Za-z0-9.-]+$/.test(b.berkas)) return new Response("Not found", { status: 404 });
    const isi = await readFile(join(FOLDER_BERKAS_SISWA, b.studentId, b.berkas));
    return new Response(new Uint8Array(isi), { headers: { "Content-Type": b.mime, "Content-Disposition": "inline", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (e) { lemparBilaPengalihan(e); return new Response("Not found", { status: 404 }); }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifySession();
    const b = await cari((await params).id);
    if (!b || !(await hakBerkasSiswa(session, b.studentId)).kelola) return Response.json({ error: "Tidak ditemukan." }, { status: 404 });
    await prisma.berkasSiswa.delete({ where: { id: b.id } });
    if (/^[A-Za-z0-9.-]+$/.test(b.berkas)) await unlink(join(FOLDER_BERKAS_SISWA, b.studentId, b.berkas)).catch(() => null);
    await logActivity(session, { action: "DELETE", entity: "BerkasSiswa", entityId: b.id, description: `${session.name} menghapus berkas ${labelBerkasSiswa(b.jenis)} milik "${b.student.user.name}" (${b.student.nis})` });
    return Response.json({ ok: true });
  } catch (e) { lemparBilaPengalihan(e); return Response.json({ error: "Gagal menghapus." }, { status: 500 }); }
}
