import { NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { assertPerpustakaan } from "@/lib/perpustakaan-guard";
import * as XLSX from "xlsx";

export async function GET() {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  await assertPerpustakaan(session);

  const headers = ["Judul Buku", "Penulis", "Penerbit", "Kategori", "Stok", "Lokasi/Rak", "Barcode"];
  const contoh = ["Matematika Kelas X", "Bambang Sudibyo", "Erlangga", "Pelajaran", "5", "Rak A1", ""];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, contoh]);
  ws["!cols"] = headers.map(h => ({ wch: Math.max(h.length + 2, 18) }));
  XLSX.utils.book_append_sheet(wb, ws, "Katalog Buku");

  const petunjukData = [
    ["Kolom", "Keterangan", "Wajib?"],
    ["Judul Buku", "Judul lengkap buku", "Ya"],
    ["Penulis", "Nama penulis buku", "Opsional"],
    ["Penerbit", "Nama penerbit", "Opsional"],
    ["Kategori", "Kategori/genre buku, contoh: Pelajaran, Fiksi, Referensi", "Ya"],
    ["Stok", "Jumlah eksemplar yang dimiliki, angka. Kosong = dianggap 1", "Opsional"],
    ["Lokasi/Rak", "Lokasi rak penyimpanan buku", "Opsional"],
    ["Barcode", "Kode unik buku. Kosong = dibuatkan otomatis (format PST-00001). Kalau diisi dan SUDAH ADA di sistem, data buku itu akan DIPERBARUI (bukan dibuat baru)", "Opsional"],
    [""],
    ["CATATAN:"],
    ["- Baris pertama adalah header, jangan dihapus"],
    ["- Baris kedua adalah contoh data, hapus sebelum import"],
    ["- Barcode yang sudah ada di sistem akan diperbarui (update) datanya"],
    ["- Barcode kosong/baru akan membuat judul buku baru dengan barcode otomatis"],
  ];
  const wsPetunjuk = XLSX.utils.aoa_to_sheet(petunjukData);
  wsPetunjuk["!cols"] = [{ wch: 20 }, { wch: 55 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsPetunjuk, "Petunjuk");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="template-katalog-buku.xlsx"',
    },
  });
}
