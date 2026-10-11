import { verifyRole } from "@/lib/dal";
import { kelasBukuWali, susunBukuWali } from "@/lib/buku-wali";
import { balasanExcel } from "@/lib/ekspor-excel";

export const dynamic = "force-dynamic";

/** Buku Wali Kelas → Excel. Kelas dari browser tidak dipercaya: harus termasuk kelas yang boleh dibuka sesi ini. */
export async function GET(req: Request) {
  const session = await verifyRole(["TEACHER", "ADMIN"]);
  const boleh = await kelasBukuWali(session);
  const kelas = new URL(req.url).searchParams.get("kelas") ?? "";
  if (!boleh.some(k => k.id === kelas)) return Response.json({ error: "Khusus wali kelas dari kelas ini." }, { status: 403 });
  const d = await susunBukuWali(kelas);
  if (!d) return Response.json({ error: "Kelas tidak ditemukan." }, { status: 404 });
  return balasanExcel({
    namaFile: `buku-wali-${d.kelas.nama.replace(/\s+/g, "-")}`, namaSheet: d.kelas.nama,
    headers: ["No", "Nama", "NIS", "L/P", "Hadir", "Izin", "Sakit", "Alpha", "% Hadir", "Poin bersih", "Tingkat sanksi", "Mapel bernilai", "Di bawah KKM", "Mapel di bawah KKM", "Rata-rata", "Izin menunggu", "Ekstrakurikuler", "Kunjungan rumah", "Peringatan dini"],
    rows: d.baris.map((b, i) => [i + 1, b.nama, b.nis, b.jk, b.hadir.HADIR, b.hadir.IZIN, b.hadir.SAKIT, b.hadir.ALPHA, b.hadir.persen ?? "", b.poin.bersih, b.poin.level, b.nilai.mapel, b.nilai.dibawah.length,
      b.nilai.dibawah.map(x => `${x.mapel} (${x.nilai})`).join("; "), b.nilai.rata ?? "", b.izin.menunggu, b.ekskul.join(", "), b.kunjungan.length, b.risiko ? `${b.risiko.tingkat}: ${b.risiko.alasan.join("; ")}` : ""]),
  });
}
