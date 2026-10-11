import { verifyRole } from "@/lib/dal";
import { bolehPantauGuru } from "@/lib/pantau-guru";
import { cakupanTingkat } from "@/lib/kehadiran-guru";
import { susunKeterlaksanaan } from "@/lib/keterlaksanaan";
import { balasanExcel } from "@/lib/ekspor-excel";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  if (!(await bolehPantauGuru(session))) return Response.json({ error: "Tidak diizinkan." }, { status: 403 });
  const semua = new URL(req.url).searchParams.get("semua") === "1";
  const h = await susunKeterlaksanaan({ tingkat: semua ? undefined : await cakupanTingkat() });
  return balasanExcel({
    namaFile: `keterlaksanaan-kurikulum-${h.sampai}`, namaSheet: "Keterlaksanaan",
    headers: ["No", "Kelas", "Mapel", "Guru", "Pertemuan Terjadwal", "JP Terjadwal", "Jurnal Terisi", "Belum Dijurnal", "Keterlaksanaan (%)", "Jurnal Terakhir", "Butir Prota", "Materi Tercapai", "Seharusnya Selesai", "Materi Tertinggal", "Materi Berikutnya"],
    rows: h.baris.map((b, i) => [i + 1, b.kelas, b.mapel, b.guru, b.pertemuan, b.jp, b.jurnal, b.tertinggal, b.persen ?? "", b.jurnalTerakhir ?? "",
      b.rencana?.total ?? "", b.rencana?.tercapai ?? "", b.rencana?.seharusnya ?? "", b.rencana?.tertinggal ?? "", b.rencana?.berikut ?? ""]),
  });
}
