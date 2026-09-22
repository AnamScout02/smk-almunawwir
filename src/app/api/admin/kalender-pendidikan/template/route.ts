import * as XLSX from "xlsx";
import { verifyTasAccess } from "@/lib/tas-access-guard";

export const dynamic = "force-dynamic";

/** Template Excel untuk impor Kalender Pendidikan.
 *
 * Tiga modul impor lain (Buku Induk Siswa, Buku Induk Guru, Perpustakaan) sudah punya templatenya
 * sejak awal; kalender satu-satunya yang belum, karena impornya dibuat untuk MEMBACA berkas
 * kalender sekolah apa adanya (temuan user 13 September 2026). Template ini tetap perlu: berkas
 * sekolah baru ada kalau kalendernya sudah disusun, sedangkan yang menyusun dari nol butuh tahu
 * kolom apa saja yang dibaca sistem.
 *
 * Nama kolom WAJIB persis "Bulan", "Tanggal", "Agenda", "Pelaksana" — itu yang dicari pembaca
 * (lihat `JUDUL_KOLOM` di `src/lib/kalender-import.ts`). Urutan kolom bebas, dan lembar lain di
 * berkas yang sama diabaikan.
 */
export async function GET() {
  await verifyTasAccess();

  const tahunIni = new Date().getFullYear();
  const contoh = [
    ["Bulan", "Tanggal", "Agenda", "Pelaksana"],
    [`Juli ${tahunIni}`, "13 - 18", "Pekan MPLS, Pembinaan Kelas dan Sosialisasi Program Sekolah", "Kesiswaan dan Panitia"],
    ["", "14", "Kegiatan Sulingjar", "Operator Sekolah"],
    [`Agustus ${tahunIni}`, "17", "HUT Republik Indonesia", ""],
    ["", "18 - 22", "Pekan HUT Kemerdekaan", "Kesiswaan"],
    [`September ${tahunIni}`, "14 - 19", "Sumatif Tengah Semester Ganjil", "Kurikulum dan Panitia"],
    ["", "30", "Pembagian Rapor STS Ganjil", "Kurikulum dan Wali Kelas"],
  ];

  const petunjuk = [
    ["CARA MENGISI TEMPLATE KALENDER PENDIDIKAN"],
    [],
    ["1.", "Isi agenda pada lembar \"AGENDA\". Jangan mengubah nama keempat kolomnya:"],
    ["", "Bulan · Tanggal · Agenda · Pelaksana — sistem mencari kolom berdasarkan nama ini."],
    [],
    ["2.", "Kolom Bulan cukup diisi SEKALI di baris pertama tiap bulan."],
    ["", "Baris berikutnya boleh dikosongkan — otomatis mewarisi bulan di atasnya."],
    ["", "Format: \"Juli 2026\" (nama bulan + tahun). Kalau Excel terlanjur mengubahnya jadi"],
    ["", "tanggal, tetap terbaca — tidak perlu diperbaiki."],
    [],
    ["3.", "Kolom Tanggal: \"14\" untuk satu hari, \"13 - 18\" untuk rentang."],
    [],
    ["4.", "Kolom Pelaksana boleh dikosongkan. Isinya masuk sebagai keterangan agenda."],
    [],
    ["5.", "JENIS agenda (Libur / Ujian / KBM / Rapat / PPDB / Kegiatan) TIDAK diisi di sini —"],
    ["", "ditebak otomatis dari kata pada judul agenda. Contoh: judul memuat \"libur\" → Libur,"],
    ["", "\"sumatif\"/\"ujian\"/\"UKK\"/\"ANBK\" → Ujian, \"rapat\"/\"pleno\" → Rapat."],
    ["", "Kalau ada yang meleset, betulkan lewat tombol Edit setelah impor."],
    [],
    ["6.", "Sebelum impor, PILIH DULU TAHUN AJARAN pada saringan di halaman Kalender Pendidikan —"],
    ["", "agenda menempel ke tahun ajaran yang sedang dipilih di situ."],
    [],
    ["7.", "Berkas kalender sekolah yang sudah ada boleh langsung diimpor apa adanya tanpa memakai"],
    ["", "template ini, asalkan salah satu lembarnya punya keempat kolom di atas. Lembar lain"],
    ["", "(RPE, matriks, perhitungan hari efektif) diabaikan."],
  ];

  const wb = XLSX.utils.book_new();

  const wsAgenda = XLSX.utils.aoa_to_sheet(contoh);
  wsAgenda["!cols"] = [{ wch: 16 }, { wch: 12 }, { wch: 62 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, wsAgenda, "AGENDA");

  const wsPetunjuk = XLSX.utils.aoa_to_sheet(petunjuk);
  wsPetunjuk["!cols"] = [{ wch: 5 }, { wch: 96 }];
  XLSX.utils.book_append_sheet(wb, wsPetunjuk, "PETUNJUK");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="template-kalender-pendidikan.xlsx"',
    },
  });
}
