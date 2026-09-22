export const dynamic = "force-dynamic";

import { CheckCircle2, XCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";

export const metadata = { title: "Verifikasi Sertifikat PKL" };

const tgl = (d: Date) => d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });

/** Verifikasi publik sertifikat PKL (QR keaslian milik situs sendiri). Hanya data yang tercetak di sertifikat. */
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [pkl, s] = await Promise.all([
    /^[A-Za-z0-9_-]{10,64}$/.test(token)
      ? prisma.internship.findUnique({ where: { sertifikatToken: token }, select: { sertifikatNomor: true, company: true, position: true, startDate: true, endDate: true, student: { select: { user: { select: { name: true } }, major: { select: { name: true } } } } } }).catch(() => null)
      : Promise.resolve(null),
    getSettings(["school.name"]),
  ]);
  const sekolah = s["school.name"] || "SMK Al-Munawwir IIBS";
  return (
    <main className="flex min-h-dvh items-center justify-center bg-cream px-4 py-10">
      <div className="panel w-full max-w-md overflow-hidden">
        {pkl ? (
          <>
            <div className="flex items-center gap-3 border-b border-emerald-100 bg-emerald-50 px-6 py-4">
              <CheckCircle2 size={24} className="shrink-0 text-emerald-600" />
              <div><p className="font-heading font-bold text-emerald-700">Sertifikat PKL asli</p><p className="text-xs text-emerald-700">Tercatat di basis data resmi {sekolah}</p></div>
            </div>
            <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2 p-6 text-sm">
              <dt className="text-gray-500">Nomor</dt><dd className="font-semibold text-primary-900">{pkl.sertifikatNomor}</dd>
              <dt className="text-gray-500">Nama</dt><dd className="font-semibold text-primary-900">{pkl.student.user.name}</dd>
              <dt className="text-gray-500">Kompetensi</dt><dd>{pkl.student.major?.name ?? "-"}</dd>
              <dt className="text-gray-500">Tempat PKL</dt><dd>{pkl.company}</dd>
              <dt className="text-gray-500">Posisi</dt><dd>{pkl.position}</dd>
              <dt className="text-gray-500">Periode</dt><dd>{tgl(pkl.startDate)} – {tgl(pkl.endDate)}</dd>
            </dl>
          </>
        ) : (
          <div className="flex items-center gap-3 bg-red-50 px-6 py-6">
            <XCircle size={24} className="shrink-0 text-red-600" />
            <div><p className="font-heading font-bold text-red-700">Sertifikat tidak dikenali</p><p className="text-xs text-red-700">Kode QR ini tidak terdaftar di {sekolah}. Hubungi sekolah untuk memastikan.</p></div>
          </div>
        )}
      </div>
    </main>
  );
}
