import "server-only";
import { prisma } from "@/lib/prisma";
import { kodeBukuInduk, namaWilayah } from "@/lib/peta-sebaran";
import { bakuNamaSekolah, kunciSekolah } from "@/lib/nama-sekolah";

/** ANALISIS SEBARAN (8 Oktober 2026) — satu sumber untuk halaman Analisis, Excel alamat belum lengkap, dan Laporan
 *  Sebaran cetak. Semuanya dihitung dari Buku Induk (alamat → kode wilayah lewat `kodeBukuInduk`, pencocokan yang SAMA
 *  dengan Peta Sebaran) dan kolom `previousSchool`, dikelompokkan per ANGKATAN MASUK (`enrollYear`).
 *
 *  - Angkatan memakai SEMUA siswa yang pernah masuk (aktif, lulus, keluar, pindah) — yang dinilai adalah dari mana
 *    sekolah MENERIMA siswa, bukan siapa yang bertahan.
 *  - Sasaran promosi membandingkan PANGSA (persen dari siswa terpetakan pada periodenya), bukan jumlah mentah:
 *    kelengkapan alamat angkatan lama & baru berbeda, dan jumlah mentah akan menuduh daerah "menurun" padahal hanya
 *    alamatnya yang kosong. Hasilnya DAFTAR UNTUK DITINJAU panitia, bukan kesimpulan.
 *  - Alamat belum lengkap hanya untuk siswa AKTIF (alamat alumni tidak bisa lagi dilengkapi dari berkasnya dengan mudah). */

export type BarisWilayah = { kode: string; nama: string; kab: string; total: number; aktif: number; alumni: number; perTahun: Record<number, number> };
export type BarisSekolah = { nama: string; total: number; perTahun: Record<number, number> };
export type Geser = { jumlahLama: number; jumlahBaru: number; pangsaLama: number; pangsaBaru: number; arah: "turun" | "naik" | "tetap" };
export type Periode = { lama: number[]; baru: number[]; terpetakanLama: number; terpetakanBaru: number; bersekolahLama: number; bersekolahBaru: number };

/** Pergeseran PANGSA satu baris (kecamatan / sekolah asal) antara periode lama & baru. Ambang sengaja tidak peka:
 *  baris dengan segelintir siswa naik-turun karena kebetulan — "turun" butuh ≥5 siswa di periode lama dan pangsa
 *  tinggal ≤60%; "naik" butuh ≥5 siswa di periode baru dan pangsa ≥1,4×; KEDUANYA juga butuh selisih ≥1 poin persen
 *  (tanpa itu 6→5 siswa pun tertulis "tumbuh" hanya karena penyebutnya berbeda). Selebihnya "tetap". */
export function geser(perTahun: Record<number, number>, p: Periode, penyebut: "terpetakan" | "bersekolah"): Geser {
  const jl = p.lama.reduce((n, t) => n + (perTahun[t] ?? 0), 0), jb = p.baru.reduce((n, t) => n + (perTahun[t] ?? 0), 0);
  const dl = penyebut === "terpetakan" ? p.terpetakanLama : p.bersekolahLama, db = penyebut === "terpetakan" ? p.terpetakanBaru : p.bersekolahBaru;
  const pl = dl ? (jl / dl) * 100 : 0, pb = db ? (jb / db) * 100 : 0;
  const arah = !dl || !db || Math.abs(pb - pl) < 1 ? "tetap" : jl >= 5 && pb <= pl * 0.6 ? "turun" : jb >= 5 && pb >= pl * 1.4 ? "naik" : "tetap";
  return { jumlahLama: jl, jumlahBaru: jb, pangsaLama: pl, pangsaBaru: pb, arah };
}
export type SiswaAlamat = { id: string; nama: string; nis: string; sebab: string; tingkat: "kosong" | "kabupaten" };
export type AnalisisSebaran = {
  tahun: number[];
  tren: { tahun: number; jumlah: number; terpetakan: number }[];
  kecamatan: BarisWilayah[];
  sekolah: BarisSekolah[];
  tanpaSekolah: number;
  periode: Periode;
  belumLengkap: { kelas: string; siswa: SiswaAlamat[] }[];
  ringkas: { aktif: number; alumni: number; aktifTerpetakan: number; alumniTerpetakan: number; kabUtama: { kode: string; nama: string } | null };
};

const teks = (d: Record<string, unknown>, k: string) => (typeof d[k] === "string" ? (d[k] as string).trim() : "");

/** Apa yang kurang dari alamat ini supaya terpetakan sampai kecamatan (`kode` = hasil `kodeBukuInduk`). */
function sebabAlamat(d: Record<string, unknown>, kode: string): string {
  const kab = teks(d, "kabupaten"), kec = teks(d, "kecamatan");
  return !kode
    ? (!kab ? (kec || teks(d, "desa") ? "Kabupaten/kota belum diisi" : "Alamat belum diisi") : `Kabupaten/kota "${kab}" tidak dikenali`)
    : (!kec ? "Kecamatan belum diisi" : `Kecamatan "${kec}" tidak dikenali di kabupaten itu`);
}

/** Untuk SATU siswa (halaman wali kelas & antrean "Perlu tindakan" siswa): null = alamat sudah terpetakan sampai
 *  kecamatan, selain itu teks apa yang kurang. Aturannya sama persis dengan daftar Alamat Belum Lengkap. */
export async function alamatKurang(bukuIndukData: unknown): Promise<string | null> {
  const d = (bukuIndukData ?? {}) as Record<string, unknown>;
  const kode = await kodeBukuInduk(d);
  return kode.length >= 8 ? null : sebabAlamat(d, kode);
}

let singgah: { waktu: number; isi: AnalisisSebaran } | null = null;
export async function analisisSebaran(): Promise<AnalisisSebaran> {
  if (singgah && Date.now() - singgah.waktu < 10 * 60_000) return singgah.isi;
  const siswa = await prisma.student.findMany({
    select: {
      id: true, nis: true, enrollYear: true, studentStatus: true, previousSchool: true, bukuIndukData: true,
      user: { select: { name: true } }, class: { select: { name: true, grade: true } },
    },
  });

  const wil = new Map<string, BarisWilayah>();
  const sek = new Map<string, { varian: Map<string, number>; total: number; perTahun: Record<number, number> }>();
  const trenMap = new Map<number, { jumlah: number; terpetakan: number }>();
  const kabAktif = new Map<string, number>();
  const kelasMap = new Map<string, { urut: string; siswa: SiswaAlamat[] }>();
  const ringkas = { aktif: 0, alumni: 0, aktifTerpetakan: 0, alumniTerpetakan: 0 };
  let tanpaSekolah = 0;

  for (const s of siswa) {
    const d = (s.bukuIndukData ?? {}) as Record<string, unknown>;
    const kode = await kodeBukuInduk(d);
    const th = s.enrollYear ?? 0;
    const aktif = s.studentStatus === "AKTIF", lulus = s.studentStatus === "LULUS";
    if (aktif) { ringkas.aktif++; if (kode) ringkas.aktifTerpetakan++; }
    if (lulus) { ringkas.alumni++; if (kode) ringkas.alumniTerpetakan++; }
    if (aktif && kode) kabAktif.set(kode.slice(0, 5), (kabAktif.get(kode.slice(0, 5)) ?? 0) + 1);

    if (th) {
      const t = trenMap.get(th) ?? { jumlah: 0, terpetakan: 0 };
      t.jumlah++; if (kode.length >= 8) t.terpetakan++;
      trenMap.set(th, t);
    }
    if (kode.length >= 8) {
      const kk = kode.slice(0, 8);
      let w = wil.get(kk);
      if (!w) { w = { kode: kk, nama: "", kab: "", total: 0, aktif: 0, alumni: 0, perTahun: {} }; wil.set(kk, w); }
      w.total++; if (aktif) w.aktif++; if (lulus) w.alumni++;
      if (th) w.perTahun[th] = (w.perTahun[th] ?? 0) + 1;
    }

    const kunci = kunciSekolah(s.previousSchool);
    if (kunci) {
      let x = sek.get(kunci);
      if (!x) { x = { varian: new Map(), total: 0, perTahun: {} }; sek.set(kunci, x); }
      const baku = bakuNamaSekolah(s.previousSchool);
      x.varian.set(baku, (x.varian.get(baku) ?? 0) + 1);
      x.total++; if (th) x.perTahun[th] = (x.perTahun[th] ?? 0) + 1;
    } else tanpaSekolah++;

    if (aktif && kode.length < 8) {
      const sebab = sebabAlamat(d, kode);
      const nama = s.class?.name ?? "Belum ada kelas";
      const k = kelasMap.get(nama) ?? { urut: `${s.class ? String(s.class.grade).padStart(2, "0") : "99"}${nama}`, siswa: [] };
      k.siswa.push({ id: s.id, nama: s.user.name, nis: s.nis ?? "", sebab, tingkat: kode ? "kabupaten" : "kosong" });
      kelasMap.set(nama, k);
    }
  }

  for (const w of wil.values()) { w.nama = await namaWilayah(w.kode); w.kab = await namaWilayah(w.kode.slice(0, 5)); }
  const kecamatan = [...wil.values()].sort((a, b) => b.total - a.total || a.nama.localeCompare(b.nama, "id"));
  const sekolah = [...sek.values()].map(x => ({
    nama: [...x.varian].sort((a, b) => b[1] - a[1])[0][0], total: x.total, perTahun: x.perTahun,
  })).sort((a, b) => b.total - a.total || a.nama.localeCompare(b.nama, "id"));

  const tahun = [...trenMap.keys()].sort((a, b) => a - b);
  const baru = tahun.slice(-3), lama = tahun.slice(0, -3).slice(-5);
  const jumlahTren = (th: number[], k: "terpetakan") => th.reduce((n, t) => n + (trenMap.get(t)?.[k] ?? 0), 0);
  const bersekolah = (th: number[]) => sekolah.reduce((n, x) => n + th.reduce((m, t) => m + (x.perTahun[t] ?? 0), 0), 0);
  const periode: Periode = {
    lama, baru, terpetakanLama: jumlahTren(lama, "terpetakan"), terpetakanBaru: jumlahTren(baru, "terpetakan"),
    bersekolahLama: bersekolah(lama), bersekolahBaru: bersekolah(baru),
  };

  const kabTeratas = [...kabAktif].sort((a, b) => b[1] - a[1])[0]?.[0];
  const isi: AnalisisSebaran = {
    tahun,
    tren: tahun.map(t => ({ tahun: t, ...trenMap.get(t)! })),
    kecamatan, sekolah, tanpaSekolah,
    periode,
    belumLengkap: [...kelasMap].sort((a, b) => a[1].urut.localeCompare(b[1].urut, "id"))
      .map(([kelas, v]) => ({ kelas, siswa: v.siswa.sort((a, b) => a.nama.localeCompare(b.nama, "id")) })),
    ringkas: { ...ringkas, kabUtama: kabTeratas ? { kode: kabTeratas, nama: await namaWilayah(kabTeratas) } : null },
  };
  singgah = { waktu: Date.now(), isi };
  return isi;
}

/** Periode pembanding untuk rentang yang DIPILIH petugas ("dari tahun … sampai …"): baru = 3 angkatan terakhir pada
 *  rentang, lama = SEMUA angkatan sebelumnya di rentang itu. Batas "5 angkatan" hanya berlaku untuk periode bawaan —
 *  kalau petugas sengaja memilih 2014–2025, tahun 2014–2017 harus ikut dihitung (temuan user 8 Okt 2026). */
export function periodeDari(a: AnalisisSebaran, tahun: number[]): Periode {
  const baru = tahun.slice(-3), lama = tahun.slice(0, -3);
  const terpetakan = (th: number[]) => a.tren.filter(t => th.includes(t.tahun)).reduce((n, t) => n + t.terpetakan, 0);
  const bersekolah = (th: number[]) => a.sekolah.reduce((n, x) => n + th.reduce((m, t) => m + (x.perTahun[t] ?? 0), 0), 0);
  return { lama, baru, terpetakanLama: terpetakan(lama), terpetakanBaru: terpetakan(baru), bersekolahLama: bersekolah(lama), bersekolahBaru: bersekolah(baru) };
}

