// Jembatan yang SAMA namanya dengan aplikasi Android (window.AplikasiSMK), supaya halaman ujian tidak perlu tahu
// ia berjalan di HP atau di komputer lab.
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("AplikasiSMK", {
  modeUjian: aktif => ipcRenderer.send("mode-ujian", !!aktif),
  sedangModeUjian: () => ipcRenderer.invoke("sedang-mode-ujian"),
  versi: () => "1.0",
  cetak: () => {},
});
// Dipakai halaman offline.html: kembali ke alamat yang gagal dimuat (diperiksa main.js — hanya situs sekolah).
contextBridge.exposeInMainWorld("muatUlang", ke => ipcRenderer.send("muat-ulang", String(ke || "")));
