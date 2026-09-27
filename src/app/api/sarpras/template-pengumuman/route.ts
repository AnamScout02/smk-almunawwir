import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { aksesSarpras } from "@/lib/sarpras-akses";
import { logActivity } from "@/lib/activity-log";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** TEMPLATE PENGUMUMAN PAPAN (25 September 2026) — kalimat yang sering dipakai petugas.
 *
 * Alasannya bukan sekadar hemat ketikan: pengumuman lewat pengeras suara sekolah lebih mudah dipahami kalau
 * susunan kalimatnya selalu sama, dan template mencegah tiap petugas merangkai kalimatnya sendiri-sendiri.
 * Isinya tetap BOLEH disunting sebelum dikirim — template adalah titik awal, bukan kunci mati.
 *
 * Tanda kurung siku (`[nama]`, `[kelas]`, `[jam]`) sengaja dibiarkan sebagai isian yang diketik petugas, bukan
 * diganti otomatis: papan tidak tahu siapa yang dipanggil, dan menebaknya akan lebih berbahaya daripada berguna. */
export const CARA = ["TEKS_SUARA", "TEKS", "SUARA"] as const;

export async function GET() {
  try {
    await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    const daftar = await prisma.templatePengumuman.findMany({
      orderBy: [{ urutan: "asc" }, { judul: "asc" }],
    }).catch(() => []);
    return Response.json({ daftar });
  } catch (galat) {
    lemparBilaPengalihan(galat);
    return Response.json({ error: "Gagal memuat template." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    const akses = await aksesSarpras(session);
    if (!akses.kelola) return Response.json({ error: "Khusus pengelola sarana prasarana." }, { status: 403 });

    const b = await req.json().catch(() => ({})) as { id?: string; judul?: string; isi?: string; cara?: string; urutan?: number };
    const judul = (b.judul ?? "").trim();
    if (!judul) return Response.json({ error: "Judul template wajib diisi." }, { status: 400 });
    const data = {
      judul,
      isi: (b.isi ?? "").trim() || null,
      cara: CARA.includes(b.cara as typeof CARA[number]) ? b.cara! : "TEKS_SUARA",
      urutan: typeof b.urutan === "number" ? Math.round(b.urutan) : 0,
    };

    const hasil = b.id
      ? await prisma.templatePengumuman.update({ where: { id: b.id }, data })
      : await prisma.templatePengumuman.create({ data });
    await logActivity(session, {
      action: b.id ? "UBAH_TEMPLATE_PENGUMUMAN" : "TAMBAH_TEMPLATE_PENGUMUMAN",
      entity: "TemplatePengumuman", entityId: hasil.id,
      description: `${b.id ? "Mengubah" : "Menambah"} template pengumuman "${judul}"`,
    });
    return Response.json({ ok: true, id: hasil.id });
  } catch (galat) {
    lemparBilaPengalihan(galat);
    return Response.json({ error: "Gagal menyimpan template." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    const akses = await aksesSarpras(session);
    if (!akses.kelola) return Response.json({ error: "Khusus pengelola sarana prasarana." }, { status: 403 });
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return Response.json({ error: "Template tidak dikenal." }, { status: 400 });
    const lama = await prisma.templatePengumuman.findUnique({ where: { id }, select: { judul: true } });
    await prisma.templatePengumuman.delete({ where: { id } });
    await logActivity(session, {
      action: "HAPUS_TEMPLATE_PENGUMUMAN", entity: "TemplatePengumuman", entityId: id,
      description: `Menghapus template pengumuman "${lama?.judul ?? id}"`,
    });
    return Response.json({ ok: true });
  } catch (galat) {
    lemparBilaPengalihan(galat);
    return Response.json({ error: "Gagal menghapus template." }, { status: 500 });
  }
}
