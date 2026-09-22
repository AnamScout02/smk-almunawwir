/** Mencocokkan nama mata pelajaran yang DITULIS guru (Kode Test di Excel, "Mata Pelajaran" di kepala
 * naskah Word) dengan nama mapel ujian di sistem (= nama di Penugasan Mengajar).
 *
 *   SAMA   : persis sama (abaikan besar-kecil huruf & tanda baca)
 *   MIRIP  : singkatan/versi pendek yang jelas maksudnya — "Pendidikan Agama Islam" untuk
 *            "Pendidikan Agama Islam Dan Budi Pekerti", "PJOK", "B. Indonesia", "MTK"
 *   BEDA   : mapel lain → berkas kemungkinan tertukar
 *   KOSONG : tidak diisi
 *
 * Aman dipakai di klien maupun server. */

export type HasilCocokMapel = "SAMA" | "MIRIP" | "BEDA" | "KOSONG";

const rapi = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
const inisial = (s: string) => rapi(s).split(" ").filter(w => w && w !== "dan").map(w => w[0]).join("");

/** Sebutan umum di sekolah yang tidak bisa ditebak dari huruf depan. Kunci = nama mapel (dirapikan). */
const SEBUTAN: Record<string, string[]> = {
  "matematika": ["mtk", "mat", "math"],
  "bahasa indonesia": ["bindo", "b indo", "b indonesia", "bhs indonesia", "bhs indo"],
  "bahasa inggris": ["bing", "b ing", "b inggris", "bhs inggris", "english"],
  "pendidikan jasmani olahraga dan kesehatan": ["penjas", "penjasorkes", "olahraga"],
  "pendidikan pancasila": ["ppkn", "pkn", "pancasila"],
};

export function cocokMapel(tertulis: string | null | undefined, mapel: string): HasilCocokMapel {
  if (!tertulis || !rapi(tertulis)) return "KOSONG";
  const a = rapi(tertulis), b = rapi(mapel);
  if (a === b) return "SAMA";
  // versi pendek dari depan: minimal 2 kata supaya "Pendidikan" saja tidak dianggap cocok
  if (a.split(" ").length >= 2 && (b.startsWith(a + " ") || a.startsWith(b + " "))) return "MIRIP";
  const tanpaSpasi = a.replace(/ /g, "");
  const ib = inisial(mapel);
  if (tanpaSpasi.length >= 2 && tanpaSpasi.length <= ib.length && ib.startsWith(tanpaSpasi)) return "MIRIP";
  if ((SEBUTAN[b] ?? []).includes(a)) return "MIRIP";
  return "BEDA";
}
