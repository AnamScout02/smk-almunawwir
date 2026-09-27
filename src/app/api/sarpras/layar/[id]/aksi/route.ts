import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { aksesSarpras } from "@/lib/sarpras-akses";
import { tekanTombol, TOMBOL, bukaAlamat, mulaiUlang, modeTerimaLayar, pasangPapan, unduhSuara } from "@/lib/layar-adb";
import { tahanPapanOtomatis } from "@/lib/layar-jadwal";
import path from "path";
import { logActivity } from "@/lib/activity-log";
import { ALAMAT_APLIKASI } from "@/lib/alamat-aplikasi";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const NAMA_AKSI: Record<string, string> = {
  "buka-papan": "Membuka papan sekolah",
  "mulai-ulang": "Memulai ulang TV",
  "terima-layar": "Menyalakan mode terima layar (Miracast)",
  "pasang-papan": "Memasang aplikasi papan",
  "unduh-suara": "Membuka unduhan data suara TTS",
};

/** Tombol jarak jauh (daya/beranda/kembali/bisu). Hanya pengelola penuh — bukan semua yang boleh melihat. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    const akses = await aksesSarpras(session);
    if (!akses.kelola) return Response.json({ error: "Tidak berhak mengendalikan layar." }, { status: 403 });

    const { id } = await params;
    const { tombol, aksi } = await req.json().catch(() => ({})) as {
      tombol?: keyof typeof TOMBOL; aksi?: "buka-papan" | "mulai-ulang" | "terima-layar" | "pasang-papan" | "unduh-suara";
    };
    if (!aksi && (!tombol || !(tombol in TOMBOL))) return Response.json({ error: "Tombol tidak dikenal." }, { status: 400 });

    const layar = await prisma.layar.findUnique({ where: { id }, select: { nama: true, ruang: true, ipTerakhir: true, ipTetap: true, token: true } });
    if (!layar) return Response.json({ error: "Layar tidak ditemukan." }, { status: 404 });
    const ip = layar.ipTetap || layar.ipTerakhir;
    if (!ip) return Response.json({ error: "Alamat IP TV belum diketahui." }, { status: 409 });

    let hasil: { ok: boolean; pesan: string };
    if (aksi === "buka-papan") {
      if (!layar.token) return Response.json({ error: "Tautan papan belum dibuat untuk layar ini." }, { status: 409 });
      hasil = await bukaAlamat(ip, `${ALAMAT_APLIKASI}/layar/${layar.token}`);
    } else if (aksi === "mulai-ulang") {
      hasil = await mulaiUlang(ip);
    } else if (aksi === "terima-layar") {
      hasil = await modeTerimaLayar(ip);
      // Papan otomatis DITAHAN selama TV dipakai mencerminkan layar. Penjaga "hanya buka saat TV di beranda"
      // sudah mencegah papan merebut layar saat Miracast terbuka, tetapi begitu pantulan selesai TV kembali ke
      // beranda sebentar — tanpa penahanan ini papan bisa menyambar tepat di jeda itu, saat rapat masih berjalan.
      if (hasil.ok) tahanPapanOtomatis(id, 60);
    } else if (aksi === "unduh-suara") {
      hasil = await unduhSuara(ip);
    } else if (aksi === "pasang-papan") {
      hasil = await pasangPapan(ip, path.join(process.cwd(), "public", "unduh", "myalwis-papan.apk"));
    } else {
      hasil = await tekanTombol(ip, tombol!);
    }
    if (hasil.ok) {
      await logActivity(session, {
        action: "KENDALI_LAYAR_TV", entity: "Layar", entityId: id,
        description: `${aksi ? NAMA_AKSI[aksi] : `Menekan tombol ${tombol}`} pada "${layar.nama}" (${layar.ruang})`,
      });
    }
    return Response.json(hasil, { status: hasil.ok ? 200 : 503 });
  } catch (galat) {
    lemparBilaPengalihan(galat);
    return Response.json({ error: "Perintah gagal dikirim." }, { status: 500 });
  }
}
