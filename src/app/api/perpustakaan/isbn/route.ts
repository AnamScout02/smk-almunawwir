import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { assertPerpustakaan } from "@/lib/perpustakaan-guard";
import { rapikanIsbn } from "@/lib/isbn";

/** CARI BUKU DARI ISBN (10 Oktober 2026, pilihan user) — petugas memindai barcode belakang buku, judul/penulis/penerbit/
 *  sampul diambil dari katalog terbuka: Google Books lalu Open Library (keduanya tanpa kunci & tanpa biaya). Diambil SERVER
 *  supaya sampulnya bisa disalin ke penyimpanan sekolah (gambar dari alamat luar tidak dipakai langsung). Hasilnya hanya
 *  MENGISI formulir — petugas tetap memeriksa lalu menekan Simpan. Buku lokal sering tidak ada di katalog: dijawab
 *  `ditemukan: false`, bukan galat. */
type Hasil = { title: string; author: string; publisher: string; tahun: string; sampul: string; sumber: string };
const ambil = async (url: string) => { try { const r = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { "User-Agent": "MyAlwis-Perpustakaan/1.0" } }); return r.ok ? await r.json() : null; } catch { return null; } };

/* Google Books tanpa kunci memakai jatah harian BERSAMA yang sering habis (terukur 10 Okt 2026: 429) — saat itu pencarian
 * diteruskan ke Open Library. Sekolah bisa menaruh kunci API gratisnya sendiri di SiteSetting `perpustakaan.kunciGoogleBooks`. */
async function dariGoogle(isbn: string, kunci: string): Promise<Hasil | null> {
  const d = await ambil(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&maxResults=1${kunci ? `&key=${encodeURIComponent(kunci)}` : ""}`) as { items?: { volumeInfo?: { title?: string; subtitle?: string; authors?: string[]; publisher?: string; publishedDate?: string; imageLinks?: { thumbnail?: string } } }[] } | null;
  const v = d?.items?.[0]?.volumeInfo;
  if (!v?.title) return null;
  return { title: [v.title, v.subtitle].filter(Boolean).join(": "), author: (v.authors ?? []).join(", "), publisher: v.publisher ?? "", tahun: (v.publishedDate ?? "").slice(0, 4),
    sampul: (v.imageLinks?.thumbnail ?? "").replace(/^http:/, "https:").replace("&edge=curl", ""), sumber: "Google Books" };
}
async function dariOpenLibrary(isbn: string): Promise<Hasil | null> {
  const d = await ambil(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`) as Record<string, { title?: string; authors?: { name: string }[]; publishers?: { name: string }[]; publish_date?: string; cover?: { large?: string; medium?: string } }> | null;
  const v = d?.[`ISBN:${isbn}`];
  if (!v?.title) return null;
  return { title: v.title, author: (v.authors ?? []).map(a => a.name).join(", "), publisher: (v.publishers ?? []).map(p => p.name).join(", "), tahun: /\d{4}/.exec(v.publish_date ?? "")?.[0] ?? "",
    sampul: v.cover?.large ?? v.cover?.medium ?? "", sumber: "Open Library" };
}

/** Sampul disalin ke folder perpustakaan (hanya JPEG/PNG, ≤1,5 MB, dari dua penyedia di atas). Gagal = tanpa sampul. */
async function salinSampul(url: string, isbn: string): Promise<string> {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || !/(^|\.)(google\.com|googleusercontent\.com|googleapis\.com|openlibrary\.org|archive\.org)$/.test(u.hostname)) return "";
    const r = await fetch(u, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return "";
    const b = Buffer.from(await r.arrayBuffer());
    const jpg = b[0] === 0xff && b[1] === 0xd8, png = b[0] === 0x89 && b[1] === 0x50;
    if ((!jpg && !png) || b.length < 1500 || b.length > 1_500_000) return "";
    const dir = join(process.cwd(), "public", "uploads", "perpustakaan"), nama = `isbn-${isbn}-${Date.now().toString(36)}.${jpg ? "jpg" : "png"}`;
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, nama), b);
    return `/api/uploads/perpustakaan/${nama}`;
  } catch { return ""; }
}

const KUNCI_GB = "perpustakaan.kunciGoogleBooks";
const kunciGoogle = async () => (await prisma.siteSetting.findUnique({ where: { key: KUNCI_GB }, select: { value: true } }).catch(() => null))?.value.trim() ?? "";
async function petugas() {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  try { await assertPerpustakaan(session); return session; } catch { return null; }
}

/** Cari dari JUDUL (10 Okt 2026: buku paket Indonesia sering tidak ketemu lewat ISBN di Open Library, dan petugas kadang
 *  mengetik judulnya). Mengembalikan beberapa pilihan; sampul baru disalin saat satu pilihan ber-ISBN dipilih. */
type Pilihan = { title: string; author: string; publisher: string; isbn: string };
async function cariJudul(q: string, kunci: string): Promise<Pilihan[]> {
  const hasil: Pilihan[] = [];
  const g = await ambil(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(`intitle:${q}`)}&maxResults=6&langRestrict=id${kunci ? `&key=${encodeURIComponent(kunci)}` : ""}`) as { items?: { volumeInfo?: { title?: string; subtitle?: string; authors?: string[]; publisher?: string; publishedDate?: string; industryIdentifiers?: { type: string; identifier: string }[] } }[] } | null;
  for (const it of g?.items ?? []) {
    const v = it.volumeInfo; if (!v?.title) continue;
    const ids = v.industryIdentifiers ?? [];
    hasil.push({ title: [v.title, v.subtitle].filter(Boolean).join(": ").slice(0, 200), author: (v.authors ?? []).join(", ").slice(0, 150), publisher: [v.publisher, (v.publishedDate ?? "").slice(0, 4)].filter(Boolean).join(", ").slice(0, 150),
      isbn: rapikanIsbn(ids.find(x => x.type === "ISBN_13")?.identifier ?? ids.find(x => x.type === "ISBN_10")?.identifier ?? "") ?? "" });
  }
  if (hasil.length < 3) {
    const o = await ambil(`https://openlibrary.org/search.json?title=${encodeURIComponent(q)}&limit=6&fields=title,author_name,publisher,first_publish_year,isbn`) as { docs?: { title?: string; author_name?: string[]; publisher?: string[]; first_publish_year?: number; isbn?: string[] }[] } | null;
    for (const v of o?.docs ?? []) {
      if (!v.title) continue;
      hasil.push({ title: v.title.slice(0, 200), author: (v.author_name ?? []).slice(0, 3).join(", ").slice(0, 150), publisher: [(v.publisher ?? [])[0], v.first_publish_year].filter(Boolean).join(", ").slice(0, 150),
        isbn: (v.isbn ?? []).map(x => rapikanIsbn(x)).find(x => x && x.length === 13) ?? "" });
    }
  }
  return hasil.slice(0, 8);
}

/** Pasang / hapus kunci API Google Books sekolah (gratis, ±1.000 pencarian per hari). Kunci diuji dulu; tidak dikembalikan ke browser. */
export async function PUT(req: Request) {
  const session = await petugas();
  if (!session) return NextResponse.json({ error: "Khusus petugas perpustakaan." }, { status: 403 });
  const kunci = String((await req.json().catch(() => ({})))?.kunci ?? "").trim();
  if (!kunci) { await prisma.siteSetting.deleteMany({ where: { key: KUNCI_GB } }); return NextResponse.json({ ok: true, adaKunci: false }); }
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(kunci)) return NextResponse.json({ error: "Bentuk kunci tidak dikenali (biasanya berawalan AIza…)." }, { status: 400 });
  const uji = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:9780140328721&maxResults=1&key=${encodeURIComponent(kunci)}`, { signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!uji?.ok) return NextResponse.json({ error: `Kunci ditolak Google (${uji?.status ?? "tidak terhubung"}). Pastikan "Books API" sudah diaktifkan untuk kunci itu.` }, { status: 400 });
  await prisma.siteSetting.upsert({ where: { key: KUNCI_GB }, create: { key: KUNCI_GB, value: kunci }, update: { value: kunci } });
  return NextResponse.json({ ok: true, adaKunci: true });
}

export async function GET(req: Request) {
  if (!(await petugas())) return NextResponse.json({ error: "Khusus petugas perpustakaan." }, { status: 403 });
  const u = new URL(req.url), kunci = await kunciGoogle(), adaKunci = !!kunci;
  const mentah = (u.searchParams.get("isbn") ?? u.searchParams.get("q") ?? "").trim();
  if (!mentah) return NextResponse.json({ adaKunci });   // formulir menanyakan keadaan kunci saat dibuka
  const isbn = rapikanIsbn(mentah);
  if (!isbn) {
    // Bukan ISBN → diperlakukan sebagai JUDUL (minimal 4 huruf).
    if (mentah.replace(/[^a-zA-Z]/g, "").length < 4) return NextResponse.json({ error: "Tulis nomor ISBN (10 atau 13 angka di barcode belakang buku) atau judul bukunya." }, { status: 400 });
    return NextResponse.json({ ditemukan: false, adaKunci, pilihan: await cariJudul(mentah.slice(0, 120), kunci) });
  }
  const h = (await dariGoogle(isbn, kunci)) ?? (await dariOpenLibrary(isbn));
  if (!h) return NextResponse.json({ ditemukan: false, isbn, adaKunci });
  const coverUrl = h.sampul ? await salinSampul(h.sampul, isbn) : "";
  return NextResponse.json({ ditemukan: true, isbn, adaKunci, title: h.title.slice(0, 200), author: h.author.slice(0, 150), publisher: [h.publisher, h.tahun].filter(Boolean).join(", ").slice(0, 150), coverUrl, sumber: h.sumber });
}
