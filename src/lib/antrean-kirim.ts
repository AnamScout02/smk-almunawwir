/** ANTREAN KIRIM (10 Oktober 2026, pilihan user) — isian guru yang gagal terkirim karena SINYAL PUTUS (jurnal mengajar,
 *  absensi kelas) disimpan di perangkat (IndexedDB) lalu dikirim sendiri saat tersambung lagi. Pola jurnal PKL
 *  (src/lib/antrean-jurnal.ts) & layar ujian, dibuat umum supaya halaman lain tinggal memanggil `kirimAtauAntre`.
 *  Aturannya:
 *   - Yang diantrekan HANYA kegagalan jaringan / server tak menjawab (≥500). Penolakan server (4xx: nilai terkunci, bukan
 *     kelas Anda) TIDAK diantrekan — diulang pun hasilnya sama; pesannya langsung ditampilkan.
 *   - `kunci` satu per (jenis + kelas + mapel + tanggal): menyimpan ulang isian yang sama MENGGANTI antreannya, bukan menumpuk.
 *   - Rute tujuannya harus aman dikirim ulang (jurnal & absensi menghapus-lalu-menulis untuk tanggal itu).
 *   - Yang ditahan hanya KIRIMAN. Halaman tetap perlu sinyal untuk dibuka pertama kali (daftar siswa diambil dari server). */
export type KirimanTunda = { kunci: string; url: string; isi: unknown; label: string; dibuat: number };

const NAMA_DB = "antrean-kirim", TOKO = "kiriman";
export const PERISTIWA_ANTREAN = "antrean-kirim-berubah";
const kabari = () => { try { window.dispatchEvent(new Event(PERISTIWA_ANTREAN)); } catch { /* bukan di peramban */ } };

function buka(): Promise<IDBDatabase> {
  return new Promise((ok, gagal) => {
    const r = indexedDB.open(NAMA_DB, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore(TOKO, { keyPath: "kunci" }); };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => gagal(r.error);
  });
}
function jalan<T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return buka().then(db => new Promise<T>((ok, gagal) => {
    const tx = db.transaction(TOKO, mode), q = f(tx.objectStore(TOKO));
    q.onsuccess = () => ok(q.result);
    q.onerror = () => gagal(q.error);
    tx.oncomplete = () => db.close();
  }));
}
export const daftarKiriman = () => jalan<KirimanTunda[]>("readonly", s => s.getAll()).catch(() => [] as KirimanTunda[]);
const hapus = (kunci: string) => jalan("readwrite", s => s.delete(kunci)).catch(() => null);

const kirim = (k: { url: string; isi: unknown }) => fetch(k.url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(k.isi) });

/** Kirim sekarang; kalau jaringan putus / server tak menjawab → masuk antrean. `antre: true` = belum sampai ke server.
 *  Bila perangkat tidak bisa menyimpan antrean (mode privat), `antre` false dan `res` null: pemanggil menampilkan galat biasa. */
export async function kirimAtauAntre(k: Omit<KirimanTunda, "dibuat">): Promise<{ antre: boolean; res: Response | null }> {
  let res: Response | null = null;
  try { res = await kirim(k); } catch { res = null; }
  if (res && res.status < 500) { await hapus(k.kunci); kabari(); return { antre: false, res }; }
  const tersimpan = await jalan("readwrite", s => s.put({ ...k, dibuat: Date.now() })).then(() => true).catch(() => false);
  kabari();
  return { antre: tersimpan, res: tersimpan ? null : res };
}

/** Kirim seluruh antrean, yang terlama dulu. Berhenti di kegagalan jaringan pertama. */
export async function kirimSemuaAntrean(): Promise<{ terkirim: string[]; ditolak: { label: string; pesan: string }[]; sisa: number }> {
  const terkirim: string[] = [], ditolak: { label: string; pesan: string }[] = [];
  const semua = (await daftarKiriman()).sort((a, b) => a.dibuat - b.dibuat);
  let i = 0;
  for (; i < semua.length; i++) {
    const k = semua[i];
    let res: Response;
    try { res = await kirim(k); } catch { break; }
    if (res.status >= 500) break;
    await hapus(k.kunci);
    if (res.ok) terkirim.push(k.label);
    else ditolak.push({ label: k.label, pesan: (await res.json().catch(() => null))?.error ?? `ditolak server (${res.status})` });
  }
  if (terkirim.length || ditolak.length) kabari();
  return { terkirim, ditolak, sisa: semua.length - i };
}
