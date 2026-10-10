export const dynamic = "force-dynamic";
import { muatRekapBayar } from "@/lib/spmb-rekap-bayar";
import RekapBayarSpmb from "@/components/spmb/RekapBayarSpmb";

export const metadata = { title: "Rekap Pembayaran SPMB" };

/** REKAP PEMBAYARAN daftar ulang SPMB — siapa sudah bayar berapa, kapan, dan berapa kurangnya; per calon, per gelombang,
 *  per tanggal. Hanya MEMBACA: mengesahkan/menolak/mencatat pembayaran tetap di jendela calon (Tahapan Calon). Penjaga akses
 *  ada di layout Pusat SPMB (`bolehSpmb`). */
export default async function Page() {
  const d = await muatRekapBayar();
  return <RekapBayarSpmb baris={d.baris} gelombang={d.gelombang.map(g => ({ id: g.id, nama: g.nama, biaya: g.biayaDaftar }))} syarat={d.syarat} uangMuka={d.uangMuka} />;
}
