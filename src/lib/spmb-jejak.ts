/** Tahap corong pendaftaran SPMB — satu daftar untuk pencatat (browser), rute penerima, dan
 *  halaman statistik panitia. Urutannya = urutan corong. */
export const TAHAP_JEJAK = [
  { kode: "KUNJUNG", label: "Membuka halaman SPMB" },
  { kode: "MULAI", label: "Mulai mengisi formulir" },
  { kode: "LANGKAH_2", label: "Sampai langkah 2 (Kontak & Alamat)" },
  { kode: "LANGKAH_3", label: "Sampai langkah 3 (Sekolah & Pilihan)" },
  { kode: "LANGKAH_4", label: "Sampai langkah 4 (Berkas)" },
  { kode: "KIRIM", label: "Berhasil mendaftar" },
] as const;
/** Bukan bagian corong, dihitung terpisah. */
export const TAHAP_LAIN = [{ kode: "KUIS", label: "Menyelesaikan kuis jurusan" }] as const;
export const SEMUA_TAHAP = new Set<string>([...TAHAP_JEJAK, ...TAHAP_LAIN].map(t => t.kode));

const KUNCI_SESI = "spmb-sesi";

/** Dipanggil dari browser. Tanpa data pribadi: hanya id acak per peramban + nama tahap. Tiap tahap
 *  dikirim SEKALI per tab (sessionStorage), dan server menolak duplikat per (sesi, tahap). Gagal
 *  diam-diam — statistik tidak boleh mengganggu pendaftaran. */
export function catatJejak(tahap: string) {
  try {
    if (typeof window === "undefined" || !SEMUA_TAHAP.has(tahap)) return;
    // Halaman yang sedang DIPRA-MUAT (Speculation Rules) belum dilihat siapa pun — catat saat dibuka.
    const d = document as Document & { prerendering?: boolean };
    if (d.prerendering) {
      document.addEventListener("prerenderingchange", () => catatJejak(tahap), { once: true });
      return;
    }
    let sesi = localStorage.getItem(KUNCI_SESI);
    if (!sesi || !/^[a-z0-9]{20}$/.test(sesi)) {
      const b = new Uint8Array(10);
      crypto.getRandomValues(b);
      sesi = Array.from(b, x => x.toString(36).padStart(2, "0").slice(-2)).join("");
      localStorage.setItem(KUNCI_SESI, sesi);
    }
    const tanda = `spmb-jejak:${tahap}`;
    if (sessionStorage.getItem(tanda)) return;
    sessionStorage.setItem(tanda, "1");
    const isi = JSON.stringify({ sesi, tahap });
    if (!navigator.sendBeacon?.("/api/public/spmb-jejak", new Blob([isi], { type: "application/json" }))) {
      fetch("/api/public/spmb-jejak", { method: "POST", headers: { "Content-Type": "application/json" }, body: isi, keepalive: true })
        .catch(() => {});
    }
  } catch { /* mode privat / penyimpanan diblokir */ }
}
