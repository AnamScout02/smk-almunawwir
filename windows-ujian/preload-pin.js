const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("pinKeluar", {
  kirim: kode => ipcRenderer.invoke("pin-kirim", kode),
  batal: () => ipcRenderer.send("pin-batal"),
});
contextBridge.exposeInMainWorld("muatUlang", ke => ipcRenderer.send("muat-ulang", ke));
