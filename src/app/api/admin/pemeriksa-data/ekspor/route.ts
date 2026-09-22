import { verifyTasAccess } from "@/lib/tas-access-guard";
import { jalankanPemeriksaan } from "@/lib/pemeriksa-data";
import { balasanExcelBanyakSheet } from "@/lib/ekspor-excel";

export const dynamic = "force-dynamic";

const LABEL: Record<string, string> = { kritis: "Kritis", penting: "Penting", saran: "Saran" };

/** Unduhan hasil Pemeriksa Data sebagai Excel.
 *
 * Bukan sekadar salinan layar: daftar contohnya TIDAK dipotong 50 seperti tampilan (lihat
 * `batasContoh`), jadi berkas ini memang daftar kerja yang lengkap. Dua sheet — "Ringkasan"
 * untuk melihat temuan mana yang paling banyak, "Rincian" untuk dikerjakan baris per baris. */
export async function GET() {
  await verifyTasAccess();
  const hasil = await jalankanPemeriksaan({ batasContoh: Number.MAX_SAFE_INTEGER });

  const ringkasan = hasil.temuan.map((t, i) => [
    i + 1, LABEL[t.kategori] ?? t.kategori, t.judul, t.jumlah, t.penjelasan, t.saran,
  ]);

  const rincian: (string | number)[][] = [];
  let n = 0;
  for (const t of hasil.temuan) {
    for (const c of t.contoh) {
      rincian.push([++n, LABEL[t.kategori] ?? t.kategori, t.judul, c.nis, c.nama, c.detail]);
    }
  }

  return balasanExcelBanyakSheet(`pemeriksa-data-${new Date().toLocaleDateString("sv-SE")}`, [
    {
      nama: "Ringkasan",
      headers: ["No", "Tingkat", "Temuan", "Jumlah", "Penjelasan", "Saran Tindakan"],
      rows: ringkasan,
    },
    {
      nama: "Rincian",
      headers: ["No", "Tingkat", "Temuan", "NIS", "Nama Siswa", "Detail"],
      rows: rincian,
    },
  ]);
}
