import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { prisma } from "@/lib/prisma";
import { mulaiBel, selesaiBel } from "@/lib/volume-bel";

export const dynamic = "force-dynamic";

/** VOLUME TV SAAT BEL (25 September 2026) — dipanggil papan tepat sebelum bel berbunyi dan setelah selesai.
 *
 * TANPA LOGIN seperti rute papan lain: izinnya dari **token layar** ditambah syarat layar itu memang disetel
 * `volumeBel`. Yang bisa dilakukan pemegang tautan hanyalah menaikkan volume TV itu ke angka yang sudah
 * ditetapkan petugas, lalu mengembalikannya — bukan menyetel volume bebas dari luar. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const { fase } = await req.json().catch(() => ({})) as { fase?: string };
    if (fase !== "mulai" && fase !== "selesai") return Response.json({ error: "Fase tidak dikenal." }, { status: 400 });

    const layar = await prisma.layar.findUnique({
      where: { token },
      select: { id: true, aktif: true, volumeBel: true, ipTetap: true, ipTerakhir: true },
    }).catch(() => null);
    if (!layar || !layar.aktif) return Response.json({ error: "Layar tidak dikenal." }, { status: 404 });
    if (layar.volumeBel == null) return Response.json({ ok: true, lewati: true });

    const ip = layar.ipTetap || layar.ipTerakhir;
    if (!ip) return Response.json({ ok: false, pesan: "Alamat IP TV belum diketahui." });

    const hasil = fase === "mulai"
      ? await mulaiBel(layar.id, ip, layar.volumeBel)
      : await selesaiBel(layar.id, ip);
    return Response.json(hasil);
  } catch (galat) {
    lemparBilaPengalihan(galat);
    return Response.json({ error: "Gagal mengatur volume." }, { status: 500 });
  }
}
