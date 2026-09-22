import * as XLSX from "xlsx";

/** Semua unduhan data keluar sebagai berkas Excel (.xlsx), BUKAN CSV.
 *
 * Alasannya nyata, bukan selera: Excel versi Indonesia memakai titik-koma sebagai pemisah kolom,
 * sedangkan CSV yang kita hasilkan memakai koma. Akibatnya tiap berkas yang dibuka lewat klik dua
 * kali menumpuk seluruh data di SATU kolom, dan petugas harus melewati wizard "Text to Columns"
 * dulu setiap kali (keluhan user 13 September 2026: "mending excel biasa, jadi tidak satu kolom
 * untuk banyak data").
 *
 * Berkas .xlsx tidak punya masalah itu sama sekali — kolomnya sudah kolom sungguhan, angka tetap
 * terbaca sebagai angka (bisa langsung dijumlah), dan tidak perlu BOM UTF-8 untuk huruf beraksen.
 */

export type SelBaris = (string | number | null | undefined)[];

const TIPE_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Nama sheet Excel maksimal 31 karakter dan tidak boleh memuat : \ / ? * [ ] */
function namaSheetAman(nama: string): string {
  return (nama.replace(/[:\\/?*[\]]/g, " ").trim() || "Data").slice(0, 31);
}

/** Lebar kolom mengikuti isi terpanjang — supaya tidak ada sel yang tampil "#####" atau terpotong. */
function lebarKolom(headers: string[], rows: SelBaris[]): { wch: number }[] {
  return headers.map((h, i) => {
    let maks = String(h ?? "").length;
    for (const r of rows) {
      const p = String(r[i] ?? "").length;
      if (p > maks) maks = p;
    }
    return { wch: Math.min(Math.max(maks + 2, 8), 45) };
  });
}

/** Bangun satu berkas Excel berisi satu sheet, siap dikirim sebagai unduhan. */
export function balasanExcel({
  namaFile, namaSheet, headers, rows,
}: {
  /** Tanpa ekstensi — ".xlsx" ditambahkan sendiri. */
  namaFile: string;
  namaSheet: string;
  headers: string[];
  rows: SelBaris[];
}): Response {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = lebarKolom(headers, rows);
  // Saringan per kolom langsung aktif — kebiasaan TU memang menyaring per kelas/status setelah
  // berkasnya dibuka, jadi tidak perlu memasangnya manual tiap kali.
  if (headers.length) {
    ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: headers.length - 1 } }) };
  }
  XLSX.utils.book_append_sheet(wb, ws, namaSheetAman(namaSheet));

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": TIPE_XLSX,
      "Content-Disposition": `attachment; filename="${namaFile.replace(/"/g, "")}.xlsx"`,
    },
  });
}

/** Berkas Excel dengan BEBERAPA sheet — dipakai kalau satu unduhan memuat lebih dari satu tabel. */
export function balasanExcelBanyakSheet(
  namaFile: string,
  sheets: { nama: string; headers: string[]; rows: SelBaris[] }[],
): Response {
  const wb = XLSX.utils.book_new();
  const terpakai = new Set<string>();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet([s.headers, ...s.rows]);
    ws["!cols"] = lebarKolom(s.headers, s.rows);
    if (s.headers.length) {
      ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: s.rows.length, c: s.headers.length - 1 } }) };
    }
    // Excel menolak dua sheet bernama sama — bubuhi angka kalau bentrok.
    let nama = namaSheetAman(s.nama), n = 2;
    while (terpakai.has(nama.toLowerCase())) nama = namaSheetAman(`${s.nama} ${n++}`);
    terpakai.add(nama.toLowerCase());
    XLSX.utils.book_append_sheet(wb, ws, nama);
  }
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": TIPE_XLSX,
      "Content-Disposition": `attachment; filename="${namaFile.replace(/"/g, "")}.xlsx"`,
    },
  });
}
