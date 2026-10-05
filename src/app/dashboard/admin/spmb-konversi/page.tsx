import { redirect } from "next/navigation";

/** Dilebur ke Pusat SPMB (1 Oktober 2026) — isinya sama persis dengan menu "Jadi Siswa" di portal,
 *  sehingga sempat tampil DOBEL di sidebar (laporan user). Rute lama dipertahankan sebagai
 *  pengalihan supaya penanda peramban & tautan yang sudah dibagikan tidak mati (pola §18). */
export default function Page() {
  redirect("/pusat-spmb/konversi");
}
