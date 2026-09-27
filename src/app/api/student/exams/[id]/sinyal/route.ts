import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { verifyRole } from "@/lib/dal";
import { siswaDariSesi } from "@/lib/ujian-server";
import { tungguSinyal } from "@/lib/sinyal-ujian";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** Long-poll sinyal tindakan pengawas (src/lib/sinyal-ujian.ts). Ditahan sampai pengawas bertindak atas siswa ini /
 * ujian ini, atau 25 detik. Balasan `sinyal` = jalankan denyut sekarang; `sebar` = sinyal umum (sebarkan denyut acak
 * beberapa detik). Tidak membawa data apa pun — keadaan sebenarnya tetap diambil lewat denyut yang sudah dijaga. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["STUDENT"]);
    const student = await siswaDariSesi(session);
    if (!student) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const hasil = await tungguSinyal(id, student.id, 25_000, req.signal);
    return Response.json({ sinyal: !!hasil, sebar: hasil === "ujian" }, { headers: { "Cache-Control": "no-store, no-transform" } });
  } catch (galat) {
    lemparBilaPengalihan(galat);
    return Response.json({ error: "Gagal." }, { status: 500 });
  }
}
