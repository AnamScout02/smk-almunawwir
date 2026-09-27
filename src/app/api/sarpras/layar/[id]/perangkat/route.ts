import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { aksesSarpras } from "@/lib/sarpras-akses";
import { infoPerangkat } from "@/lib/layar-adb";

export const dynamic = "force-dynamic";

/** Aplikasi yang sedang dibuka + info perangkat, lewat ADB. Hasilnya juga disimpan di baris Layar supaya
 * tetap terlihat (dengan waktunya) walau TV lalu dimatikan. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    const akses = await aksesSarpras(session);
    if (!akses.masuk) return Response.json({ error: "Khusus pengelola sarana prasarana." }, { status: 403 });

    const { id } = await params;
    const layar = await prisma.layar.findUnique({ where: { id }, select: { ipTerakhir: true, ipTetap: true } });
    if (!layar) return Response.json({ error: "Layar tidak ditemukan." }, { status: 404 });
    const ip = layar.ipTetap || layar.ipTerakhir;
    if (!ip) return Response.json({ error: "Alamat IP TV belum diketahui." }, { status: 409 });

    const info = await infoPerangkat(ip);
    if (info.status === "SIAP") {
      await prisma.layar.update({
        where: { id },
        data: {
          aplikasiDepan: info.aplikasiDepan ?? null,
          perangkatModel: info.model ?? undefined,
          perangkatVersi: info.versiAndroid ?? undefined,
          terakhirDenyut: new Date(),
        },
      }).catch(() => null);
    }
    return Response.json(info);
  } catch (galat) {
    lemparBilaPengalihan(galat);
    return Response.json({ error: "Gagal membaca perangkat." }, { status: 500 });
  }
}
