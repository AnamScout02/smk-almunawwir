export type WeekType = "A" | "B";

// grade 12 / lainnya -> null (artinya "SEMUA", tidak ikut rotasi)
export function weekGroupForClass(grade: number, weekType: WeekType): "PRODUKTIF" | "UMUM" | null {
  if (grade !== 10 && grade !== 11) return null;
  const isA = weekType === "A";
  if (grade === 10) return isA ? "PRODUKTIF" : "UMUM";
  return isA ? "UMUM" : "PRODUKTIF"; // XI dibalik dari X
}

const WEEK_NUMBER: Record<WeekType, string> = { A: "1", B: "2" };

export function weekLabel(grade: number, weekType: string): string {
  if (weekType === "SEMUA") return "Setiap Minggu";
  const group = weekGroupForClass(grade, weekType as WeekType);
  return `Minggu ${WEEK_NUMBER[weekType as WeekType]} (${group === "PRODUKTIF" ? "Produktif" : "Umum"})`;
}

// Blok dengan weekType berbeda (A vs B) TIDAK dianggap bentrok satu sama lain — cuma dianggap
// bentrok kalau salah satunya "SEMUA" (berlaku di minggu manapun) atau weekType-nya sama persis.
export function weekTypesOverlap(w1: string, w2: string): boolean {
  return w1 === "SEMUA" || w2 === "SEMUA" || w1 === w2;
}
