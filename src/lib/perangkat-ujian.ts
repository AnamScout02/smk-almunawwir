/** KUNCI PERANGKAT ujian — sisi browser.
 *
 * Tiap browser menyimpan satu ID acak. Server (jagaAttempt di src/lib/ujian-server.ts) mengikat
 * pengerjaan ke perangkat yang pertama membukanya; perangkat lain ditolak sampai pengawas menekan
 * "Reset Login". Nama header HARUS sama dengan `HEADER_PERANGKAT` di ujian-server.ts. */

export const HEADER_PERANGKAT = "x-perangkat-ujian";
const KUNCI = "smk-perangkat-ujian";

export function idPerangkat(): string {
  try {
    let id = localStorage.getItem(KUNCI);
    if (!id) {
      id = Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, "0")).join("");
      localStorage.setItem(KUNCI, id);
    }
    return id;
  } catch {
    // Penyimpanan diblokir (mode privat ketat) — pengerjaan tidak bisa dikunci ke perangkat ini.
    return "";
  }
}

/** `fetch` yang otomatis membawa ID perangkat. */
export function fetchUjian(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const p = idPerangkat();
  if (p) headers.set(HEADER_PERANGKAT, p);
  return fetch(url, { ...init, headers });
}

/** TENGGANG PENGAWASAN (22 Sep 2026): jendela izin mikrofon (Jawaban Lisan) membuat halaman kehilangan fokus sesaat —
 * tanpa tenggang ini terbaca "pindah tab" dan bisa MENGUNCI pengerjaan. Perekam memanggil `tahanPengawasan` tepat
 * sebelum meminta izin; pencatat pelanggaran di layar ujian melewati kejadian selama masa itu. */
let abaikanSampai = 0;
export const tahanPengawasan = (ms: number) => { abaikanSampai = Date.now() + ms; };
export const lepasPengawasan = () => { abaikanSampai = 0; };
export const pengawasanDitahan = () => Date.now() < abaikanSampai;

/** Jembatan untuk APLIKASI UJIAN ANDROID (22 Sep 2026): sebelum membuka pemilih berkas/kamera, aplikasi memanggil
 * `window.__ujianAplikasi.tahan(ms)` supaya layar sistem itu tidak tercatat "pindah tab", lalu `lepas()` sesudahnya. */
if (typeof window !== "undefined") {
  (window as unknown as { __ujianAplikasi?: object }).__ujianAplikasi = { tahan: tahanPengawasan, lepas: lepasPengawasan };
}
