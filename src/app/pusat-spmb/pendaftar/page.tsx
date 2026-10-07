import { redirect } from "next/navigation";

/** Menu "Pendaftar" DISATUKAN ke Tahapan Calon (6 Okt 2026, permintaan user) — satu menu untuk satu calon:
 *  data, berkas, keputusan, cetak formulir, hapus, tahapan, pembayaran. Rute lama tetap hidup sebagai pengalihan. */
export default function Page() { redirect("/pusat-spmb/tahapan"); }
