import { getSettings } from "@/lib/site-settings";
import { getLang } from "@/lib/lang";
import NavbarClient from "./NavbarClient";
import PengamatGerak from "@/components/gerak/PengamatGerak";
import PramuatTransisi from "@/components/gerak/PramuatTransisi";

interface NavbarProps {
  transparent?: boolean;
}

// Server component — logo DAN bahasa (cookie `lang`) dibaca di server supaya menu langsung tampil benar tanpa kilasan
// saat hydration (temuan 15 Sep 2026: di mode Inggris menu sempat tetap Beranda/Tentang/Berita di beberapa halaman).
export default async function Navbar({ transparent = false }: NavbarProps) {
  const [s, lang] = await Promise.all([getSettings(["logo.emblem", "logo.full", "logo.full_white"]), getLang()]);
  // PengamatGerak ikut di sini karena Navbar dipasang di SETIAP halaman publik — satu tempat untuk
  // seluruh animasi masuk situs publik (globals.css "GERAK SITUS PUBLIK").
  return (
    <>
    <PengamatGerak />
    <PramuatTransisi />
    <NavbarClient
      transparent={transparent}
      langAwal={lang}
      initialEmblem={s["logo.emblem"] || "/images/logo-emblem.png"}
      initialFull={s["logo.full"] || "/images/logo-full.png"}
      initialFullWhite={s["logo.full_white"] || ""}
    />
    </>
  );
}
