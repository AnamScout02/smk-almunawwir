import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { aksesSarpras } from "@/lib/sarpras-akses";
import { tekanTombol, bukaAlamat, TOMBOL } from "@/lib/layar-adb";
import { ALAMAT_APLIKASI } from "@/lib/alamat-aplikasi";
import { logActivity } from "@/lib/activity-log";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** PERINTAH MASSAL KE BANYAK LAYAR (24 September 2026, permintaan user: "ada tombol pilih, pilih semua dan
 * action on/off yang terpilih atau buka papan sekolah").
 *
 * Sekolah punya belasan TV; menyalakan atau memadamkannya satu per satu dari layar perbesar jelas tidak masuk
 * akal. Rute ini menerima daftar layar sekaligus.
 *
 * Yang dijaga:
 * - Perintah dikirim BERURUTAN, bukan serentak. Tiap perintah membuka sesi ADB sendiri; belasan sekaligus akan
 *   membanjiri jaringan dan justru banyak yang gagal.
 * - Hasil per layar dikembalikan apa adanya (berhasil/alasan gagal), supaya petugas tahu TV mana yang perlu
 *   dicek — bukan cuma "sebagian gagal".
 * - Satu catatan Log Aktivitas untuk satu perintah massal, bukan satu per TV, supaya log tetap terbaca. */
export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    const akses = await aksesSarpras(session);
    if (!akses.kelola) return Response.json({ error: "Tidak berhak mengendalikan layar." }, { status: 403 });

    const b = await req.json().catch(() => ({})) as {
      ids?: string[]; tombol?: keyof typeof TOMBOL; aksi?: "buka-papan";
      pengumuman?: { judul?: string; isi?: string; cara?: string } | null;
      belMode?: { mode?: string; sampai?: string | null };
    };
    const ids = Array.isArray(b.ids) ? b.ids.filter(x => typeof x === "string").slice(0, 40) : [];
    if (!ids.length) return Response.json({ error: "Belum ada layar yang dipilih." }, { status: 400 });
    // PENGUMUMAN MASSAL (24 Sep 2026): satu ketikan tampil & DIBACAKAN di semua TV terpilih. `pengumuman: null`
    // mengosongkannya serentak — pengumuman mendesak harus bisa dicabut secepat menayangkannya.
    // MODE BEL (4 Okt 2026, ruang ANBK/TKA): NORMAL | HENING | UJIAN untuk TV terpilih, berlaku sampai waktu
    // tertentu (kosong = sampai diubah). Papan membaca status hening lewat denyut 10 detik (/kabar); jadwal bel
    // ujian terpakai saat papan dimuat ulang (dashboard membukanya ulang setelah menyimpan).
    if (b.belMode !== undefined) {
      const mode = ["NORMAL", "HENING", "UJIAN"].includes(b.belMode?.mode ?? "") ? b.belMode!.mode! : "NORMAL";
      const sampai = mode !== "NORMAL" && b.belMode?.sampai ? new Date(b.belMode.sampai) : null;
      if (sampai && (Number.isNaN(sampai.getTime()) || sampai.getTime() <= Date.now()))
        return Response.json({ error: "Batas waktu mode bel harus di masa depan." }, { status: 400 });
      await prisma.layar.updateMany({ where: { id: { in: ids } }, data: { belMode: mode, belModeSampai: sampai } });
      await logActivity(session, {
        action: "MODE_BEL_LAYAR", entity: "Layar", entityId: "-",
        description: `Mode bel ${mode}${sampai ? ` sampai ${sampai.toISOString()}` : ""} untuk ${ids.length} layar`,
      });
      return Response.json({ ok: true, berhasil: ids.length, total: ids.length, hasil: [] });
    }
    if (b.pengumuman !== undefined) {
      const judul = b.pengumuman?.judul?.trim() || null;
      const isi = b.pengumuman?.isi?.trim() || null;
      const cara = ["TEKS_SUARA", "TEKS", "SUARA"].includes(b.pengumuman?.cara ?? "") ? b.pengumuman!.cara! : "TEKS_SUARA";
      await prisma.layar.updateMany({ where: { id: { in: ids } }, data: { papanJudul: judul, papanIsi: isi, papanCara: cara } });
      await logActivity(session, {
        action: "PENGUMUMAN_LAYAR_MASSAL", entity: "Layar", entityId: "-",
        description: judul || isi
          ? `Menayangkan pengumuman "${(judul ?? isi ?? "").slice(0, 60)}" di ${ids.length} layar`
          : `Menghapus pengumuman dari ${ids.length} layar`,
      });
      return Response.json({ ok: true, berhasil: ids.length, total: ids.length, hasil: [] });
    }

    if (!b.aksi && (!b.tombol || !(b.tombol in TOMBOL))) return Response.json({ error: "Perintah tidak dikenal." }, { status: 400 });

    const layar = await prisma.layar.findMany({
      where: { id: { in: ids } },
      select: { id: true, nama: true, ruang: true, token: true, ipTetap: true, ipTerakhir: true },
    });

    const hasil: { id: string; nama: string; ok: boolean; pesan: string }[] = [];
    for (const l of layar) {
      const ip = l.ipTetap || l.ipTerakhir;
      if (!ip) { hasil.push({ id: l.id, nama: l.nama, ok: false, pesan: "Alamat IP belum diketahui." }); continue; }
      let r: { ok: boolean; pesan: string };
      if (b.aksi === "buka-papan") {
        r = l.token
          ? await bukaAlamat(ip, `${ALAMAT_APLIKASI}/layar/${l.token}`).catch(() => ({ ok: false, pesan: "Gagal menghubungi TV." }))
          : { ok: false, pesan: "Tautan papan belum dibuat." };
      } else {
        r = await tekanTombol(ip, b.tombol!).catch(() => ({ ok: false, pesan: "Gagal menghubungi TV." }));
      }
      hasil.push({ id: l.id, nama: l.nama, ...r });
    }

    const berhasil = hasil.filter(h => h.ok).length;
    await logActivity(session, {
      action: "KENDALI_LAYAR_MASSAL", entity: "Layar", entityId: "-",
      description: `${b.aksi === "buka-papan" ? "Membuka papan sekolah" : `Menekan tombol ${b.tombol}`} pada ${layar.length} layar (${berhasil} berhasil)`,
    });
    return Response.json({ ok: true, berhasil, total: layar.length, hasil });
  } catch (galat) {
    lemparBilaPengalihan(galat);
    return Response.json({ error: "Perintah massal gagal." }, { status: 500 });
  }
}
