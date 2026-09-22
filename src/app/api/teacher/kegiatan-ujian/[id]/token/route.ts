import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { logActivity } from "@/lib/activity-log";
import { bolehAturUjian, ringkasKegiatan, SELECT_KEGIATAN } from "@/lib/kegiatan-ujian-server";
import { buatTokenUnik } from "@/lib/ujian-server";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const DILARANG = { error: "Hanya Administrator atau Wakil Kepala Kurikulum yang boleh mengatur token kegiatan." };

/** TOKEN BERSAMA SATU KEGIATAN (20 September 2026) — satu token untuk semua mata pelajaran dalam
 * kegiatan itu; server yang memilihkan ujian mana yang sedang dibuka untuk kelas si siswa.
 *
 * `{ aksi: "buat" }`  membuat/memutar token sekarang (token lama masih diterima 2 menit).
 * `{ aksi: "hapus" }` mematikan token bersama — tiap ujian kembali memakai tokennya sendiri.
 * Token per-ujian TIDAK dihapus dan tetap berlaku, jadi perubahan ini selalu bisa dibatalkan. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    if (!(await bolehAturUjian(session))) return Response.json(DILARANG, { status: 403 });
    const { id } = await params;
    const b = await req.json().catch(() => ({})) as { aksi?: string };
    const ada = await prisma.kegiatanUjian.findUnique({ where: { id }, select: { id: true, nama: true, token: true } });
    if (!ada) return Response.json({ error: "Kegiatan tidak ditemukan." }, { status: 404 });

    if (b.aksi === "hapus") {
      const k = await prisma.kegiatanUjian.update({
        where: { id }, data: { token: null, tokenLama: null }, select: SELECT_KEGIATAN,
      });
      await logActivity(session, {
        action: "TOKEN_KEGIATAN_UJIAN", entity: "KegiatanUjian", entityId: id,
        description: `Token bersama kegiatan "${k.nama}" dimatikan — tiap ujian kembali memakai tokennya sendiri`,
      }).catch(() => {});
      return Response.json(ringkasKegiatan(k));
    }

    const token = await buatTokenUnik();
    const k = await prisma.kegiatanUjian.update({
      where: { id },
      data: { tokenLama: ada.token, token, tokenDiperbarui: new Date() },
      select: SELECT_KEGIATAN,
    });
    await logActivity(session, {
      action: "TOKEN_KEGIATAN_UJIAN", entity: "KegiatanUjian", entityId: id,
      // Nilai tokennya SENGAJA tidak dicatat — log aktivitas bisa dibaca banyak petugas.
      description: `${ada.token ? "Memutar" : "Membuat"} token bersama kegiatan "${k.nama}"`,
    }).catch(() => {});
    return Response.json(ringkasKegiatan(k));
  } catch {
    return Response.json({ error: "Gagal mengatur token kegiatan." }, { status: 500 });
  }
}
