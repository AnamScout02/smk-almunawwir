export const dynamic = "force-dynamic";

import { CheckCircle2, XCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { PREDIKAT_EKSTRA } from "@/lib/ekstra-nilai";

export const metadata = { title: "Verifikasi Sertifikat Ekstrakurikuler" };

/** Verifikasi publik sertifikat ekstrakurikuler — hanya data yang tercetak. */
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [a, s] = await Promise.all([
    /^[A-Za-z0-9_-]{10,64}$/.test(token)
      ? prisma.extracurricularMember.findUnique({ where: { sertifikatToken: token }, select: { role: true, extracurricularId: true, extracurricular: { select: { name: true } }, student: { select: { id: true, user: { select: { name: true } }, class: { select: { name: true } } } } } }).catch(() => null)
      : Promise.resolve(null),
    getSettings(["school.name"]),
  ]);
  const nilai = a ? await prisma.nilaiEkstra.findFirst({ where: { extracurricularId: a.extracurricularId, studentId: a.student.id }, orderBy: { semester: "desc" } }).catch(() => null) : null;
  const sekolah = s["school.name"] || "SMK Al-Munawwir IIBS";
  return (
    <main className="flex min-h-dvh items-center justify-center bg-cream px-4 py-10">
      <div className="panel w-full max-w-md overflow-hidden">
        {a ? (
          <>
            <div className="flex items-center gap-3 border-b border-emerald-100 bg-emerald-50 px-6 py-4">
              <CheckCircle2 size={24} className="shrink-0 text-emerald-600" />
              <div><p className="font-heading font-bold text-emerald-700">Sertifikat asli</p><p className="text-xs text-emerald-700">Tercatat di basis data resmi {sekolah}</p></div>
            </div>
            <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2 p-6 text-sm">
              <dt className="text-gray-500">Nama</dt><dd className="font-semibold text-primary-900">{a.student.user.name}</dd>
              <dt className="text-gray-500">Kelas</dt><dd>{a.student.class?.name ?? "-"}</dd>
              <dt className="text-gray-500">Ekstrakurikuler</dt><dd>{a.extracurricular.name}{a.role ? ` · ${a.role}` : ""}</dd>
              {nilai && <><dt className="text-gray-500">Predikat</dt><dd>{nilai.predikat} ({PREDIKAT_EKSTRA[nilai.predikat] ?? ""}) — {nilai.semester}</dd></>}
            </dl>
          </>
        ) : (
          <div className="flex items-center gap-3 bg-red-50 px-6 py-6">
            <XCircle size={24} className="shrink-0 text-red-600" />
            <div><p className="font-heading font-bold text-red-700">Sertifikat tidak dikenali</p><p className="text-xs text-red-700">Kode QR ini tidak terdaftar di {sekolah}.</p></div>
          </div>
        )}
      </div>
    </main>
  );
}
