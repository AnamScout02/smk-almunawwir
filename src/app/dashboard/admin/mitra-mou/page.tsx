import { redirect } from "next/navigation";

/** Status MoU Mitra dilebur ke Pusat PKL → Data DUDI (9 Okt 2026, user: "malah terpisah"): keadaan MoU tiap DUDI,
 *  saringan MoU habis/segera habis, dan dokumennya ada di sana. Kepala Sekolah (guru) tetap punya halamannya di portal guru. */
export default function Page() { redirect("/pusat-pkl/dudi"); }
