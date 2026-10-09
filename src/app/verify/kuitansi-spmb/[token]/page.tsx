export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import KartuVerifikasi, { samarNama } from "@/components/spmb/KartuVerifikasi";

export const metadata = { title: "Verifikasi Kuitansi SPMB" };

/** Verifikasi publik kuitansi: nomor, jumlah, tanggal, dan STATUS TERKINI — kuitansi yang pembayarannya kemudian
 *  dibatalkan/dihapus panitia tidak lagi tampil sah, jadi kuitansi lama tidak bisa dipakai ulang. */
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [r, s] = await Promise.all([
    /^[A-Za-z0-9_-]{10,64}$/.test(token)
      ? prisma.pembayaranSpmb.findUnique({
          where: { kuitansiToken: token },
          select: { kuitansiNo: true, jumlah: true, tanggal: true, status: true, admission: { select: { nomor: true, fullName: true } } },
        }).catch(() => null)
      : null,
    getSettings(["school.name"]),
  ]);
  const sekolah = s["school.name"] || "SMK Al-Munawwir IIBS";
  const sah = r?.status === "SAH";
  return (
    <KartuVerifikasi sah={sah} sekolah={sekolah} judulSah="Kuitansi asli — pembayaran sah" judulGagal={r ? "Pembayaran ini sudah tidak berlaku" : "Kuitansi tidak dikenali"}
      baris={sah ? [
        ["No. kuitansi", r!.kuitansiNo ?? "—"],
        ["Jumlah", `Rp ${r!.jumlah.toLocaleString("id-ID")}`],
        ["Tanggal bayar", r!.tanggal.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" })],
        ["Calon murid", `${samarNama(r!.admission.fullName)} · ${r!.admission.nomor ?? "—"}`],
      ] : []} />
  );
}
