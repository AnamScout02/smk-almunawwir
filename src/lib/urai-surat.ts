/** PENGURAI SURAT MASUK (9 Okt 2026) — MURNI, dipakai setelah OCR di peramban. Mengusulkan nomor, tanggal, pengirim, dan
 *  perihal dari teks surat dinas berbahasa Indonesia. Hasilnya USULAN: OCR sering salah baca stempel, tulisan tangan, dan
 *  kop bergambar, jadi layar selalu menampilkannya dengan tombol "Pakai" — tidak pernah mengisi sendiri.
 *  Tanpa regex lookbehind (Safari iPhone lama gagal mengurainya — CLAUDE.md #66). */
export type UsulanSurat = { nomor: string; tanggal: string; pengirim: string; perihal: string };

const BULAN: Record<string, number> = {
  januari: 1, februari: 2, pebruari: 2, maret: 3, april: 4, mei: 5, juni: 6, juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, nopember: 11, desember: 12,
};
const rapikan = (s: string) => s.replace(/[|_]+/g, " ").replace(/\s+/g, " ").replace(/^[\s:.\-–]+|[\s:.\-–]+$/g, "").trim();

function isoDari(d: number, m: number, y: number) {
  if (!(y >= 2000 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return "";
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function uraiSurat(mentah: string): UsulanSurat {
  const baris = mentah.split(/\r?\n/).map(b => b.trim()).filter(Boolean);
  const ambil = (pola: RegExp) => { for (const b of baris) { const m = pola.exec(b); if (m?.[1]) { const v = rapikan(m[1]); if (v.length >= 3) return v; } } return ""; };

  // "Nomor : 421.5/123/SMK/2026" — juga "No." dan "Nomer". Dihentikan sebelum label lain di baris yang sama.
  let nomor = ambil(/^(?:nomor|nomer|no)\s*[.:]\s*[:.]?\s*(.+)$/i);
  // Nomor surat tidak memuat kata: ambil rangkaian awal huruf/angka/titik yang disambung "/" atau "-" saja, supaya isi
  // kolom sebelahnya ("… Tangerang, 1 Oktober 2026") tidak ikut terbawa saat OCR merapatkan dua kolom jadi satu baris.
  nomor = (/^[\w.]+(?:\s?[\/\-]\s?[\w.]+)*/.exec(nomor)?.[0] ?? "").slice(0, 80);

  // "Perihal : …" / "Hal : …" — isi boleh berlanjut ke baris berikutnya bila baris itu bukan label lain.
  let perihal = "";
  for (let i = 0; i < baris.length; i++) {
    const m = /^(?:perihal|hal)\s*[.:]\s*(.*)$/i.exec(baris[i]);
    if (!m) continue;
    perihal = rapikan(m[1]);
    const lanjut = baris[i + 1] ?? "";
    if (perihal.length < 60 && lanjut && !/^(?:nomor|no|lampiran|lamp|sifat|kepada|yth|di\b|dengan|assalam|bismillah|sehubungan|berdasarkan|menindak|dalam rangka)/i.test(lanjut) && !/,$/.test(lanjut) && !/[.:]\s*$/.test(perihal) && lanjut.length < 70 && !/^\d/.test(lanjut)) perihal = rapikan(`${perihal} ${lanjut}`);
    break;
  }
  perihal = perihal.slice(0, 200);

  // Tanggal: "12 Oktober 2026" (juga "Banyuwangi, 12 Oktober 2026") didahulukan; cadangan 12/10/2026 atau 12-10-2026.
  let tanggal = "";
  for (const b of baris) {
    const m = /(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/.exec(b);
    const bln = m ? BULAN[m[2].toLowerCase()] : 0;
    if (m && bln) { tanggal = isoDari(+m[1], bln, +m[3]); if (tanggal) break; }
  }
  if (!tanggal) for (const b of baris) { const m = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/.exec(b); if (m) { tanggal = isoDari(+m[1], +m[2], +m[3]); if (tanggal) break; } }

  // Pengirim = baris kop: di 8 baris teratas, baris yang hampir seluruhnya huruf besar dan memuat kata lembaga didahulukan;
  // bila tidak ada, baris huruf besar terpanjang. Baris alamat/telepon dilewati.
  const atas = baris.slice(0, 8).filter(b => b.length >= 6 && !/(jl\.|jalan|telp|telepon|fax|e-?mail|website|kode pos|www\.|@)/i.test(b) && !/^(?:nomor|no|lampiran|perihal|hal)\b/i.test(b));
  const besar = atas.filter(b => { const h = b.replace(/[^A-Za-z]/g, ""); return h.length >= 6 && h.replace(/[^A-Z]/g, "").length / h.length >= 0.8; });
  const lembaga = /(DINAS|KEMENTERIAN|PEMERINTAH|SEKOLAH|SMK|SMA|SMP|MTS|MADRASAH|YAYASAN|UNIVERSITAS|INSTITUT|POLITEKNIK|KANTOR|BADAN|PT\b|CV\b|KOMITE|PONDOK|KECAMATAN|DESA|KEPOLISIAN|PUSKESMAS|BANK)/;
  // Kop pemerintah bertingkat ("PEMERINTAH PROVINSI …" lalu "DINAS PENDIDIKAN"): yang paling khusus biasanya baris lembaga TERAKHIR.
  const calon = besar.filter(b => lembaga.test(b));
  const pengirim = rapikan((calon.length ? calon[calon.length - 1] : [...besar].sort((a, b) => b.length - a.length)[0]) ?? "").slice(0, 120);

  return { nomor, tanggal, pengirim: pengirim.replace(/\b([A-Z])([A-Z]+)\b/g, (_, a: string, b: string) => (b.length <= 2 && /^(PT|CV|UD|SMK|SMA|SMP|MTS|MA|RI)$/.test(a + b) ? a + b : a + b.toLowerCase())), perihal };
}
