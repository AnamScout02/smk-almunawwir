import { NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import * as XLSX from "xlsx";

export async function GET() {
  await verifyRole(["ADMIN", "TAS"]);

  const headers = [
    "NIP",
    "Nama Lengkap",
    "Mata Pelajaran",
    "No. HP",
    "Tempat Lahir",
    "Tanggal Lahir (DD/MM/YYYY)",
    "Jenis Kelamin (L/P)",
    "Agama",
    "Alamat",
    "Pendidikan Terakhir (S1/S2/D3/dll)",
    "Jabatan (Guru Tetap/GTT/PNS/Honorer)",
    "Tanggal Mulai Mengajar (DD/MM/YYYY)",
    "Status (AKTIF/PENSIUN/KELUAR)",
    "Keterangan",
  ];

  const contoh = [
    "197001012000011001",
    "Drs. Ahmad Fauzan, M.Pd.",
    "Matematika",
    "081234567890",
    "Surabaya",
    "01/01/1970",
    "L",
    "Islam",
    "Jl. Contoh No. 1, Surabaya",
    "S2",
    "PNS",
    "01/07/2000",
    "AKTIF",
    "",
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, contoh]);
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 2, 20) }));
  XLSX.utils.book_append_sheet(wb, ws, "Buku Induk Guru");

  const petunjukData = [
    ["PETUNJUK PENGISIAN BUKU INDUK GURU"],
    [""],
    ["Kolom", "Keterangan", "Wajib?"],
    ["NIP", "Nomor Induk Pegawai (unik, wajib)", "Ya"],
    ["Nama Lengkap", "Nama lengkap beserta gelar", "Ya"],
    ["Mata Pelajaran", "Mata pelajaran yang diajarkan", "Ya"],
    ["No. HP", "Nomor HP aktif", "Opsional"],
    ["Tempat Lahir", "Kota tempat lahir", "Opsional"],
    ["Tanggal Lahir", "Format DD/MM/YYYY, contoh: 01/01/1970", "Opsional"],
    ["Jenis Kelamin", "L untuk Laki-laki, P untuk Perempuan", "Opsional"],
    ["Agama", "Islam / Kristen / Katolik / Hindu / Buddha / Konghucu", "Opsional"],
    ["Alamat", "Alamat tempat tinggal", "Opsional"],
    ["Pendidikan Terakhir", "S1 / S2 / S3 / D3 / SMA / dll.", "Opsional"],
    ["Jabatan", "Guru Tetap / GTT / PNS / Honorer / Kepala Sekolah / Wakasek", "Opsional"],
    ["Tanggal Mulai Mengajar", "Format DD/MM/YYYY", "Opsional"],
    ["Status", "AKTIF / PENSIUN / KELUAR", "Opsional (default: AKTIF)"],
    ["Keterangan", "Catatan tambahan", "Opsional"],
    [""],
    ["CATATAN:"],
    ["- Baris pertama adalah header, jangan dihapus"],
    ["- Baris kedua adalah contoh, hapus sebelum import"],
    ["- NIP yang sudah ada di sistem akan diperbarui (update), bukan duplikat"],
  ];
  const wsPetunjuk = XLSX.utils.aoa_to_sheet(petunjukData);
  wsPetunjuk["!cols"] = [{ wch: 30 }, { wch: 55 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, wsPetunjuk, "Petunjuk");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="template-buku-induk-guru.xlsx"',
    },
  });
}
