/** ANTREAN JURNAL PKL (9 Okt 2026) — jurnal yang gagal terkirim karena sinyal putus disimpan di HP (IndexedDB,
 *  termasuk fotonya) lalu dikirim sendiri saat sinyal kembali. Banyak tempat PKL bersinyal lemah; tanpa ini siswa
 *  harus mengetik ulang.
 *
 *  Batas yang jujur: foto dalam antrean baru sampai ke server SAAT TERKIRIM, jadi cap "foto kamera" memakai waktu
 *  kirim — dan hanya diberikan bila terkirim di HARI yang sama dengan tanggal jurnalnya. Jurnal yang baru terkirim
 *  esok harinya tetap tersimpan, fotonya bertanda "waktu tidak terverifikasi". */

export type JurnalTunda = {
  id: string; date: string; activity: string; kompetensi: string[];
  lokasi: { lat: number; lng: number; akurasi: number } | null;
  foto: Blob | null; dibuat: number;
};

const NAMA_DB = "pkl-jurnal", TOKO = "antrean";

function buka(): Promise<IDBDatabase> {
  return new Promise((ok, gagal) => {
    const r = indexedDB.open(NAMA_DB, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore(TOKO, { keyPath: "id" }); };
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

export const antreJurnal = (j: JurnalTunda) => jalan("readwrite", s => s.put(j));
export const daftarAntrean = () => jalan<JurnalTunda[]>("readonly", s => s.getAll()).catch(() => [] as JurnalTunda[]);
export const hapusAntrean = (id: string) => jalan("readwrite", s => s.delete(id));

/** Kirim seluruh antrean. Berhenti di kegagalan JARINGAN pertama (sinyal belum kembali); galat dari server
 *  (mis. bukan lagi peserta PKL) membuang butir itu supaya antrean tidak macet selamanya. Mengembalikan jumlah terkirim. */
export async function kirimAntrean(): Promise<number> {
  let terkirim = 0;
  for (const j of (await daftarAntrean()).sort((a, b) => a.dibuat - b.dibuat)) {
    try {
      let foto: { url: string; waktu: number; tanda: string } | null = null;
      if (j.foto) {
        const fd = new FormData();
        fd.append("file", new File([j.foto], "jurnal-pkl.jpg", { type: j.foto.type || "image/jpeg" }));
        const r = await fetch("/api/student/pkl/foto", { method: "POST", body: fd });
        if (r.ok) foto = await r.json();
        else if (r.status >= 500) return terkirim;
      }
      const r = await fetch("/api/student/pkl/journal", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: j.date, activity: j.activity, kompetensi: j.kompetensi, ...(j.lokasi ?? {}), ...(foto ? { photoUrl: foto.url, tanda: foto.tanda, waktuFoto: foto.waktu } : {}) }),
      });
      if (r.status >= 500) return terkirim;
      await hapusAntrean(j.id);
      if (r.ok) terkirim++;
    } catch {
      return terkirim; // jaringan masih putus
    }
  }
  return terkirim;
}
