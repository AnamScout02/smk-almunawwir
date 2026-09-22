import { type Opsi, type Kunci, HURUF } from "@/lib/soal";

/** Menerapkan isi kolom "Kunci Jawaban" dari Excel ke sebuah butir, sesuai tipenya.
 *
 * Format yang diterima (dicantumkan juga di lembar PETUNJUK template Excel):
 *   PG            : "A"                      -> opsi A ditandai benar
 *   PG_KOMPLEKS   : "ACD" / "A,C,D"          -> A, C, D ditandai benar
 *   BENAR_SALAH   : "B,S,B" / "BSB" / "1,0,1" -> urut pernyataan 1..n
 *   MENJODOHKAN   : "1-B,2-A,3-C"            -> pasangan kiri->kanan
 *   ISIAN_SINGKAT : "jawaban|alternatif"     -> daftar jawaban yang diterima
 *   URAIAN/UNGGAH : JAWABAN ACUAN (dikoreksi guru). Kolom "Pedoman Penskoran" (bila ada) → rubrik. Berkas lama tanpa
 *                   kolom itu: isi kolom Kunci dianggap pedoman penskoran seperti sebelumnya.
 *   SURVEI        : diabaikan
 *
 * Mengembalikan butir baru (tidak mengubah masukan) + daftar peringatan bila kunci tidak cocok
 * dengan pilihan yang ada (mis. kunci "E" padahal pilihan hanya A-D). */
export function terapkanKunci(
  b: { tipe: string; opsi: Opsi[]; kunci: Kunci | null },
  kunciTeks: string,
  /** Isi kolom "Pedoman Penskoran" — null/undefined bila berkasnya TIDAK punya kolom itu (template lama). */
  pedoman?: string | null,
): { opsi: Opsi[]; kunci: Kunci | null; peringatan: string[] } {
  const k = (kunciTeks ?? "").trim();
  const peringatan: string[] = [];
  const opsi = b.opsi.map(o => ({ ...o, benar: false }));
  let kunci: Kunci | null = b.kunci ? { ...b.kunci } : null;

  // Uraian & unggah: kolom Kunci = jawaban acuan, kolom Pedoman = pedoman penskoran (21 September 2026).
  if (b.tipe === "URAIAN" || b.tipe === "UNGGAH" || b.tipe === "LISAN") {
    if (pedoman === null || pedoman === undefined) {
      if (k) kunci = { ...(kunci ?? {}), rubrik: k }; // template lama: satu kolom = pedoman penskoran
    } else {
      const p = pedoman.trim();
      kunci = { ...(kunci ?? {}), ...(k ? { acuan: k } : {}), ...(p ? { rubrik: p } : {}) };
    }
    return { opsi: b.opsi, kunci, peringatan };
  }

  if (!k) {
    if (b.tipe === "PG" || b.tipe === "PG_KOMPLEKS" || b.tipe === "ISIAN_SINGKAT" || b.tipe === "MENJODOHKAN") {
      peringatan.push("Kunci jawaban kosong");
    }
    return { opsi: b.opsi, kunci, peringatan };
  }

  switch (b.tipe) {
    case "PG": {
      const h = k.toUpperCase().replace(/[^A-H]/g, "").slice(0, 1);
      const o = opsi.find(x => x.kode === h);
      if (o) o.benar = true; else peringatan.push(`Kunci "${k}" tidak ada di pilihan`);
      break;
    }
    case "PG_KOMPLEKS": {
      const huruf = [...new Set(k.toUpperCase().replace(/[^A-H]/g, "").split(""))];
      for (const h of huruf) {
        const o = opsi.find(x => x.kode === h);
        if (o) o.benar = true; else peringatan.push(`Kunci "${h}" tidak ada di pilihan`);
      }
      if (!opsi.some(o => o.benar)) peringatan.push("Tidak ada kunci yang cocok");
      break;
    }
    case "BENAR_SALAH": {
      const nilai = k.toUpperCase().replace(/[^BSTF10]/g, "").split("")
        .map(c => c === "B" || c === "T" || c === "1");
      if (nilai.length !== opsi.length) peringatan.push(`Kunci ${nilai.length} nilai, pernyataan ${opsi.length}`);
      opsi.forEach((o, i) => { if (i < nilai.length) o.benar = nilai[i]; });
      break;
    }
    case "MENJODOHKAN": {
      const pasangan: Record<string, string> = {};
      for (const bagian of k.split(/[,;]\s*/)) {
        const m = bagian.trim().match(/^(\w+)\s*[-=:>]+\s*(\w+)$/);
        if (m) pasangan[m[1]] = m[2].toUpperCase();
      }
      const kanan = (kunci?.kanan ?? []);
      // Kalau pilihan kanan belum ada, bangun dari huruf yang muncul di pasangan.
      const hurufKanan = [...new Set(Object.values(pasangan))].sort();
      const kananBaru = kanan.length ? kanan : hurufKanan.map(h => ({ kode: h, teks: "" }));
      for (const o of opsi) if (!pasangan[o.kode]) peringatan.push(`Butir ${o.kode} belum berpasangan`);
      kunci = { ...(kunci ?? {}), kanan: kananBaru, pasangan };
      if (!kanan.length) peringatan.push("Teks pilihan kanan diisi di formulir");
      break;
    }
    case "ISIAN_SINGKAT": {
      kunci = { ...(kunci ?? {}), jawaban: k.split("|").map(x => x.trim()).filter(Boolean) };
      break;
    }
    case "URAIAN":
    case "UNGGAH": {
      kunci = { ...(kunci ?? {}), rubrik: k };
      break;
    }
    default:
      break;
  }
  return { opsi, kunci, peringatan };
}

/** Kebalikannya: ringkas kunci sebuah butir jadi teks satu sel (untuk ekspor / pratinjau). */
export function kunciKeTeks(b: { tipe: string; opsi: Opsi[]; kunci: Kunci | null }): string {
  switch (b.tipe) {
    case "PG": return b.opsi.find(o => o.benar)?.kode ?? "";
    case "PG_KOMPLEKS": return b.opsi.filter(o => o.benar).map(o => o.kode).join("");
    case "BENAR_SALAH": return b.opsi.map(o => (o.benar ? "B" : "S")).join(",");
    case "MENJODOHKAN": return Object.entries(b.kunci?.pasangan ?? {}).map(([a, c]) => `${a}-${c}`).join(",");
    case "ISIAN_SINGKAT": return (b.kunci?.jawaban ?? []).join("|");
    case "URAIAN": case "UNGGAH": case "LISAN": return b.kunci?.acuan || b.kunci?.rubrik || "";
    case "TITIK_GAMBAR": return `${b.kunci?.area?.length ?? 0} area pada gambar`;
    case "SERET_LEPAS": return b.opsi.map(o => o.teks).join(", ");
    case "URUTKAN": return (b.kunci?.urutan?.length ? b.kunci.urutan : b.opsi.map(o => o.kode))
      .map(k => (b.opsi.find(o => o.kode === k)?.teks ?? k).replace(/<[^>]+>/g, "").slice(0, 40)).join(" → ");
    default: return "";
  }
}

/** Pastikan tiap opsi punya kode (A, B, C, ...) — dipakai saat butir datang dari formulir. */
export function rapikanKodeOpsi(opsi: Opsi[], tipe: string): Opsi[] {
  // Label seret-lepas terikat ke area lewat kodenya, dan langkah URUTKAN ke kunci urutan — kodenya jangan diubah.
  if (tipe === "SERET_LEPAS" || tipe === "URUTKAN") return opsi;
  if (tipe === "BENAR_SALAH" || tipe === "MENJODOHKAN") {
    return opsi.map((o, i) => ({ ...o, kode: String(i + 1) }));
  }
  return opsi.map((o, i) => ({ ...o, kode: HURUF[i] ?? String(i + 1) }));
}
