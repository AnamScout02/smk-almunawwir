import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { prisma } from "@/lib/prisma";
import { susunPapanPegawai } from "@/lib/papan-pegawai";

export const dynamic = "force-dynamic";

/** ISI PAPAN RUANG GURU (25 September 2026) — dipanggil papan tiap satu giliran panel.
 *
 * TANPA LOGIN, seperti rute papan lainnya: yang memberi izin adalah **token layar** ditambah syarat layar itu
 * memang bertanda `papanJenis = "GURU"`. Dengan begitu tautan papan kelas — yang bisa saja beredar di grup
 * siswa — tidak bisa dipakai membaca daftar nama guru yang belum mengisi jurnal.
 *
 * Diambil lewat rute terpisah (bukan ikut muatan halaman) supaya panel bisa menyegarkan dirinya tanpa memuat
 * ulang seluruh papan: memuat ulang halaman akan mengembalikan giliran panel ke urutan pertama dan menyentak
 * layar di dinding. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const layar = await prisma.layar.findUnique({
      where: { token },
      select: { aktif: true, papanJenis: true, papanGiliran: true },
    }).catch(() => null);
    if (!layar || !layar.aktif) return Response.json({ error: "Layar tidak dikenal." }, { status: 404 });
    if (layar.papanJenis !== "GURU") return Response.json({ error: "Layar ini bukan papan ruang guru." }, { status: 403 });

    const { libur, panel } = await susunPapanPegawai();
    return Response.json({ libur, panel, giliran: layar.papanGiliran });
  } catch (galat) {
    lemparBilaPengalihan(galat);
    return Response.json({ error: "Gagal menyiapkan isi papan." }, { status: 500 });
  }
}
