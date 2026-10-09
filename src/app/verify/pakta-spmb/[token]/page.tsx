export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import KartuVerifikasi, { samarNama } from "@/components/spmb/KartuVerifikasi";

export const metadata = { title: "Verifikasi Surat Pernyataan SPMB" };

/** Verifikasi publik surat pernyataan orang tua — identitas & waktu tanda tangan saja, tanpa isi & gambar TTD. */
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [r, s] = await Promise.all([
    /^[A-Za-z0-9_-]{10,64}$/.test(token)
      ? prisma.admission.findUnique({ where: { paktaToken: token }, select: { nomor: true, fullName: true, paktaNama: true, paktaHubungan: true, paktaAt: true } }).catch(() => null)
      : null,
    getSettings(["school.name"]),
  ]);
  const sekolah = s["school.name"] || "SMK Al-Munawwir IIBS";
  const sah = !!r?.paktaAt;
  return (
    <KartuVerifikasi sah={sah} sekolah={sekolah} judulSah="Surat pernyataan asli" judulGagal="Surat pernyataan tidak dikenali"
      baris={sah ? [
        ["Nomor", r!.nomor ?? "—"],
        ["Calon murid", samarNama(r!.fullName)],
        ["Ditandatangani", `${r!.paktaNama ? samarNama(r!.paktaNama) : "—"}${r!.paktaHubungan ? ` (${r!.paktaHubungan})` : ""}`],
        ["Waktu", r!.paktaAt!.toLocaleString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) + " WIB"],
      ] : []} />
  );
}
