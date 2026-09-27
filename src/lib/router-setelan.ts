import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

/** SETELAN SAMBUNGAN ROUTER — BISA DIISI DARI HALAMAN (27 September 2026).
 *
 * Permintaan user: "untuk router nya kita bisa memasukkan ip address dari router dan port maupun user
 * password secara manual saja, siapa tau kedepannya kita lakukan perubahan". Sebelumnya keempatnya hanya
 * ada di `.env`, sehingga mengganti router atau memutar sandinya berarti menyunting berkas di server lalu
 * membangun ulang image — dua hal yang tidak bisa dikerjakan petugas jaringan sendiri.
 *
 * Polanya PERSIS `dapodik.kunci` (src/lib/dapodik.ts): nilai biasa disimpan apa adanya di SiteSetting,
 * sandinya disimpan TERENKRIPSI AES-256-GCM dengan kunci turunan `SESSION_SECRET`, dan `.env` tetap
 * menjadi cadangan bila setelan di basis data kosong. Sandi TIDAK PERNAH dikembalikan ke browser — API
 * hanya memberi tahu apakah sandi sudah tersimpan atau belum. */

export const KUNCI_HOST = "jaringan.routerHost";
export const KUNCI_PORT = "jaringan.routerPort";
export const KUNCI_USER = "jaringan.routerUser";
export const KUNCI_SANDI = "jaringan.routerSandi";
const SEMUA = [KUNCI_HOST, KUNCI_PORT, KUNCI_USER, KUNCI_SANDI];

/** Port API RouterOS bawaan pustaka. Router sekolah memakai 8740 (disetel di `.env`), bukan 8728. */
export const PORT_ROUTER_BAWAAN = 8728;

const kunciSandi = () => createHash("sha256").update(`router-sandi|${process.env.SESSION_SECRET ?? ""}`).digest();

export function enkripsiSandiRouter(teks: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", kunciSandi(), iv);
  const isi = Buffer.concat([c.update(teks, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), isi.toString("base64")].join(":");
}

function dekripsiSandiRouter(simpanan: string): string | null {
  try {
    const [versi, iv, tag, isi] = simpanan.split(":");
    if (versi !== "v1" || !iv || !tag || !isi) return null;
    const d = createDecipheriv("aes-256-gcm", kunciSandi(), Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(isi, "base64")), d.final()]).toString("utf8");
  } catch { return null; }
}

export interface SetelanRouter {
  host: string;
  port: number;
  user: string;
  /** Sandi HANYA untuk dipakai membuka sambungan. Jangan pernah dikirim ke klien atau dicatat. */
  sandi: string;
  /** Apakah nilainya berasal dari halaman (basis data), bukan `.env`. */
  manual: { host: boolean; port: boolean; user: boolean; sandi: boolean };
  /** Sandi tersimpan tetapi tidak bisa dibuka — biasanya `SESSION_SECRET` berganti. */
  sandiRusak: boolean;
}

/* Singgahan pendek: `withMikrotik` dipanggil beberapa kali per permintaan halaman (bacaRouter saja dua
 * kali), dan setelan ini hampir tidak pernah berubah. Dibuang paksa oleh `lupakanSetelanRouter()`
 * begitu petugas menyimpan setelan baru, jadi perubahan langsung terasa tanpa menunggu singgahan habis. */
let singgahan: { nilai: SetelanRouter; sampai: number } | null = null;
export function lupakanSetelanRouter() { singgahan = null; }

export async function setelanRouter(): Promise<SetelanRouter> {
  if (singgahan && singgahan.sampai > Date.now()) return singgahan.nilai;

  const baris = await prisma.siteSetting
    .findMany({ where: { key: { in: SEMUA } }, select: { key: true, value: true } })
    .catch(() => [] as { key: string; value: string }[]);
  const nilai = (k: string) => baris.find(b => b.key === k)?.value.trim() ?? "";

  const hostDb = nilai(KUNCI_HOST);
  const portDb = nilai(KUNCI_PORT);
  const userDb = nilai(KUNCI_USER);
  const sandiDb = nilai(KUNCI_SANDI);
  const sandiBuka = sandiDb ? dekripsiSandiRouter(sandiDb) : null;

  const hasil: SetelanRouter = {
    host: hostDb || (process.env.MIKROTIK_HOST ?? ""),
    port: Number(portDb) || Number(process.env.MIKROTIK_PORT) || PORT_ROUTER_BAWAAN,
    user: userDb || (process.env.MIKROTIK_USER ?? ""),
    sandi: sandiBuka || (process.env.MIKROTIK_PASSWORD ?? ""),
    manual: { host: !!hostDb, port: !!portDb, user: !!userDb, sandi: !!sandiBuka },
    sandiRusak: !!sandiDb && !sandiBuka,
  };
  singgahan = { nilai: hasil, sampai: Date.now() + 30_000 };
  return hasil;
}

/** Yang boleh dilihat halaman: sandinya diganti penanda ada/tidak. */
export async function setelanRouterTampil() {
  const s = await setelanRouter();
  return {
    host: s.host, port: s.port, user: s.user,
    adaSandi: !!s.sandi, sandiRusak: s.sandiRusak, manual: s.manual,
    /* Supaya petugas tahu nilai mana yang akan dipakai bila isian halaman dikosongkan. */
    bawaanEnv: {
      host: process.env.MIKROTIK_HOST ?? "", port: Number(process.env.MIKROTIK_PORT) || PORT_ROUTER_BAWAAN,
      user: process.env.MIKROTIK_USER ?? "", adaSandi: !!process.env.MIKROTIK_PASSWORD,
    },
  };
}

/** Alamat host wajib IPv4/nama host polos — bukan URL. Sandi ikut terkirim ke alamat ini. */
export function periksaHostRouter(host: string): string | null {
  const h = host.trim();
  if (!h) return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) {
    return h.split(".").every(o => Number(o) >= 0 && Number(o) <= 255) ? null : "Alamat IP tidak sah.";
  }
  if (/^[a-z0-9][a-z0-9.-]*$/i.test(h)) return null;
  return "Alamat router hanya berupa IP atau nama host (tanpa http://, tanpa jalur).";
}

export interface IsianSetelanRouter { host?: string; port?: string | number; user?: string; sandi?: string; hapusSandi?: boolean }

/** Menyimpan setelan. Isian kosong = HAPUS baris, artinya kembali memakai nilai `.env`. */
export async function simpanSetelanRouter(b: IsianSetelanRouter): Promise<{ galat?: string }> {
  if (b.host !== undefined) {
    const galat = periksaHostRouter(b.host);
    if (galat) return { galat };
  }
  if (b.port !== undefined && String(b.port).trim() !== "") {
    const p = Number(b.port);
    if (!Number.isInteger(p) || p < 1 || p > 65535) return { galat: "Port harus angka 1–65535." };
  }

  const tulis = async (key: string, isi: string) => {
    if (!isi) await prisma.siteSetting.deleteMany({ where: { key } });
    else await prisma.siteSetting.upsert({ where: { key }, update: { value: isi }, create: { key, value: isi } });
  };

  if (b.host !== undefined) await tulis(KUNCI_HOST, b.host.trim());
  if (b.port !== undefined) await tulis(KUNCI_PORT, String(b.port).trim());
  if (b.user !== undefined) await tulis(KUNCI_USER, b.user.trim());
  /* Kotak sandi yang DIBIARKAN KOSONG berarti "jangan diubah" — bukan "hapus". Menghapus sandi
   * harus diminta tegas lewat `hapusSandi`, kalau tidak sekali simpan setelan lain akan diam-diam
   * memutus sambungan router. */
  if (b.hapusSandi) await tulis(KUNCI_SANDI, "");
  else if (b.sandi) await tulis(KUNCI_SANDI, enkripsiSandiRouter(b.sandi));

  lupakanSetelanRouter();
  return {};
}
