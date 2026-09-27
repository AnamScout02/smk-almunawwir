import "server-only";
import { createHash, createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

/** CCTV SEKOLAH (24 September 2026) — cuplikan gambar kamera masuk dashboard.
 *
 * Perangkatnya **Dahua** (dipastikan 24 Sep 2026: `/cgi-bin/magicBox.cgi` menjawab 401 Digest bergaya Dahua,
 * endpoint Hikvision 404; port 80, 554 RTSP, dan 37777 terbuka di 202.202.101.29). Dahua menyediakan foto
 * sesaat lewat HTTP: `/cgi-bin/snapshot.cgi?channel=N` dengan **HTTP Digest**, jadi tidak perlu aplikasi DVR,
 * tidak perlu pustaka video, dan tidak perlu membuka port apa pun ke internet.
 *
 * Yang SENGAJA tidak dilakukan: menyimpan/merekam gambar di server. Cuplikan diteruskan apa adanya ke layar
 * petugas dan tidak ditulis ke disk — rekaman tetap tinggal di DVR sekolah, dan setiap pengambilan tercatat
 * di Log Aktivitas. RTSP (video langsung) sengaja belum dipakai: butuh transcoding yang berat untuk server ini.
 *
 * Sandi DVR disimpan TERENKRIPSI di SiteSetting, pola yang sama dengan kunci Dapodik — tidak pernah dikirim
 * ke browser dan tidak ditulis ke kode. */

export const KUNCI = {
  host: "cctv.host",
  pengguna: "cctv.pengguna",
  sandi: "cctv.sandi",       // terenkripsi
  kanal: "cctv.kanal",       // jumlah kamera
  namaKanal: "cctv.namaKanal", // "1=Gerbang,2=Lobi,..."
} as const;

const kunciSandi = () => createHash("sha256").update(`cctv-sandi|${process.env.SESSION_SECRET ?? ""}`).digest();

export function enkripsiSandi(teks: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", kunciSandi(), iv);
  const isi = Buffer.concat([c.update(teks, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), isi.toString("base64")].join(":");
}

function dekripsiSandi(simpanan: string): string | null {
  try {
    const [versi, iv, tag, isi] = simpanan.split(":");
    if (versi !== "v1" || !iv || !tag || !isi) return null;
    const d = createDecipheriv("aes-256-gcm", kunciSandi(), Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(isi, "base64")), d.final()]).toString("utf8");
  } catch { return null; }
}

export interface PengaturanCctv {
  host: string; pengguna: string; adaSandi: boolean; kanal: number;
  namaKanal: Record<number, string>;
}

function uraiNama(teks: string): Record<number, string> {
  const peta: Record<number, string> = {};
  for (const bagian of teks.split(",")) {
    const [n, ...sisa] = bagian.split("=");
    const nomor = Number(n?.trim());
    const nama = sisa.join("=").trim();
    if (nomor > 0 && nama) peta[nomor] = nama;
  }
  return peta;
}

export async function pengaturanCctv(): Promise<PengaturanCctv & { sandi: string | null }> {
  const baris = await prisma.siteSetting
    .findMany({ where: { key: { in: Object.values(KUNCI) } }, select: { key: true, value: true } })
    .catch(() => [] as { key: string; value: string }[]);
  const ambil = (k: string) => baris.find(b => b.key === k)?.value ?? "";
  const simpanan = ambil(KUNCI.sandi);
  return {
    host: ambil(KUNCI.host).trim(),
    pengguna: ambil(KUNCI.pengguna).trim(),
    sandi: simpanan ? dekripsiSandi(simpanan) : null,
    adaSandi: !!simpanan,
    kanal: Math.max(0, Math.min(64, Number(ambil(KUNCI.kanal)) || 0)),
    namaKanal: uraiNama(ambil(KUNCI.namaKanal)),
  };
}

/* ------------------------------ HTTP Digest ------------------------------ */

const md5 = (s: string) => createHash("md5").update(s).digest("hex");

function jawabanDigest(tantangan: string, opsi: { pengguna: string; sandi: string; metode: string; uri: string }): string | null {
  const bagian: Record<string, string> = {};
  for (const m of tantangan.matchAll(/(\w+)=(?:"([^"]*)"|([^,\s]+))/g)) bagian[m[1].toLowerCase()] = m[2] ?? m[3] ?? "";
  const { realm, nonce, qop, opaque, algorithm } = bagian;
  if (!realm || !nonce) return null;
  const cnonce = randomBytes(8).toString("hex");
  const nc = "00000001";
  const ha1 = md5(`${opsi.pengguna}:${realm}:${opsi.sandi}`);
  const ha2 = md5(`${opsi.metode}:${opsi.uri}`);
  const respons = qop
    ? md5(`${ha1}:${nonce}:${nc}:${cnonce}:auth:${ha2}`)
    : md5(`${ha1}:${nonce}:${ha2}`);
  const p = [
    `username="${opsi.pengguna}"`, `realm="${realm}"`, `nonce="${nonce}"`, `uri="${opsi.uri}"`,
    `response="${respons}"`,
  ];
  if (algorithm) p.push(`algorithm=${algorithm}`);
  if (qop) p.push("qop=auth", `nc=${nc}`, `cnonce="${cnonce}"`);
  if (opaque) p.push(`opaque="${opaque}"`);
  return `Digest ${p.join(", ")}`;
}

/** Ambil satu foto kamera. Mengembalikan JPEG, atau pesan galat yang bisa ditampilkan apa adanya ke petugas. */
export async function cuplikanKamera(kanal: number): Promise<{ jpeg: Buffer } | { galat: string }> {
  const p = await pengaturanCctv();
  if (!p.host) return { galat: "Alamat DVR belum diatur." };
  if (!p.pengguna || !p.sandi) return { galat: "Nama pengguna/sandi DVR belum diatur." };

  const jalur = `/cgi-bin/snapshot.cgi?channel=${kanal}`;
  const url = `http://${p.host}${jalur}`;
  const pengendali = AbortSignal.timeout(8000);

  try {
    const pertama = await fetch(url, { signal: pengendali, cache: "no-store" });
    if (pertama.status !== 401) {
      if (!pertama.ok) return { galat: `DVR membalas ${pertama.status}.` };
      return { jpeg: Buffer.from(await pertama.arrayBuffer()) };
    }
    const tantangan = pertama.headers.get("www-authenticate") ?? "";
    const auth = jawabanDigest(tantangan, { pengguna: p.pengguna, sandi: p.sandi, metode: "GET", uri: jalur });
    if (!auth) return { galat: "DVR meminta cara masuk yang belum didukung." };

    const kedua = await fetch(url, { headers: { Authorization: auth }, signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (kedua.status === 401) return { galat: "Nama pengguna atau sandi DVR salah." };
    // 403 = sandi DITERIMA tapi akunnya tidak berwenang. Kasus nyata 24 Sep 2026: yang diisi akun aplikasi HP
    // (Dahua/DMSS, berupa alamat email), bukan akun lokal DVR. Bedanya penting — tanpa penjelasan ini petugas
    // akan mengira sandinya salah dan menggantinya berulang kali.
    if (kedua.status === 403) {
      return { galat: "Sandi diterima, tetapi akun ini tidak berwenang mengambil gambar. Pakai akun LOKAL DVR (biasanya \"admin\" dengan sandi perangkat), bukan akun aplikasi HP. Kalau tetap ditolak, beri izin \"Monitor\" pada akun itu di menu DVR → Sistem → Akun." };
    }
    if (!kedua.ok) return { galat: `DVR membalas ${kedua.status}.` };
    const jpeg = Buffer.from(await kedua.arrayBuffer());
    if (jpeg.length < 500) return { galat: "Kamera tidak mengirim gambar (kanal kosong atau kamera mati)." };
    return { jpeg };
  } catch (e) {
    return { galat: e instanceof Error && e.name === "TimeoutError" ? "DVR tidak menjawab." : "Gagal menghubungi DVR." };
  }
}
