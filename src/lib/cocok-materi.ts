/** Pencocokan MATERI jurnal dengan butir Prota/Promes (netral, 10 Okt 2026). Jurnal sekali ketuk menyalin teks butir
 *  rencana apa adanya, jadi "tercapai" cukup dibuktikan dengan teks butir itu tertulis di jurnal (atau sebaliknya).
 *  Sengaja TIDAK memakai kemiripan kabur: salah cocok di sini membuat papan kurikulum melaporkan materi yang belum
 *  diajarkan sebagai tercapai. Jurnal yang ditulis bebas dengan kata lain = tidak dihitung, dan layar menyebutnya. */
const rapi = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export function cocokMateri(jurnal: string, butir: string): boolean {
  const j = rapi(jurnal), b = rapi(butir);
  if (b.length < 4 || j.length < 4) return false;
  return j.includes(b) || (j.length >= 8 && b.includes(j));
}
export interface ButirRencana { materi: string; jp: number; pekanMulai: number | null; pekanSelesai: number | null; catatan?: string | null }
export function bacaButir(items: unknown): ButirRencana[] {
  return (Array.isArray(items) ? items : []).map(x => x as ButirRencana).filter(x => x && typeof x.materi === "string" && x.materi.trim());
}
/** Ringkas kemajuan satu kelas terhadap rencana: butir tercapai, yang seharusnya sudah selesai, dan butir berikutnya. */
export function kemajuanRencana(butir: ButirRencana[], materiJurnal: string[], pekanKini: number) {
  const capai = butir.map(b => materiJurnal.some(m => cocokMateri(m, b.materi)));
  const berpekan = butir.some(b => b.pekanMulai || b.pekanSelesai);
  const seharusnya = berpekan ? butir.filter(b => { const akhir = b.pekanSelesai ?? b.pekanMulai; return !!akhir && akhir < pekanKini; }).length : null;
  const tercapai = capai.filter(Boolean).length;
  const iBerikut = capai.findIndex(c => !c);
  const pekanIni = butir.find(b => { const a = b.pekanMulai ?? b.pekanSelesai, z = b.pekanSelesai ?? b.pekanMulai; return !!a && !!z && a <= pekanKini && pekanKini <= z; }) ?? null;
  return {
    total: butir.length, tercapai, seharusnya,
    tertinggal: seharusnya === null ? null : Math.max(0, seharusnya - tercapai),
    berikut: iBerikut >= 0 ? butir[iBerikut] : null, pekanIni,
  };
}
