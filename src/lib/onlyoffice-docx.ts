import "server-only";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun,
  Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, TableLayoutType,
  Header, Footer, HorizontalPositionRelativeFrom, VerticalPositionRelativeFrom, TextWrappingType,
} from "docx";
import { writeFile, mkdir, readFile } from "fs/promises";
import { join } from "path";
import { randomBytes } from "crypto";
import sharp from "sharp";

interface Run { text: string; bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean }

// Parser HTML→docx ringan khusus untuk output Tiptap (RichTextEditor) — bukan parser HTML umum.
// Cukup menangani tag yang benar-benar dihasilkan editor (p, h1-h3, blockquote, ul/ol>li, br,
// strong/b, em/i, u, s/strike) — tag lain (table, img, span warna/highlight) diabaikan formatnya
// tapi teksnya tetap diambil, supaya konversi tidak pernah gagal/crash pada isi surat nyata.
function decodeEntities(s: string): string {
  return s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function parseInlineRuns(html: string): Run[] {
  const runs: Run[] = [];
  const stack: { bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean }[] = [{}];
  const tagRe = /<(\/?)(\w+)[^>]*>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(html))) {
    const [, closing, tag, text] = m;
    if (text !== undefined) {
      const clean = decodeEntities(text);
      if (clean) runs.push({ text: clean, ...stack[stack.length - 1] });
      continue;
    }
    const name = (tag || "").toLowerCase();
    if (name === "br") { runs.push({ text: "\n" }); continue; }
    const styleMap: Record<string, keyof (typeof stack)[number]> = {
      strong: "bold", b: "bold", em: "italic", i: "italic", u: "underline", s: "strike", strike: "strike", del: "strike",
    };
    if (styleMap[name]) {
      if (closing) { if (stack.length > 1) stack.pop(); }
      else stack.push({ ...stack[stack.length - 1], [styleMap[name]]: true });
    }
  }
  return runs;
}

/** Konversi HTML hasil RichTextEditor (Tiptap) jadi array Paragraph docx — dipakai sebagai isi
 * awal dokumen ONLYOFFICE supaya surat yang sudah ditulis di editor biasa tidak mulai dari
 * halaman kosong saat pertama kali dibuka di Editor Word. */
function htmlToDocxParagraphs(html: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const blockRe = /<(p|h1|h2|h3|blockquote|li)[^>]*>([\s\S]*?)<\/\1>/g;
  let m: RegExpExecArray | null;
  let found = false;
  while ((m = blockRe.exec(html))) {
    found = true;
    const [, tag, inner] = m;
    const runs = parseInlineRuns(inner);
    const children = runs.length
      ? runs.flatMap((r, i) => {
          const parts = r.text.split("\n");
          return parts.flatMap((p, j) => {
            const arr: TextRun[] = [];
            if (j > 0) arr.push(new TextRun({ text: "", break: 1 }));
            if (p) arr.push(new TextRun({ text: p, bold: r.bold, italics: r.italic, underline: r.underline ? {} : undefined, strike: r.strike }));
            return arr;
          });
        })
      : [new TextRun("")];
    const heading = tag === "h1" ? HeadingLevel.HEADING_1 : tag === "h2" ? HeadingLevel.HEADING_2 : tag === "h3" ? HeadingLevel.HEADING_3 : undefined;
    paragraphs.push(new Paragraph({
      children,
      heading,
      bullet: tag === "li" ? { level: 0 } : undefined,
      indent: tag === "blockquote" ? { left: 720 } : undefined,
    }));
  }
  if (!found) {
    // Fallback: tidak ada tag block dikenali (mis. cuma teks polos) — tetap masukkan sebagai satu paragraf
    const text = decodeEntities(html.replace(/<[^>]+>/g, " ")).trim();
    if (text) paragraphs.push(new Paragraph({ children: [new TextRun(text)] }));
  }
  return paragraphs;
}

export function randomDocxKey(): string {
  return randomBytes(16).toString("hex");
}

const PAGE_WIDTH_PX = 794; // lebar penuh kertas A4 @96dpi (210mm) — dipakai kop atas/bawah supaya
                            // tampil dari tepi ke tepi persis seperti versi HTML (.a4-page width:210mm)
const SIDE_MARGIN_TWIPS = 1134; // 2cm, samakan dengan .a4-page-body padding:2cm di globals.css

const WHITE_TRANSPARENCY_THRESHOLD = 235; // piksel dgn R,G,B semuanya >= ini dianggap "putih polos"

// File upload runtime disajikan lewat /api/uploads/... (lihat komentar saveDocxToUploads di
// bawah), tapi FILE FISIKNYA tetap di public/uploads/... — prefix "/api" itu cuma bagian route,
// bukan bagian path disk, jadi harus dibuang dulu sebelum baca langsung dari disk. Dipakai juga
// di luar file ini (cetak/page.tsx) untuk baca .docx yang sama demi konversi mammoth saat print.
export function uploadUrlToDiskPath(url: string): string {
  const relPath = url.startsWith("/api/uploads/") ? url.slice(4) : url;
  return join(process.cwd(), "public", relPath);
}

async function loadLetterheadImage(
  url?: string | null,
  targetWidthPx = PAGE_WIDTH_PX,
  makeWhiteTransparent = false,
): Promise<ImageRun | null> {
  if (!url) return null;
  try {
    const filePath = uploadUrlToDiskPath(url);
    const raw = await readFile(filePath);
    const img = sharp(raw);
    const meta = await img.metadata();
    const w = meta.width || targetWidthPx;
    const h = meta.height || Math.round(targetWidthPx / 6);
    const width = targetWidthPx;
    const height = Math.round((h / w) * width);

    // Kop atas/bawah biasanya diupload sebagai JPG (selalu opaque, tidak ada alpha channel) —
    // area putih di sekeliling logo/teks kop jadi menutupi total pattern watermark di
    // belakangnya. Ubah piksel yang "putih polos" jadi transparan supaya pattern tetap
    // kelihatan tembus di area kosong kop, sementara logo/teks/garis kop yang berwarna tetap utuh.
    let pngBuffer: Buffer;
    if (makeWhiteTransparent) {
      const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] >= WHITE_TRANSPARENCY_THRESHOLD && data[i + 1] >= WHITE_TRANSPARENCY_THRESHOLD && data[i + 2] >= WHITE_TRANSPARENCY_THRESHOLD) {
          data[i + 3] = 0;
        }
      }
      pngBuffer = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
    } else {
      pngBuffer = await img.png().toBuffer();
    }

    return new ImageRun({ type: "png", data: pngBuffer, transformation: { width, height } });
  } catch {
    return null;
  }
}

function fmtLongId(d: Date): string {
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

const PAGE_HEIGHT_PX = 1123; // tinggi penuh kertas A4 @96dpi (297mm)
// Motif MIRING −45° (6 Okt 2026): ubin miring berperiode jarak motif × √2, jadi 90 → 127 px supaya jarak motif tetap sama
// dengan background-size:127.28px di .a4-page::before (globals.css). Bilangan bulat: sharp hanya mengubin piksel utuh.
const PATTERN_TILE_PX = 127;
const PATTERN_OPACITY = 0.04; // samakan dengan opacity:0.04 di .a4-page::before

/** Bikin satu gambar setinggi-lebar kertas A4 penuh, berisi pattern-smk.png yang diubin
 * berulang-ulang dengan opacity sangat tipis — meniru watermark `.a4-page::before` di
 * globals.css (versi HTML). Dipasang sebagai floating image "di belakang teks" (behindDocument)
 * di footer supaya otomatis muncul di SETIAP halaman, sama seperti versi HTML. */
async function createTiledPatternImage(): Promise<Buffer | null> {
  try {
    const patternPath = join(process.cwd(), "public", "images", "pattern-smk-miring.png");
    const raw = await readFile(patternPath);
    const { data, info } = await sharp(raw)
      .resize(PATTERN_TILE_PX, PATTERN_TILE_PX)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    // Turunkan channel alpha jadi ~4% — sharp tidak punya opsi "opacity" langsung saat composite,
    // jadi alpha tiap piksel dikalikan manual sebelum di-tile.
    for (let i = 3; i < data.length; i += 4) data[i] = Math.round(data[i] * PATTERN_OPACITY);
    const fadedTile = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();

    return await sharp({
      create: { width: PAGE_WIDTH_PX, height: PAGE_HEIGHT_PX, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    }).composite([{ input: fadedTile, tile: true }]).png().toBuffer();
  } catch {
    return null;
  }
}

const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

export interface SuratLetterData {
  nomor: string;
  perihal: string;
  pihak: string;
  tanggal: Date;
  penandaTangan: string;
  principalName: string;
  kopAtasUrl?: string | null;
  kopBawahUrl?: string | null;
  signatureUrl?: string | null;
  bodyHtml?: string | null;
}

/** Bikin file .docx surat LENGKAP (kop atas/bawah, tabel nomor/perihal, kepada yth, badan
 * surat, blok tanda tangan) — dipakai alur "langsung ke Editor Word" supaya begitu dibuka,
 * ONLYOFFICE sudah menampilkan surat resmi utuh (bukan cuma judul), tinggal ketik isinya.
 * File ini jadi SATU-SATUNYA sumber isi surat untuk mode ini (beda dari `createBlankDocx`
 * yang cuma menaruh badan surat sebagai pelengkap mode `content` HTML lama). */
export async function createSuratLetterDocx(data: SuratLetterData): Promise<Buffer> {
  const [kopAtas, kopBawah, signature, patternBuffer] = await Promise.all([
    loadLetterheadImage(data.kopAtasUrl, PAGE_WIDTH_PX, true),
    loadLetterheadImage(data.kopBawahUrl, PAGE_WIDTH_PX, true),
    loadLetterheadImage(data.signatureUrl, 100), // ~2,65cm @96dpi (gambar ttd/QR biasanya persegi) — kecil, bukan banner lebar penuh — biarkan putih (QR perlu kontras)
    createTiledPatternImage(),
  ]);

  const bodyParagraphs = data.bodyHtml?.trim()
    ? htmlToDocxParagraphs(data.bodyHtml)
    : [new Paragraph({ children: [new TextRun("")] })];

  // Kop atas cuma di halaman PERTAMA (header khusus "first page"); kop bawah & pattern watermark
  // di SEMUA halaman (footer biasa) — supaya kalau isi surat panjang sampai lebih dari 1 halaman,
  // kop bawah & pattern tetap konsisten muncul di tiap halaman sementara kop atas (identitas sekali
  // di awal surat) tidak berulang-ulang. Indent negatif = gambar tembus sampai tepi kertas
  // (edge-to-edge), meniru `.a4-page` versi HTML yang lebar penuh 210mm tanpa margin 2cm badan surat.
  const edgeToEdge = { left: -SIDE_MARGIN_TWIPS, right: -SIDE_MARGIN_TWIPS };
  const kopAtasHeader = kopAtas ? new Header({ children: [new Paragraph({ indent: edgeToEdge, children: [kopAtas] })] }) : undefined;

  const footerChildren: Paragraph[] = [];
  if (patternBuffer) {
    footerChildren.push(new Paragraph({ children: [new ImageRun({
      type: "png", data: patternBuffer,
      transformation: { width: PAGE_WIDTH_PX, height: PAGE_HEIGHT_PX },
      floating: {
        horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: 0 },
        verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: 0 },
        behindDocument: true,
        wrap: { type: TextWrappingType.NONE },
      },
    })] }));
  }
  if (kopBawah) footerChildren.push(new Paragraph({ indent: edgeToEdge, children: [kopBawah] }));
  const kopBawahFooter = footerChildren.length ? new Footer({ children: footerChildren }) : undefined;

  const children: (Paragraph | Table)[] = [];

  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorders,
    rows: [
      new TableRow({ children: [
        new TableCell({ width: { size: 12, type: WidthType.PERCENTAGE }, borders: noBorders, children: [new Paragraph("Nomor")] }),
        new TableCell({ width: { size: 3, type: WidthType.PERCENTAGE }, borders: noBorders, children: [new Paragraph(":")] }),
        new TableCell({ borders: noBorders, children: [new Paragraph({ children: [new TextRun({ text: data.nomor, bold: true })] })] }),
      ] }),
      new TableRow({ children: [
        new TableCell({ borders: noBorders, children: [new Paragraph("Perihal")] }),
        new TableCell({ borders: noBorders, children: [new Paragraph(":")] }),
        new TableCell({ borders: noBorders, children: [new Paragraph({ children: [new TextRun({ text: data.perihal, bold: true })] })] }),
      ] }),
    ],
  }));

  children.push(new Paragraph({ text: "", spacing: { after: 200 } }));
  children.push(new Paragraph({ children: [new TextRun("Kepada Yth.")] }));
  children.push(new Paragraph({ children: [new TextRun({ text: data.pihak, bold: true })], spacing: { after: 300 } }));

  children.push(...bodyParagraphs);

  // Blok tanda tangan: tabel 1 kolom diposisikan di sisi KANAN halaman (alignment tabel), tapi
  // teks DI DALAM sel rata KIRI (bukan center) — sesuai permintaan. Nama penandatangan tanpa
  // tanda kurung lagi.
  const signatureCellChildren: Paragraph[] = [
    new Paragraph({ children: [new TextRun(`Singojuruh, ${fmtLongId(data.tanggal)}`)] }),
    new Paragraph({ children: [new TextRun(data.penandaTangan)], spacing: { after: signature ? 100 : 800 } }),
  ];
  if (signature) signatureCellChildren.push(new Paragraph({ children: [signature], spacing: { after: 100 } }));
  signatureCellChildren.push(new Paragraph({
    children: [new TextRun({ text: data.principalName || " ", bold: true, underline: {} })],
  }));

  children.push(new Paragraph({ text: "", spacing: { before: 400 } }));
  children.push(new Table({
    alignment: AlignmentType.RIGHT,
    // AUTO + AUTOFIT = lebar kolom mengikuti baris terpanjang (nama kepsek), bukan persentase
    // tetap — supaya nama panjang (mis. dengan banyak gelar) tidak kepotong jadi 2 baris.
    width: { size: 100, type: WidthType.AUTO },
    layout: TableLayoutType.AUTOFIT,
    borders: noBorders,
    rows: [new TableRow({ children: [new TableCell({ width: { size: 100, type: WidthType.AUTO }, borders: noBorders, children: signatureCellChildren })] })],
  }));

  const doc = new Document({
    // Samakan dengan font dokumen cetak resmi lain (Buku Induk, Rapor, dll) — lihat `.print-doc`
    // di globals.css. Tanpa ini docx pakai default Times New Roman bawaan library.
    // spacing.line:360 + lineRule default "auto" = 360/240 = spasi antar baris 1,5 (satuan Word:
    // 240 twips = single line) — berlaku ke semua paragraf yang tidak override spacing sendiri.
    styles: { default: { document: { run: { font: "Arial Narrow", size: 22 }, paragraph: { spacing: { line: 360 } } } } },
    sections: [{
      properties: {
        titlePage: true, // wajib true supaya header/footer "first" di bawah benar-benar dipakai
        // header/footer:0 = jarak dari tepi kertas ke mulai kop DIHAPUS, supaya kop atas/bawah
        // benar-benar mentok ke tepi kertas (edge-to-edge total, horizontal DAN vertikal) —
        // meniru `.a4-page` versi HTML yang kopnya full-bleed tanpa margin sama sekali.
        page: { margin: { left: SIDE_MARGIN_TWIPS, right: SIDE_MARGIN_TWIPS, header: 0, footer: 0 } },
      },
      headers: kopAtasHeader ? { first: kopAtasHeader } : undefined,
      // footers.first WAJIB diisi (sama dengan default) — kalau tidak, titlePage:true bikin
      // halaman pertama tidak dapat footer sama sekali (dianggap "footer first" kosong).
      footers: kopBawahFooter ? { default: kopBawahFooter, first: kopBawahFooter } : undefined,
      children,
    }],
  });
  return Packer.toBuffer(doc);
}

// Pakai /api/uploads/... (bukan /uploads/... langsung) karena file di sini ditulis saat runtime —
// static serving bawaan Next.js cuma men-scan folder public/ sekali saat server start, jadi file
// baru tidak akan ketemu lewat situ sampai server di-restart (lihat komentar di
// src/app/api/uploads/[...path]/route.ts, pola yang sama dipakai upload gambar lain).
export async function saveDocxToUploads(subfolder: string, filename: string, buffer: Buffer): Promise<string> {
  const dir = join(process.cwd(), "public", "uploads", subfolder);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, filename), buffer);
  return `/api/uploads/${subfolder}/${filename}`;
}

export interface NotulenDocxData {
  tanggal: Date;
  waktu?: string | null;
  tempat?: string | null;
  pemimpin?: string | null;
  materi?: string | null;
  dibukaOleh?: string | null;
  sambutan: string[];
  peserta: string[];
  keputusan?: string | null;
  notulis?: string | null;
  principalName: string;
  kopAtasUrl?: string | null;
  kopBawahUrl?: string | null;
}

/**
 * Berkas .docx notulen rapat LENGKAP — kop atas/bawah, tabel keterangan rapat, daftar hadir,
 * hasil keputusan, dan blok tanda tangan notulis & Kepala Sekolah.
 *
 * Alurnya sama persis dengan Surat (permintaan user 30 September 2026: "notulen bisa edit kayak
 * surat juga"): isian terstruktur yang sudah ada dipakai untuk MENGISI dokumen awal, lalu notulis
 * melanjutkan di ONLYOFFICE. Jadi membuka Editor Word tidak pernah menampilkan halaman kosong —
 * data yang sudah diketik di formulir langsung terbawa.
 */
export async function createNotulenDocx(data: NotulenDocxData): Promise<Buffer> {
  const [kopAtas, kopBawah, patternBuffer] = await Promise.all([
    loadLetterheadImage(data.kopAtasUrl, PAGE_WIDTH_PX, true),
    loadLetterheadImage(data.kopBawahUrl, PAGE_WIDTH_PX, true),
    createTiledPatternImage(),
  ]);

  const edgeToEdge = { left: -SIDE_MARGIN_TWIPS, right: -SIDE_MARGIN_TWIPS };
  const kopAtasHeader = kopAtas
    ? new Header({ children: [new Paragraph({ indent: edgeToEdge, children: [kopAtas] })] })
    : undefined;

  const footerChildren: Paragraph[] = [];
  if (patternBuffer) {
    footerChildren.push(new Paragraph({ children: [new ImageRun({
      type: "png", data: patternBuffer,
      transformation: { width: PAGE_WIDTH_PX, height: PAGE_HEIGHT_PX },
      floating: {
        horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: 0 },
        verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: 0 },
        behindDocument: true,
        wrap: { type: TextWrappingType.NONE },
      },
    })] }));
  }
  if (kopBawah) footerChildren.push(new Paragraph({ indent: edgeToEdge, children: [kopBawah] }));
  const kopBawahFooter = footerChildren.length ? new Footer({ children: footerChildren }) : undefined;

  const tgl = data.tanggal.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
  const kosong = new Paragraph({ children: [new TextRun("")] });
  const baris = (label: string, isi: string) => new TableRow({
    children: [
      new TableCell({ width: { size: 28, type: WidthType.PERCENTAGE }, borders: noBorders, children: [new Paragraph({ children: [new TextRun({ text: label })] })] }),
      new TableCell({ width: { size: 4, type: WidthType.PERCENTAGE }, borders: noBorders, children: [new Paragraph({ children: [new TextRun({ text: ":" })] })] }),
      new TableCell({ width: { size: 68, type: WidthType.PERCENTAGE }, borders: noBorders, children: [new Paragraph({ children: [new TextRun({ text: isi || "—" })] })] }),
    ],
  });

  const children: (Paragraph | Table)[] = [
    new Paragraph({ alignment: AlignmentType.CENTER, heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "NOTULEN RAPAT", bold: true })] }),
    kosong,
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      rows: [
        baris("Hari / Tanggal", tgl),
        baris("Waktu", data.waktu ?? ""),
        baris("Tempat", data.tempat ?? ""),
        baris("Pemimpin Rapat", data.pemimpin ?? ""),
        baris("Materi Rapat", data.materi ?? ""),
        baris("Dibuka oleh", data.dibukaOleh ?? ""),
        baris("Sambutan dari", data.sambutan.join(", ")),
      ],
    }),
    kosong,
    new Paragraph({ children: [new TextRun({ text: "A. Daftar Hadir", bold: true })] }),
  ];

  if (data.peserta.length === 0) {
    children.push(new Paragraph({ children: [new TextRun("—")] }));
  } else {
    data.peserta.forEach((n, i) => children.push(new Paragraph({ children: [new TextRun(`${i + 1}. ${n}`)] })));
  }

  children.push(kosong, new Paragraph({ children: [new TextRun({ text: "B. Hasil Keputusan Rapat", bold: true })] }));
  const keputusan = (data.keputusan ?? "").trim();
  if (keputusan) {
    for (const b of keputusan.split(/\r?\n/)) children.push(new Paragraph({ children: [new TextRun(b)] }));
  } else {
    children.push(kosong, kosong, kosong);   // ruang kosong untuk diketik notulis
  }

  // Blok tanda tangan: notulis di kiri, Kepala Sekolah di kanan.
  children.push(kosong, kosong, new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [new TableRow({ children: [
      new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, borders: noBorders, children: [
        new Paragraph({ children: [new TextRun("Notulis,")] }), kosong, kosong, kosong,
        new Paragraph({ children: [new TextRun({ text: data.notulis || "…", bold: true, underline: {} })] }),
      ] }),
      new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, borders: noBorders, children: [
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun("Mengetahui,")] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun("Kepala Sekolah")] }), kosong, kosong,
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.principalName || "…", bold: true, underline: {} })] }),
      ] }),
    ] })],
  }));

  const doc = new Document({
    styles: { default: { document: { run: { font: "Arial Narrow", size: 22 }, paragraph: { spacing: { line: 360 } } } } },
    sections: [{
      properties: {
        titlePage: true,
        page: { margin: { left: SIDE_MARGIN_TWIPS, right: SIDE_MARGIN_TWIPS, header: 0, footer: 0 } },
      },
      headers: kopAtasHeader ? { first: kopAtasHeader } : undefined,
      footers: kopBawahFooter ? { default: kopBawahFooter, first: kopBawahFooter } : undefined,
      children,
    }],
  });
  return Packer.toBuffer(doc);
}
