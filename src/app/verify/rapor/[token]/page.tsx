export const dynamic = "force-dynamic";

import { CheckCircle2, XCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";

export const metadata = { title: "Verifikasi Rapor" };

const JENIS: Record<string, string> = { AKHIR: "Rapor Akhir Semester", TS: "Rapor Tengah Semester", DINIYAH: "Rapor Diniyah" };

/** Verifikasi publik rapor format sekolah — hanya identitas dokumen, BUKAN nilai (CLAUDE.md #49). */
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [r, s] = await Promise.all([
    /^[A-Za-z0-9_-]{10,64}$/.test(token)
      ? prisma.raporVerifikasi.findUnique({
          where: { token },
          select: { semester: true, jenis: true, kelasNama: true, student: { select: { nis: true, classId: true, user: { select: { name: true } } } } },
        }).catch(() => null)
      : Promise.resolve(null),
    getSettings(["school.name"]),
  ]);
  const sah = r?.student.classId
    ? await prisma.raporApproval.findFirst({ where: { semester: r.semester, class: { name: r.kelasNama } }, select: { approvedAt: true, approvedBy: true } }).catch(() => null)
    : null;
  const sekolah = s["school.name"] || "SMK Al-Munawwir IIBS";
  return (
    <main className="flex min-h-dvh items-center justify-center bg-cream px-4 py-10">
      <div className="panel w-full max-w-md overflow-hidden">
        {r ? (
          <>
            <div className="flex items-center gap-3 border-b border-emerald-100 bg-emerald-50 px-6 py-4">
              <CheckCircle2 size={24} className="shrink-0 text-emerald-600" />
              <div><p className="font-heading font-bold text-emerald-700">Rapor asli</p><p className="text-xs text-emerald-700">Diterbitkan dari basis data resmi {sekolah}</p></div>
            </div>
            <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 p-6 text-sm">
              <dt className="text-gray-500">Nama</dt><dd className="font-semibold text-primary-900">{r.student.user.name}</dd>
              <dt className="text-gray-500">NIS</dt><dd>{r.student.nis}</dd>
              <dt className="text-gray-500">Dokumen</dt><dd>{JENIS[r.jenis] ?? "Rapor"}</dd>
              <dt className="text-gray-500">Kelas</dt><dd>{r.kelasNama}</dd>
              <dt className="text-gray-500">Semester</dt><dd>{r.semester}</dd>
              {sah && <><dt className="text-gray-500">Disahkan</dt><dd>{sah.approvedBy}, {sah.approvedAt.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" })}</dd></>}
            </dl>
            <p className="border-t border-gray-100 px-6 py-3 text-xs text-gray-500">Nilai tidak ditampilkan di sini. Cocokkan nama, kelas, dan semester dengan rapor yang Anda pegang.</p>
          </>
        ) : (
          <div className="flex items-center gap-3 bg-red-50 px-6 py-6">
            <XCircle size={24} className="shrink-0 text-red-600" />
            <div><p className="font-heading font-bold text-red-700">Rapor tidak dikenali</p><p className="text-xs text-red-700">Kode QR ini tidak terdaftar di {sekolah}.</p></div>
          </div>
        )}
      </div>
    </main>
  );
}
