/** DETEKSI PENDAFTAR GANDA SPMB (8 Oktober 2026) — hitungan MURNI, netral (bukan `server-only`).
 *
 *  Calon mendaftar TANPA akun, jadi orang yang sama bisa mendaftar dua kali: lupa nomor lalu mengisi
 *  ulang, orang tua dan anak sama-sama mengisi, atau pindah gelombang. Baris kembar menggandakan
 *  hitungan kuota, peringkat, dan pesanan seragam.
 *
 *  Hasilnya DAFTAR UNTUK DIPERIKSA, bukan keputusan: tidak ada baris yang dihapus atau digabung
 *  otomatis. Dua tingkat keyakinan:
 *   - PASTI  : NIK sama, atau NISN sama (nomor itu milik satu orang).
 *   - MIRIP  : tanggal lahir sama + nama mirip; atau nama sama + nomor WhatsApp sama (tanggal lahir
 *              salah ketik).
 *  Anak KEMBAR lahir di hari yang sama dengan nama yang mirip — karena itu pasangan yang KEDUANYA
 *  punya NIK sah dan NIK-nya berbeda tidak ditandai, kecuali namanya persis sama. Sisanya bisa
 *  ditandai "bukan ganda" oleh panitia (`abaikan`). */

export type CalonGanda = {
  id: string; nama: string;
  /** Tanggal lahir "YYYY-MM-DD". */
  lahir: string;
  nik?: string | null; nisn?: string | null; phone?: string | null;
};

export type AlasanGanda = "NIK" | "NISN" | "NAMA_LAHIR" | "MIRIP_LAHIR" | "NAMA_WA";

export const LABEL_ALASAN: Record<AlasanGanda, string> = {
  NIK: "NIK sama",
  NISN: "NISN sama",
  NAMA_LAHIR: "Nama & tanggal lahir sama",
  MIRIP_LAHIR: "Tanggal lahir sama, nama mirip",
  NAMA_WA: "Nama & nomor WhatsApp sama",
};

export type PasanganGanda = { a: string; b: string; alasan: AlasanGanda[] };
export type KelompokGanda = { anggota: string[]; pasti: boolean; alasan: AlasanGanda[]; pasangan: PasanganGanda[] };

/** Ragam tulisan "Muhammad" disamakan — "Moh. Rizki" dan "Muhammad Rizki" adalah orang yang sama. */
const MUHAMMAD = /^(MUHAMMAD|MUHAMAD|MOHAMMAD|MOHAMAD|MOCHAMMAD|MOCHAMAD|MUCHAMMAD|MUCHAMAD|MUKHAMMAD|MUKHAMAD|MOH|MUH|MOCH|MUCH|MHD|MD|M)$/;

export function kataNama(nama: string): string[] {
  return nama.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase()
    .replace(/['’`]/g, "").replace(/[^A-Z]+/g, " ").trim().split(" ")
    .filter(Boolean).map(k => (MUHAMMAD.test(k) ? "M" : k));
}
export const kunciNama = (nama: string) => kataNama(nama).join(" ");

function jarak(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 99;
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]; d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return d[b.length];
}

/** Nama mirip: salah ketik ≤2 huruf, atau yang satu adalah potongan yang lain ("Ahmad Fauzi" ⊂ "Ahmad Fauzi Ramadhan"). */
export function namaMirip(a: string, b: string): boolean {
  const ka = kataNama(a), kb = kataNama(b);
  if (!ka.length || !kb.length) return false;
  const sa = ka.join(" "), sb = kb.join(" ");
  if (sa === sb) return true;
  const [pendek, panjang] = ka.length <= kb.length ? [ka, kb] : [kb, ka];
  // Potongan: semua kata nama yang lebih pendek ada di nama yang lebih panjang, dan bukan hanya "M".
  // Tiap kata boleh meleset satu huruf ("Fauzi" / "Fauzy").
  const ada = (k: string) => panjang.some(p => p === k || (k.length >= 5 && jarak(k, p) <= 1));
  if (pendek.every(ada) && pendek.some(k => k.length >= 4)) return true;
  const ra = sa.replace(/ /g, ""), rb = sb.replace(/ /g, "");
  return Math.min(ra.length, rb.length) >= 6 && jarak(ra, rb) <= 2;
}

const sah = (v: string | null | undefined, n: number) => {
  const s = (v ?? "").replace(/\D/g, "");
  return s.length === n && !/^(\d)\1+$/.test(s) ? s : "";
};
/** Nomor WA dibandingkan dari 9 digit terakhirnya — "0812…", "62812…", dan "+62 812…" jadi sama. */
const ekorWa = (v: string | null | undefined) => {
  const s = (v ?? "").replace(/\D/g, "");
  return s.length >= 9 ? s.slice(-9) : "";
};

export const kunciPasangan = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function cariGanda(calon: CalonGanda[], abaikan: Iterable<string> = []): KelompokGanda[] {
  const lewati = new Set(abaikan);
  const siap = calon.map(c => ({ ...c, _nik: sah(c.nik, 16), _nisn: sah(c.nisn, 10), _wa: ekorWa(c.phone), _kunci: kunciNama(c.nama) }));
  type Siap = (typeof siap)[number];
  const pasangan = new Map<string, PasanganGanda>();
  const catat = (x: Siap, y: Siap, alasan: AlasanGanda) => {
    if (x.id === y.id) return;
    const k = kunciPasangan(x.id, y.id);
    if (lewati.has(k)) return;
    const p = pasangan.get(k) ?? { a: x.id < y.id ? x.id : y.id, b: x.id < y.id ? y.id : x.id, alasan: [] };
    if (!p.alasan.includes(alasan)) p.alasan.push(alasan);
    pasangan.set(k, p);
  };
  const ember = (kunci: (c: Siap) => string) => {
    const m = new Map<string, Siap[]>();
    for (const c of siap) { const k = kunci(c); if (k) (m.get(k) ?? m.set(k, []).get(k)!).push(c); }
    return [...m.values()].filter(v => v.length > 1);
  };
  const tiapPasang = (v: Siap[], f: (x: Siap, y: Siap) => void) => {
    for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) f(v[i], v[j]);
  };

  for (const v of ember(c => c._nik)) tiapPasang(v, (x, y) => catat(x, y, "NIK"));
  for (const v of ember(c => c._nisn)) tiapPasang(v, (x, y) => catat(x, y, "NISN"));
  for (const v of ember(c => c.lahir)) tiapPasang(v, (x, y) => {
    const sama = x._kunci === y._kunci;
    // Kembar: dua NIK sah yang berbeda = dua orang, kecuali namanya persis sama (NIK salah ketik).
    if (!sama && x._nik && y._nik && x._nik !== y._nik) return;
    if (!sama && x._nisn && y._nisn && x._nisn !== y._nisn) return;
    if (sama) catat(x, y, "NAMA_LAHIR");
    else if (namaMirip(x.nama, y.nama)) catat(x, y, "MIRIP_LAHIR");
  });
  for (const v of ember(c => (c._wa && c._kunci ? `${c._kunci}#${c._wa}` : ""))) {
    tiapPasang(v, (x, y) => { if (x.lahir !== y.lahir) catat(x, y, "NAMA_WA"); });
  }

  // Gabungkan pasangan jadi kelompok (A=B dan B=C → satu kelompok tiga baris).
  const induk = new Map<string, string>();
  const cari = (x: string): string => { const p = induk.get(x) ?? x; if (p === x) return x; const r = cari(p); induk.set(x, r); return r; };
  for (const p of pasangan.values()) { const ra = cari(p.a), rb = cari(p.b); if (ra !== rb) induk.set(ra, rb); }
  const kel = new Map<string, KelompokGanda>();
  for (const p of pasangan.values()) {
    const r = cari(p.a);
    const g = kel.get(r) ?? { anggota: [], pasti: false, alasan: [], pasangan: [] };
    for (const id of [p.a, p.b]) if (!g.anggota.includes(id)) g.anggota.push(id);
    for (const a of p.alasan) if (!g.alasan.includes(a)) g.alasan.push(a);
    if (p.alasan.includes("NIK") || p.alasan.includes("NISN")) g.pasti = true;
    g.pasangan.push(p);
    kel.set(r, g);
  }
  return [...kel.values()].sort((a, b) => Number(b.pasti) - Number(a.pasti) || b.anggota.length - a.anggota.length);
}
