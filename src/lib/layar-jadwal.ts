import "server-only";
import { prisma } from "@/lib/prisma";
import { tekanTombol, infoPerangkat, bukaAlamat, keadaanBoot } from "@/lib/layar-adb";
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

/* ------------------------- penjaga menyala sendiri setelah padam ------------------------- */

/** TIDURKAN TV YANG MENYALA SENDIRI DI LUAR JAM PAPAN (5 Oktober 2026).
 *
 * TV TCL sekolah aslinya bermode-nyala "siaga" setelah listrik kembali: siaga DINGIN, WiFi mati, sehingga papan
 * tidak bisa menyalakannya sampai ada yang menekan remote (laporan user 5 Okt 2026 setelah mati lampu: Lab TKJ,
 * AKL, DKV tidak bisa dihidupkan dari papan). Penawarnya: menu Hotel TV → Mode Nyala = "Langsung menyala".
 * Tetapi `matikanLayarTerjadwal` hanya menembak SEKALI di menit jadwalnya — listrik kembali pukul 02.00 berarti
 * TV menyala semalaman. Penjaga ini menutup celah itu: di LUAR rentang [jadwalNyala, jadwalMati) — dan seharian
 * pada hari libur — TV yang baru boot (< 40 menit) dengan layar menyala dan tidak sedang dipakai (yang tampil
 * beranda atau papan sekolah) ditidurkan. Tidur, bukan daya: TV tetap terjangkau untuk dinyalakan esok pagi.
 *
 * Hanya TV yang punya KEDUA jadwal — tanpa jadwal, tidak ada dasar untuk menganggap jam berapa pun "di luar jam".
 * Satu kali per boot (diingat dari uptime), jadi guru yang sengaja menyalakan lagi tidak ditidurkan terus. */
const PAPAN_PAKET = "sch.almunawwir.papan";
const SUDAH_DITIDURKAN = new Map<string, number>(); // layarId → waktu boot (ms) yang sudah ditangani

function keMenit(hhmm: string | null): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm ?? "").trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export async function tidurkanSetelahPadam(): Promise<{ diperiksa: number; ditidurkan: number }> {
  const layar = await prisma.layar.findMany({
    where: { aktif: true, NOT: [{ jadwalMati: null }, { jadwalNyala: null }] },
    select: { id: true, jadwalMati: true, jadwalNyala: true, ipTetap: true, ipTerakhir: true },
  });
  if (!layar.length) return { diperiksa: 0, ditidurkan: 0 };
  const { jam, menit, tanggal } = jamWib();
  const sekarang = jam * 60 + menit;
  const libur = !!(await cekLibur(tanggal.toISOString().slice(0, 10)).catch(() => null));

  const calon = layar.filter(l => {
    const a = keMenit(l.jadwalNyala), b = keMenit(l.jadwalMati);
    if (a === null || b === null || !(l.ipTetap || l.ipTerakhir)) return false;
    if (libur) return true;
    const jamPapan = a < b ? sekarang >= a && sekarang < b : sekarang >= a || sekarang < b;
    return !jamPapan;
  });

  let ditidurkan = 0;
  // Empat sekaligus: TV yang siaga dingin baru gagal setelah batas waktu sambung, jangan antre satu per satu.
  for (let i = 0; i < calon.length; i += 4) {
    await Promise.all(calon.slice(i, i + 4).map(async l => {
      const ip = (l.ipTetap || l.ipTerakhir)!;
      const k = await keadaanBoot(ip);
      if (!k || !k.menyala || k.uptimeDetik > 40 * 60) return;
      const boot = Date.now() - k.uptimeDetik * 1000;
      const tercatat = SUDAH_DITIDURKAN.get(l.id);
      if (tercatat && Math.abs(tercatat - boot) < 120_000) return;      // boot ini sudah ditangani
      if (k.paketDepan && !PELUNCUR.includes(k.paketDepan) && k.paketDepan !== PAPAN_PAKET) return; // sedang dipakai
      SUDAH_DITIDURKAN.set(l.id, boot);
      const h = await tekanTombol(ip, "daya").catch(() => ({ ok: false }));
      if (h.ok) ditidurkan += 1;
    }));
  }
  return { diperiksa: calon.length, ditidurkan };
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
    if (info.layarNyala === false) continue; // sengaja ditidurkan (jadwal/penjaga padam) — jangan dibangunkan

    terakhirCoba.set(l.id, Date.now());
    const hasil = await bukaAlamat(ip, `${ALAMAT_APLIKASI}/layar/${l.token}`).catch(() => ({ ok: false }));
    if (hasil.ok) dibuka += 1;
  }
  return { dibuka };
}
