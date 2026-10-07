import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { assertSpmb } from "@/lib/spmb";
import { balasanExcelBanyakSheet } from "@/lib/ekspor-excel";
import { LABEL_STATUS } from "@/lib/spmb-status";
import { ringkasBayar, setelanBayar } from "@/lib/spmb-tahapan-server";
import { hitungBayar } from "@/lib/spmb-tahapan";

export const dynamic = "force-dynamic";

/** Rekap pembayaran daftar ulang SPMB (6 Okt 2026) — untuk bendahara lewat Excel; modul Bendahara tidak disentuh. */
export async function GET(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertSpmb(session);
    const gelombangId = req.nextUrl.searchParams.get("gelombangId") || undefined;
    const where = { status: { notIn: ["DITOLAK", "REJECTED"] }, ...(gelombangId ? { gelombangId } : {}) };
    const [calon, set, peta, riwayat] = await Promise.all([
      prisma.admission.findMany({
        where, orderBy: [{ gelombang: { urutan: "asc" } }, { fullName: "asc" }],
        select: {
          id: true, nomor: true, fullName: true, chosenMajor: true, status: true, phone: true,
          potonganBiaya: true, keteranganPotongan: true, gelombangId: true, daftarUlangConfirmedAt: true, gelombang: { select: { nama: true } },
        },
      }),
      setelanBayar(),
      ringkasBayar(),
      prisma.pembayaranSpmb.findMany({
        where: { admission: where }, orderBy: { tanggal: "asc" },
        select: { jumlah: true, tanggal: true, metode: true, status: true, alasanTolak: true, dicatatOleh: true, disahkanOleh: true, catatan: true, admission: { select: { nomor: true, fullName: true } } },
      }),
    ]);
    const tgl = (d: Date | null) => (d ? d.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Jakarta" }) : "");
    return balasanExcelBanyakSheet(`pembayaran-spmb-${new Date().toISOString().slice(0, 10)}`, [
      {
        nama: "Per Calon",
        headers: ["No", "Nomor", "Nama", "Gelombang", "Jurusan", "WhatsApp", "Status", "Konfirmasi Daftar Ulang", "Biaya", "Potongan", "Ket. Potongan", "Tagihan", "Sah", "Menunggu Diperiksa", "Sisa", "Keterangan"],
        rows: calon.map((c, i) => {
          const r = peta.get(c.id) ?? { sah: 0, menunggu: 0 };
          const b = hitungBayar(set, c.potonganBiaya, r.sah, r.menunggu, c.gelombangId);
          return [i + 1, c.nomor ?? "", c.fullName, c.gelombang?.nama ?? "", c.chosenMajor, c.phone, LABEL_STATUS[c.status] ?? c.status,
            tgl(c.daftarUlangConfirmedAt), b.total, b.potongan, c.keteranganPotongan ?? "", b.tagihan, b.sah, b.menunggu, b.sisa,
            b.lunas ? "Lunas" : b.sah > 0 ? "Mencicil" : "Belum bayar"];
        }),
      },
      {
        nama: "Riwayat Pembayaran",
        headers: ["Tanggal", "Nomor", "Nama", "Jumlah", "Metode", "Status", "Alasan Ditolak", "Dicatat", "Disahkan Oleh", "Catatan"],
        rows: riwayat.map(p => [tgl(p.tanggal), p.admission.nomor ?? "", p.admission.fullName, p.jumlah, p.metode, p.status, p.alasanTolak ?? "",
          p.dicatatOleh ?? "Calon (unggah bukti)", p.disahkanOleh ?? "", p.catatan ?? ""]),
      },
    ]);
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Tidak berwenang" }, { status: 403 });
  }
}
