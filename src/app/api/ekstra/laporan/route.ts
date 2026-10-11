import { verifyRole } from "@/lib/dal";
import { bolehEkskul } from "@/lib/ekstra-server";
import { laporanBulananEkstra } from "@/lib/ekstra-laporan";
import { balasanExcelBanyakSheet } from "@/lib/ekspor-excel";

export const dynamic = "force-dynamic";

/** Unduhan .xlsx Laporan Bulanan satu ekskul (`?ekskul=&bulan=YYYY-MM`) — sheet Pertemuan & Rekap Anggota. */
export async function GET(req: Request) {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  const q = new URL(req.url).searchParams, id = q.get("ekskul") ?? "", bulan = q.get("bulan") ?? "";
  if (!/^\d{4}-\d{2}$/.test(bulan)) return Response.json({ error: "Bulan tidak valid." }, { status: 400 });
  if (!(await bolehEkskul(session, id)).ekskul) return Response.json({ error: "Anda tidak mengelola ekstrakurikuler ini." }, { status: 403 });
  const l = await laporanBulananEkstra(id, bulan);
  if (!l) return Response.json({ error: "Ekstrakurikuler tidak ditemukan." }, { status: 404 });
  return balasanExcelBanyakSheet(`laporan-${l.ekskul.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${bulan}`, [
    { nama: "Pertemuan", headers: ["No", "Tanggal", "Kegiatan", "Hadir", "Peserta", "Dicatat oleh", "Lewat tautan pembina", "Jumlah foto"],
      rows: l.pertemuan.map((p, i) => [i + 1, p.tanggal, p.kegiatan ?? "", p.hadir, p.peserta, p.oleh, p.lewatTautan ? "Ya" : "", p.foto.length]) },
    { nama: "Rekap Anggota", headers: ["No", "Nama", "NIS", "Kelas", "Peran", "Hadir", "Izin", "Sakit", "Tanpa kabar", "Jumlah pertemuan", "Persen hadir"],
      rows: l.rekap.map((r, i) => [i + 1, r.nama, r.nis, r.kelas, r.peran, r.hadir, r.izin, r.sakit, r.alpha, r.total, r.persen ?? ""]) },
  ]);
}
