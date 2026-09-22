export const dynamic = "force-dynamic";

import { CheckCircle2, XCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";

export const metadata = { title: "Verifikasi Piagam Prestasi" };

/** Verifikasi publik piagam prestasi — hanya data yang tercetak di piagam. */
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [r, s] = await Promise.all([
    /^[A-Za-z0-9_-]{10,64}$/.test(token)
      ? prisma.studentPointRecord.findUnique({ where: { sertifikatToken: token }, select: { note: true, date: true, achievementType: { select: { name: true } }, student: { select: { user: { select: { name: true } } } } } }).catch(() => null)
      : Promise.resolve(null),
    getSettings(["school.name"]),
  ]);
  const sekolah = s["school.name"] || "SMK Al-Munawwir IIBS";
  return (
    <main className="flex min-h-dvh items-center justify-center bg-cream px-4 py-10">
      <div className="panel w-full max-w-md overflow-hidden">
        {r ? (
          <>
            <div className="flex items-center gap-3 border-b border-emerald-100 bg-emerald-50 px-6 py-4">
              <CheckCircle2 size={24} className="shrink-0 text-emerald-600" />
              <div><p className="font-heading font-bold text-emerald-700">Piagam prestasi asli</p><p className="text-xs text-emerald-700">Tercatat di basis data resmi {sekolah}</p></div>
            </div>
            <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 p-6 text-sm">
              <dt className="text-gray-500">Nama</dt><dd className="font-semibold text-primary-900">{r.student.user.name}</dd>
              <dt className="text-gray-500">Prestasi</dt><dd>{r.achievementType?.name ?? "Prestasi"}{r.note ? ` — ${r.note}` : ""}</dd>
              <dt className="text-gray-500">Tanggal</dt><dd>{r.date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" })}</dd>
            </dl>
          </>
        ) : (
          <div className="flex items-center gap-3 bg-red-50 px-6 py-6">
            <XCircle size={24} className="shrink-0 text-red-600" />
            <div><p className="font-heading font-bold text-red-700">Piagam tidak dikenali</p><p className="text-xs text-red-700">Kode QR ini tidak terdaftar di {sekolah}.</p></div>
          </div>
        )}
      </div>
    </main>
  );
}
