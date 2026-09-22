import UjianManager from "@/components/shared/UjianManager";
import { KisiMenuPortal } from "@/components/shared/NavPortal";
import { MENU_PUSAT_UJIAN } from "@/lib/menu-portal";

export default function PusatUjianPage() {
  return (
    <>
      <UjianManager basePath="/pusat-ujian" />
      {/* Seluruh menu portal juga tampil di beranda (18 Sep 2026) — tidak ada lagi laci menu di HP. */}
      <div className="px-6 pb-8 lg:px-8"><KisiMenuPortal items={MENU_PUSAT_UJIAN} judul="Menu Pusat Ujian" /></div>
    </>
  );
}
