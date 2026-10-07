/** ALOKASI DANA IURAN (6 Oktober 2026) — hitungan MURNI, dipakai layar, cetak, dan Excel supaya angkanya selalu sama.
 *  Netral (bukan `server-only`): penyunting klien menghitung ulang seketika saat angka diubah.
 *
 *  Permintaan user: "1 angkatan kelas 10 ada 120 anak, setiap anak 200.000 per bulan, lalu pembagian alokasi persentase
 *  untuk kesiswaan sekian persen, kegiatan umum sekian persen … rincian lengkap". Keputusan user: pos BOLEH BEDA per
 *  angkatan, ada REALISASI (uang masuk & pengeluaran per pos), dan "hanya untuk perhitungan" (tanpa pengesahan).
 *
 *  Aturan hitung (sengaja dijaga, jangan diubah diam-diam):
 *  - Pemasukan per bulan = (siswa − siswa keringanan) × iuran + Σ keringanan (jumlah × iuran khususnya).
 *  - Pos NOMINAL (rupiah per siswa per bulan, mis. asuransi) diambil DULU dari pemasukan, untuk SEMUA siswa angkatan itu.
 *    Sisanya dibagi ke pos PERSEN.
 *  - Rupiah selalu bilangan bulat: tiap pos persen DIBULATKAN KE BAWAH, lalu SISA PEMBULATAN masuk ke pos penampung
 *    (pilihan rencana; kosong = pos persen pertama) — jadi jumlah semua pos SELALU sama dengan pemasukan.
 *  - Bila total persen BUKAN 100, selisihnya TIDAK disebar diam-diam: tampil sebagai "Belum dialokasikan" + peringatan.
 */

export type JenisPos = "PERSEN" | "NOMINAL";
export interface PosAlokasi { nama: string; jenis: JenisPos; nilai: number }
export interface Keringanan { label: string; jumlah: number; iuran: number }
export interface AngkatanMasuk {
  id?: string; nama: string; tingkat: number | null; jumlahSiswa: number; iuran: number;
  keringanan: Keringanan[]; pos: PosAlokasi[];
}
export interface OpsiRencana { bulan: number; posPenampung?: string | null }

export const BELUM_DIALOKASIKAN = "Belum dialokasikan";

export interface HasilPos {
  nama: string; jenis: JenisPos; nilai: number;
  perBulan: number; perSemester: number; perTahun: number;
  /** Rata-rata per siswa per bulan (bisa pecahan bila ada keringanan / pembulatan). */
  perSiswa: number;
  /** Porsi sebenarnya terhadap pemasukan (%), berguna untuk pos nominal. */
  porsi: number;
  dapatSisaPembulatan: number;
}
export interface HasilAngkatan {
  id?: string; nama: string; tingkat: number | null; jumlahSiswa: number; iuran: number;
  siswaKeringanan: number; pemasukanBulan: number; pemasukanSemester: number; pemasukanTahun: number;
  pos: HasilPos[]; totalPersen: number; belumDialokasikan: number; peringatan: string[];
}

const bulat = (n: unknown) => { const x = Math.round(Number(n)); return Number.isFinite(x) ? x : 0; };
const kunciPos = (n: string) => n.trim().toLowerCase().replace(/\s+/g, " ");
const rupiah = (n: number) => `Rp${Math.round(n).toLocaleString("id-ID")}`;

/** Rapikan isian dari browser/DB — angka negatif & pos tanpa nama dibuang, persen dibatasi 0–100. */
export function rapikanAngkatan(a: Partial<AngkatanMasuk>): AngkatanMasuk {
  const pos = (Array.isArray(a.pos) ? a.pos : [])
    .map(p => ({ nama: String(p?.nama ?? "").trim().slice(0, 80), jenis: (p?.jenis === "NOMINAL" ? "NOMINAL" : "PERSEN") as JenisPos, nilai: Number(p?.nilai) || 0 }))
    .filter(p => p.nama)
    .map(p => ({ ...p, nilai: p.jenis === "PERSEN" ? Math.min(100, Math.max(0, Math.round(p.nilai * 100) / 100)) : Math.max(0, bulat(p.nilai)) }));
  const keringanan = (Array.isArray(a.keringanan) ? a.keringanan : [])
    .map(k => ({ label: String(k?.label ?? "").trim().slice(0, 60) || "Keringanan", jumlah: Math.max(0, bulat(k?.jumlah)), iuran: Math.max(0, bulat(k?.iuran)) }))
    .filter(k => k.jumlah > 0);
  return {
    id: a.id, nama: String(a.nama ?? "").trim().slice(0, 60) || "Angkatan",
    tingkat: a.tingkat == null || a.tingkat === ("" as unknown) ? null : bulat(a.tingkat),
    jumlahSiswa: Math.max(0, bulat(a.jumlahSiswa)), iuran: Math.max(0, bulat(a.iuran)), keringanan, pos,
  };
}

export function hitungAngkatan(masuk: AngkatanMasuk, opsi: OpsiRencana): HasilAngkatan {
  const a = rapikanAngkatan(masuk);
  const bulan = Math.max(1, bulat(opsi.bulan) || 12);
  const peringatan: string[] = [];
  const siswaKeringananMentah = a.keringanan.reduce((s, k) => s + k.jumlah, 0);
  const siswaKeringanan = Math.min(siswaKeringananMentah, a.jumlahSiswa);
  if (siswaKeringananMentah > a.jumlahSiswa) peringatan.push(`Siswa keringanan (${siswaKeringananMentah}) melebihi jumlah siswa (${a.jumlahSiswa}).`);
  // Keringanan yang melebihi jumlah siswa dipotong dari baris terakhir supaya pemasukan tidak dihitung dari siswa fiktif.
  let jatah = a.jumlahSiswa;
  const pemasukanKeringanan = a.keringanan.reduce((s, k) => { const n = Math.min(k.jumlah, jatah); jatah -= n; return s + n * k.iuran; }, 0);
  const pemasukanBulan = (a.jumlahSiswa - siswaKeringanan) * a.iuran + pemasukanKeringanan;
  if (a.jumlahSiswa > 0 && a.iuran === 0 && pemasukanKeringanan === 0) peringatan.push("Iuran per siswa belum diisi.");

  const nominal = a.pos.filter(p => p.jenis === "NOMINAL");
  const persen = a.pos.filter(p => p.jenis === "PERSEN");
  const totalNominal = nominal.reduce((s, p) => s + p.nilai * a.jumlahSiswa, 0);
  const sisaBagi = Math.max(0, pemasukanBulan - totalNominal);
  if (totalNominal > pemasukanBulan) peringatan.push(`Pos nominal (${rupiah(totalNominal)}/bulan) melebihi pemasukan (${rupiah(pemasukanBulan)}/bulan).`);
  const totalPersen = Math.round(persen.reduce((s, p) => s + p.nilai, 0) * 100) / 100;
  const persenPas = Math.abs(totalPersen - 100) < 0.005;
  if (persen.length && !persenPas) peringatan.push(`Total persen ${totalPersen.toLocaleString("id-ID")}% — harus 100% supaya seluruh dana terbagi.`);
  if (!a.pos.length && pemasukanBulan > 0) peringatan.push("Belum ada pos alokasi.");

  const perBulanPos = new Map<PosAlokasi, number>();
  for (const p of nominal) perBulanPos.set(p, Math.min(p.nilai * a.jumlahSiswa, Number.MAX_SAFE_INTEGER));
  for (const p of persen) perBulanPos.set(p, Math.floor((sisaBagi * p.nilai) / 100));
  const teralokasi = [...perBulanPos.values()].reduce((s, v) => s + v, 0);
  let selisih = pemasukanBulan - teralokasi;
  // Sisa pembulatan (hanya bila persen sudah pas 100%) → pos penampung, supaya total pos = pemasukan persis.
  let penerimaSisa: PosAlokasi | undefined;
  if (persenPas && persen.length && selisih > 0) {
    penerimaSisa = persen.find(p => opsi.posPenampung && kunciPos(p.nama) === kunciPos(opsi.posPenampung)) ?? persen[0];
    perBulanPos.set(penerimaSisa, (perBulanPos.get(penerimaSisa) ?? 0) + selisih);
  }
  const sisaPembulatan = penerimaSisa ? selisih : 0;
  if (penerimaSisa) selisih = 0;

  const pos: HasilPos[] = a.pos.map(p => {
    const perBulan = perBulanPos.get(p) ?? 0;
    return {
      nama: p.nama, jenis: p.jenis, nilai: p.nilai,
      perBulan, perTahun: perBulan * bulan, perSemester: Math.round((perBulan * bulan) / 2),
      perSiswa: a.jumlahSiswa ? perBulan / a.jumlahSiswa : 0,
      porsi: pemasukanBulan ? (perBulan / pemasukanBulan) * 100 : 0,
      dapatSisaPembulatan: p === penerimaSisa ? sisaPembulatan : 0,
    };
  });
  return {
    id: a.id, nama: a.nama, tingkat: a.tingkat, jumlahSiswa: a.jumlahSiswa, iuran: a.iuran, siswaKeringanan,
    pemasukanBulan, pemasukanTahun: pemasukanBulan * bulan, pemasukanSemester: Math.round((pemasukanBulan * bulan) / 2),
    pos, totalPersen, belumDialokasikan: Math.max(0, selisih), peringatan,
  };
}

export interface RekapPos {
  nama: string; perAngkatan: Record<string, number>; perBulan: number; perSemester: number; perTahun: number; porsi: number;
}
export interface HasilRencana {
  bulan: number; angkatan: HasilAngkatan[]; rekap: RekapPos[];
  totalSiswa: number; pemasukanBulan: number; pemasukanSemester: number; pemasukanTahun: number; belumDialokasikanBulan: number;
}

/** Hitung seluruh angkatan + rekap per POS (pos bernama sama di angkatan berbeda dijumlahkan; huruf besar/kecil diabaikan). */
export function hitungRencana(angkatan: AngkatanMasuk[], opsi: OpsiRencana): HasilRencana {
  const bulan = Math.max(1, bulat(opsi.bulan) || 12);
  const hasil = angkatan.map(a => hitungAngkatan(a, { ...opsi, bulan }));
  const peta = new Map<string, RekapPos>();
  hasil.forEach((h, i) => {
    const kunciAngkatan = h.id ?? `#${i}`;
    for (const p of h.pos) {
      const k = kunciPos(p.nama);
      const r = peta.get(k) ?? { nama: p.nama, perAngkatan: {}, perBulan: 0, perSemester: 0, perTahun: 0, porsi: 0 };
      r.perAngkatan[kunciAngkatan] = (r.perAngkatan[kunciAngkatan] ?? 0) + p.perBulan;
      r.perBulan += p.perBulan;
      peta.set(k, r);
    }
  });
  const pemasukanBulan = hasil.reduce((s, h) => s + h.pemasukanBulan, 0);
  const rekap = [...peta.values()].map(r => ({
    ...r, perTahun: r.perBulan * bulan, perSemester: Math.round((r.perBulan * bulan) / 2),
    porsi: pemasukanBulan ? (r.perBulan / pemasukanBulan) * 100 : 0,
  }));
  const belum = hasil.reduce((s, h) => s + h.belumDialokasikan, 0);
  return {
    bulan, angkatan: hasil, rekap,
    totalSiswa: hasil.reduce((s, h) => s + h.jumlahSiswa, 0),
    pemasukanBulan, pemasukanTahun: pemasukanBulan * bulan, pemasukanSemester: Math.round((pemasukanBulan * bulan) / 2),
    belumDialokasikanBulan: belum,
  };
}

/* ------------------------------------------------------------- REALISASI */

export interface TransaksiMasuk { id: string; jenis: "MASUK" | "KELUAR"; angkatanId: string | null; pos: string | null; tanggal: string; jumlah: number; keterangan?: string | null }
export interface SaldoPos { nama: string; anggaranTahun: number; masuk: number; keluar: number; saldo: number; terpakai: number }
export interface HasilRealisasi { pos: SaldoPos[]; totalMasuk: number; totalKeluar: number; saldo: number }

/** Uang MASUK sebuah angkatan dibagi ke pos-posnya SESUAI PORSI RENCANA angkatan itu (jadi pos nominal & persen sama-sama
 *  ikut), dibulatkan ke bawah dengan sisa ke pos porsi terbesar. Porsi yang belum direncanakan (persen < 100%) dan uang
 *  masuk tanpa angkatan jatuh ke "Belum dialokasikan". KELUAR mengurangi pos yang disebut. */
export function hitungRealisasi(rencana: HasilRencana, transaksi: TransaksiMasuk[]): HasilRealisasi {
  const peta = new Map<string, SaldoPos>();
  const ambil = (nama: string) => {
    const k = kunciPos(nama);
    let s = peta.get(k);
    if (!s) { s = { nama, anggaranTahun: 0, masuk: 0, keluar: 0, saldo: 0, terpakai: 0 }; peta.set(k, s); }
    return s;
  };
  for (const r of rencana.rekap) ambil(r.nama).anggaranTahun = r.perTahun;
  const angkatanById = new Map(rencana.angkatan.filter(a => a.id).map(a => [a.id!, a]));

  for (const t of transaksi) {
    const jumlah = Math.max(0, bulat(t.jumlah));
    if (t.jenis === "KELUAR") { ambil(t.pos?.trim() || BELUM_DIALOKASIKAN).keluar += jumlah; continue; }
    const a = t.angkatanId ? angkatanById.get(t.angkatanId) : undefined;
    if (!a || a.pemasukanBulan <= 0 || !a.pos.length) { ambil(BELUM_DIALOKASIKAN).masuk += jumlah; continue; }
    let sisa = jumlah;
    const bagian = a.pos.map(p => { const v = Math.floor((jumlah * p.perBulan) / a.pemasukanBulan); sisa -= v; return { p, v }; });
    // Porsi "belum dialokasikan" dari rencana angkatan itu tetap di sana, bukan dilempar ke pos lain.
    const belum = Math.floor((jumlah * a.belumDialokasikan) / a.pemasukanBulan);
    sisa -= belum;
    if (belum) ambil(BELUM_DIALOKASIKAN).masuk += belum;
    if (sisa > 0 && bagian.length) bagian.reduce((m, b) => (b.p.perBulan > m.p.perBulan ? b : m)).v += sisa;
    for (const b of bagian) ambil(b.p.nama).masuk += b.v;
  }
  const pos = [...peta.values()].map(s => ({ ...s, saldo: s.masuk - s.keluar, terpakai: s.masuk ? (s.keluar / s.masuk) * 100 : 0 }));
  const totalMasuk = pos.reduce((s, p) => s + p.masuk, 0);
  const totalKeluar = pos.reduce((s, p) => s + p.keluar, 0);
  return { pos, totalMasuk, totalKeluar, saldo: totalMasuk - totalKeluar };
}

export const formatRupiah = (n: number) => `Rp${Math.round(n).toLocaleString("id-ID")}`;
