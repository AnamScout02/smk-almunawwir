import "server-only";
import { prisma } from "@/lib/prisma";
import { LABEL_STATUS } from "@/lib/spmb-status";
import { hitungBayar } from "@/lib/spmb-tahapan";
import { setelanBayar } from "@/lib/spmb-tahapan-server";
import type { BarisRekapBayar, CicilanRekap } from "@/lib/spmb-rekap-hitung";

/** Data REKAP PEMBAYARAN SPMB (10 Oktober 2026, permintaan user) — satu pemuat untuk layar & Excel. Calon yang ditolak tidak
 *  ikut (tidak punya tagihan), KECUALI yang sudah pernah membayar: uangnya tetap harus terlihat di rekap. */
export async function muatRekapBayar(gelombangId?: string) {
  const [calon, set, gelombang] = await Promise.all([
    prisma.admission.findMany({
      where: { ...(gelombangId ? { gelombangId } : {}), OR: [{ status: { notIn: ["DITOLAK", "REJECTED"] } }, { pembayaranSpmb: { some: { status: { in: ["SAH", "MENUNGGU"] } } } }] },
      orderBy: [{ gelombang: { urutan: "asc" } }, { fullName: "asc" }],
      select: {
        id: true, nomor: true, fullName: true, chosenMajor: true, status: true, phone: true, studentId: true,
        potonganBiaya: true, keteranganPotongan: true, gelombangId: true, daftarUlangConfirmedAt: true, gelombang: { select: { nama: true } },
        pembayaranSpmb: { orderBy: { tanggal: "asc" }, select: { jumlah: true, tanggal: true, metode: true, status: true, kuitansiNo: true, dicatatOleh: true, disahkanOleh: true } },
      },
    }),
    setelanBayar(),
    prisma.gelombangSpmb.findMany({ orderBy: { urutan: "asc" }, select: { id: true, nama: true, biayaDaftar: true } }).catch(() => []),
  ]);
  const kini = Date.now();
  const baris: BarisRekapBayar[] = calon.map(c => {
    const cicilan: CicilanRekap[] = c.pembayaranSpmb.filter(p => p.status !== "DITOLAK").map(p => ({
      tanggal: p.tanggal.toISOString(), jumlah: p.jumlah, metode: p.metode, status: p.status, kuitansi: p.kuitansiNo,
      oleh: p.status === "SAH" ? (p.disahkanOleh ?? p.dicatatOleh ?? "") : "",
    }));
    const sahList = cicilan.filter(x => x.status === "SAH");
    const sah = sahList.reduce((a, x) => a + x.jumlah, 0), menunggu = cicilan.filter(x => x.status === "MENUNGGU").reduce((a, x) => a + x.jumlah, 0);
    const b = hitungBayar(set, c.potonganBiaya, sah, menunggu, c.gelombangId);
    const terakhir = sahList.at(-1)?.tanggal ?? null;
    return {
      id: c.id, nomor: c.nomor ?? "", nama: c.fullName, jurusan: c.chosenMajor ?? "", wa: c.phone ?? "", status: LABEL_STATUS[c.status] ?? c.status,
      gelombangId: c.gelombangId ?? "-", gelombang: c.gelombang?.nama ?? "Tanpa gelombang", konfirmasi: c.daftarUlangConfirmedAt?.toISOString() ?? null, jadiSiswa: !!c.studentId,
      biaya: b.total, potongan: Math.min(b.potongan, b.total), ketPotongan: c.keteranganPotongan ?? "", tagihan: b.tagihan, sah, menunggu, sisa: b.sisa,
      keadaan: b.tagihan <= 0 ? "TANPA" : b.lunas ? "LUNAS" : sah > 0 ? "CICIL" : "BELUM",
      cicilan, pertama: sahList[0]?.tanggal ?? null, terakhir,
      hariDiam: terakhir && b.sisa > 0 ? Math.floor((kini - new Date(terakhir).getTime()) / 86400_000) : null,
    };
  });
  return { baris, gelombang, syarat: set.syarat, uangMuka: set.uangMuka };
}
