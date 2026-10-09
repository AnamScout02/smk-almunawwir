import { redirect } from "next/navigation";

/** Pendaftaran PKL pindah ke Pusat PKL (9 Okt 2026). Rute lama tetap hidup sebagai pengalihan. */
export default function Page() { redirect("/pusat-pkl/pendaftaran"); }
