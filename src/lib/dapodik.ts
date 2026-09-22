import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

/** WEB SERVICE DAPODIK — akses BACA-SAJA ke aplikasi Dapodik sekolah (VM 102). NPSN dan kunci dibaca dari variabel
 * lingkungan (`DAPODIK_NPSN`, `DAPODIK_KEY`, diteruskan docker-compose). Kunci hanya dipakai di header Authorization —
 * JANGAN pernah memasukkannya ke pesan, log, atau respons API.
 *
 * ALAMAT DAPODIK & IP SERVER SITUS bisa diubah Administrator dari halaman Sinkron Dapodik (permintaan user 16 Sep 2026 —
 * mis. VM Dapodik dibuat ulang dengan IP baru). Isian manual disimpan di SiteSetting `dapodik.alamat` / `dapodik.ipServer`;
 * kosong = bawaan (`DAPODIK_URL` di .env, IP 172.15.0.3). Karena kunci ikut terkirim ke alamat itu, alamat WAJIB berupa IPv4
 * jaringan lokal (lihat `periksaAlamatDapodik`) — bukan nama domain atau IP internet.
 *
 * KUNCI WEB SERVICE juga bisa diganti Administrator dari halaman (permintaan user 17 Sep 2026). Disimpan TERENKRIPSI
 * (AES-256-GCM, kunci turunan SESSION_SECRET) di SiteSetting `dapodik.kunci`; kosong = `DAPODIK_KEY` di .env. Nilainya tidak
 * pernah dikirim balik ke browser — `konfigurasiDapodik()` hanya memberi status, kunci dibaca `ambilKunciDapodik()` di server. */

export interface HasilDapodik<T = unknown> { ok: boolean; http: number; pesan: string; data: T | null }

export const KUNCI_ALAMAT_DAPODIK = "dapodik.alamat";
export const KUNCI_IP_SERVER_DAPODIK = "dapodik.ipServer";
export const KUNCI_TOKEN_DAPODIK = "dapodik.kunci";
/** IP yang dilihat Dapodik saat server situs menghubunginya (diperiksa 14 Sep 2026: `ip route get 172.15.0.4` → src 172.15.0.3). */
export const IP_SERVER_BAWAAN = "172.15.0.3";
// Port bawaan & pemecah alamat ada di modul netral supaya halaman (klien) ikut memakainya.
import { PORT_DAPODIK, pecahAlamatDapodik } from "@/lib/dapodik-alamat";
export { PORT_DAPODIK, pecahAlamatDapodik };

const bersihkanUrl = (u: string) => u.trim().replace(/\/+$/, "");

const kunciSandi = () => createHash("sha256").update(`dapodik-kunci|${process.env.SESSION_SECRET ?? ""}`).digest();

export function enkripsiKunciDapodik(teks: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", kunciSandi(), iv);
  const isi = Buffer.concat([c.update(teks, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), isi.toString("base64")].join(":");
}

function dekripsiKunciDapodik(simpanan: string): string | null {
  try {
    const [versi, iv, tag, isi] = simpanan.split(":");
    if (versi !== "v1" || !iv || !tag || !isi) return null;
    const d = createDecipheriv("aes-256-gcm", kunciSandi(), Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(isi, "base64")), d.final()]).toString("utf8");
  } catch { return null; }
}

async function bacaPengaturan() {
  return prisma.siteSetting
    .findMany({ where: { key: { in: [KUNCI_ALAMAT_DAPODIK, KUNCI_IP_SERVER_DAPODIK, KUNCI_TOKEN_DAPODIK] } }, select: { key: true, value: true } })
    .catch(() => [] as { key: string; value: string }[]);
}

/** Kunci yang dipakai memanggil Dapodik — HANYA untuk header Authorization, jangan dikirim ke mana pun. */
async function ambilKunciDapodik(baris?: { key: string; value: string }[]) {
  const simpanan = (baris ?? await bacaPengaturan()).find(b => b.key === KUNCI_TOKEN_DAPODIK)?.value.trim() ?? "";
  const manual = simpanan ? dekripsiKunciDapodik(simpanan) : null;
  return { kunci: manual || process.env.DAPODIK_KEY || "", manual: !!manual, rusak: !!simpanan && !manual };
}

export async function konfigurasiDapodik() {
  const baris = await bacaPengaturan();
  const token = await ambilKunciDapodik(baris);
  const nilai = (k: string) => baris.find(b => b.key === k)?.value.trim() ?? "";
  const urlBawaan = bersihkanUrl(process.env.DAPODIK_URL ?? "");
  const alamatManual = bersihkanUrl(nilai(KUNCI_ALAMAT_DAPODIK));
  const ipManual = nilai(KUNCI_IP_SERVER_DAPODIK);
  const url = alamatManual || urlBawaan;
  const npsn = process.env.DAPODIK_NPSN ?? "";
  const adaKunci = !!token.kunci;
  return {
    url, urlBawaan, alamatManual: !!alamatManual,
    kunciManual: token.manual, kunciRusak: token.rusak, adaKunciBawaan: !!process.env.DAPODIK_KEY,
    ipServer: ipManual || IP_SERVER_BAWAAN, ipManual: !!ipManual,
    npsn, adaKunci, lengkap: !!(url && npsn && adaKunci),
  };
}

const polaIpv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
function oktet(ip: string): number[] | null {
  const m = polaIpv4.exec(ip);
  if (!m) return null;
  const o = m.slice(1).map(Number);
  return o.every(x => x <= 255) && m.slice(1).every(x => x === String(Number(x))) ? o : null;
}

/** Kunci Web Service dari Dapodik → Pengaturan → Web Service: 8–128 karakter tanpa spasi. */
export function periksaKunciDapodik(masukan: string): { ok: true; nilai: string } | { ok: false; pesan: string } {
  const t = masukan.trim();
  if (t.length < 8 || t.length > 128) return { ok: false, pesan: "Kunci Web Service harus 8–128 karakter." };
  if (!/^[\x21-\x7e]+$/.test(t)) return { ok: false, pesan: "Kunci Web Service tidak boleh memuat spasi atau huruf khusus." };
  return { ok: true, nilai: t };
}

/** IP server situs (hanya ditampilkan untuk operator Dapodik). Kosong = kembali ke bawaan. */
export function periksaIpServer(masukan: string): { ok: true; nilai: string } | { ok: false; pesan: string } {
  const t = masukan.trim();
  if (!t) return { ok: true, nilai: "" };
  const o = oktet(t);
  if (!o || o[0] === 0 || o[0] >= 224) return { ok: false, pesan: "IP server situs harus berupa alamat IPv4, mis. 172.15.0.3." };
  return { ok: true, nilai: t };
}

/** Alamat Web Service Dapodik. Menerima IP maupun nama domain, dengan atau tanpa skema & port:
 * `192.168.100.99`, `192.168.100.99:5774`, `http://dapodik.sekolah.sch.id:5774`, `localhost:5774`.
 * Tanpa port → memakai 5774 (port bawaan aplikasi Dapodik).
 *
 * BEBAS IP/DOMAIN sejak 20 September 2026 (permintaan user: "jadi IP-nya bisa berapa pun, bisa juga
 * domain, misal localhost"). Sebelumnya hanya IPv4 jaringan lokal — 10.x, 172.16–31.x, 192.168.x,
 * atau blok /16 yang sama dengan bawaan .env — sehingga alamat VM lama 172.15.0.4 ikut ditolak
 * begitu bawaan .env berganti ke 192.168.100.99 (172.15.x.x bukan rentang privat; dulu ia lolos
 * hanya lewat jalur "sama /16 dengan bawaan").
 *
 * Yang masih ditolak hanyalah yang membuat alamatnya bukan alamat: skema selain http/https,
 * nama pengguna/sandi, jalur, query, dan tanda pagar.
 *
 * `peringatan` terisi bila hostnya BUKAN jaringan lokal (IP privat / loopback / .local): kunci Web
 * Service ikut terkirim di header ke alamat ini, jadi salah ketik berarti kunci terkirim ke
 * komputer orang lain. Halaman WAJIB menampilkannya. */
export function periksaAlamatDapodik(masukan: string, ipServer?: string): { ok: true; nilai: string; peringatan?: string } | { ok: false; pesan: string } {
  const t = masukan.trim();
  if (!t) return { ok: true, nilai: "" };
  const galat = (pesan: string) => ({ ok: false as const, pesan });
  let u: URL;
  try { u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `http://${t}`); } catch { return galat("Alamat tidak bisa dibaca. Contoh yang benar: 192.168.100.99:5774"); }
  if (u.protocol !== "http:" && u.protocol !== "https:") return galat("Alamat harus memakai http:// atau https://.");
  if (u.username || u.password) return galat("Alamat tidak boleh memuat nama pengguna atau sandi.");
  if ((u.pathname && u.pathname !== "/") || u.search || u.hash) return galat("Isi alamat saja tanpa jalur — cukup IP/domain dan port.");
  if (!u.hostname) return galat("Isi IP atau nama domain komputer Dapodik.");
  // URL membuang port bawaan protokol (":80"), jadi port yang memang DITULIS dibedakan dari yang dikosongkan.
  const portTertulis = /^(?:[a-z][a-z0-9+.-]*:\/\/)?[^/?#]*:(\d+)(?:[/?#]|$)/i.test(t);
  const port = u.port || (portTertulis ? "" : PORT_DAPODIK);
  const nilai = `${u.protocol}//${u.hostname}${port ? `:${port}` : ""}`;
  if (hostLokal(u.hostname, ipServer)) return { ok: true, nilai };
  return {
    ok: true, nilai,
    peringatan: `${u.hostname} bukan alamat jaringan lokal. Kunci Web Service akan dikirim ke alamat ini — pastikan benar-benar komputer Dapodik sekolah.`,
  };
}

/** Host yang berada di jaringan sendiri — dipakai HANYA untuk memutuskan perlu-tidaknya peringatan.
 *
 * Selain rentang privat baku (RFC1918, loopback, link-local, `localhost`, `.local`), host yang
 * SATU BLOK /16 DENGAN SERVER SITUS juga dihitung lokal. Jaringan sekolah ini memakai 172.15.x.x
 * yang secara teknis BUKAN rentang privat (privat mulai 172.16), sehingga komputer Dapodik di
 * sebelah server sendiri selalu dikira alamat internet dan peringatannya muncul terus — temuan
 * user 20 September 2026. Membandingkannya dengan IP server jauh lebih tepat daripada menambah
 * 172.15 sebagai pengecualian hafalan. */
function hostLokal(host: string, ipServer?: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".localhost")) return true;
  const o = oktet(h);
  if (!o) return false;
  if (o[0] === 10 || o[0] === 127 || (o[0] === 172 && o[1] >= 16 && o[1] <= 31)
    || (o[0] === 192 && o[1] === 168) || (o[0] === 169 && o[1] === 254)) return true;
  const s = oktet((ipServer || IP_SERVER_BAWAAN).trim());
  return !!s && o[0] === s[0] && o[1] === s[1];
}

/** Port Web Service — kolom terpisah di halaman. Kosong = 5774. */
export function periksaPortDapodik(masukan: string): { ok: true; nilai: string } | { ok: false; pesan: string } {
  const t = masukan.trim();
  if (!t) return { ok: true, nilai: PORT_DAPODIK };
  if (!/^\d{1,5}$/.test(t)) return { ok: false, pesan: "Port harus berupa angka, mis. 5774." };
  const n = Number(t);
  if (n < 1 || n > 65535) return { ok: false, pesan: "Port harus antara 1 dan 65535." };
  return { ok: true, nilai: String(n) };
}

export async function panggilDapodik<T = unknown>(endpoint: string, params: Record<string, string> = {}, batasMs = 15_000): Promise<HasilDapodik<T>> {
  const k = await konfigurasiDapodik();
  if (!k.lengkap) return { ok: false, http: 0, pesan: "Pengaturan Dapodik (alamat, NPSN, kunci) belum lengkap di server.", data: null };
  const qs = new URLSearchParams({ npsn: k.npsn, ...params });
  try {
    const r = await fetch(`${k.url}/WebService/${endpoint}?${qs}`, {
      headers: { Authorization: `Bearer ${(await ambilKunciDapodik()).kunci}` },
      cache: "no-store",
      signal: AbortSignal.timeout(batasMs),
    });
    const teks = await r.text();
    let json: Record<string, unknown> | null = null;
    try { json = JSON.parse(teks) as Record<string, unknown>; } catch { /* Dapodik kadang menjawab teks polos, mis. "Access denied" */ }
    // Penolakan Dapodik (terlihat 17 Sep 2026) datang sebagai HTTP 200 yang ISINYA kepala "HTTP/1.0 403 Forbidden …" lalu JSON —
    // ambil JSON-nya supaya pesan aslinya ("IP Address yang didaftarkan … berbeda") yang tampil, bukan potongan kepala.
    if (json === null && /^\s*HTTP\/\d/.test(teks) && teks.includes("{")) {
      try { json = JSON.parse(teks.slice(teks.indexOf("{"))) as Record<string, unknown>; } catch { /* biarkan teks polos */ }
    }
    const sukses = r.ok && json !== null && json.success !== false;
    // Dapodik yang sedang galat membalas halaman HTML utuh — jangan tampilkan markup mentah ke pengguna.
    const halamanHtml = json === null && /^\s*</.test(teks);
    const bersih = (x: string) => x.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    let pesanServer = typeof json?.message === "string" ? bersih(json.message)
      : halamanHtml ? `Dapodik mengirim halaman galat, bukan data (HTTP ${r.status})`
        : bersih(teks).slice(0, 200);
    // Galat dari sisi aplikasi Dapodik sendiri (layanan databasenya belum aktif) — beri langkah untuk operator.
    if (halamanHtml || /tidak terhubung dengan database/i.test(pesanServer)) {
      pesanServer += ". Database aplikasi Dapodik di komputernya belum aktif: tutup lalu buka lagi aplikasi Dapodik dan login sampai halaman utamanya tampil (bila perlu mulai ulang komputer Dapodik), kemudian coba lagi.";
    }
    return {
      ok: sukses, http: r.status,
      pesan: sukses ? "Terhubung ke Web Service Dapodik." : pesanServer || `Dapodik menjawab HTTP ${r.status}.`,
      data: sukses ? (json as T) : null,
    };
  } catch (e) {
    return {
      ok: false, http: 0, data: null,
      pesan: (e as Error).name === "TimeoutError"
        ? `Web Service Dapodik tidak menjawab dalam ${Math.round(batasMs / 1000)} detik.`
        : `Tidak bisa menghubungi komputer Dapodik di ${k.url} — periksa VM Dapodik menyala, alamatnya benar, dan port Web Service terbuka.`,
    };
  }
}
