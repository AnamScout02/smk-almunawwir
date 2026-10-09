import { NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { bolehPeta } from "@/lib/peta-guard";
import { analisisSebaran } from "@/lib/analisis-sebaran";
import { balasanExcel } from "@/lib/ekspor-excel";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

/** Excel siswa aktif yang alamatnya belum terpetakan sampai kecamatan — untuk dibagikan ke wali kelas/TU. */
export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    if (!(await bolehPeta(session))) return NextResponse.json({ error: "Tidak berwenang." }, { status: 403 });
    const a = await analisisSebaran();
    const rows = a.belumLengkap.flatMap(k => k.siswa.map((s, i) => [k.kelas, i + 1, s.nama, s.nis, s.sebab]));
    const tgl = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
    return balasanExcel({ namaFile: `alamat-belum-lengkap-${tgl}`, namaSheet: "Alamat Belum Lengkap", headers: ["Kelas", "No", "Nama", "NIS", "Yang kurang"], rows });
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Gagal membuat berkas." }, { status: 500 });
  }
}
