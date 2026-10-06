/* MyAlwis Ujian — browser ujian Windows (4 Oktober 2026).
 *
 * Padanan Exambrowser ANBK untuk CBT sekolah, kode sendiri (Electron). Yang dilakukan:
 *  - Layar penuh kiosk + selalu di atas jendela lain sejak dibuka; tanpa bilah alamat, menu, alat pengembang.
 *  - Hanya membuka situs sekolah: tautan & jendela baru ke alamat lain ditolak.
 *  - Sesi TIDAK disimpan ke disk (partisi memori) — komputer lab dipakai bergantian.
 *  - Saat halaman pengerjaan memanggil `AplikasiSMK.modeUjian(true)` (sama dengan aplikasi Android):
 *    tangkapan/rekam layar diblokir (setContentProtection) dan keluar WAJIB PIN pengawas
 *    (/api/ujian/aplikasi/keluar — pintu yang sama dengan aplikasi Android).
 *  Batas yang jujur: Ctrl+Alt+Del dan tombol Windows tidak bisa dicegat aplikasi biasa. Jendela tetap
 *  menutupi layar, dan situs mencatat setiap kali fokus berpindah. Untuk kunci tingkat sistem, pakai
 *  Safe Exam Browser (berkasnya diunduh dari Pengaturan Ujian). */
const { app, BrowserWindow, session, ipcMain, dialog } = require("electron");
const path = require("path");

const ALAMAT = process.env.MYALWIS_ALAMAT || "https://smkalmunawwiriibs.sch.id";
const AWAL = `${ALAMAT}/ujian-online`;
const HOST = new URL(ALAMAT).host;
const VERSI = "1.1";

let win = null;
let pin = null;          // jendela PIN keluar
let modeUjian = false;
let bolehTutup = false;
let pewaktuPotret = null;

/* LAYAR PROKTOR (v1.1, 5 Okt 2026): selama mode ujian, potret JENDELA UJIAN ini (bukan seluruh desktop) dikirim
   tiap 10 detik ke server untuk kisi "Layar Peserta" di Papan Pantau pengawas. Server hanya menyimpan potret
   terakhir di memori. Peserta diberi tahu lewat tanda di layar (preload.js). */
function idUjianDariUrl() {
  try { return new URL(win.webContents.getURL()).pathname.match(/^\/ujian-online\/([A-Za-z0-9_-]+)/)?.[1] ?? null; }
  catch { return null; }
}
async function kirimPotret() {
  if (!win || win.isDestroyed() || !modeUjian) return;
  const examId = idUjianDariUrl();
  if (!examId) return;
  try {
    const gambar = await win.webContents.capturePage();
    const kecil = gambar.resize({ width: 640, quality: "good" }).toJPEG(55);
    await session.fromPartition("ujian").fetch(`${ALAMAT}/api/student/exams/${examId}/cuplikan`, {
      method: "POST", body: kecil,
      headers: { "Content-Type": "image/jpeg", "X-Fokus": win.isFocused() ? "1" : "0", "User-Agent": session.fromPartition("ujian").getUserAgent() },
    });
  } catch { /* jaringan putus — dicoba lagi di putaran berikutnya */ }
}

if (!app.requestSingleInstanceLock()) app.quit();
app.on("second-instance", () => { if (win) { win.show(); win.focus(); } });

const alamatSah = url => {
  try { const u = new URL(url); return u.protocol === "https:" && (u.host === HOST || u.host.endsWith(`.${HOST}`)); }
  catch { return false; }
};

function aturModeUjian(aktif) {
  modeUjian = !!aktif;
  if (!win) return;
  win.setContentProtection(modeUjian);
  win.setAlwaysOnTop(true, modeUjian ? "screen-saver" : "pop-up-menu");
  clearInterval(pewaktuPotret); pewaktuPotret = null;
  if (modeUjian) { setTimeout(kirimPotret, 3000); pewaktuPotret = setInterval(kirimPotret, 10_000); }
}

function buatJendela() {
  const ses = session.fromPartition("ujian"); // tanpa "persist:" = hanya di memori
  ses.setUserAgent(`${ses.getUserAgent().replace(/Electron\/\S+\s?/, "")} MyAlwisUjianWin/${VERSI}`);
  ses.setPermissionRequestHandler((_wc, izin, cb) => cb(izin === "media" || izin === "fullscreen" || izin === "clipboard-sanitized-write"));
  ses.on("will-download", e => e.preventDefault());

  win = new BrowserWindow({
    kiosk: true, fullscreen: true, alwaysOnTop: true, autoHideMenuBar: true, show: false,
    backgroundColor: "#0F1A45", title: "MyAlwis Ujian",
    webPreferences: { session: ses, preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: true, devTools: false, spellcheck: false },
  });
  win.removeMenu();
  win.setAlwaysOnTop(true, "pop-up-menu");
  win.once("ready-to-show", () => win.show());
  win.loadURL(AWAL);

  const wc = win.webContents;
  wc.setWindowOpenHandler(({ url }) => { if (alamatSah(url)) wc.loadURL(url); return { action: "deny" }; });
  wc.on("will-navigate", (e, url) => { if (!alamatSah(url)) e.preventDefault(); });
  wc.on("will-redirect", (e, url) => { if (!alamatSah(url)) e.preventDefault(); });
  wc.on("context-menu", e => e.preventDefault());
  wc.on("did-fail-load", (_e, kode, _desk, url, utama) => {
    if (utama && kode !== -3) wc.loadFile(path.join(__dirname, "offline.html"), { query: { ke: url || AWAL } });
  });
  wc.on("before-input-event", (e, i) => {
    const k = i.key.toLowerCase();
    const ctrl = i.control || i.meta;
    const blokir =
      k === "f12" || k === "f11" || (ctrl && i.shift && ["i", "j", "c"].includes(k)) ||
      (ctrl && ["n", "t", "w", "o", "s", "p", "u", "+", "-", "=", "0"].includes(k)) ||
      (i.alt && ["f4", "arrowleft", "arrowright", "home"].includes(k)) || k === "browserback" || k === "browserforward";
    if (blokir) e.preventDefault();
    if (ctrl && i.shift && k === "q" && i.type === "keyDown") mintaKeluar();
  });
  win.on("close", e => { if (!bolehTutup) { e.preventDefault(); mintaKeluar(); } });
  // Fokus berpindah (Alt-Tab): jendela tetap di atas; situs yang mencatat pelanggarannya.
  win.on("blur", () => {
    if (!modeUjian) return;
    void kirimPotret(); // pengawas langsung melihat "tidak fokus", tidak menunggu putaran 10 detik
    if (!pin) setTimeout(() => win && !win.isDestroyed() && win.moveTop(), 150);
  });
}

async function mintaKeluar() {
  if (pin) { pin.focus(); return; }
  if (!modeUjian) {
    const { response } = await dialog.showMessageBox(win, {
      type: "question", buttons: ["Keluar", "Batal"], defaultId: 1, cancelId: 1,
      title: "MyAlwis Ujian", message: "Tutup MyAlwis Ujian?",
    });
    if (response === 0) { bolehTutup = true; app.quit(); }
    return;
  }
  pin = new BrowserWindow({
    parent: win, modal: true, width: 380, height: 300, resizable: false, minimizable: false, maximizable: false,
    alwaysOnTop: true, frame: false, backgroundColor: "#ffffff", show: false,
    webPreferences: { preload: path.join(__dirname, "preload-pin.js"), contextIsolation: true, sandbox: true, devTools: false },
  });
  pin.setAlwaysOnTop(true, "screen-saver");
  pin.loadFile(path.join(__dirname, "pin.html"));
  pin.once("ready-to-show", () => pin.show());
  pin.on("closed", () => { pin = null; });
}

ipcMain.on("mode-ujian", (_e, aktif) => aturModeUjian(aktif));
ipcMain.handle("sedang-mode-ujian", () => modeUjian);
ipcMain.handle("versi", () => VERSI);
ipcMain.on("pin-batal", () => pin && pin.close());
ipcMain.on("muat-ulang", (_e, ke) => { if (win && alamatSah(ke)) win.loadURL(ke); else if (win) win.loadURL(AWAL); });
// PIN diperiksa SERVER memakai sesi peserta (cookie partisi ujian) — PIN tidak pernah disimpan di aplikasi.
ipcMain.handle("pin-kirim", async (_e, kode) => {
  try {
    const r = await session.fromPartition("ujian").fetch(`${ALAMAT}/api/ujian/aplikasi/keluar`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: String(kode || "") }),
    });
    const d = await r.json().catch(() => ({}));
    if (d.ok) { bolehTutup = true; setImmediate(() => app.quit()); return { ok: true }; }
    return { ok: false, error: d.error || "PIN salah." };
  } catch { return { ok: false, error: "Tidak bisa menghubungi server. Minta bantuan pengawas." }; }
});

app.whenReady().then(buatJendela);
app.on("window-all-closed", () => app.quit());
