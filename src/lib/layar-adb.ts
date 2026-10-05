import "server-only";
import { execFile } from "node:child_process";

/** KENDALI & PANTAU VISUAL LAYAR LEWAT ADB (24 September 2026).
 *
 * Android TV menyediakan ADB lewat jaringan (port 5555) setelah "Opsi Pengembang → Debugging" dinyalakan
 * dan izin di layar TV disetujui SEKALI per perangkat. Dari situ sistem bisa: mengambil tangkapan layar,
 * membaca aplikasi yang sedang dibuka, dan menekan tombol daya/beranda dari jauh — tanpa memasang aplikasi
 * apa pun di TV.
 *
 * Batas yang HARUS diketahui dan jangan dijanjikan lebih:
 * - Aplikasi berproteksi DRM (Netflix, Disney+) menghasilkan tangkapan layar HITAM. Itu penguncian Android.
 * - Input HDMI (laptop/konsol yang dicolok) TIDAK tergambar oleh Android, jadi tangkapan layarnya juga kosong.
 * - Saat TV standby, WiFi-nya mati → ADB tidak menjawab sama sekali. Membangunkan TV dari jauh hanya mungkin
 *   lewat kabel LAN (Wake-on-LAN) atau colokan pintar; lewat WiFi terbukti tidak bisa (diuji 24 Sep 2026).
 * - Izin ADB terikat pada KUNCI klien. Kunci itu disimpan di volume `adb_keys` supaya tidak hilang tiap deploy;
 *   kalau volume dihapus, setiap TV harus menyetujui ulang izin di layarnya. */

const BATAS_MS = 15_000;
const PORT = 5555;

function jalankan(args: string[], batasMs = BATAS_MS): Promise<{ keluar: Buffer; galat: string; kode: number }> {
  return new Promise(resolve => {
    execFile("adb", args, { timeout: batasMs, maxBuffer: 24 * 1024 * 1024, encoding: "buffer" }, (err, stdout, stderr) => {
      resolve({
        keluar: stdout ?? Buffer.alloc(0),
        galat: (stderr ?? Buffer.alloc(0)).toString("utf8").trim(),
        kode: err && typeof (err as { code?: number }).code === "number" ? (err as { code: number }).code : err ? 1 : 0,
      });
    });
  });
}

/* SETELAN PENJAGA TV (4 Okt 2026) — diterapkan otomatis tiap kali tersambung, paling sering sekali per 6 jam
   per TV (TV bisa mengembalikan setelannya sendiri setelah pembaruan sistem / reset):
   - `adb_allowed_connection_time = 0`: Android 11+ MEMBATALKAN izin debugging yang sudah disetujui bila TV tidak
     tersambung ADB 7 hari (laporan user: "siaga jaringan ada kalanya minta akses debugging lagi"). 0 = tidak pernah.
   - `screen_off_timeout` maksimum: TV sekolah ternyata kembali ke 10 menit, sehingga papan padam sendiri. */
const PENJAGA_TERAKHIR = new Map<string, number>();
async function terapkanPenjaga(ip: string) {
  const t = PENJAGA_TERAKHIR.get(ip) ?? 0;
  if (Date.now() - t < 6 * 3600_000) return;
  PENJAGA_TERAKHIR.set(ip, Date.now());
  await jalankan(["-s", `${ip}:${PORT}`, "shell",
    "settings put global adb_allowed_connection_time 0; settings put system screen_off_timeout 2147483647; settings put secure sleep_timeout -1"],
    10_000).catch(() => null);
}

export type StatusAdb = "SIAP" | "BELUM_DIIZINKAN" | "TIDAK_TERJANGKAU" | "ADB_TIDAK_ADA" | "TERPROTEKSI";

/** Pastikan tersambung. Dipanggil di depan setiap perintah — `adb connect` yang sudah tersambung sangat murah. */
export async function sambung(ip: string): Promise<StatusAdb> {
  const c = await jalankan(["connect", `${ip}:${PORT}`], 12_000);
  const balasan = c.keluar.toString("utf8") + c.galat;
  if (c.galat.includes("not found") || c.galat.includes("ENOENT")) return "ADB_TIDAK_ADA";
  // Port tertutup → memang tidak terjangkau. Dibedakan dari "terhubung tetapi belum siap" di bawah.
  if (/failed to connect|Connection refused|No route to host|Network is unreachable/i.test(balasan)) return "TIDAK_TERJANGKAU";

  /* SAMBUNGAN BARU PERLU SESAAT (laporan user 25 Sep 2026: "setiap awal pendaftaran TV, ambil ulang selalu
     bilang debugging belum on padahal sudah"). Pada kontak pertama perangkat sempat tampil `offline` selama
     jabat tangan, dan tetap `offline`/`unauthorized` selama dialog "Izinkan proses debug?" masih terbuka di
     layar TV. Versi lama langsung memvonis TIDAK_TERJANGKAU — yang pesannya menyuruh menyalakan Debugging
     jaringan, padahal justru sudah menyala dan tinggal menunggu persetujuan. Karena itu dicoba tiga kali
     dengan jeda, dan `offline` yang menetap dilaporkan sebagai BELUM_DIIZINKAN, bukan tidak terjangkau. */
  for (let coba = 0; coba < 3; coba++) {
    const d = await jalankan(["devices"], 8_000);
    const baris = d.keluar.toString("utf8").split("\n").find(b => b.startsWith(`${ip}:${PORT}`));
    if (baris) {
      const status = baris.split(/\s+/)[1] ?? "";
      if (status === "device") { void terapkanPenjaga(ip); return "SIAP"; }
      if (status === "unauthorized") return "BELUM_DIIZINKAN";
    }
    if (coba < 2) await new Promise(r => setTimeout(r, 1500));
  }
  // Terhubung tetapi tidak pernah menjadi `device`: hampir selalu izin yang belum disetujui di layar TV.
  return "BELUM_DIIZINKAN";
}

export const PESAN_STATUS: Record<StatusAdb, string> = {
  SIAP: "Siap",
  BELUM_DIIZINKAN: "TV terhubung, tetapi izin debug belum disetujui. LIHAT LAYAR TV — ada dialog \"Izinkan proses debug?\"; centang \"Selalu izinkan\" lalu OK. Kalau dialognya tidak muncul, matikan lalu nyalakan lagi Debugging jaringan di Opsi Pengembang.",
  // Penyebab tersering ditulis lebih dulu (5 Okt 2026): setelah listrik padam TV TCL masuk SIAGA DINGIN — WiFi mati
  // sampai remote ditekan sekali — dan pesan lama "tidak menjawab" membuat petugas mengira papan yang rusak.
  TIDAK_TERJANGKAU: "TV tidak terjangkau dari jaringan. Paling sering: TV mati total atau siaga dingin setelah listrik padam — nyalakan SEKALI dengan remote, sesudah itu bisa dikendalikan dari sini lagi. Kalau TV jelas menyala, periksa WiFi TV dan Opsi Pengembang → Debugging jaringan.",
  ADB_TIDAK_ADA: "Perkakas ADB tidak tersedia di server.",
  TERPROTEKSI: "Layar tidak bisa ditangkap karena tayangannya berproteksi salinan.",
};

/** Di bawah ini, tangkapan 1080p pasti layar kosong/hitam. Papan bermotif kita saja 785 KB; YouTube, Netflix, dan
 * masukan HDMI mengembalikan bingkai hitam yang termampat menjadi belasan KB. */
const BATAS_GAMBAR_KOSONG = 40_000;

/** Tangkapan layar TV sebagai PNG. */
export async function tangkapLayar(ip: string): Promise<{ png: Buffer } | { galat: string; status: StatusAdb }> {
  const st = await sambung(ip);
  if (st !== "SIAP") return { galat: PESAN_STATUS[st], status: st };
  // exec-out menjaga data biner tetap utuh (shell biasa merusak PNG karena terjemahan baris baru).
  const r = await jalankan(["-s", `${ip}:${PORT}`, "exec-out", "screencap", "-p"], 20_000);
  if (r.kode !== 0 || r.keluar.length < 1000) return { galat: r.galat || "Tangkapan layar gagal diambil.", status: "TIDAK_TERJANGKAU" };

  // SEBAGIAN TV MENCEMARI KELUARAN. Temuan nyata 24 Sep 2026: dua TCL 55P6L dengan firmware berbeda — yang satu
  // mengirim PNG bersih, yang satu mengawalinya dengan baris log pabrikan ("Init wrapper…"), sehingga berkasnya
  // ditolak browser dan tampak seperti "TV tidak menjawab". Karena itu gambar dicari dari TANDA TANGAN PNG-nya,
  // bukan diandaikan mulai di byte pertama.
  const TANDA = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const mulai = r.keluar.indexOf(TANDA);
  if (mulai < 0) return { galat: "TV membalas tanpa gambar yang bisa dibaca.", status: "TIDAK_TERJANGKAU" };
  const png = mulai === 0 ? r.keluar : r.keluar.subarray(mulai);

  /* TAYANGAN BERPROTEKSI (25 September 2026, laporan user: "ruang rapat cek buka youtube, tampilan monitoring
     black spot"). YouTube, Netflix, dan masukan HDMI memakai jalur video terlindungi, sehingga `screencap`
     mengembalikan bingkai HITAM — itu batas Android, tidak ada cara mengakalinya dari sisi kita. Kotak hitam
     polos tidak memberi tahu apa pun kepada petugas, jadi bila gambarnya kosong kita SEBUTKAN aplikasi yang
     sedang dibuka. Justru itulah yang dibutuhkan: yang ingin diketahui sekolah adalah TV sedang dipakai apa. */
  if (png.length < BATAS_GAMBAR_KOSONG) {
    const info = await infoPerangkat(ip).catch(() => null);
    const nama = info?.aplikasiDepan || info?.paketDepan;
    return {
      galat: nama
        ? `Layar tidak bisa ditangkap karena tayangannya berproteksi salinan. TV sedang membuka: ${nama}.`
        : "Layar tidak bisa ditangkap — tayangan berproteksi salinan atau layar TV sedang mati.",
      status: "TERPROTEKSI",
    };
  }
  return { png };
}

/** Nama aplikasi yang sedang di depan + info perangkat ringkas. */
export async function infoPerangkat(ip: string): Promise<{
  status: StatusAdb; pesan: string;
  paketDepan?: string | null; aplikasiDepan?: string | null;
  model?: string | null; versiAndroid?: string | null; layarNyala?: boolean | null;
}> {
  const status = await sambung(ip);
  if (status !== "SIAP") return { status, pesan: PESAN_STATUS[status] };
  // Satu perintah = satu STRING: `adb shell` menjalankannya di shell TV, jadi pipa & tanda kutip diurai di sana.
  const s = async (perintah: string) => (await jalankan(["-s", `${ip}:${PORT}`, "shell", perintah])).keluar.toString("utf8").trim();

  const [depan, model, versi, daya] = await Promise.all([
    s("dumpsys activity activities | grep -m1 -E 'mResumedActivity|topResumedActivity'"),
    s("getprop ro.product.model"),
    s("getprop ro.build.version.release"),
    s("dumpsys power | grep -m1 mWakefulness="),
  ]);
  const paket = depan.match(/\s([A-Za-z0-9_.]+)\/[A-Za-z0-9_.$]+/)?.[1] ?? null;
  return {
    status, pesan: "Siap",
    paketDepan: paket,
    aplikasiDepan: paket ? namaAplikasi(paket) : null,
    model: model || null,
    versiAndroid: versi || null,
    layarNyala: daya ? /Awake/i.test(daya) : null,
  };
}

/** Tombol jarak jauh — padanan remote fisik (24 September 2026, permintaan user: "tombolnya nggak bisa ditambahin?").
 *
 * Gunanya bukan sekadar kenyamanan: remote TV sekolah sering hilang atau habis baterai, dan selama ini guru
 * jadi tidak bisa berbuat apa-apa. Dengan daftar ini TV tetap bisa dikendalikan dari HP petugas.
 *
 * Sengaja HANYA tombol yang aman: tidak ada yang bisa mengubah setelan pabrik, menghapus aplikasi, atau
 * mengeluarkan akun. Kode angkanya adalah keycode Android baku. */
export const TOMBOL = {
  /* "Matikan" = TIDUR (KEYCODE_SLEEP), BUKAN tombol daya (26). Tombol daya mengikuti mode daya yang disetel di TV
     (Doze mematikan WiFi → tidak bisa dinyalakan lagi dari jauh). Tidur hanya memadamkan layar dan sistem tetap
     hidup, apa pun modenya — diuji 4 Okt 2026 di TV Lab DKV: Asleep tetap menjawab ADB, KEYCODE_WAKEUP menyalakan. */
  daya: "223",
  dayaTotal: "26",     // tombol daya sungguhan — mengikuti mode daya TV (Doze = tidak bisa dibangunkan dari jauh)
  bangunkan: "224",    // KEYCODE_WAKEUP — layar mati tapi jaringan hidup
  beranda: "3",
  kembali: "4",
  ok: "23",            // DPAD_CENTER
  atas: "19",
  bawah: "20",
  kiri: "21",
  kanan: "22",
  bisu: "164",
  volumeNaik: "24",
  volumeTurun: "25",
  putarJeda: "85",
  sumber: "178",       // TV_INPUT — pindah sumber (HDMI/TV)
} as const;

export async function tekanTombol(ip: string, tombol: keyof typeof TOMBOL): Promise<{ ok: boolean; pesan: string }> {
  const st = await sambung(ip);
  if (st !== "SIAP") return { ok: false, pesan: PESAN_STATUS[st] };
  const r = await jalankan(["-s", `${ip}:${PORT}`, "shell", "input", "keyevent", TOMBOL[tombol]]);
  return r.kode === 0 ? { ok: true, pesan: "Perintah terkirim." } : { ok: false, pesan: r.galat || "Perintah gagal." };
}

/** Buka alamat web di TV (dipakai tombol "Buka Papan Sekolah"). Android TV membuka penangan bawaan untuk
 * alamat itu; kalau TV belum punya aplikasi yang bisa membukanya, perintahnya gagal dengan pesan apa adanya. */
export const PAKET_PAPAN = "sch.almunawwir.papan";

/** Buka papan di TV — LEWAT APLIKASI MyAlwis Papan bila terpasang, peramban hanya sebagai cadangan.
 *
 * Peramban TV menambahkan bilah alamatnya sendiri di atas papan dan menampilkan penunjuk tetikus; halaman web
 * tidak bisa menyembunyikan keduanya (temuan user 25 Sep 2026: "masih muncul alamat di atas"). Aplikasi papan
 * adalah WebView layar penuh, jadi hasilnya bersih dan seragam di semua merek TV — sekaligus menghilangkan
 * ketergantungan pada peramban bawaan yang berbeda-beda (Google TV bahkan tidak punya peramban sama sekali). */
export async function bukaAlamat(ip: string, url: string): Promise<{ ok: boolean; pesan: string }> {
  const st = await sambung(ip);
  if (st !== "SIAP") return { ok: false, pesan: PESAN_STATUS[st] };

  const lewatAplikasi = await jalankan([
    "-s", `${ip}:${PORT}`, "shell", "am", "start",
    "-n", `${PAKET_PAPAN}/.MainActivity`, "-e", "alamat", url,
  ]);
  const hasilAplikasi = lewatAplikasi.keluar.toString("utf8") + lewatAplikasi.galat;
  if (lewatAplikasi.kode === 0 && !/Error|Exception|does not exist|not found/i.test(hasilAplikasi)) {
    return { ok: true, pesan: "Papan dibuka lewat aplikasi MyAlwis Papan." };
  }

  const r = await jalankan(["-s", `${ip}:${PORT}`, "shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", url]);
  const keluaran = r.keluar.toString("utf8") + r.galat;
  if (/Error|Exception|no activity/i.test(keluaran)) {
    return { ok: false, pesan: "TV tidak punya aplikasi untuk membuka alamat web, dan aplikasi MyAlwis Papan belum terpasang di TV ini." };
  }
  return r.kode === 0
    ? { ok: true, pesan: "Alamat dibuka di peramban TV — pasang aplikasi MyAlwis Papan supaya bilah alamatnya hilang." }
    : { ok: false, pesan: r.galat || "Perintah gagal." };
}

/** Pasang/perbarui aplikasi papan di TV dari berkas APK yang sudah ada di server. */
export async function pasangPapan(ip: string, berkasApk: string): Promise<{ ok: boolean; pesan: string }> {
  const st = await sambung(ip);
  if (st !== "SIAP") return { ok: false, pesan: PESAN_STATUS[st] };
  const r = await jalankan(["-s", `${ip}:${PORT}`, "install", "-r", berkasApk], 180_000);
  const keluaran = r.keluar.toString("utf8") + r.galat;
  if (/Success/i.test(keluaran)) return { ok: true, pesan: "Aplikasi papan terpasang." };
  return { ok: false, pesan: keluaran.trim().split("\n").pop() || "Pemasangan gagal." };
}

/** Paket penerima Miracast per merek — TV yang tidak punya satu pun berarti memang tidak mendukung Miracast. */
const PENERIMA_LAYAR = [
  "com.tcl.miracast",
  "com.mediatek.wfd.sink", "com.mediatek.miracast",
  "com.android.smart.terminal.wfd", "com.softwinner.wfd",
];

/** MODE TERIMA LAYAR (Miracast) — menaruh TV ke mode menunggu pantulan layar tanpa perlu remote.
 *
 * Ini Wi-Fi Direct, BUKAN lewat jaringan sekolah: laptop harus Windows dengan adaptor yang mendukung Miracast
 * (`Win`+`K`). macOS tidak mendukung Miracast sama sekali — untuk MacBook pakai Google Cast lewat Chrome. */
export async function modeTerimaLayar(ip: string): Promise<{ ok: boolean; pesan: string }> {
  const st = await sambung(ip);
  if (st !== "SIAP") return { ok: false, pesan: PESAN_STATUS[st] };
  const daftar = await jalankan(["-s", `${ip}:${PORT}`, "shell", "pm", "list", "packages"], 15_000);
  const terpasang = daftar.keluar.toString("utf8");
  const paket = PENERIMA_LAYAR.find(p => terpasang.includes(`package:${p}`));
  if (!paket) {
    return { ok: false, pesan: "TV ini tidak punya penerima Miracast. Pakai Google Cast dari Chrome — laptop harus di WiFi yang sama dengan TV." };
  }

  /* MENCARI KOMPONENNYA, BUKAN `monkey`. Versi pertama memakai `monkey -p <paket> -c LAUNCHER 1`; perintah itu
     hanya memuntahkan daftar argumennya sendiri sebagai keluaran dan tidak membuka apa-apa, sehingga pesan galat
     di layar petugas berisi potongan argumen yang tidak berarti (laporan user 25 Sep 2026). Penyebabnya:
     penerima Miracast SENGAJA tidak punya ikon peluncur — `resolve-activity -c LAUNCHER` pun menjawab "No
     activity found". Jadi komponennya dibaca dari daftar aktivitas paket, lalu dibuka dengan `am start -n`. */
  const info = await jalankan(["-s", `${ip}:${PORT}`, "shell", "dumpsys", "package", paket], 20_000);
  const teks = info.keluar.toString("utf8");
  const semua = [...new Set(teks.match(new RegExp(`${paket.replace(/\./g, "\\.")}/[A-Za-z0-9_.]+`, "g")) ?? [])];
  /* SINK DULU, BUKAN MainActivity. Pada TCL, `com.tcl.miracast/.MainActivity` ternyata layar "MiraTestMenu"
     bertuliskan "only for Test, must remove this" berisi tombol START/STOP Service — bukan penerima yang
     dipakai pengguna (temuan user 25 Sep 2026). Layar penerima sebenarnya adalah aktivitas ber-"Sink".
     Apa pun yang bernama Test/Debug dibuang lebih dulu supaya menu pabrikan tidak pernah terpilih. */
  const layak = semua.filter(x => /Activity$/.test(x) && !/Test|Debug|Service|BroadcastReceiver/i.test(x));
  // DeviceList = layar "pilih perangkat" yang memang dihadapkan ke pengguna; Sink adalah layanan penerimanya
  // dan pada TCL tidak mengambil fokus sendiri (diuji 25 Sep 2026: `am start .DeamonSinkActivity` tidak tampil).
  const pilihan = layak.find(x => /DeviceList|Connect|Display/i.test(x))
    ?? layak.find(x => /Sink/i.test(x))
    ?? layak.find(x => /\/\.?MainActivity$/.test(x))
    ?? layak[0];
  if (!pilihan) return { ok: false, pesan: "Penerima Miracast ada di TV, tetapi layar pembukanya tidak ditemukan." };

  const r = await jalankan(["-s", `${ip}:${PORT}`, "shell", "am", "start", "-n", pilihan], 20_000);
  const hasil = r.keluar.toString("utf8") + r.galat;
  if (r.kode !== 0 || /Error|Exception|does not exist/i.test(hasil)) {
    return { ok: false, pesan: "TV menolak membuka mode terima layar." };
  }
  return { ok: true, pesan: "TV siap menerima pantulan layar. Di laptop Windows tekan Win+K lalu pilih TV ini." };
}

/** VOLUME TV (0–100 pada TCL & Polytron yang dipakai sekolah — `Max` dibaca dari perangkat, tidak diasumsikan).
 *
 * Dipakai bel sekolah: dinaikkan tepat sebelum bel berbunyi lalu dikembalikan persis ke nilai semula. Halaman web
 * TIDAK BISA melakukan ini — `HTMLMediaElement.volume` hanya meredam suara aplikasinya sendiri, tidak menyentuh
 * volume perangkat. Jalurnya harus ADB, sama seperti tombol volume di Dinding Layar.
 *
 * `cmd media_session volume` dipakai karena perintah `media volume` TIDAK ADA di TV ini (diuji 25 Sep 2026:
 * "media: inaccessible or not found"), dan menekan tombol volume berulang tidak masuk akal untuk skala 0–100. */
export async function bacaVolume(ip: string): Promise<{ nilai: number; maks: number } | null> {
  const st = await sambung(ip);
  if (st !== "SIAP") return null;
  const r = await jalankan(["-s", `${ip}:${PORT}`, "shell", "dumpsys", "audio"], 20_000);
  if (r.kode !== 0) return null;
  // Blok STREAM_MUSIC saja — dumpsys memuat belasan stream dan `grep` tanpa lingkup mengambil angka stream lain.
  const blok = r.keluar.toString("utf8").split("- STREAM_MUSIC:")[1];
  if (!blok) return null;
  const potong = blok.split("- STREAM_")[0];
  const nilai = potong.match(/streamVolume:\s*(\d+)/);
  const maks = potong.match(/Max:\s*(\d+)/);
  if (!nilai) return null;
  return { nilai: Number(nilai[1]), maks: maks ? Number(maks[1]) : 100 };
}

export async function aturVolume(ip: string, nilai: number): Promise<boolean> {
  const st = await sambung(ip);
  if (st !== "SIAP") return false;
  const r = await jalankan(["-s", `${ip}:${PORT}`, "shell", "cmd", "media_session", "volume", "--stream", "3", "--set", String(Math.round(nilai))], 15_000);
  return r.kode === 0;
}

/** UNDUH DATA SUARA TTS DI TV (25 September 2026).
 *
 * Google TTS sudah terpasang di TV sekolah, tetapi data suaranya diunduh PER BAHASA dan TV-nya berbahasa Inggris
 * (`en-GB`), jadi suara Indonesia belum tentu ada. Perintah ini membuka layar "Install voice data" milik Google
 * TTS; petugas tinggal memilih **Bahasa Indonesia** memakai remote virtual di halaman ini — tidak perlu mencari
 * remote fisik TV.
 *
 * Tidak bisa sepenuhnya otomatis: pemilihan bahasa ada di antarmuka Google, bukan perintah yang bisa dikirim.
 * Sesudah selesai, tekan "Buka Papan Sekolah" untuk kembali. */
export async function unduhSuara(ip: string): Promise<{ ok: boolean; pesan: string }> {
  const st = await sambung(ip);
  if (st !== "SIAP") return { ok: false, pesan: PESAN_STATUS[st] };
  const r = await jalankan([
    "-s", `${ip}:${PORT}`, "shell", "am", "start", "-a", "android.speech.tts.engine.INSTALL_TTS_DATA",
  ], 20_000);
  const keluaran = r.keluar.toString("utf8") + r.galat;
  if (r.kode !== 0 || /Error|Exception|no activity/i.test(keluaran)) {
    return { ok: false, pesan: "TV ini tidak punya pengunduh data suara (mesin Google TTS mungkin belum terpasang)." };
  }
  return { ok: true, pesan: "Layar unduhan suara terbuka di TV. Pilih Bahasa Indonesia memakai tombol panah & OK di remote ini." };
}

/** Mulai ulang TV — untuk TV yang menggantung. Butuh ADB, jadi hanya berlaku saat TV masih menjawab. */
export async function mulaiUlang(ip: string): Promise<{ ok: boolean; pesan: string }> {
  const st = await sambung(ip);
  if (st !== "SIAP") return { ok: false, pesan: PESAN_STATUS[st] };
  const r = await jalankan(["-s", `${ip}:${PORT}`, "reboot"], 20_000);
  return r.kode === 0 ? { ok: true, pesan: "TV dimulai ulang — tunggu sekitar satu menit." } : { ok: false, pesan: r.galat || "Perintah gagal." };
}

/** Nama paket → nama yang dikenal orang. Daftar pendek saja; selebihnya tampilkan nama paketnya apa adanya
 * supaya petugas tetap bisa mengenali aplikasi yang belum terdaftar di sini. */
const NAMA: Record<string, string> = {
  "com.google.android.youtube.tv": "YouTube",
  "com.google.android.youtube.tvkids": "YouTube Kids",
  "com.google.android.apps.tv.launcherx": "Beranda Google TV",
  "com.google.android.tvlauncher": "Beranda Android TV",
  "com.netflix.ninja": "Netflix",
  "com.tcl.live": "TCL Channel",
  "com.google.android.videos": "Google TV Film",
  "com.spotify.tv.android": "Spotify",
  "org.xbmc.kodi": "Kodi",
  "com.android.tv.settings": "Setelan TV",
  "com.google.android.tv.remote.service": "Remote",
};
export function namaAplikasi(paket: string): string {
  if (NAMA[paket]) return NAMA[paket];
  if (/tvinput|hdmi|tif/i.test(paket)) return "Input HDMI / sumber luar";
  return paket;
}

/** STATUS LAYAR (4 Okt 2026): TV yang "dimatikan" dengan tidur tetap hidup di jaringan, sehingga router saja
 *  menganggapnya menyala (laporan user: "dimatikan dari papan masih masuk list TV hidup"). Dibaca dari
 *  `mWakefulness` lewat ADB — CEPAT dan tanpa percobaan ulang (dipanggil untuk banyak TV sekaligus saat daftar
 *  dimuat), disinggahkan 60 detik. null = tidak bisa dibaca (ADB belum diizinkan / tidak menjawab). */
const SINGGAH_LAYAR = new Map<string, { t: number; v: "MENYALA" | "TIDUR" | null }>();
export async function statusLayar(ip: string): Promise<"MENYALA" | "TIDUR" | null> {
  const s = SINGGAH_LAYAR.get(ip);
  if (s && Date.now() - s.t < 60_000) return s.v;
  let v: "MENYALA" | "TIDUR" | null = null;
  try {
    await jalankan(["connect", `${ip}:${PORT}`], 5_000);
    const r = await jalankan(["-s", `${ip}:${PORT}`, "shell", "dumpsys power | grep -m1 mWakefulness="], 6_000);
    const t = r.keluar.toString("utf8");
    if (/mWakefulness=Awake/.test(t)) { v = "MENYALA"; void terapkanPenjaga(ip); }
    else if (/mWakefulness=(Asleep|Dozing|Dreaming)/.test(t)) v = "TIDUR";
  } catch { v = null; }
  SINGGAH_LAYAR.set(ip, { t: Date.now(), v });
  return v;
}

/** KEADAAN BOOT (5 Okt 2026) — untuk penjaga "menyala sendiri setelah listrik kembali" (layar-jadwal.ts).
 *  Satu perintah shell: lama menyala (detik, dari /proc/uptime), layar menyala/tidak, dan aplikasi depan.
 *  CEPAT & tanpa percobaan ulang karena dipanggil untuk semua TV tiap 5 menit di luar jam papan;
 *  null = TV tidak terjangkau (siaga dingin/mati) atau ADB belum diizinkan. */
export async function keadaanBoot(ip: string): Promise<{ uptimeDetik: number; menyala: boolean; paketDepan: string | null } | null> {
  try {
    await jalankan(["connect", `${ip}:${PORT}`], 5_000);
    const r = await jalankan(["-s", `${ip}:${PORT}`, "shell",
      "cat /proc/uptime; dumpsys power | grep -m1 mWakefulness=; dumpsys activity activities | grep -m1 -E 'mResumedActivity|topResumedActivity'"], 8_000);
    const t = r.keluar.toString("utf8");
    const up = Number(t.match(/^\s*([\d.]+)\s/)?.[1]);
    if (!Number.isFinite(up)) return null;
    return {
      uptimeDetik: Math.floor(up),
      menyala: /mWakefulness=Awake/.test(t),
      paketDepan: t.match(/Activit[a-z]*Record\{\S+ \S+ ([A-Za-z0-9_.]+)\//)?.[1] ?? null,
    };
  } catch { return null; }
}
