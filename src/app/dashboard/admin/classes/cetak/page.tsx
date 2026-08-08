export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft, School } from "lucide-react";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import PageHeader from "@/components/admin/PageHeader";
import PrintButton from "@/components/shared/PrintButton";
import PrintKop from "@/components/shared/PrintKop";

const GRADE_LABEL: Record<number, string> = { 10: "X", 11: "XI", 12: "XII" };

/** Cetak data kelas — SATU KELAS SATU HALAMAN (page-break per kelas): info kelas (jurusan, wali
 * kelas, ketua kelas, sekretaris, jumlah siswa) diikuti daftar akun login (Nama/NIS/Username)
 * kelas itu. TIDAK menyertakan password — password di-hash (bcrypt, satu arah), sistem TIDAK
 * BISA membaca ulang nilai aslinya utk siapa pun (keputusan eksplisit user: cuma cetak username,
 * tanpa password). Landscape krn kolom tabel akun cukup banyak. */
export default async function CetakDataKelasPage() {
  await verifyRole(["ADMIN", "TAS"]);

  const [classes, settings] = await Promise.all([
    prisma.class.findMany({
      include: {
        major: { select: { name: true, code: true } },
        homeroom: { select: { user: { select: { name: true } } } },
        ketuaKelas: { select: { user: { select: { name: true } } } },
        sekretaris: { select: { user: { select: { name: true } } } },
        students: {
          where: { studentStatus: "AKTIF" },
          select: { id: true, nis: true, user: { select: { name: true, email: true } } },
          orderBy: { user: { name: "asc" } },
        },
      },
      orderBy: [{ grade: "asc" }, { name: "asc" }],
    }),
    getSettings(["logo.full_white"]),
  ]);

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0">
      <style>{"@page { size: A4 landscape; margin: 1cm; }"}</style>

      <div className="print:hidden">
        <PageHeader icon={<School size={22} />} title="Cetak Data Kelas" description="Info kelas + daftar akun login siswa, satu kelas satu halaman" />
      </div>

      <div className="flex items-center gap-2 mb-5 print:hidden">
        <Link href="/dashboard/admin/classes" className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition">
          <ArrowLeft size={18} />
        </Link>
        <PrintButton />
      </div>

      {classes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center text-gray-400 text-sm print:hidden">Belum ada kelas.</div>
      ) : (
        classes.map((cls, i) => (
          <div key={cls.id}
            className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-6 print:border-0 print:shadow-none print:rounded-none print:p-0 mb-8 print:mb-0 ${i < classes.length - 1 ? "break-after-page" : ""}`}>
            <div className="print:block hidden">
              <PrintKop title={`Data Kelas — ${cls.name}`} subtitle="SMK Al-Munawwir IIBS" logoUrl={settings["logo.full_white"]} edgeClassName="-mx-6 print:-mx-2" />
            </div>

            <h3 className="font-heading font-bold text-primary-900 text-lg mb-3 print:hidden">
              Kelas {cls.name} <span className="text-sm font-normal text-gray-400">— Tingkat {GRADE_LABEL[cls.grade] ?? cls.grade}</span>
            </h3>

            <div className="grid grid-cols-3 gap-3 text-sm bg-gray-50 rounded-xl p-4 mb-5 print:bg-transparent print:border print:border-gray-300 print:rounded-none">
              <div><span className="text-gray-500">Jurusan</span><span className="mx-2">:</span><strong>{cls.major.code} — {cls.major.name}</strong></div>
              <div><span className="text-gray-500">Wali Kelas</span><span className="mx-2">:</span><strong className={cls.homeroom ? "" : "text-amber-500"}>{cls.homeroom?.user.name ?? "Belum ditentukan"}</strong></div>
              <div><span className="text-gray-500">Jumlah Siswa</span><span className="mx-2">:</span><strong>{cls.students.length}</strong></div>
              <div><span className="text-gray-500">Ketua Kelas</span><span className="mx-2">:</span><strong>{cls.ketuaKelas?.user.name ?? "—"}</strong></div>
              <div><span className="text-gray-500">Sekretaris</span><span className="mx-2">:</span><strong>{cls.sekretaris?.user.name ?? "—"}</strong></div>
              <div><span className="text-gray-500">Dicetak</span><span className="mx-2">:</span><strong>{new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</strong></div>
            </div>

            <p className="text-xs font-bold text-primary-800 uppercase tracking-wide mb-2">Daftar Akun Login Siswa</p>
            {cls.students.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Belum ada siswa aktif di kelas ini.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200 print:border-0 print:rounded-none">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-primary-900 text-white print:bg-gray-100 print:text-primary-900">
                      <th className="border border-primary-800 print:border-gray-300 px-3 py-2 text-left w-10">No</th>
                      <th className="border border-primary-800 print:border-gray-300 px-3 py-2 text-left">Nama</th>
                      <th className="border border-primary-800 print:border-gray-300 px-3 py-2 text-left">NIS</th>
                      <th className="border border-primary-800 print:border-gray-300 px-3 py-2 text-left">Username (Email)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cls.students.map((s, idx) => (
                      <tr key={s.id} className="hover:bg-primary-50/30 print:hover:bg-transparent">
                        <td className="border border-gray-200 px-3 py-1.5 text-gray-400">{idx + 1}</td>
                        <td className="border border-gray-200 px-3 py-1.5 font-medium text-primary-900">{s.user.name}</td>
                        <td className="border border-gray-200 px-3 py-1.5 font-mono">{s.nis}</td>
                        <td className="border border-gray-200 px-3 py-1.5 font-mono">{s.user.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="text-[11px] text-gray-400 italic mt-4">
              Catatan: password tidak dapat dicetak karena tersimpan dalam bentuk terenkripsi satu-arah (tidak bisa dibaca ulang oleh siapa pun). Password default akun baru = NIS siswa, kecuali sudah pernah diganti sendiri oleh siswa lewat menu Ganti Password.
            </p>
          </div>
        ))
      )}
    </div>
  );
}
