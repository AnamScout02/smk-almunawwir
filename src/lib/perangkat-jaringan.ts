import "server-only";
import { prisma } from "@/lib/prisma";
import { type MikrotikRow } from "@/lib/mikrotik";
import { bacaRouter, cekJangkauan, detik, rapikanMac, PORT_INFRA, type DataRouter } from "@/lib/router-perangkat";
import { cekLibur } from "@/lib/hari-libur";
import { kirimNotifikasi } from "@/lib/push-server";
import { penerimaPengelola } from "@/lib/sarpras-akses";

/** PERANGKAT JARINGAN (24 September 2026) — access point, router jurusan, switch, printer, DVR.
 *
 * Alasan dibuat: di router sekolah ini ada 10 AP Ruijie dan beberapa router jurusan. Kalau salah satu mati,
 * yang terjadi sekarang adalah guru mengeluh "WiFi kelas hilang" lalu Sarpras mencari-cari. Dengan modul ini
 * Sarpras tahu lebih dulu, lengkap dengan riwayat: AP yang sering padam ketahuan dan bisa diganti.
 *
 * Caranya sama persis dengan Papan & TV — dicocokkan dari MikroTik lewat MAC, tanpa memasang apa pun di
 * perangkatnya. Yang berbeda hanya port yang diketuk untuk memastikan hidup (antarmuka web AP/router). */

export type JenisPerangkat = "AP" | "ROUTER" | "SWITCH" | "PRINTER" | "CCTV" | "SERVER" | "LAINNYA";

export const JENIS: { value: JenisPerangkat; label: string }[] = [
  { value: "AP", label: "Access Point (WiFi)" },
  { value: "ROUTER", label: "Router" },
  { value: "SWITCH", label: "Switch" },
  { value: "PRINTER", label: "Printer" },
  { value: "CCTV", label: "CCTV / DVR" },
  { value: "SERVER", label: "Server / NAS" },
  { value: "LAINNYA", label: "Lainnya" },
];

/** Tebakan jenis dari nama host & MAC — dipakai saat mengimpor perangkat yang terdeteksi router. */
export function tebakJenis(namaHost: string | null, mac: string): JenisPerangkat {
  const n = (namaHost ?? "").toUpperCase();
  if (/^RAP|^AP[-_]|ACCESS/.test(n)) return "AP";
  if (/ROUTER|RB\d|MIKROTIK/.test(n)) return "ROUTER";
  if (/SWITCH|SW-/.test(n)) return "SWITCH";
  if (/PRINT|EPSON|CANON|BROTHER|HP-/.test(n)) return "PRINTER";
  if (/DVR|NVR|CAM|HIK|DAHUA/.test(n)) return "CCTV";
  if (/NAS|SERVER/.test(n)) return "SERVER";
  // Ruijie (AP sekolah ini) memakai OUI 70:85:C4.
  if (rapikanMac(mac).startsWith("70:85:C4")) return "AP";
  return "LAINNYA";
}

export interface BarisPerangkat {
  id: string; nama: string; jenis: string; mac: string; lokasi: string | null; aktif: boolean;
  ip: string | null; hidup: boolean; terlihatDetikLalu: number | null;
  padamSejak: string | null; padamMenit: number | null; catatan: string | null;
}

export interface KandidatJaringan {
  mac: string; ip: string; namaHost: string | null; jenis: JenisPerangkat;
}

function petaDari(data: DataRouter | null) {
  const sewa = new Map<string, MikrotikRow>();
  for (const s of data?.sewa ?? []) if (s["mac-address"]) sewa.set(rapikanMac(s["mac-address"]), s);
  const arp = new Map<string, MikrotikRow>();
  for (const a of data?.arp ?? []) if (a["mac-address"]) arp.set(rapikanMac(a["mac-address"]), a);
  return { sewa, arp };
}

/** Daftar perangkat terdaftar + status hidup/mati sekarang, sekaligus memperbarui riwayat padamnya. */
export async function daftarPerangkat(perbaruiRiwayat = true): Promise<{ baris: BarisPerangkat[]; routerOk: boolean }> {
  const perangkat = await prisma.perangkatJaringan.findMany({ orderBy: [{ aktif: "desc" }, { jenis: "asc" }, { nama: "asc" }] });
  let data: DataRouter | null = null;
  try { data = await bacaRouter(); } catch { data = null; }
  const { sewa, arp } = petaDari(data);

  const alamat = new Map<string, string>();
  for (const p of perangkat) {
    const mac = rapikanMac(p.mac);
    const ip = sewa.get(mac)?.["active-address"] ?? sewa.get(mac)?.address ?? arp.get(mac)?.address ?? p.ipTerakhir ?? "";
    if (ip) alamat.set(p.id, ip);
  }
  const hasilKetuk = data ? await cekJangkauan([...new Set(alamat.values())], PORT_INFRA) : new Map<string, boolean>();

  const sekarang = new Date();
  const baris: BarisPerangkat[] = [];
  const perubahan: { id: string; terakhirTerlihat?: Date; padamSejak: Date | null; ipTerakhir?: string }[] = [];

  for (const p of perangkat) {
    const mac = rapikanMac(p.mac);
    const s = sewa.get(mac);
    const ip = alamat.get(p.id) ?? null;
    const terlihat = detik(s?.["last-seen"]);
    // Hidup bila: portnya menjawab, ATAU sewanya masih terikat dan baru terlihat (< 5 menit).
    const hidup = (ip ? hasilKetuk.get(ip) === true : false) || (s?.status === "bound" && terlihat !== null && terlihat < 300);
    const padamSejak = hidup ? null : (p.padamSejak ?? sekarang);

    if (perbaruiRiwayat && p.aktif && (hidup !== !p.padamSejak || (ip && ip !== p.ipTerakhir))) {
      perubahan.push({
        id: p.id,
        terakhirTerlihat: hidup ? sekarang : undefined,
        padamSejak: hidup ? null : padamSejak,
        ipTerakhir: ip ?? undefined,
      });
    }

    baris.push({
      id: p.id, nama: p.nama, jenis: p.jenis, mac, lokasi: p.lokasi, aktif: p.aktif,
      ip, hidup, terlihatDetikLalu: terlihat,
      padamSejak: hidup ? null : (p.padamSejak ?? sekarang).toISOString(),
      padamMenit: hidup ? null : Math.round((sekarang.getTime() - (p.padamSejak ?? sekarang).getTime()) / 60_000),
      catatan: p.catatan,
    });
  }

  if (perubahan.length) {
    await Promise.all(perubahan.map(u => prisma.perangkatJaringan.update({
      where: { id: u.id },
      data: { terakhirTerlihat: u.terakhirTerlihat, padamSejak: u.padamSejak, ipTerakhir: u.ipTerakhir },
    }).catch(() => null)));
  }
  return { baris, routerOk: data !== null };
}

/** Perangkat infrastruktur yang terlihat router tapi belum terdaftar. Disaring ke yang MASUK AKAL sebagai
 * perangkat tetap (bukan HP siswa): ada di jaringan manajemen, atau namanya berciri perangkat jaringan. */
export async function kandidatJaringan(): Promise<KandidatJaringan[]> {
  const [terdaftar, data] = await Promise.all([
    prisma.perangkatJaringan.findMany({ select: { mac: true } }),
    bacaRouter().catch(() => null),
  ]);
  if (!data) return [];
  const sudah = new Set(terdaftar.map(p => rapikanMac(p.mac)));
  return data.sewa
    .filter(s => s.status === "bound" && s["mac-address"] && !sudah.has(rapikanMac(s["mac-address"])))
    .map(s => ({
      mac: rapikanMac(s["mac-address"]),
      ip: s["active-address"] ?? s.address ?? "",
      namaHost: s["host-name"] || null,
      jenis: tebakJenis(s["host-name"] || null, s["mac-address"]),
    }))
    .filter(k => k.jenis !== "LAINNYA" || k.ip.startsWith("192.168.100."))
    .sort((a, b) => a.jenis.localeCompare(b.jenis) || a.ip.localeCompare(b.ip));
}

/** Penjadwal: beri tahu pengelola Sarpras tentang perangkat yang padam cukup lama, dan saat pulih.
 *
 * Kunci notifikasi memakai `padamSejak`, jadi satu kejadian padam hanya diberitahukan SEKALI walau penjadwal
 * berjalan tiap 5 menit (pola CLAUDE.md #31). Hari libur dilewati — AP memang sengaja dimatikan saat libur. */
export async function periksaPerangkatPadam(ambangMenit = 10): Promise<{ diberitahu: number }> {
  const wib = new Date(Date.now() + 7 * 3600_000);
  const hariIni = wib.toISOString().slice(0, 10);
  if (await cekLibur(hariIni).catch(() => null)) return { diberitahu: 0 };
  // Di luar jam sekolah perangkat boleh saja dimatikan; alarm hanya berguna saat KBM.
  const jam = wib.getUTCHours();
  if (jam < 6 || jam >= 17) return { diberitahu: 0 };

  const { baris } = await daftarPerangkat();
  const bermasalah = baris.filter(b => b.aktif && !b.hidup && (b.padamMenit ?? 0) >= ambangMenit);
  if (!bermasalah.length) return { diberitahu: 0 };

  const penerima = await penerimaPengelola("UMUM").catch(() => [] as string[]);
  if (!penerima.length) return { diberitahu: 0 };

  let diberitahu = 0;
  for (const b of bermasalah) {
    const hasil = await kirimNotifikasi({
      kunci: `perangkat-padam:${b.id}:${b.padamSejak}`,
      userIds: penerima,
      jenis: "SARPRAS",
      judul: `${b.jenis === "AP" ? "Access Point" : b.jenis} padam: ${b.nama}`,
      isi: `${b.lokasi ? `${b.lokasi} — ` : ""}tidak terlihat di jaringan sejak ${b.padamMenit} menit lalu.`,
      url: "/dashboard/admin/jaringan?bagian=perangkat",
    }).catch(() => ({ terkirim: false }));
    if (hasil.terkirim) diberitahu += 1;
  }
  return { diberitahu };
}
