import { getSettings } from "@/lib/site-settings";
import NavbarClient from "./NavbarClient";

interface NavbarProps {
  transparent?: boolean;
}

// Server component — fetch logo dari DB agar tidak ada flash saat hydration
export default async function Navbar({ transparent = false }: NavbarProps) {
  const s = await getSettings(["logo.emblem", "logo.full", "logo.full_white"]);
  return (
    <NavbarClient
      transparent={transparent}
      initialEmblem={s["logo.emblem"] || "/images/logo-emblem.png"}
      initialFull={s["logo.full"] || "/images/logo-full.png"}
      initialFullWhite={s["logo.full_white"] || ""}
    />
  );
}
