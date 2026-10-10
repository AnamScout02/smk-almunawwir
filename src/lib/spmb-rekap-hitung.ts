/** REKAP PEMBAYARAN SPMB — hitungan MURNI (netral), dipakai layar /pusat-spmb/pembayaran DAN Excel supaya angkanya selalu sama.
 *  Aturannya mengikuti `hitungBayar`: tagihan = biaya daftar ulang gelombang − potongan; yang dihitung MASUK hanya cicilan SAH;
 *  cicilan MENUNGGU ditampilkan terpisah (belum tentu sah); cicilan DITOLAK tidak dihitung sama sekali. */
export type CicilanRekap = { tanggal: string; jumlah: number; metode: string; status: string; kuitansi: string | null; oleh: string };
export type BarisRekapBayar = {
  id: string; nomor: string; nama: string; jurusan: string; wa: string; status: string;
  gelombangId: string; gelombang: string; konfirmasi: string | null; jadiSiswa: boolean;
  biaya: number; potongan: number; ketPotongan: string; tagihan: number; sah: number; menunggu: number; sisa: number;
  keadaan: "LUNAS" | "CICIL" | "BELUM" | "TANPA";
  cicilan: CicilanRekap[]; pertama: string | null; terakhir: string | null; hariDiam: number | null;
};
export const LABEL_KEADAAN: Record<BarisRekapBayar["keadaan"], string> = { LUNAS: "Lunas", CICIL: "Mencicil", BELUM: "Belum bayar", TANPA: "Tanpa tagihan" };

export function ringkasRekap(baris: BarisRekapBayar[]) {
  const j = (f: (b: BarisRekapBayar) => number) => baris.reduce((a, b) => a + f(b), 0);
  const n = (k: BarisRekapBayar["keadaan"]) => baris.filter(b => b.keadaan === k).length;
  const tagihan = j(b => b.tagihan), sah = j(b => b.sah);
  return { calon: baris.length, biaya: j(b => b.biaya), potongan: j(b => b.potongan), tagihan, sah, menunggu: j(b => b.menunggu), sisa: j(b => b.sisa),
    lunas: n("LUNAS"), cicil: n("CICIL"), belum: n("BELUM"), tanpa: n("TANPA"), persen: tagihan > 0 ? Math.min(100, Math.round((sah / tagihan) * 100)) : 0 };
}

export function rekapPerGelombang(baris: BarisRekapBayar[]) {
  const urut: string[] = [], peta = new Map<string, BarisRekapBayar[]>();
  for (const b of baris) { if (!peta.has(b.gelombangId)) { peta.set(b.gelombangId, []); urut.push(b.gelombangId); } peta.get(b.gelombangId)!.push(b); }
  return urut.map(id => ({ id, nama: peta.get(id)![0].gelombang, ...ringkasRekap(peta.get(id)!) }));
}

const hariWib = (iso: string) => new Date(new Date(iso).getTime() + 7 * 3600_000).toISOString().slice(0, 10);
/** Uang MASUK (cicilan SAH) per tanggal WIB, terbaru di atas. */
export function rekapPerTanggal(baris: BarisRekapBayar[]) {
  const peta = new Map<string, { tanggal: string; transaksi: number; total: number; tunai: number; transfer: number; orang: Set<string> }>();
  for (const b of baris) for (const c of b.cicilan) {
    if (c.status !== "SAH") continue;
    const k = hariWib(c.tanggal), x = peta.get(k) ?? { tanggal: k, transaksi: 0, total: 0, tunai: 0, transfer: 0, orang: new Set<string>() };
    x.transaksi++; x.total += c.jumlah; if (c.metode === "TUNAI") x.tunai += c.jumlah; else x.transfer += c.jumlah; x.orang.add(b.id);
    peta.set(k, x);
  }
  return [...peta.values()].sort((a, b) => b.tanggal.localeCompare(a.tanggal)).map(x => ({ tanggal: x.tanggal, transaksi: x.transaksi, calon: x.orang.size, total: x.total, tunai: x.tunai, transfer: x.transfer }));
}
