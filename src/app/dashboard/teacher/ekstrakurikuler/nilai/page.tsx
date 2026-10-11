import { redirect } from "next/navigation";

/** Pindah ke Pusat Ekstrakurikuler (10 Okt 2026) — rute lama dipertahankan sebagai pengalihan supaya penanda & tautan lama tetap sampai. */
export default function Page() {
  redirect("/pusat-ekstra/nilai");
}
