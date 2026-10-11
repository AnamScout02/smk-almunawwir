import * as XLSX from "xlsx";
import mammoth from "mammoth";
import { verifyRole } from "@/lib/dal";
import { teacherIdDariSesi } from "@/lib/ujian-server";
import { uraiProta } from "@/lib/urai-prota";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

const entitas = (t: string) => t.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const teks = (html: string) => entitas(html.replace(/<br\s*\/?>/gi, " ").replace(/<\/(p|li|div)>/gi, " ").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();

/** Tabel HTML (hasil mammoth) → kisi sel, dengan colspan/rowspan DIBENTANGKAN supaya nomor kolom tiap baris sejajar —
 *  judul Promes hampir selalu dua tingkat (bulan di atas, minggu 1–5 di bawah) dengan sel yang digabung. */
function tabelDariHtml(html: string): string[][][] {
  const semua: string[][][] = [];
  for (const t of html.match(/<table[\s\S]*?<\/table>/gi) ?? []) {
    const kisi: string[][] = [];
    const sisa: Record<number, { n: number; v: string }> = {};
    for (const [r, tr] of (t.match(/<tr[\s\S]*?<\/tr>/gi) ?? []).entries()) {
      const baris: string[] = []; let k = 0;
      const isiSisa = () => { while (sisa[k]?.n > 0) { baris[k] = ""; sisa[k].n -= 1; k += 1; } };
      for (const sel of tr.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) ?? []) {
        isiSisa();
        const cs = Math.min(40, Number(/colspan="(\d+)"/i.exec(sel)?.[1] ?? 1)), rs = Math.min(60, Number(/rowspan="(\d+)"/i.exec(sel)?.[1] ?? 1));
        const v = teks(sel.replace(/^<t[dh][^>]*>/i, "").replace(/<\/t[dh]>$/i, ""));
        for (let i = 0; i < cs; i++) { baris[k] = i === 0 ? v : ""; if (rs > 1) sisa[k] = { n: rs - 1, v }; k += 1; }
      }
      isiSisa();
      kisi[r] = Array.from(baris, x => x ?? "");
    }
    if (kisi.length) semua.push(kisi);
  }
  return semua;
}

/** Baca berkas Prota/Promes guru (.xlsx/.xls/.docx) → butir untuk DITINJAU. Tidak menyimpan apa pun. */
export async function POST(req: Request) {
  try {
    const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
    if (!(await teacherIdDariSesi(session))) return Response.json({ error: "Data guru tidak ditemukan." }, { status: 403 });
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File) || !file.size) return Response.json({ error: "Pilih berkas Word (.docx) atau Excel (.xlsx) dulu." }, { status: 400 });
    if (file.size > 5 * 1024 * 1024) return Response.json({ error: "Berkas terlalu besar (maks 5 MB)." }, { status: 400 });
    const nama = file.name.toLowerCase(), buf = Buffer.from(await file.arrayBuffer());
    // Tanda tangan berkas: .docx/.xlsx adalah ZIP ("PK"), .xls lama diawali D0 CF 11 E0.
    const zip = buf[0] === 0x50 && buf[1] === 0x4b, ole = buf[0] === 0xd0 && buf[1] === 0xcf;
    let tabel: string[][][] = [], lepas: string[] = [];
    if (/\.docx$/.test(nama) && zip) {
      const { value } = await mammoth.convertToHtml({ buffer: buf });
      tabel = tabelDariHtml(value);
      lepas = (value.replace(/<table[\s\S]*?<\/table>/gi, " ").match(/<(p|li)[^>]*>[\s\S]*?<\/\1>/gi) ?? []).map((x, i) => {
        const t = teks(x);
        return /^<li/i.test(x) ? `${i + 1}. ${t}` : t; // butir daftar Word tidak membawa nomornya — diberi supaya dikenali
      });
    } else if (/\.xlsx?$/.test(nama) && (zip || ole)) {
      const wb = XLSX.read(buf, { type: "buffer" });
      tabel = wb.SheetNames.slice(0, 8).map(n => (XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: false, defval: "" }) as unknown[][]).slice(0, 600).map(b => b.slice(0, 80).map(String)));
    } else {
      return Response.json({ error: "Berkas harus Word (.docx) atau Excel (.xlsx/.xls). Berkas .doc lama: simpan ulang sebagai .docx." }, { status: 400 });
    }
    const hasil = uraiProta(tabel, lepas);
    if (!hasil.butir.length) return Response.json({ error: hasil.catatan[0] ?? "Tidak ada materi yang bisa dibaca dari berkas ini." }, { status: 422 });
    return Response.json(hasil);
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Berkas tidak bisa dibaca. Pastikan bukan berkas yang diberi sandi." }, { status: 400 });
  }
}
