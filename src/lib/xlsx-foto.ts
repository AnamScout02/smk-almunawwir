import * as XLSX from "xlsx";

/** Foto yang tertanam di dalam berkas Excel, sudah dipetakan ke baris tempatnya menempel. */
export interface FotoBaris { row: number; ext: string; data: Buffer }

type Wb = XLSX.WorkBook & { keys?: string[]; files?: Record<string, { content: unknown }> };

const isiBerkas = (wb: Wb, path: string): Buffer | null => {
  const f = wb.files?.[path];
  if (!f?.content) return null;
  return Buffer.from(f.content as ArrayLike<number>);
};

const teks = (wb: Wb, path: string): string | null => {
  const b = isiBerkas(wb, path);
  return b ? b.toString("utf8") : null;
};

/** Peta Id -> Target dari sebuah berkas .rels */
function bacaRels(xml: string | null): Map<string, string> {
  const m = new Map<string, string>();
  if (!xml) return m;
  for (const r of xml.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = /\bId="([^"]+)"/.exec(r[0])?.[1];
    const target = /\bTarget="([^"]+)"/.exec(r[0])?.[1];
    if (id && target) m.set(id, target);
  }
  return m;
}

/** Rapikan "../media/image7.jpeg" (relatif terhadap xl/drawings/) jadi "xl/media/image7.jpeg". */
function normalkanTarget(target: string, basis: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const bagian = basis.split("/").slice(0, -1);
  for (const p of target.split("/")) {
    if (p === "..") bagian.pop();
    else if (p !== ".") bagian.push(p);
  }
  return bagian.join("/");
}

/** Ambil semua foto yang tertanam di satu sheet, beserta NOMOR BARIS tempat foto itu menempel
 * (0-based, sama seperti indeks baris di Excel dikurangi 1).
 *
 * Kenapa serumit ini: foto di .xlsx TIDAK disimpan di dalam sel. Yang ada di sel hanyalah
 * kekosongan; fotonya "melayang" di atas lembar kerja dan posisinya dicatat terpisah di
 * xl/drawings/drawingN.xml sebagai jangkar (anchor) ke koordinat baris/kolom. Jadi untuk tahu
 * foto siapa, harus ditelusuri: sheet -> rels sheet -> drawing -> rels drawing -> berkas gambar.
 *
 * Catatan namespace (pernah salah & menghasilkan 0 foto): namespace drawing di spreadsheet adalah
 * ".../drawingml/2006/spreadsheetDrawing" dengan prefiks `xdr:`, BUKAN `spreadsheetml`.
 *
 * Berkas harus dibaca dengan `XLSX.read(buf, { type: "buffer", bookFiles: true })` — tanpa
 * `bookFiles` isi ZIP-nya tidak ikut terbawa dan fungsi ini selalu mengembalikan daftar kosong. */
export function ambilFotoSheet(wb: XLSX.WorkBook, namaSheet: string): FotoBaris[] {
  const w = wb as Wb;
  if (!w.files) return [];

  // 1. Cari berkas XML milik sheet ini lewat rels workbook (urutan SheetNames belum tentu = sheetN.xml).
  const wbRels = bacaRels(teks(w, "xl/_rels/workbook.xml.rels"));
  const wbXml = teks(w, "xl/workbook.xml") ?? "";
  let sheetPath: string | null = null;
  for (const t of wbXml.matchAll(/<sheet\b[^>]*>/g)) {
    const nama = /\bname="([^"]*)"/.exec(t[0])?.[1];
    const rid = /\br:id="([^"]+)"/.exec(t[0])?.[1];
    if (nama === namaSheet && rid) {
      const target = wbRels.get(rid);
      if (target) sheetPath = normalkanTarget(target, "xl/workbook.xml");
    }
  }
  if (!sheetPath) return [];

  // 2. Sheet -> drawing
  const relsPath = sheetPath.replace(/([^/]+)$/, "_rels/$1.rels");
  const sheetRels = bacaRels(teks(w, relsPath));
  const sheetXml = teks(w, sheetPath) ?? "";
  const drawingRid = /<drawing\b[^>]*\br:id="([^"]+)"/.exec(sheetXml)?.[1];
  if (!drawingRid) return [];
  const drawingPath = normalkanTarget(sheetRels.get(drawingRid) ?? "", sheetPath);
  const drawingXml = teks(w, drawingPath);
  if (!drawingXml) return [];

  // 3. Drawing -> gambar
  const drawingRels = bacaRels(teks(w, drawingPath.replace(/([^/]+)$/, "_rels/$1.rels")));
  const hasil: FotoBaris[] = [];
  // twoCellAnchor maupun oneCellAnchor sama-sama punya <xdr:from><xdr:row>.
  for (const anchor of drawingXml.matchAll(/<xdr:(?:two|one)CellAnchor[^>]*>[\s\S]*?<\/xdr:(?:two|one)CellAnchor>/g)) {
    const blok = anchor[0];
    const row = Number(/<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/.exec(blok)?.[1]);
    const embed = /<a:blip\b[^>]*r:embed="([^"]+)"/.exec(blok)?.[1];
    if (!Number.isFinite(row) || !embed) continue;
    const target = drawingRels.get(embed);
    if (!target) continue;
    const mediaPath = normalkanTarget(target, drawingPath);
    const data = isiBerkas(w, mediaPath);
    if (!data || data.length === 0) continue;
    hasil.push({ row, ext: (mediaPath.split(".").pop() ?? "png").toLowerCase(), data });
  }
  return hasil;
}
