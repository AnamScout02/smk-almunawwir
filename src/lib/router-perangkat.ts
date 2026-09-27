import "server-only";
import net from "node:net";
import { withMikrotik, type MikrotikRow } from "@/lib/mikrotik";

/** BAGIAN BERSAMA PEMBACAAN PERANGKAT DARI ROUTER (24 September 2026).
 *
 * Dipakai dua modul: **Papan & TV** (`layar-server.ts`) dan **Perangkat Jaringan** (`perangkat-jaringan.ts`).
 * Keduanya butuh hal yang sama — daftar sewa DHCP, tabel hotspot, dan cara memastikan sebuah perangkat
 * benar-benar hidup — jadi logikanya ditaruh di sini sekali saja. */

export interface DataRouter { sewa: MikrotikRow[]; hostHotspot: MikrotikRow[]; aktifHotspot: MikrotikRow[]; arp: MikrotikRow[] }

export const rapikanMac = (m: string) => m.trim().toUpperCase();

/** MAC acak Android: bit kedua dari oktet pertama menyala (x2/x6/xA/xE). MAC acak berubah sendiri setelah
 * perangkat menyambung ulang, sehingga sewa statis/binding yang memakainya berhenti berlaku diam-diam. */
export function mungkinMacAcak(mac: string): boolean {
  const oktet = parseInt(rapikanMac(mac).slice(0, 2), 16);
  return Number.isFinite(oktet) && (oktet & 0x02) !== 0;
}

/** Durasi gaya MikroTik ("4m12s", "1h3m", "18s") → detik. */
export function detik(t?: string): number | null {
  if (!t) return null;
  const m = t.match(/(?:(\d+)w)?(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
  if (!m) return null;
  const [, w, d, h, mi, s] = m.map(x => Number(x ?? 0));
  return ((w || 0) * 604800) + ((d || 0) * 86400) + ((h || 0) * 3600) + ((mi || 0) * 60) + (s || 0);
}

/** Satu kali ambil seluruh tabel yang dibutuhkan kedua modul. */
export async function bacaRouter(): Promise<DataRouter> {
  /* SATU KUERI RUSAK TIDAK BOLEH MENGGUGURKAN SEMUANYA (temuan 27 September 2026).
   *
   * `/ip/hotspot/active/print` di RouterOS 7.24.4 membalas sesuatu yang tidak bisa diurai `node-routeros`
   * ("UNKNOWNREPLY"). Galat itu muncul di tingkat SOKET, bukan sebagai penolakan janji, sehingga `.catch()`
   * per kueri TIDAK menolongnya: seluruh `withMikrotik` ikut gagal dan halaman Papan & TV melaporkan "Router
   * tidak bisa dihubungi" — padahal router sehat, login berhasil, dan tiga kueri lainnya menjawab normal
   * (lease 56 baris, hotspot host 29, arp 779). Gejalanya menipu total dan sempat mengarah ke firewall,
   * sesi penuh, dan variabel lingkungan.
   *
   * Karena itu kueri yang rapuh dijalankan di SAMBUNGAN SENDIRI: kalau ia roboh, yang hilang hanya daftar
   * "sudah login hotspot" (yang memang tidak menentukan — TV sekolah dilewatkan lewat IP binding, CLAUDE.md #79),
   * sementara status hidup/mati tetap terbaca. Kueri juga dijalankan BERURUTAN, bukan `Promise.all`, karena
   * satu soket API melayani satu percakapan pada satu waktu. */
  const inti = await withMikrotik(async conn => {
    const sewa = await conn.write("/ip/dhcp-server/lease/print");
    const hostHotspot = await conn.write("/ip/hotspot/host/print").catch(() => [] as MikrotikRow[]);
    const arp = await conn.write("/ip/arp/print").catch(() => [] as MikrotikRow[]);
    return { sewa, hostHotspot, arp };
  });

  const aktifHotspot = await withMikrotik(conn => conn.write("/ip/hotspot/active/print"))
    .catch(() => [] as MikrotikRow[]);

  return { ...inti, aktifHotspot };
}

/** Singgahan 60 detik hasil pemeriksaan jangkauan.
 *
 * Pemeriksaannya SENGAJA bukan ping: di jaringan hotspot, ping ke perangkat yang sudah tidak terdaftar
 * dijawab "packet rejected" oleh hotspot sendiri, jadi tidak bisa dibedakan dari perangkat mati. Yang dipakai
 * adalah mengetuk PORT yang lazim terbuka pada perangkat itu — kalau ada yang menjawab, perangkat pasti hidup. */
const singgahan = new Map<string, { hidup: boolean; sampai: number }>();

/** Port khas: 8008/8009 Chromecast (Google TV), 5555 ADB, 80/443 antarmuka web AP & router. */
export const PORT_TV = [8008, 8009, 5555];
export const PORT_INFRA = [80, 443, 22, 8080];

function ketukPort(ip: string, port: number, batasMs = 1200): Promise<boolean> {
  return new Promise(selesai => {
    const soket = new net.Socket();
    let sudah = false;
    const tutup = (hasil: boolean) => { if (sudah) return; sudah = true; soket.destroy(); selesai(hasil); };
    soket.setTimeout(batasMs);
    soket.once("connect", () => tutup(true));
    soket.once("timeout", () => tutup(false));
    soket.once("error", () => tutup(false));
    soket.connect(port, ip);
  });
}

export async function cekJangkauan(ips: string[], port = PORT_TV): Promise<Map<string, boolean>> {
  const hasil = new Map<string, boolean>();
  const perlu: string[] = [];
  for (const ip of ips) {
    const c = singgahan.get(`${ip}|${port[0]}`);
    if (c && c.sampai > Date.now()) hasil.set(ip, c.hidup);
    else perlu.push(ip);
  }
  await Promise.all(perlu.map(async ip => {
    let hidup = false;
    for (const p of port) { if (await ketukPort(ip, p)) { hidup = true; break; } }
    hasil.set(ip, hidup);
    singgahan.set(`${ip}|${port[0]}`, { hidup, sampai: Date.now() + 60_000 });
  }));
  return hasil;
}
