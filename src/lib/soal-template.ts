import "server-only";
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType,
  BorderStyle, ShadingType, HeadingLevel,
} from "docx";

/** Pembuat TEMPLATE naskah soal (Word) dan pengaturan ujian (Excel) untuk diunduh guru.
 *
 * Meniru bentuk yang sudah dikenal guru sekolah ini dari template Bimasoft — tabel tiga kolom
 * [No | Huruf | Teks] untuk Word, dan blok pengaturan + tabel kunci untuk Excel — supaya tidak ada
 * yang perlu belajar format baru. Bedanya: keduanya cukup DIUNGGAH ke sistem, tidak perlu makro,
 * tidak perlu menerbitkan ke WordPress.
 *
 * Jenis soal selain pilihan ganda ditandai dengan satu baris penanda di dalam kolom pertanyaan,
 * mis. `[BENAR_SALAH]`, `[MENJODOHKAN]`, `[ISIAN_SINGKAT]`, `[URAIAN]` - pembaca Word mengenali
 * penanda ini (lihat `soal-word.ts`). Tanpa penanda = pilihan ganda. */

const ABU = "D9D9D9";
const NAVY = "0F1A45";
const KUNING = "FFF2CC";

const teks = (t: string, opsi: { bold?: boolean; color?: string; size?: number; italics?: boolean } = {}) =>
  new Paragraph({ children: [new TextRun({ text: t, bold: opsi.bold, color: opsi.color, size: opsi.size ?? 22, italics: opsi.italics })] });

const sel = (isi: Paragraph[], opsi: { lebar: number; shading?: string; colSpan?: number } ) =>
  new TableCell({
    children: isi,
    width: { size: opsi.lebar, type: WidthType.PERCENTAGE },
    columnSpan: opsi.colSpan,
    shading: opsi.shading ? { type: ShadingType.CLEAR, fill: opsi.shading, color: "auto" } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
  });

/** Blok satu soal PG: baris nomor + baris huruf A-E. */
function blokPG(nomor: number, contoh?: { tanya: string; opsi: string[] }, warna?: string): TableRow[] {
  const huruf = contoh && contoh.opsi.length > 5 ? ["A", "B", "C", "D", "E", "F"] : ["A", "B", "C", "D", "E"];
  const baris: TableRow[] = [
    new TableRow({
      children: [
        sel([teks(`${nomor}.`, { bold: true })], { lebar: 6, shading: warna ?? ABU }),
        sel([teks(contoh?.tanya ?? "")], { lebar: 94, colSpan: 2, shading: warna }),
      ],
    }),
  ];
  huruf.forEach((h, i) => {
    if (contoh && i >= contoh.opsi.length) return;
    baris.push(new TableRow({
      children: [
        sel([teks("")], { lebar: 6, shading: warna }),
        sel([teks(h, { bold: true })], { lebar: 6, shading: warna ?? ABU }),
        sel([teks(contoh?.opsi[i] ?? "")], { lebar: 88, shading: warna }),
      ],
    }));
  });
  return baris;
}

/** Blok soal MENJODOHKAN: butir kiri pada baris bernomor, pilihan kanan ditulis di sel pertanyaan
 * supaya guru melihat keduanya sekaligus. Pasangannya diisi di Excel (mis. 1-B,2-A,3-D). */
function blokMenjodohkan(nomor: number, c: { tanya: string; kiri: string[]; kanan: string[] }): TableRow[] {
  const kepala = [
    teks("[MENJODOHKAN]", { bold: true, color: "C00000" }),
    teks(c.tanya),
    teks(""),
    teks("Pilihan kanan:", { bold: true, size: 20 }),
    ...c.kanan.map((t, i) => teks(`   ${["A", "B", "C", "D", "E", "F"][i]}. ${t}`, { size: 20 })),
    teks(""),
    teks("Kunci di Excel: 1-A,2-B,3-C   (butir kiri - pilihan kanan)", { size: 20, italics: true }),
  ];
  const baris: TableRow[] = [
    new TableRow({
      children: [
        sel([teks(`${nomor}.`, { bold: true })], { lebar: 6, shading: KUNING }),
        sel(kepala, { lebar: 94, colSpan: 2, shading: KUNING }),
      ],
    }),
  ];
  c.kiri.forEach((t, i) => {
    baris.push(new TableRow({
      children: [
        sel([teks("")], { lebar: 6, shading: KUNING }),
        sel([teks(String(i + 1), { bold: true })], { lebar: 6, shading: ABU }),
        sel([teks(t)], { lebar: 88, shading: KUNING }),
      ],
    }));
  });
  return baris;
}

/** Blok soal jenis lain: baris nomor berisi penanda + pertanyaan, tanpa baris huruf. */
function blokPenanda(nomor: number, penanda: string, isi: string[]): TableRow[] {
  return [
    new TableRow({
      children: [
        sel([teks(`${nomor}.`, { bold: true })], { lebar: 6, shading: ABU }),
        sel([teks(`[${penanda}]`, { bold: true, color: "C00000" }), ...isi.map(t => teks(t))], { lebar: 94, colSpan: 2, shading: KUNING }),
      ],
    }),
  ];
}

export async function buatTemplateWord(opsi: { mapel?: string; kelas?: string; guru?: string } = {}): Promise<Buffer> {
  const identitas = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      ["Mata Pelajaran", opsi.mapel ?? ""],
      ["Kelas", opsi.kelas ?? ""],
      ["Guru Pengampu", opsi.guru ?? ""],
    ].map(([k, v]) => new TableRow({
      children: [
        sel([teks(k, { bold: true })], { lebar: 25, shading: ABU }),
        sel([teks(":")], { lebar: 3 }),
        sel([teks(v)], { lebar: 72 }),
      ],
    })),
  });

  // SELURUH tabel berisi CONTOH TERISI, satu (atau dua) untuk tiap jenis soal — bukan puluhan baris
  // pilihan ganda kosong. Guru cukup mengganti isinya dan menyalin blok yang sejenis untuk menambah
  // soal, jadi format tiap jenis selalu terlihat dan tidak ada yang salah tulis (permintaan user
  // 13 September 2026). Urutan & nomornya SAMA PERSIS dengan kunci contoh di template Excel.
  const rows: TableRow[] = [
    // 1. PILIHAN GANDA
    ...blokPG(1, {
      tanya: "[CONTOH PILIHAN GANDA] Ibu kota Provinsi Jawa Timur adalah ....",
      opsi: ["Surabaya", "Malang", "Kediri", "Banyuwangi", "Jember"],
    }),
    // 2. PILIHAN GANDA DENGAN RUMUS
    ...blokPG(2, {
      tanya: "[CONTOH PILIHAN GANDA + RUMUS] Hasil dari $\\frac{3}{4} + \\frac{1}{2}$ adalah ....   (rumus ditulis di antara tanda $)",
      opsi: ["$\\frac{5}{4}$", "$\\frac{4}{6}$", "$\\frac{3}{8}$", "$\\frac{2}{3}$", "$x^2 = 4$"],
    }),
    // 3. PILIHAN GANDA KOMPLEKS
    ...blokPG(3, {
      tanya: "[PG_KOMPLEKS] Pilih SEMUA bilangan prima berikut.",
      opsi: ["2", "9", "11", "15", "17"],
    }, KUNING),
    // 4. BENAR / SALAH
    ...blokPenanda(4, "BENAR_SALAH", [
      "Tentukan Benar atau Salah tiap pernyataan berikut.",
      "1) Jakarta adalah ibu kota Indonesia.",
      "2) Matahari terbit dari sebelah barat.",
      "3) Air mendidih pada suhu 100 derajat Celsius di permukaan laut.",
    ]),
    // 5. MENJODOHKAN
    ...blokMenjodohkan(5, {
      tanya: "Pasangkan jenis teks dengan ciri utamanya.",
      kiri: ["Teks eksposisi", "Teks narasi", "Teks deskripsi"],
      kanan: [
        "Memaparkan pendapat disertai argumen",
        "Menceritakan peristiwa berurutan waktu",
        "Menggambarkan objek secara rinci",
        "Berisi langkah-langkah (pengecoh)",
      ],
    }),
    // 6. ISIAN SINGKAT
    ...blokPenanda(6, "ISIAN_SINGKAT", ["Hasil dari 7 x 8 adalah ...."]),
    // 7. SURVEI (tidak dinilai)
    ...blokPG(7, {
      tanya: "[SURVEI] Bagian mana yang menurut Anda paling sulit?   (tidak dinilai)",
      opsi: ["Menentukan gagasan utama", "Menyusun kalimat efektif", "Membedakan jenis teks", "Menulis paragraf"],
    }, KUNING),
    // 8. URAIAN (dikoreksi guru)
    ...blokPenanda(8, "URAIAN", ["Jelaskan proses terjadinya hujan!"]),
    // 9. UNGGAH BERKAS (dinilai guru)
    ...blokPenanda(9, "UNGGAH", ["Unggah foto poster hasil karya Anda (JPG/PNG/PDF, maks 5 MB)."]),
  ];

  const soal = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
      left: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
      right: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "BBBBBB" },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "BBBBBB" },
    },
  });

  const baris = (t: string, o: { bold?: boolean; color?: string } = {}) => teks(t, { size: 20, ...o });
  const doc = new Document({
    creator: "SMK Al Munawwir IIBS - Pusat Ujian",
    // Arial Narrow untuk SELURUH naskah (permintaan user 20 September 2026) — sama dengan font
    // dokumen cetak sekolah (.print-doc), jadi hasil unduhan & hasil cetak terlihat satu keluarga.
    styles: { default: { document: { run: { font: "Arial Narrow", size: 22 } } } },
    sections: [{
      children: [
        new Paragraph({ text: "TEMPLATE NASKAH SOAL - PUSAT UJIAN ONLINE", heading: HeadingLevel.HEADING_2, alignment: AlignmentType.CENTER }),
        teks("SMK Al Munawwir IIBS", { bold: true, color: NAVY }),
        new Paragraph({ text: "" }),
        identitas,
        new Paragraph({ text: "" }),
        teks("CARA MENGISI", { bold: true }),
        baris("1. Tabel di bawah berisi CONTOH TERISI untuk SEMUA jenis soal (nomor 1 sampai 9). Ganti isinya dengan soal Anda.", { bold: true }),
        baris("2. Untuk menambah soal: salin (copy) seluruh blok contoh yang jenisnya sama, tempel di bawahnya, lalu ubah nomornya."),
        baris("3. Hapus blok contoh yang jenisnya tidak dipakai. Nomor boleh tidak berurutan; yang penting nomor di Word SAMA dengan nomor di Excel."),
        baris("4. KUNCI JAWABAN TIDAK DITULIS DI SINI - diisi di berkas Excel pada nomor yang sama (template Excel sudah berisi kunci contoh 1-9).", { bold: true }),
        baris("5. Jenis soal ditentukan penanda di AWAL sel pertanyaan. Tanpa penanda = pilihan ganda biasa:"),
        baris("      [PG_KOMPLEKS]  [BENAR_SALAH]  [MENJODOHKAN]  [ISIAN_SINGKAT]  [URAIAN]  [UNGGAH]  [SURVEI]", { bold: true, color: "C00000" }),
        baris("   Tulisan [CONTOH ...] pada soal nomor 1 dan 2 hanya keterangan - hapus saat mengganti isinya."),
        baris("6. Benar/Salah: tulis pernyataan bernomor 1), 2), 3) di sel pertanyaan. Menjodohkan: butir kiri di baris bernomor, pilihan kanan di sel pertanyaan."),
        baris("7. Gambar: Insert > Picture langsung di sel pertanyaan (otomatis diperkecil saat diimpor). Pangkat/indeks (x2, H2O) tetap terbaca."),
        baris("8. Rumus matematika: tulis di antara tanda $, mis. $x^2 + \\sqrt{y}$ atau $\\frac{1}{2}$ - tampil sebagai rumus di layar siswa."),
        baris("9. Simpan sebagai .docx lalu unggah di Pusat Ujian > Bank Soal > Impor dari Word (bersama berkas Excel)."),
        new Paragraph({ text: "" }),
        soal,
      ],
    }],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}

/** TEMPLATE PENGATURAN & KUNCI (.xlsx).
 *
 * Dibangun dengan `exceljs`, bukan `xlsx` (SheetJS): edisi komunitas SheetJS tidak bisa menulis
 * GAYA sel sama sekali — font, garis tabel, dan warna semuanya hilang. Padahal bentuk bergaris &
 * berwarna itu yang dikenali guru dari template Bimasoft (permintaan user 20 September 2026,
 * beserta contoh berkas yang sudah mereka rapikan sendiri).
 *
 * Tata letak mengikuti berkas contoh user PERSIS: blok pengaturan di kiri (A–B), tabel kunci di
 * tengah (F–K, termasuk Pedoman Penskoran uraian), dan kelompok "Kisi - Kisi Soal" di kanan (L–O) sebagai kepala gabungan. Font
 * Arial Narrow di seluruh lembar, sama dengan naskah Word-nya. */
export async function buatTemplateExcel(opsi: { namaTest?: string; mapel?: string } = {}): Promise<Buffer> {
  // Kunci contoh untuk SEMUA jenis soal — nomor & urutannya SAMA PERSIS dengan template Word.
  // [No, Kunci, Pedoman Penskoran, Skor, Grouping, LockN, KD, Materi, Indikator Soal, Level, Keterangan]
  const kunci: (string | number)[][] = [
    [1, "A", "", 2, "", "", "3.1", "Teks prosedur", "Menentukan tujuan teks prosedur", "L1", "Pilihan ganda - satu huruf"],
    [2, "A", "", 2, "", "", "3.1", "Teks prosedur", "Menghitung hasil dari rumus pada teks", "L2", "Pilihan ganda dengan rumus - tetap satu huruf"],
    [3, "ACE", "", 4, "", "", "3.2", "Struktur teks", "Mengidentifikasi bagian-bagian teks", "L1", "PG Kompleks - gabungan huruf tanpa spasi/koma"],
    [4, "B,S,B", "", 6, "", "", "3.2", "Struktur teks", "Menilai kebenaran pernyataan tentang teks", "L2", "Benar/Salah - urut nomor pernyataan, pisahkan koma (boleh 1,0,1)"],
    [5, "1-A,2-B,3-C", "", 6, "", "", "3.3", "Kebahasaan", "Memasangkan istilah dengan maknanya", "L1", "Menjodohkan - butir kiri-pilihan kanan, pisahkan koma"],
    [6, "56|lima puluh enam", "", 4, "", "", "3.3", "Kebahasaan", "Menuliskan hasil perhitungan", "L2", "Isian singkat - jawaban lain yang juga benar dipisah tanda |"],
    [7, "", "", 0, "", "", "", "", "", "", "Survei - dikosongkan, skor 0 (tidak dinilai)"],
    // Uraian & unggah (21 September 2026, pertanyaan user): kolom Kunci Jawaban = JAWABAN ACUAN (poin jawaban yang
    // diharapkan), kolom Pedoman Penskoran = kriteria & skornya. Keduanya tercetak di Kartu Soal & lampiran kunci
    // kisi-kisi, dan tampil di layar Koreksi sebagai pegangan guru — tidak dinilai otomatis.
    [8, "Tujuan: membuat nasi goreng. Bahan & alat: nasi, bawang, kecap, minyak, wajan. Langkah: 1) panaskan minyak, 2) tumis bawang, 3) masukkan nasi & kecap, 4) aduk rata lalu sajikan. Memakai kalimat perintah.",
      "Tujuan tepat (4); bahan & alat lengkap (4); langkah urut dan jelas (6); bahasa baku (2)", 16, "", 8, "4.1", "Menyusun teks", "Menyusun teks prosedur sesuai struktur", "L3",
      "Uraian - Kunci = JAWABAN ACUAN, Pedoman Penskoran = kriteria & skor. LockN 8 = selalu di nomor 8"],
    [9, "Poster A4 berisi judul, langkah-langkah bergambar, dan nama pembuat.", "Isi sesuai tugas (5); kerapian (3); tepat waktu (2)", 10, "", 9, "4.1", "Menyusun teks", "Menyajikan hasil karya", "L3",
      "Unggah berkas - Kunci = gambaran hasil yang diharapkan, Pedoman = kriteria. LockN 9 = selalu di akhir"],
  ];
  const jumlah = kunci.length;
  const pengaturan: [string, string | number][] = [
    ["Nama Test", opsi.namaTest ?? ""],
    ["Kode Test", opsi.mapel ?? ""],
    ["Sub Test", ""],
    ["Tanggal", ""],
    ["Waktu Test", "07:30"],
    ["Alokasi", 90],
    ["Jumlah Soal", jumlah],
    ["Yang Harus Dikerjakan", jumlah],
    ["Acak Soal / Option", "1 / 1"],
    ["Key", ""],
  ];

  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "SMK Al Munawwir IIBS - Pusat Ujian";

  const garis = { style: "thin" as const, color: { argb: "FF9AA3BF" } };
  const kotak = { top: garis, left: garis, bottom: garis, right: garis };
  const isiKepala = (warna: string) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: warna } });

  const ws = wb.addWorksheet("SOAL", { views: [{ state: "frozen", ySplit: 2 }] });
  ws.properties.defaultRowHeight = 16;
  ws.columns = [
    { width: 24 }, { width: 30 }, { width: 3 }, { width: 3 }, { width: 3 },
    { width: 9 }, { width: 34 }, { width: 34 }, { width: 7 }, { width: 10 }, { width: 8 },
    { width: 8 }, { width: 22 }, { width: 42 }, { width: 7 }, { width: 62 },
  ];

  // --- Baris 1: tiga kepala kelompok (digabung seperti berkas contoh) ---
  ws.mergeCells("A1:B1"); ws.getCell("A1").value = "PENGATURAN UJIAN";
  ws.mergeCells("F1:K1"); ws.getCell("F1").value = "TABEL KUNCI JAWABAN";
  ws.mergeCells("L1:O1"); ws.getCell("L1").value = "Kisi - Kisi Soal";
  for (const [sel2, warna] of [["A1", "FF0F1A45"], ["F1", "FF1B2B6B"], ["L1", "FFB87D0E"]] as const) {
    const c = ws.getCell(sel2);
    c.font = { name: "Arial Narrow", bold: true, size: 11, color: { argb: "FFFFFFFF" } };
    c.fill = isiKepala(warna);
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.border = kotak;
  }

  // --- Baris 2: kepala kolom tabel kunci ---
  const kepala = ["No. Soal", "Kunci Jawaban", "Pedoman Penskoran (uraian)", "Skor", "Grouping", "LockN", "KD", "Materi", "Indikator Soal", "Level", "Keterangan (boleh dihapus)"];
  kepala.forEach((t, i) => {
    const c = ws.getCell(2, 6 + i);
    c.value = t;
    c.font = { name: "Arial Narrow", bold: true, size: 10, color: { argb: "FF0F1A45" } };
    c.fill = isiKepala("FFEEF0F8");
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = kotak;
  });

  // --- Blok pengaturan (kiri) & tabel kunci (kanan) ---
  pengaturan.forEach(([label, nilai], i) => {
    const r = 2 + i;
    const a = ws.getCell(r, 1), b = ws.getCell(r, 2);
    a.value = label; b.value = nilai;
    a.font = { name: "Arial Narrow", bold: true, size: 10 };
    b.font = { name: "Arial Narrow", size: 10 };
    a.fill = isiKepala("FFF5F6FA");
    a.border = kotak; b.border = kotak;
  });
  kunci.forEach((baris, i) => {
    const r = 3 + i;
    baris.forEach((v, k) => {
      const c = ws.getCell(r, 6 + k);
      c.value = v === "" ? null : v;
      c.font = { name: "Arial Narrow", size: 10, color: { argb: k === 10 ? "FF8A93A8" : "FF1F2937" } };
      c.alignment = { horizontal: k === 0 || k === 3 || k === 9 ? "center" : "left", vertical: "top", wrapText: k === 1 || k === 2 || k === 8 || k === 10 };
      c.border = kotak;
      if (i % 2 === 1) c.fill = isiKepala("FFFAFBFD"); // selang-seling supaya barisnya mudah diikuti
    });
  });

  // --- Lembar PETUNJUK ---
  const wp = wb.addWorksheet("PETUNJUK");
  wp.columns = [{ width: 26 }, { width: 26 }, { width: 78 }];
  const petunjuk: (string | number)[][] = [
    ["PETUNJUK PENGISIAN - TEMPLATE PENGATURAN & KUNCI UJIAN"],
    [],
    ["PENTING", "Naskah soal ada di berkas WORD, kunci jawaban di berkas EXCEL ini."],
    ["", "Kedua template berisi CONTOH TERISI nomor 1-9 untuk semua jenis soal. Ganti isinya; tambah baris untuk soal berikutnya."],
    ["", "Keduanya dihubungkan lewat NOMOR SOAL: soal nomor 3 di Word <-> baris No. Soal 3 di sini."],
    ["", "Kalau nomornya tidak cocok, sistem memberi tahu per soal saat impor - tidak diam-diam salah pasang."],
    [],
    ["=== BLOK KIRI: PENGATURAN ==="],
    ["Nama Test", "Judul ujian, mis. Sumatif Tengah Semester Ganjil"],
    ["Kode Test", "WAJIB sama persis dengan Mata Pelajaran di kepala naskah Word & nama mapel di Penugasan Mengajar,"],
    ["", "mis. Pendidikan Agama Islam Dan Budi Pekerti. Excel yang Kode Test-nya mapel lain DITOLAK saat diterapkan ke ujian."],
    ["Sub Test", "Keterangan tambahan, boleh dikosongkan"],
    ["Tanggal", "Tanggal pelaksanaan (boleh format tanggal Excel)"],
    ["Waktu Test", "Jam mulai, format 07:30"],
    ["Alokasi", "Lama pengerjaan dalam menit"],
    ["Jumlah Soal", "Banyaknya soal di naskah Word"],
    ["Yang Harus Dikerjakan", "Kalau lebih KECIL dari Jumlah Soal, tiap siswa hanya menerima sebagian soal yang diambil acak"],
    ["Acak Soal / Option", "1 = diacak, 0 = tidak. Contoh '1 / 0' = soal diacak, pilihan tidak."],
    ["", "Catatan: yang diacak ISI pilihannya; huruf A B C D E di layar siswa tetap urut."],
    ["Key", "Boleh kosong - token dibuat otomatis oleh sistem"],
    [],
    ["=== KEPALA NASKAH WORD ==="],
    ["Mata Pelajaran", "Sama persis dengan Kode Test di atas"],
    ["Kelas", "Keterangan saja: X AK 1, atau beberapa kelas (XI TKJ 1, XI TKJ 2), atau X Semua Jurusan."],
    ["", "Kelas peserta yang sebenarnya dipilih di Pengaturan ujian - satu ujian boleh untuk banyak kelas sekaligus."],
    ["Guru Pengampu", "Nama guru penyusun soal (keterangan)"],
    [],
    ["=== BLOK KANAN: KUNCI JAWABAN ==="],
    ["No. Soal", "Nomor soal sesuai naskah Word"],
    ["Skor", "Bobot butir. Boleh pecahan (2.5). Kosong = 1"],
    ["Grouping", "Isi nomor soal BERIKUTNYA yang satu wacana."],
    ["", "Contoh: soal 3 diisi 4, soal 4 diisi 5 -> soal 3,4,5 satu grup dan tidak dipisah saat diacak."],
    ["LockN", "Posisi tetap saat diacak. Isi 1 untuk soal yang harus selalu nomor 1 (listening/petunjuk);"],
    ["", "isi nomor terakhir untuk soal uraian yang harus di akhir."],
    ["KD", "Kode Kompetensi Dasar, mis. 3.1 - dipakai analisis hasil per KD"],
    ["Materi", "Opsional - materi pokok soal, mis. Teks prosedur. Dipakai cetak Kisi-kisi"],
    ["Indikator Soal", "Opsional - rumusan indikator, mis. Menentukan tujuan teks prosedur"],
    ["Level", "Opsional - level kognitif: L1 (pengetahuan & pemahaman), L2 (aplikasi), L3 (penalaran)"],
    ["Pedoman Penskoran", "Khusus uraian & unggah berkas - kriteria dan skornya. Soal lain dikosongkan"],
    [],
    ["=== FORMAT KOLOM 'KUNCI JAWABAN' PER JENIS SOAL ==="],
    ["Jenis Soal", "Penanda di Word", "Contoh isi kolom Kunci Jawaban"],
    ["Pilihan Ganda", "(tanpa penanda)", "B"],
    ["Pilihan Ganda Kompleks", "[PG_KOMPLEKS]", "ACE            (gabungan huruf, tanpa spasi/koma)"],
    ["Benar / Salah", "[BENAR_SALAH]", "B,S,B          (urut pernyataan; boleh juga 1,0,1)"],
    ["Menjodohkan", "[MENJODOHKAN]", "1-A,2-B,3-C    (butir kiri - pilihan kanan)"],
    ["Isian Singkat", "[ISIAN_SINGKAT]", "56|lima puluh enam   (alternatif dipisah tanda | )"],
    ["Uraian", "[URAIAN]", "JAWABAN ACUAN - poin jawaban yang diharapkan, mis. Tujuan: membuat nasi goreng. Langkah: ..."],
    ["", "", "Isi juga kolom PEDOMAN PENSKORAN di sebelahnya, mis. Tujuan tepat (4); langkah urut (6); bahasa baku (2)"],
    ["", "", "Tidak dinilai otomatis - keduanya dicetak di Kartu Soal & lampiran kunci Kisi-kisi, dan jadi pegangan guru di Koreksi Uraian."],
    ["Unggah Berkas", "[UNGGAH]", "Gambaran hasil yang diharapkan + Pedoman Penskoran, mis. Isi sesuai tugas (5); kerapian (3)"],
    ["Survei", "[SURVEI]", "(dikosongkan - tidak dinilai, skor 0)"],
    [],
    ["=== CARA MENGUNGGAH ==="],
    ["1.", "Buka Pusat Ujian > Bank Soal > Impor dari Word"],
    ["2.", "Pilih berkas Word (naskah) DAN berkas Excel ini sekaligus"],
    ["3.", "Sistem menampilkan hasil bacaannya - periksa kunci tiap soal, betulkan yang meleset"],
    ["4.", "Tekan Simpan. Soal yang belum lengkap dilewati dan disebutkan alasannya."],
  ];
  petunjuk.forEach(baris => {
    const r = wp.addRow(baris.length ? baris : [""]);
    const judulSeksi = typeof baris[0] === "string" && baris[0].startsWith("===");
    const judulUtama = r.number === 1;
    r.eachCell({ includeEmpty: false }, cell => {
      cell.font = {
        name: "Arial Narrow", size: judulUtama ? 12 : 10,
        bold: judulUtama || judulSeksi || Number(cell.col) === 1,
        color: { argb: judulUtama || judulSeksi ? "FF0F1A45" : "FF1F2937" },
      };
      cell.alignment = { vertical: "top", wrapText: true };
      if (judulSeksi || judulUtama) cell.fill = isiKepala(judulUtama ? "FFEEF0F8" : "FFF5F6FA");
    });
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}
