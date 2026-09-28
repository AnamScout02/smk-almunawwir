export const dynamic = "force-dynamic";

import { getSettings } from "@/lib/site-settings";
import { getLang } from "@/lib/lang";
import LoginClient from "./LoginClient";
import { headers } from "next/headers";
import { lewatAplikasi } from "@/lib/aplikasi-ujian";

/** Halaman Masuk — pembungkus server tipis supaya ayat mengikuti Konten Halaman → Ayat & Hadis
 * (sebelumnya tertulis mati di kode sehingga perubahan dari admin tidak pernah tampil). */
export default async function LoginPage() {
  const s = await getSettings(["islamic.login_arabic", "islamic.login_label", "logo.emblem"]);
  // Bahasa dari cookie `lang` (sama dengan navbar situs) — bukan localStorage yang baru terbaca setelah hydrate.
  const lang = await getLang();
  // TANPA navbar situs, di browser MAUPUN di aplikasi (permintaan user 22–23 Sep 2026: "di halaman login benar-benar
  // halaman login tanpa header" + "halaman loginnya benar-benar keren"). Tautan kembali ke beranda ada di halamannya.
  // Di aplikasi (MyAlwis Mobile) tautan situs publik & SPMB disembunyikan — aplikasi bukan tempat menjelajah situs.
  return (
    <LoginClient ayat={s["islamic.login_arabic"]} keteranganAyat={s["islamic.login_label"]} lang={lang}
      modeAplikasi={lewatAplikasi((await headers()).get("user-agent"))}
      logo={s["logo.emblem"] || "/images/logo-emblem.png"} />
  );
}
