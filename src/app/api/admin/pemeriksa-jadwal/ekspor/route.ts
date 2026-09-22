import { verifyRole } from "@/lib/dal";
import { jalankanPemeriksaanJadwal } from "@/lib/pemeriksa-jadwal";
import { balasanExcelBanyakSheet } from "@/lib/ekspor-excel";

export const dynamic = "force-dynamic";

const LABEL: Record<string, string> = { kritis: "Kritis", penting: "Penting", saran: "Saran" };

/** Daftar temuan jadwal lengkap (tidak dipotong 50 seperti tampilan layar). */
export async function GET() {
  await verifyRole(["ADMIN", "TAS"]);
  const hasil = await jalankanPemeriksaanJadwal({ batasContoh: Number.MAX_SAFE_INTEGER });

  const rincian: (string | number)[][] = [];
  let n = 0;
  for (const t of hasil.temuan) {
    for (const c of t.contoh) {
      rincian.push([++n, LABEL[t.kategori] ?? t.kategori, t.judul, c.kiri, c.kanan, c.waktu, c.detail]);
    }
  }

  return balasanExcelBanyakSheet(`pemeriksa-jadwal-${new Date().toLocaleDateString("sv-SE")}`, [
    {
      nama: "Ringkasan",
      headers: ["No", "Tingkat", "Temuan", "Jumlah", "Penjelasan", "Saran Tindakan"],
      rows: hasil.temuan.map((t, i) => [i + 1, LABEL[t.kategori] ?? t.kategori, t.judul, t.jumlah, t.penjelasan, t.saran]),
    },
    {
      nama: "Rincian",
      headers: ["No", "Tingkat", "Temuan", "Pihak 1", "Pihak 2", "Waktu", "Detail"],
      rows: rincian,
    },
  ]);
}
