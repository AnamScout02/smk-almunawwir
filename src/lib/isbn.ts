/** ISBN (netral): hanya angka (dan X di akhir ISBN-10), 10 atau 13 digit, dengan angka periksa yang benar.
 *  Barcode belakang buku = EAN-13 berawalan 978/979 — itulah ISBN-13-nya. */
export function rapikanIsbn(mentah: string): string | null {
  const s = mentah.toUpperCase().replace(/[^0-9X]/g, "");
  if (s.length === 13 && /^\d{13}$/.test(s)) {
    const j = [...s].reduce((a, c, i) => a + Number(c) * (i % 2 ? 3 : 1), 0);
    return j % 10 === 0 ? s : null;
  }
  if (s.length === 10 && /^\d{9}[\dX]$/.test(s)) {
    const j = [...s].reduce((a, c, i) => a + (c === "X" ? 10 : Number(c)) * (10 - i), 0);
    return j % 11 === 0 ? s : null;
  }
  return null;
}
