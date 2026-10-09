import { redirect } from "next/navigation";

/** Penempatan PKL pindah ke Pusat PKL (9 Okt 2026) — DUDI dari katalog, penempatan massal, mutasi, dan jurnal ada di sana.
 *  Rute lama tetap hidup sebagai pengalihan supaya tautan & penanda peramban lama tidak mati. */
export default function Page() { redirect("/pusat-pkl/penempatan"); }
