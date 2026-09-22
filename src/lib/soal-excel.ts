import * as XLSX from "xlsx";
import { rapikanLevel } from "@/lib/kisi-kisi";

/** Pembaca Excel PENGATURAN UJIAN — mengikuti tata letak lembar "SOAL" pada template Excel yang
 * sudah dipakai guru sekolah ini bertahun-tahun (Bimasoft #13): blok pengaturan di kiri (label
 * di satu kolom, nilai di kolom sebelahnya) dan tabel kunci jawaban di kanan dengan kepala
 * `No. Soal | Kunci Jawaban | Skor | Grouping | LockN | KD` (+ opsional `Materi | Indikator Soal | Level` untuk kisi-kisi).
 *
 * Dibaca berdasarkan LABEL, bukan posisi sel — jadi kalau guru menggeser kolom atau menyisipkan
 * baris, tetap terbaca. */

export interface PengaturanUjian {
  namaTest: string | null;
  kodeTest: string | null;    // biasanya nama mapel
  subTest: string | null;
  tanggal: string | null;     // "YYYY-MM-DD"
  jamMulai: string | null;    // "HH:mm"
  alokasiMenit: number | null;
  jumlahSoal: number | null;
  jumlahDikerjakan: number | null;
  acakSoal: boolean | null;
  acakOpsi: boolean | null;
  key: string | null;         // "Key" = token ujian di template lama
}

export interface KunciBaris {
  nomor: number;
  kunci: string;              // "A" | "ABD" | "1" | "Benar,Salah,Benar" | teks isian | "" (uraian)
  skor: number;
  grouping: number | null;    // nomor soal berikutnya yang segrup (cara Bimasoft: rantai)
  lockN: number | null;
  kd: string | null;
  materi: string | null;
  indikator: string | null;
  levelKognitif: string | null;
  /** Kolom "Pedoman Penskoran" (uraian/unggah). null = berkas tidak punya kolom itu (template lama). */
  pedoman: string | null;
}

export interface HasilExcel {
  pengaturan: PengaturanUjian;
  kunci: KunciBaris[];
  lembar: string | null;
  catatan: string[];
}

const teks = (v: unknown) => String(v ?? "").trim();
const angka = (v: unknown): number | null => {
  const s = teks(v).replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/** Cari nilai di sebelah kanan sebuah label ("Nama Test :" → sel berikutnya yang tidak kosong). */
function nilaiSetelahLabel(rows: unknown[][], pola: RegExp): unknown[] {
  for (const r of rows) {
    for (let c = 0; c < r.length; c++) {
      if (pola.test(teks(r[c]).replace(/\s*:\s*$/, ""))) {
        return r.slice(c + 1).filter(v => teks(v) !== "");
      }
    }
  }
  return [];
}

export function bacaExcelUjian(buf: Buffer): HasilExcel {
  const wb = XLSX.read(buf, { type: "buffer" });
  const catatan: string[] = [];
  const kandidat = [...wb.SheetNames.filter(n => /soal|pengaturan|setting/i.test(n)), ...wb.SheetNames];

  for (const nama of kandidat) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nama], { header: 1, blankrows: false, defval: "" });

    // Kepala tabel kunci: cari baris yang memuat "No" + "Kunci" (+ "Skor"). Label di template
    // asli bisa pecah dua baris ("No.\nSoal") — makanya dicocokkan longgar.
    let iKepala = -1, kol: Record<string, number> = {};
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i].map(v => teks(v).toLowerCase().replace(/\s+/g, " "));
      const iNo = r.findIndex(v => /^no\.?( soal)?$/.test(v));
      const iKunci = r.findIndex(v => /kunci/.test(v));
      if (iNo >= 0 && iKunci > iNo) {
        iKepala = i;
        kol = {
          nomor: iNo, kunci: iKunci,
          skor: r.findIndex(v => /^skor|^bobot/.test(v)),
          grouping: r.findIndex(v => /group/.test(v)),
          lockN: r.findIndex(v => /lock/.test(v)),
          kd: r.findIndex(v => /^kd$|kompetensi/.test(v)),
          materi: r.findIndex(v => /^materi/.test(v)),
          indikator: r.findIndex(v => /indikator/.test(v)),
          level: r.findIndex(v => /level|kognitif/.test(v)),
          pedoman: r.findIndex(v => /pedoman|rubrik|penskoran/.test(v)),
        };
        break;
      }
    }
    if (iKepala < 0) continue;

    const kunci: KunciBaris[] = [];
    for (const r of rows.slice(iKepala + 1)) {
      const nomor = angka(r[kol.nomor]);
      if (nomor === null || nomor < 1) continue;
      kunci.push({
        nomor,
        kunci: teks(r[kol.kunci]),
        skor: kol.skor >= 0 ? (angka(r[kol.skor]) ?? 1) : 1,
        grouping: kol.grouping >= 0 ? angka(r[kol.grouping]) : null,
        lockN: kol.lockN >= 0 ? angka(r[kol.lockN]) : null,
        kd: kol.kd >= 0 ? (teks(r[kol.kd]) || null) : null,
        materi: kol.materi >= 0 ? (teks(r[kol.materi]) || null) : null,
        indikator: kol.indikator >= 0 ? (teks(r[kol.indikator]) || null) : null,
        levelKognitif: kol.level >= 0 ? rapikanLevel(r[kol.level]) : null,
        pedoman: kol.pedoman >= 0 ? teks(r[kol.pedoman]) : null,
      });
    }
    if (kunci.length === 0) continue;

    // Blok pengaturan (berbasis label).
    const tgl = nilaiSetelahLabel(rows, /^tanggal$/i);
    const jam = nilaiSetelahLabel(rows, /^waktu( test)?$/i);
    const acak = nilaiSetelahLabel(rows, /^acak/i);
    let tanggal: string | null = null;
    if (tgl.length >= 3) {
      // "15 | - | 10 | - | 2018" — pemisahnya ikut terbaca, ambil angkanya saja
      const n = tgl.map(angka).filter((x): x is number => x !== null);
      if (n.length >= 3) tanggal = `${n[2]}-${String(n[1]).padStart(2, "0")}-${String(n[0]).padStart(2, "0")}`;
    } else if (tgl.length === 1 && /^\d{5}$/.test(teks(tgl[0]))) {
      const p = XLSX.SSF.parse_date_code(Number(tgl[0]));
      if (p) tanggal = `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
    }
    let jamMulai: string | null = null;
    {
      const n = jam.map(angka).filter((x): x is number => x !== null);
      if (n.length >= 2) jamMulai = `${String(n[0]).padStart(2, "0")}:${String(n[1]).padStart(2, "0")}`;
    }
    const acakN = acak.map(angka).filter((x): x is number => x !== null);

    const pengaturan: PengaturanUjian = {
      namaTest: teks(nilaiSetelahLabel(rows, /^nama test$/i)[0]) || null,
      kodeTest: teks(nilaiSetelahLabel(rows, /^kode test$/i)[0]) || null,
      subTest: teks(nilaiSetelahLabel(rows, /^sub ?test$/i)[0]) || null,
      tanggal, jamMulai,
      alokasiMenit: angka(nilaiSetelahLabel(rows, /^alokasi$/i)[0]),
      jumlahSoal: angka(nilaiSetelahLabel(rows, /^jumlah soal$/i)[0]),
      jumlahDikerjakan: angka(nilaiSetelahLabel(rows, /^yang harus dikerjakan$/i)[0]),
      acakSoal: acakN.length >= 1 ? acakN[0] === 1 : null,
      acakOpsi: acakN.length >= 2 ? acakN[1] === 1 : null,
      key: teks(nilaiSetelahLabel(rows, /^key$/i)[0]) || null,
    };

    // Grouping ala Bimasoft = rantai "nomor berikutnya". Diterjemahkan jadi id grup: 3→4, 4→5
    // berarti 3,4,5 satu grup.
    const grup = new Map<number, number>();
    for (const k of kunci) if (k.grouping && k.grouping !== k.nomor) {
      const g = grup.get(k.nomor) ?? k.nomor;
      grup.set(k.nomor, g); grup.set(k.grouping, g);
    }
    for (const k of kunci) if (grup.has(k.nomor)) k.grouping = grup.get(k.nomor)!;
    else k.grouping = null;

    return { pengaturan, kunci, lembar: nama, catatan };
  }
  return {
    pengaturan: { namaTest: null, kodeTest: null, subTest: null, tanggal: null, jamMulai: null, alokasiMenit: null, jumlahSoal: null, jumlahDikerjakan: null, acakSoal: null, acakOpsi: null, key: null },
    kunci: [], lembar: null,
    catatan: ["Tidak ditemukan tabel kunci jawaban (kepala kolom 'No. Soal' dan 'Kunci Jawaban')."],
  };
}
