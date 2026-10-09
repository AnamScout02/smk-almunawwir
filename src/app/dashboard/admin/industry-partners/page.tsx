import { redirect } from "next/navigation";

/** Mitra Industri dilebur ke Pusat PKL → Data DUDI (9 Okt 2026). Rute lama tetap hidup sebagai pengalihan. */
export default function Page() { redirect("/pusat-pkl/dudi"); }
