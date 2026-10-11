import "server-only";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { KODE, tebakKode } from "@/lib/kalender-matriks";

/** HARI LIBUR — satu sumber untuk semua fitur yang harus diam di hari libur: pengingat notifikasi, pita Tugas Hari Ini,
 * absen mandiri QR, badge "kelas belum absen". Tanggal (YYYY-MM-DD, WIB) dianggap libur bila:
 *   1. tercakup agenda Kalender Pendidikan yang bersifat LIBUR (jenis LIBUR / kode LHB, LU, LS1, LS2, CB, LHR);
 *   2. tanggal merah nasional (kalender libur Indonesia Google — hanya "Hari libur nasional", bukan "Perayaan"),
 *      selama sakelar `notifikasi.liburNasional` aktif;
 *   3. ditambahkan manual di Notifikasi Push → Hari Libur (libur mendadak di luar kalender);
 *   4. hari Minggu.
 * Tanggal merah nasional disalin ke SiteSetting `libur.nasional` dan diperbarui paling sering sekali seminggu oleh
 * penjadwal pengingat. Kalau sumbernya tidak bisa diakses, salinan terakhir tetap dipakai (permintaan user 15 Sep 2026:
 * "kenapa tidak ambil data hari libur saja, dan semua tanggal merah/minggu setiap tahunnya"). */

export const KUNCI_LIBUR = {
  manual: "notifikasi.tanggalLibur",
  nasionalAktif: "notifikasi.liburNasional",
  nasionalData: "libur.nasional",
} as const;

const SUMBER_NASIONAL = "https://calendar.google.com/calendar/ical/id.indonesian%23holiday%40group.v.calendar.google.com/public/basic.ics";
const HARI_MS = 86_400_000;
const SEMINGGU = 7 * HARI_MS;

export type SumberLibur = "KALENDER" | "NASIONAL" | "MANUAL" | "MINGGU";
export interface InfoLibur { tanggal: string; nama: string; sumber: SumberLibur }
interface DataNasional { diperbarui: string | null; tanggal: Record<string, string> }

const isoHari = (t: number) => new Date(t).toISOString().slice(0, 10);

function bacaNasional(teks?: string): DataNasional {
  try {
    const d = JSON.parse(teks || "{}") as Partial<DataNasional>;
    return {
      diperbarui: typeof d.diperbarui === "string" ? d.diperbarui : null,
      tanggal: d.tanggal && typeof d.tanggal === "object" ? d.tanggal : {},
    };
  } catch {
    return { diperbarui: null, tanggal: {} };
  }
}

/** Urai berkas ICS: hanya acara berdeskripsi "Hari libur nasional". Acara beberapa hari (DTEND eksklusif) dipecah per tanggal. */
export function uraiIcsLibur(ics: string): Record<string, string> {
  const hasil: Record<string, string> = {};
  const baris = ics.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  let mulai = "", selesai = "", nama = "", desk = "";
  const iso = (x: string) => `${x.slice(0, 4)}-${x.slice(4, 6)}-${x.slice(6, 8)}`;
  for (const b of baris) {
    if (b === "BEGIN:VEVENT") { mulai = ""; selesai = ""; nama = ""; desk = ""; continue; }
    if (b.startsWith("DTSTART")) mulai = b.split(":").pop() ?? "";
    else if (b.startsWith("DTEND")) selesai = b.split(":").pop() ?? "";
    else if (b.startsWith("SUMMARY")) nama = b.slice(b.indexOf(":") + 1).replace(/\\([,;])/g, "$1").trim();
    else if (b.startsWith("DESCRIPTION")) desk = b.slice(b.indexOf(":") + 1);
    else if (b === "END:VEVENT") {
      if (!/^\d{8}$/.test(mulai) || !/^hari libur nasional/i.test(desk)) continue;
      const awal = Date.parse(`${iso(mulai)}T00:00:00Z`);
      const akhir = /^\d{8}$/.test(selesai) ? Date.parse(`${iso(selesai)}T00:00:00Z`) : awal + HARI_MS;
      for (let t = awal; t < akhir && t < awal + 40 * HARI_MS; t += HARI_MS) {
        const k = isoHari(t);
        hasil[k] = hasil[k] && !hasil[k].includes(nama) ? `${hasil[k]}; ${nama}` : nama;
      }
    }
  }
  return hasil;
}

let jedaGagalSampai = 0;
const cache = new Map<string, { hasil: InfoLibur | null; sampai: number }>();

/** Kosongkan cache cekLibur — dipanggil setelah admin mengubah pengaturan libur. */
export function bersihkanCacheLibur() { cache.clear(); }

/** Perbarui salinan tanggal merah nasional bila sudah lebih dari seminggu (atau `paksa`). Gagal → coba lagi 6 jam kemudian. */
export async function perbaruiLiburNasional(paksa = false): Promise<{ ok: boolean; jumlah: number; pesan?: string }> {
  const s = await getSettings([KUNCI_LIBUR.nasionalData]);
  const lama = bacaNasional(s[KUNCI_LIBUR.nasionalData]);
  const jumlahLama = Object.keys(lama.tanggal).length;
  const segar = lama.diperbarui && Date.now() - Date.parse(lama.diperbarui) < SEMINGGU;
  if (!paksa && (segar || Date.now() < jedaGagalSampai)) return { ok: true, jumlah: jumlahLama };
  try {
    const r = await fetch(SUMBER_NASIONAL, { signal: AbortSignal.timeout(15_000), cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const baru = uraiIcsLibur(await r.text());
    if (Object.keys(baru).length < 10) throw new Error("isi kalender libur tidak wajar");
    // Tahun yang ada di sumber diganti utuh (tanggal tentatif bisa bergeser); tahun lama yang sudah tidak dimuat tetap disimpan.
    const tahunBaru = new Set(Object.keys(baru).map(t => t.slice(0, 4)));
    const tetap = Object.fromEntries(Object.entries(lama.tanggal).filter(([t]) => !tahunBaru.has(t.slice(0, 4))));
    const value = JSON.stringify({ diperbarui: new Date().toISOString(), tanggal: { ...tetap, ...baru } });
    await prisma.siteSetting.upsert({ where: { key: KUNCI_LIBUR.nasionalData }, update: { value }, create: { key: KUNCI_LIBUR.nasionalData, value } });
    cache.clear();
    return { ok: true, jumlah: Object.keys(baru).length };
  } catch (e) {
    jedaGagalSampai = Date.now() + 6 * 3600_000;
    return { ok: false, jumlah: jumlahLama, pesan: (e as Error).message };
  }
}

export async function infoLiburNasional(): Promise<{ jumlah: number; diperbarui: string | null }> {
  const d = bacaNasional((await getSettings([KUNCI_LIBUR.nasionalData]))[KUNCI_LIBUR.nasionalData]);
  return { jumlah: Object.keys(d.tanggal).length, diperbarui: d.diperbarui };
}

/** Semua hari libur dalam rentang [dari, sampai] (YYYY-MM-DD, inklusif), satu entri per tanggal — sumber sekolah didahulukan. */
export async function daftarLibur(dari: string, sampai: string): Promise<InfoLibur[]> {
  const s = await getSettings([KUNCI_LIBUR.manual, KUNCI_LIBUR.nasionalAktif, KUNCI_LIBUR.nasionalData]);
  const awal = Date.parse(`${dari}T00:00:00Z`), akhir = Date.parse(`${sampai}T00:00:00Z`);
  if (!Number.isFinite(awal) || !Number.isFinite(akhir) || akhir < awal) return [];
  const peta = new Map<string, InfoLibur>();
  const tambah = (tanggal: string, nama: string, sumber: SumberLibur) => {
    if (tanggal >= dari && tanggal <= sampai && !peta.has(tanggal)) peta.set(tanggal, { tanggal, nama, sumber });
  };

  const agenda = await prisma.schoolEvent.findMany({
    where: { tanggalMulai: { lte: new Date(akhir) }, tanggalSelesai: { gte: new Date(awal) } },
    select: { judul: true, jenis: true, hariEfektif: true, kode: true, tanggalMulai: true, tanggalSelesai: true },
  }).catch(() => []);
  for (const a of agenda) {
    const eksplisit = !!(a.kode && KODE[a.kode]);
    const kode = eksplisit ? a.kode : tebakKode(a.judul, a.jenis, a.hariEfektif);
    if (!kode || KODE[kode]?.sifat !== "LIBUR") continue;
    // KEGIATAN yang tidak dicentang "hari efektif" BUKAN libur (temuan user 10 Okt 2026: LDKS 7–9 Okt hanya diikuti kelas X,
    // tetapi TV, pengingat, dan absen mandiri menganggap seluruh sekolah libur — guru tidak bisa presensi). `tebakKode`
    // menjatuhkan semua agenda non-efektif ke "LHB" untuk pewarnaan kalender; untuk LIBUR SUNGGUHAN syaratnya lebih ketat:
    // agendanya berjenis LIBUR, kodenya dipilih tegas, atau judulnya memang nama libur (cuti bersama, libur semester, …).
    if (!eksplisit && kode === "LHB" && a.jenis !== "LIBUR") continue;
    for (let t = a.tanggalMulai.getTime(); t <= a.tanggalSelesai.getTime(); t += HARI_MS) tambah(isoHari(t), a.judul, "KALENDER");
  }
  if (s[KUNCI_LIBUR.nasionalAktif] !== "0") {
    for (const [t, nama] of Object.entries(bacaNasional(s[KUNCI_LIBUR.nasionalData]).tanggal)) tambah(t, nama, "NASIONAL");
  }
  for (const t of (s[KUNCI_LIBUR.manual] ?? "").split(/[\s,;]+/).filter(Boolean)) tambah(t, "Libur tambahan", "MANUAL");
  for (let t = awal; t <= akhir; t += HARI_MS) if (new Date(t).getUTCDay() === 0) tambah(isoHari(t), "Hari Minggu", "MINGGU");
  return [...peta.values()].sort((a, b) => a.tanggal.localeCompare(b.tanggal));
}

/** Hari libur pada tanggal itu (atau null). Di-cache 5 menit per proses — dipanggil tiap navigasi lewat pita Tugas Hari Ini. */
export async function cekLibur(tanggal: string): Promise<InfoLibur | null> {
  const ada = cache.get(tanggal);
  if (ada && ada.sampai > Date.now()) return ada.hasil;
  const hasil = (await daftarLibur(tanggal, tanggal))[0] ?? null;
  cache.set(tanggal, { hasil, sampai: Date.now() + 5 * 60_000 });
  if (cache.size > 60) { const pertama = cache.keys().next().value; if (pertama) cache.delete(pertama); }
  return hasil;
}
