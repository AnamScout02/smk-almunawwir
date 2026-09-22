export const dynamic = "force-dynamic";

import { CheckCircle2, XCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";

export const metadata = { title: "Verifikasi Surat" };

/** Verifikasi publik surat keluar — hanya identitas surat (nomor, tanggal, perihal, penanda tangan), bukan isinya. */
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [surat, s] = await Promise.all([
    /^[A-Za-z0-9_-]{10,64}$/.test(token)
      ? prisma.surat.findUnique({ where: { verifikasiToken: token }, select: { nomor: true, tanggal: true, perihal: true, pihak: true, penandaTangan: true, tipe: true } }).catch(() => null)
      : Promise.resolve(null),
    getSettings(["school.name"]),
  ]);
  const sekolah = s["school.name"] || "SMK Al-Munawwir IIBS";
  const sah = surat && surat.tipe === "KELUAR";
  return (
    <main className="flex min-h-dvh items-center justify-center bg-cream px-4 py-10">
      <div className="panel w-full max-w-md overflow-hidden">
        {sah ? (
          <>
            <div className="flex items-center gap-3 border-b border-emerald-100 bg-emerald-50 px-6 py-4">
              <CheckCircle2 size={24} className="shrink-0 text-emerald-600" />
              <div><p className="font-heading font-bold text-emerald-700">Surat resmi terverifikasi</p><p className="text-xs text-emerald-700">Tercatat di agenda surat {sekolah}</p></div>
            </div>
            <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 p-6 text-sm">
              <dt className="text-gray-500">Nomor</dt><dd className="font-semibold text-primary-900">{surat.nomor}</dd>
              <dt className="text-gray-500">Tanggal</dt><dd>{surat.tanggal.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" })}</dd>
              <dt className="text-gray-500">Perihal</dt><dd>{surat.perihal}</dd>
              <dt className="text-gray-500">Kepada</dt><dd>{surat.pihak}</dd>
              <dt className="text-gray-500">Ditandatangani</dt><dd>{surat.penandaTangan ?? "Kepala Sekolah"}</dd>
            </dl>
            <p className="px-6 pb-5 text-xs text-gray-500">Isi surat tidak ditampilkan di halaman ini. Bandingkan data di atas dengan lembar surat yang Anda terima.</p>
          </>
        ) : (
          <div className="flex items-center gap-3 bg-red-50 px-6 py-6">
            <XCircle size={24} className="shrink-0 text-red-600" />
            <div><p className="font-heading font-bold text-red-700">Surat tidak dikenali</p><p className="text-xs text-red-700">Kode QR ini tidak terdaftar di {sekolah}.</p></div>
          </div>
        )}
      </div>
    </main>
  );
}
