import { NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { generateQrWithLogoDataUrl } from "@/lib/qrcode";
import { anggotaDariUserId, ringkasanAnggota } from "@/lib/perpustakaan-server";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

/** KARTU ANGGOTA DIGITAL — QR berisi identitas yang sama dengan kartu tanda cetak (NIS/NIP/awalan email),
 * jadi bisa langsung dipindai petugas di meja sirkulasi atau kiosk kunjungan dari layar HP. */
export async function GET() {
  let session: Awaited<ReturnType<typeof verifyRole>>;
  try {
    session = await verifyRole(["ADMIN", "TAS", "TEACHER", "STUDENT"]);
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const anggota = await anggotaDariUserId(session.userId);
  if (!anggota) return NextResponse.json({ error: "Akun ini bukan anggota perpustakaan." }, { status: 404 });
  const [qr, ringkas] = await Promise.all([generateQrWithLogoDataUrl(anggota.identitas), ringkasanAnggota(anggota.id)]);
  return NextResponse.json({
    anggota, qr,
    pinjamanAktif: ringkas.aktif.length, terlambat: ringkas.aktif.filter(p => p.terlambat).length,
    pesanan: ringkas.reservasi.length, tunggakan: ringkas.totalTunggakan, aturan: ringkas.aturan,
  });
}
