import KehadiranGuruTerpadu from "@/components/shared/KehadiranGuruTerpadu";

export const dynamic = "force-dynamic";

// Tautan "Buku Piket" menuju rute portal GURU — guru tidak bisa membuka /dashboard/admin/* (CLAUDE.md #45).
const wib = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
const wibMundur = (hari: number) => new Date(Date.now() + 7 * 3600_000 - hari * 86400000).toISOString().slice(0, 10);

export default function TeacherKehadiranGuruPage() {
  return <KehadiranGuruTerpadu bukuPiketHref="/dashboard/teacher/wakasek/penjamin-mutu/kedisiplinan" dariAwal={wibMundur(6)} sampaiAwal={wib()} />;
}
