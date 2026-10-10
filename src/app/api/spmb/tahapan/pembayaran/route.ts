import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { assertSpmb } from "@/lib/spmb";
import { balasanExcelBanyakSheet } from "@/lib/ekspor-excel";
import { muatRekapBayar } from "@/lib/spmb-rekap-bayar";
import { LABEL_KEADAAN, rekapPerGelombang, rekapPerTanggal, ringkasRekap } from "@/lib/spmb-rekap-hitung";

export const dynamic = "force-dynamic";

/** Rekap pembayaran daftar ulang SPMB (.xlsx) — data & hitungan SAMA dengan layar /pusat-spmb/pembayaran
 *  (muatRekapBayar + spmb-rekap-hitung). Modul Bendahara tidak disentuh. */
export async function GET(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertSpmb(session);
    const { baris } = await muatRekapBayar(req.nextUrl.searchParams.get("gelombangId") || undefined);
    const tgl = (d: string | null) => (d ? new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Jakarta" }) : "");
    const maksCicil = Math.min(8, Math.max(1, ...baris.map(b => b.cicilan.filter(c => c.status === "SAH").length)));
    const t = ringkasRekap(baris);
    return balasanExcelBanyakSheet(`pembayaran-spmb-${new Date().toISOString().slice(0, 10)}`, [
      {
        nama: "Per Calon",
        headers: ["No", "Nomor", "Nama", "Gelombang", "Jurusan", "WhatsApp", "Status", "Jadi Siswa", "Konfirmasi Daftar Ulang", "Biaya", "Potongan", "Ket. Potongan", "Tagihan", "Sudah Bayar (Sah)", "Menunggu Diperiksa", "Sisa / Kurang", "Keterangan", "Jumlah Cicilan", "Bayar Pertama", "Bayar Terakhir", "Hari Sejak Bayar Terakhir",
          ...Array.from({ length: maksCicil }, (_, i) => [`Cicilan ${i + 1} Tanggal`, `Cicilan ${i + 1} Jumlah`]).flat()],
        rows: baris.map((b, i) => {
          const sah = b.cicilan.filter(c => c.status === "SAH");
          return [i + 1, b.nomor, b.nama, b.gelombang, b.jurusan, b.wa, b.status, b.jadiSiswa ? "Ya" : "", tgl(b.konfirmasi), b.biaya, b.potongan, b.ketPotongan, b.tagihan, b.sah, b.menunggu, b.sisa,
            LABEL_KEADAAN[b.keadaan], sah.length, tgl(b.pertama), tgl(b.terakhir), b.hariDiam ?? "",
            ...Array.from({ length: maksCicil }, (_, k) => (sah[k] ? [tgl(sah[k].tanggal), sah[k].jumlah] : ["", ""])).flat()];
        }),
      },
      {
        nama: "Per Gelombang",
        headers: ["Gelombang", "Calon", "Lunas", "Mencicil", "Belum Bayar", "Biaya", "Potongan", "Tagihan", "Sudah Masuk (Sah)", "Menunggu Diperiksa", "Sisa / Kurang", "Terkumpul (%)"],
        rows: [...rekapPerGelombang(baris).map(g => [g.nama, g.calon, g.lunas, g.cicil, g.belum, g.biaya, g.potongan, g.tagihan, g.sah, g.menunggu, g.sisa, g.persen]),
          ["JUMLAH", t.calon, t.lunas, t.cicil, t.belum, t.biaya, t.potongan, t.tagihan, t.sah, t.menunggu, t.sisa, t.persen]],
      },
      {
        nama: "Per Tanggal",
        headers: ["Tanggal", "Transaksi", "Calon", "Tunai", "Transfer", "Jumlah Masuk"],
        rows: rekapPerTanggal(baris).map(x => [tgl(`${x.tanggal}T05:00:00Z`), x.transaksi, x.calon, x.tunai, x.transfer, x.total]),
      },
      {
        nama: "Riwayat Pembayaran",
        headers: ["Tanggal", "Nomor", "Nama", "Gelombang", "Jumlah", "Metode", "Status", "No. Kuitansi", "Disahkan / Dicatat Oleh"],
        rows: baris.flatMap(b => b.cicilan.map(c => ({ b, c }))).sort((x, y) => x.c.tanggal.localeCompare(y.c.tanggal))
          .map(({ b, c }) => [tgl(c.tanggal), b.nomor, b.nama, b.gelombang, c.jumlah, c.metode === "TUNAI" ? "Tunai" : "Transfer", c.status === "SAH" ? "Sah" : "Menunggu diperiksa", c.kuitansi ?? "", c.oleh]),
      },
    ]);
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Tidak berwenang" }, { status: 403 });
  }
}
