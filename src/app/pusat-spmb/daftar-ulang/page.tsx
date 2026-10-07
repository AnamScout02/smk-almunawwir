import { redirect } from "next/navigation";

/** Menu "Daftar Ulang" dilebur ke Tahapan Calon (6 Okt 2026, CLAUDE.md #129) — pembayaran kini bercicil
 *  per calon. Rute lama tetap hidup sebagai pengalihan supaya tautan & penanda lama tidak mati. */
export default function Page() { redirect("/pusat-spmb/tahapan?saring=BELUM_LUNAS"); }
