/** SINGKATAN MAPEL (22 September 2026) — kepala kolom DKN & leger memakai singkatan (PAI, PJOK, MTK…) yang diisi Kurikulum
 * di Data Mapel → Singkatan Mapel (`Subject.singkatan`, satu isian per NAMA mapel, berlaku semua tingkat). `saranSingkatan`
 * hanya USULAN untuk mengisi form — yang tampil di dokumen tetap isian tersimpan; kosong = nama lengkap. Murni (klien & server). */

const BAKU: [RegExp, string][] = [
  [/^pendidikan agama islam/i, "PAI"],
  [/^pendidikan pancasila/i, "PP"],
  [/^pendidikan jasmani/i, "PJOK"],
  [/^bahasa indonesia/i, "B.IND"],
  [/^bahasa inggris/i, "B.ING"],
  [/^bahasa jawa/i, "B.JAWA"],
  [/^bahasa arab/i, "B.ARAB"],
  [/^matematika/i, "MTK"],
  [/^sejarah/i, "SEJ"],
  [/^seni budaya/i, "SBD"],
  [/^informatika/i, "INF"],
  [/^projek ilmu pengetahuan alam dan sosial/i, "IPAS"],
  [/^produk kreatif/i, "PKK"],
  [/^koding dan kecerdasan artifisial/i, "KKA"],
  [/^al[\s-]*qur'?an/i, "QUR"],
];
const KATA_SAMBUNG = new Set(["dan", "&", "atau", "serta", "untuk", "di", "ke", "dari"]);

/** Usulan singkatan: daftar baku sekolah umum → isi kurung "(KJD)" → Dasar Program/Konsentrasi Keahlian bernomor → inisial kata. */
export function saranSingkatan(nama: string): string {
  const n = nama.trim();
  for (const [pola, s] of BAKU) if (pola.test(n)) return s;
  const kurung = /\(([^)]+)\)\s*$/.exec(n);
  if (kurung) return kurung[1].trim(); // apa adanya — "ATUPd" memang berhuruf kecil
  const nomor = /\s(\d+)\s*$/.exec(n)?.[1] ?? "";
  if (/^dasar program keahlian/i.test(n)) return `DPK${nomor ? ` ${nomor}` : ""}`;
  if (/^konsentrasi keahlian/i.test(n)) return `KK${nomor ? ` ${nomor}` : ""}`;
  const kata = n.replace(/\d+/g, " ").split(/[\s/-]+/).filter(k => k && !KATA_SAMBUNG.has(k.toLowerCase()));
  if (kata.length === 1) return kata[0].replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() + (nomor ? ` ${nomor}` : "");
  return kata.map(k => k[0]).join("").toUpperCase() + (nomor ? ` ${nomor}` : "");
}

/** Label kepala kolom: singkatan tersimpan bila ada, selain itu nama lengkap. */
export const labelMapel = (nama: string, peta: Record<string, string> | undefined) => peta?.[nama]?.trim() || nama;

/** "PAI = Pendidikan Agama Islam Dan Budi Pekerti; MTK = Matematika" — keterangan di bawah tabel/cetakan. */
export function keteranganSingkatan(daftar: string[], peta: Record<string, string> | undefined): string {
  return daftar.filter(m => peta?.[m]?.trim()).map(m => `${peta![m].trim()} = ${m}`).join("; ");
}
