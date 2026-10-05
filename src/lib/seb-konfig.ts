import "server-only";
import { createHash } from "crypto";
import { ALAMAT_APLIKASI } from "@/lib/alamat-aplikasi";

/** BERKAS KONFIGURASI SAFE EXAM BROWSER (.seb) dibangkitkan situs (4 Oktober 2026).
 *
 * Dulu petugas harus menyusun berkas sendiri di SEB Configuration Tool lalu menempel Browser Exam
 * Key — langkah yang tidak pernah terjadi, karena isian kuncinya bahkan tidak ada di layar. Sekarang
 * berkas diunduh dari Pengaturan Ujian, dibuka di komputer lab, dan SEB langsung menuju situs.
 *
 * Bentuk berkas: plist XML TANPA enkripsi (bentuk yang sama dengan yang dibangkitkan modul SEB
 * Moodle — SEB menerimanya langsung). Sandi keluar disimpan sebagai SHA-256, bukan teks asli.
 *
 * CONFIG KEY = SHA-256 dari JSON pengaturan berkas ini: kunci kamus diurutkan (tanpa memandang huruf
 * besar/kecil), `originatorVersion` dibuang, tanpa spasi. SEB mengirim
 * `X-SafeExamBrowser-ConfigKeyHash = SHA256(URL + ConfigKey)` — kunci yang SAMA bisa dihitung server
 * dari berkas yang sama, jadi petugas tidak perlu menempel apa pun.
 *
 * Algoritmanya mengikuti dokumentasi SEB & implementasi Moodle, TETAPI belum bisa diuji dengan SEB
 * sungguhan dari server ini. Karena itu Config Key otomatis baru DIPAKAI MENGUNCI setelah satu kali
 * terbukti cocok di komputer lab (halaman /seb-uji, lihat src/lib/seb.ts) — kalau algoritmanya
 * ternyata meleset, ujian tidak terkunci mati. */

type Nilai = string | number | boolean | Nilai[] | { [k: string]: Nilai };

export function sandiSeb(sandi: string) {
  return createHash("sha256").update(sandi, "utf8").digest("hex");
}

/** Pengaturan SEB untuk ujian situs ini. `domain` = host situs (tanpa skema). */
export function pengaturanSeb(opsi: { sandiKeluar: string; alamat?: string }): Record<string, Nilai> {
  const alamat = (opsi.alamat ?? ALAMAT_APLIKASI).replace(/\/+$/, "");
  const host = new URL(alamat).host;
  return {
    originatorVersion: "SMK-AlMunawwir-CBT",
    sebConfigPurpose: 0,                 // 0 = memulai ujian (bukan mengatur klien)
    startURL: `${alamat}/ujian-online`,
    sendBrowserExamKey: true,            // kirim RequestHash & ConfigKeyHash di setiap permintaan
    allowQuit: true,
    hashedQuitPassword: opsi.sandiKeluar ? sandiSeb(opsi.sandiKeluar) : "",
    quitURL: `${alamat}/seb-selesai`,
    quitURLConfirm: false,
    browserViewMode: 1,                  // layar penuh
    mainBrowserWindowWidth: "100%",
    mainBrowserWindowHeight: "100%",
    allowBrowsingBackForward: false,
    browserWindowAllowReload: true,      // muat ulang diizinkan: layar ujian tahan putus & menyimpan jawaban
    showReloadButton: true,
    showTaskBar: true,
    showTime: true,
    showInputLanguage: true,
    allowDownUploads: true,              // soal berjenis Unggah
    allowAudioCapture: true,             // soal Jawaban Lisan (mikrofon)
    allowVideoCapture: false,
    allowSpellCheck: false,
    allowDictionaryLookup: false,
    enablePrintScreen: false,
    enablePrivateClipboard: true,
    enableRightMouse: false,
    allowPDFReaderToolbar: false,
    newBrowserWindowByLinkPolicy: 0,     // 0 = tautan yang membuka jendela baru diblokir
    newBrowserWindowByScriptPolicy: 0,
    enableAltTab: false,
    enableAltF4: false,
    enableAltEsc: false,
    enableCtrlEsc: false,
    enableStartMenu: false,
    enableEsc: false,
    enableF1: false, enableF3: false, enableF5: true, enableF6: false, enableF7: false,
    enableF8: false, enableF9: false, enableF10: false, enableF11: false, enableF12: false,
    killExplorerShell: false,
    monitorProcesses: true,
    allowVirtualMachine: false,
    enableURLFilter: true,
    enableURLContentFilter: false,
    URLFilterRules: [
      { active: true, regex: false, expression: `${host}/*`, action: 1 },
      { active: true, regex: false, expression: `*.${host}/*`, action: 1 },
    ],
  };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function plistNilai(v: Nilai, indent: string): string {
  if (typeof v === "boolean") return `${indent}<${v}/>`;
  if (typeof v === "number") return `${indent}<integer>${Math.trunc(v)}</integer>`;
  if (typeof v === "string") return `${indent}<string>${esc(v)}</string>`;
  if (Array.isArray(v)) return v.length
    ? `${indent}<array>\n${v.map(x => plistNilai(x, indent + "\t")).join("\n")}\n${indent}</array>`
    : `${indent}<array/>`;
  const isi = Object.entries(v).map(([k, x]) => `${indent}\t<key>${esc(k)}</key>\n${plistNilai(x, indent + "\t")}`).join("\n");
  return `${indent}<dict>\n${isi}\n${indent}</dict>`;
}

export function plistSeb(p: Record<string, Nilai>): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n${plistNilai(p, "")}\n</plist>\n`;
}

/** JSON kanonik SEB: kunci kamus terurut tanpa memandang huruf besar/kecil, tanpa spasi. */
function jsonKanonik(v: Nilai): string {
  if (Array.isArray(v)) return `[${v.map(jsonKanonik).join(",")}]`;
  if (v && typeof v === "object") {
    const kunci = Object.keys(v).sort((a, b) => {
      const x = a.toLowerCase(), y = b.toLowerCase();
      return x < y ? -1 : x > y ? 1 : 0;
    });
    return `{${kunci.map(k => `${JSON.stringify(k)}:${jsonKanonik(v[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}

export function configKeySeb(p: Record<string, Nilai>): string {
  const salinan = { ...p };
  delete salinan.originatorVersion;
  return createHash("sha256").update(jsonKanonik(salinan), "utf8").digest("hex");
}

/** Berkas + Config Key-nya sekaligus — keduanya dari objek yang SAMA supaya tidak pernah berbeda. */
export function susunKonfigSeb(sandiKeluar: string) {
  const p = pengaturanSeb({ sandiKeluar });
  return { xml: plistSeb(p), configKey: configKeySeb(p) };
}
