import { redirect } from "next/navigation";

/** Halaman publik daftar ulang lama (nama + WA → unggah satu bukti bayar) diganti halaman Tahapan
 *  Pendaftaran yang memuat konfirmasi daftar ulang & pembayaran bercicil (6 Okt 2026, CLAUDE.md #129). */
export default function Page() { redirect("/spmb/tahapan"); }
