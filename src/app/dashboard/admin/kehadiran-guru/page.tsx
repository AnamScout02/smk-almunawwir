import KehadiranGuruTerpadu from "@/components/shared/KehadiranGuruTerpadu";

export const dynamic = "force-dynamic";

// "Hari ini" dihitung di WIB, bukan jam server yang UTC (DESIGN_SYSTEM §17.4).
const wib = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
const wibMundur = (hari: number) => new Date(Date.now() + 7 * 3600_000 - hari * 86400000).toISOString().slice(0, 10);

export default function AdminKehadiranGuruPage() {
  return <KehadiranGuruTerpadu bukuPiketHref="/dashboard/admin/kedisiplinan-guru" dariAwal={wibMundur(6)} sampaiAwal={wib()} />;
}
