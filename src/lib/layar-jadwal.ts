import "server-only";
import { prisma } from "@/lib/prisma";
import { tekanTombol, infoPerangkat, bukaAlamat } from "@/lib/layar-adb";
import { ALAMAT_APLIKASI } from "@/lib/alamat-aplikasi";
import { cekLibur } from "@/lib/hari-libur";

/** JADWAL MATI OTOMATIS LAYAR (24 September 2026, permintaan user: "tv bisa kita buat jadwal mati hidup otomatis?").
 *
 * SENGAJA SATU ARAH — hanya MEMATIKAN. Menyalakan TV dari jauh tidak mungkin selama ia tersambung lewat WiFi:
 * saat standby, WiFi TV ikut mati sehingga tidak ada perintah apa pun yang sampai (Wake-on-LAN sudah diuji dari
 * router 24 Sep 2026 dan gagal). Menyalakan otomatis butuh kabel LAN (WoL) atau colokan pintar — kalau itu
 * dipasang nanti, tambahkan di sini sebagai arah kedua, jangan menjanjikannya sebelum benar-benar diuji.
 *
 * Dipanggil dari `instrumentation.ts` tiap 5 menit. Idempoten dalam praktiknya: TV yang sudah standby tidak
 * menjawab ADB sama sekali, jadi perintah kedua otomatis gagal tanpa efek samping. */

const ZONA = 7 * 3600_000;

/** Jam:menit sekarang di WIB (server berjalan UTC). */
function jamWib(now = Date.now()) {
  const d = new Date(now + ZONA);
  return { jam: d.getUTCHours(), menit: d.getUTCMinutes(), tanggal: d };
}

/** Benar bila `HH:MM` jatuh dalam jendela `menitJendela` terakhir — jadi jadwal tidak terlewat walau
 * penjadwal berjalan tiap 5 menit dan tidak tepat di menit yang sama. */
export function waktunya(jadwal: string, menitJendela = 6, now = Date.now()): boolean {
  const m = /^(\d{1,2}):(\d{2})$/.exec(jadwal.trim());
  if (!m) return false;
  const target = Number(m[1]) * 60 + Number(m[2]);
  const { jam, menit } = jamWib(now);
  const sekarang = jam * 60 + menit;
  const selisih = sekarang - target;
  return selisih >= 0 && selisih < menitJendela;
}

/** Nyalakan layar sesuai jadwal. HANYA berfungsi pada TV bermode "Tanpa layar" (sistem tetap hidup saat layar
 * gelap) — pada mode Doze, TV benar-benar tidur dan tidak ada perintah yang sampai. Karena itu kegagalannya
 * didiamkan: bukan kesalahan sistem, melainkan pilihan mode hemat daya di TV itu. */
export async function nyalakanLayarTerjadwal(): Promise<{ dicoba: number; berhasil: number }> {
  const layar = await prisma.layar.findMany({
    where: { aktif: true, NOT: { jadwalNyala: null } },
    select: { id: true, jadwalNyala: true, ipTetap: true, ipTerakhir: true },
  });
  if (!layar.length) return { dicoba: 0, berhasil: 0 };
  const hariIni = jamWib().tanggal.toISOString().slice(0, 10);
  if (await cekLibur(hariIni).catch(() => null)) return { dicoba: 0, berhasil: 0 };

  let dicoba = 0, berhasil = 0;
  for (const l of layar) {
    if (!l.jadwalNyala || !waktunya(l.jadwalNyala)) continue;
    const ip = l.ipTetap || l.ipTerakhir;
    if (!ip) continue;
    dicoba += 1;
    const hasil = await tekanTombol(ip, "bangunkan").catch(() => ({ ok: false }));
    if (hasil.ok) berhasil += 1;
  }
  return { dicoba, berhasil };
}

export async function matikanLayarTerjadwal(): Promise<{ dicoba: number; berhasil: number }> {
  const layar = await prisma.layar.findMany({
    where: { aktif: true, NOT: { jadwalMati: null } },
    select: { id: true, nama: true, ruang: true, jadwalMati: true, ipTetap: true, ipTerakhir: true },
  });
  if (!layar.length) return { dicoba: 0, berhasil: 0 };

  // Hari libur: penjadwal diam, sama seperti pengingat lain (CLAUDE.md #40).
  const hariIni = jamWib().tanggal.toISOString().slice(0, 10);
  if (await cekLibur(hariIni).catch(() => null)) return { dicoba: 0, berhasil: 0 };

  let dicoba = 0, berhasil = 0;
  for (const l of layar) {
    if (!l.jadwalMati || !waktunya(l.jadwalMati)) continue;
    const ip = l.ipTetap || l.ipTerakhir;
    if (!ip) continue;
    dicoba += 1;
    const hasil = await tekanTombol(ip, "daya").catch(() => ({ ok: false, pesan: "gagal" }));
    if (hasil.ok) berhasil += 1;
  }
  return { dicoba, berhasil };
}

/* ------------------------------ buka papan otomatis ------------------------------ */

/** Paket peluncur (beranda) TV. Kalau salah satu ini yang sedang di depan, berarti TV MENGANGGUR —
 * tidak ada yang sedang memakainya, jadi papan boleh ditampilkan. */
const PELUNCUR = [
  "com.google.android.apps.tv.launcherx", // Google TV
  "com.google.android.tvlauncher",        // Android TV
  "com.tcl.launcher", "com.tcl.tv.launcher",
  "com.mediatek.wwtv.tvcenter",           // sebagian TV Polytron/MTK
];

/** Jangan mencoba membuka papan pada TV yang sama lebih sering dari ini — kalau peramban gagal terbuka,
 * percobaan berulang tiap 5 menit hanya membuang waktu dan mengganggu. */
const JEDA_COBA_MS = 30 * 60_000;
const terakhirCoba = new Map<string, number>();

/** Tahan papan otomatis pada satu TV selama `menit` — dipakai saat TV sengaja dipakai untuk hal lain
 * (mencerminkan layar laptop saat rapat). Papan tidak boleh menyambar layar di sela-sela penggunaan itu. */
export function tahanPapanOtomatis(layarId: string, menit: number) {
  terakhirCoba.set(layarId, Date.now() + Math.max(0, menit * 60_000 - JEDA_COBA_MS));
}

/** BUKA PAPAN OTOMATIS (24 September 2026, permintaan user: "gas").
 *
 * Masalah yang dijawab: TV yang dimatikan lalu dinyalakan kembali tidak otomatis kembali ke papan informasi,
 * dan mengetik alamat di TV itu menyiksa. Jadi sistem yang membukakannya.
 *
 * ATURAN YANG TIDAK BOLEH DILANGGAR: papan hanya dibuka bila TV sedang **menganggur di beranda**. Kalau guru
 * sedang memutar video, membuka aplikasi, atau memakai colokan HDMI, sistem TIDAK BOLEH merebut layar — TV
 * tetap alat mengajar, dan fitur pemantauan tidak pernah dibuat untuk mengambil alih kelas. */
export async function bukaPapanOtomatis(): Promise<{ dibuka: number }> {
  const layar = await prisma.layar.findMany({
    where: { aktif: true, papanOtomatis: true, NOT: { token: null } },
    select: { id: true, nama: true, token: true, ipTetap: true, ipTerakhir: true },
  });
  if (!layar.length) return { dibuka: 0 };

  let dibuka = 0;
  for (const l of layar) {
    const ip = l.ipTetap || l.ipTerakhir;
    if (!ip) continue;
    const sebelumnya = terakhirCoba.get(l.id) ?? 0;
    if (Date.now() - sebelumnya < JEDA_COBA_MS) continue;

    const info = await infoPerangkat(ip).catch(() => null);
    if (!info || info.status !== "SIAP") continue;      // TV mati/tidur — tidak ada yang bisa dibuka
    if (!info.paketDepan || !PELUNCUR.includes(info.paketDepan)) continue; // SEDANG DIPAKAI — jangan diganggu

    terakhirCoba.set(l.id, Date.now());
    const hasil = await bukaAlamat(ip, `${ALAMAT_APLIKASI}/layar/${l.token}`).catch(() => ({ ok: false }));
    if (hasil.ok) dibuka += 1;
  }
  return { dibuka };
}
