export const dynamic = "force-dynamic";

import { getSettings } from "@/lib/site-settings";
import Navbar from "@/components/layout/Navbar";
import { getLang } from "@/lib/lang";
import LoginClient from "./LoginClient";

/** Halaman Masuk — pembungkus server tipis supaya ayat di panel kiri mengikuti Konten Halaman → Ayat & Hadis
 * (sebelumnya tertulis mati di kode sehingga perubahan dari admin tidak pernah tampil). */
export default async function LoginPage() {
  const s = await getSettings(["islamic.login_arabic", "islamic.login_label"]);
  // Bahasa dari cookie `lang` (sama dengan navbar situs) — bukan localStorage yang baru terbaca setelah hydrate.
  const lang = await getLang();
  // Navbar situs di atas (seperti Cek Kelulusan) — pengguna bisa kembali ke halaman publik tanpa tautan tambahan.
  return (
    <>
      <Navbar />
      <LoginClient ayat={s["islamic.login_arabic"]} keteranganAyat={s["islamic.login_label"]} lang={lang} />
    </>
  );
}
