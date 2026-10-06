// Jembatan yang SAMA namanya dengan aplikasi Android (window.AplikasiSMK), supaya halaman ujian tidak perlu tahu
// ia berjalan di HP atau di komputer lab.
const { contextBridge, ipcRenderer } = require("electron");
// Tanda "Layar dipantau pengawas" selama mode ujian (v1.1) — pemantauan layar tidak boleh diam-diam.
function tandaPantau(aktif) {
  const ada = document.getElementById("myalwis-tanda-pantau");
  if (!aktif) { if (ada) ada.remove(); return; }
  if (ada || !document.body) return;
  const el = document.createElement("div");
  el.id = "myalwis-tanda-pantau";
  el.textContent = "● Layar dipantau pengawas";
  el.style.cssText = "position:fixed;left:12px;bottom:12px;z-index:2147483647;pointer-events:none;"
    + "background:rgba(15,26,69,.85);color:#fff;font:600 12px/1 Segoe UI,Arial,sans-serif;padding:6px 10px;border-radius:999px";
  document.body.appendChild(el);
}
contextBridge.exposeInMainWorld("AplikasiSMK", {
  modeUjian: aktif => { ipcRenderer.send("mode-ujian", !!aktif); tandaPantau(!!aktif); },
  sedangModeUjian: () => ipcRenderer.invoke("sedang-mode-ujian"),
  versi: () => "1.1",
  cetak: () => {},
});
// Dipakai halaman offline.html: kembali ke alamat yang gagal dimuat (diperiksa main.js — hanya situs sekolah).
contextBridge.exposeInMainWorld("muatUlang", ke => ipcRenderer.send("muat-ulang", String(ke || "")));
