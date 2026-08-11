export const dynamic = "force-dynamic";

import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PrintButton from "@/components/shared/PrintButton";

const JAM = Array.from({ length: 12 }, (_, i) => i + 1);
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function currentAjaran(): string {
  const now = new Date();
  const y = now.getFullYear();
  return now.getMonth() + 1 >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}
function currentSemesterLabel(): string {
  return new Date().getMonth() + 1 >= 7 ? "Ganjil" : "Genap";
}

/** Form cetak KOSONG absensi harian per kelas — kertas manual, kolom Jam Pelajaran 1-12 diisi TTD
 * guru mapel tiap pergantian jam. TIDAK terhubung ke data Absensi Resmi digital (beda konsep —
 * itu 1 status/hari per siswa, ini legalitas kertas per jam pelajaran) — murni cetak roster
 * kelas + kop, sisanya diisi tangan. Dipakai wali kelas/TU sbg cadangan kalau sistem digital
 * down, atau sesuai kebutuhan arsip fisik sekolah. */
export default async function CetakFormAbsensiPage({ searchParams }: { searchParams: Promise<{ classId?: string }> }) {
  await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  const { classId } = await searchParams;

  const classes = await prisma.class.findMany({
    include: { major: { select: { name: true } } },
    orderBy: [{ grade: "asc" }, { name: "asc" }],
  });
  const activeClass = classId ? classes.find(c => c.id === classId) : classes[0];

  const students = activeClass
    ? await prisma.student.findMany({
        where: { classId: activeClass.id, studentStatus: "AKTIF" },
        select: { nis: true, gender: true, user: { select: { name: true } } },
        orderBy: { user: { name: "asc" } },
      })
    : [];

  const now = new Date();

  return (
    <>
      <div className="print:hidden bg-primary-900 text-white px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/admin/absensi-siswa" className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="font-heading font-bold">Cetak Form Absensi Kelas</h1>
            <p className="text-white/50 text-xs">Form kertas kosong — TTD Guru Mapel per Jam Pelajaran</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1 flex-wrap max-w-lg">
            {classes.map(c => (
              <Link key={c.id} href={`/dashboard/admin/absensi-siswa/cetak-form?classId=${c.id}`}
                className={`text-[11px] font-semibold px-2 py-1 rounded-full ${c.id === activeClass?.id ? "bg-white text-primary-900" : "bg-white/10 hover:bg-white/20"}`}>
                {c.name}
              </Link>
            ))}
          </div>
          <PrintButton />
        </div>
      </div>

      {!activeClass ? (
        <div className="p-8 text-center text-gray-400">Belum ada kelas.</div>
      ) : (
        <div className="print-doc p-6 print:p-2">
          <div className="text-center mb-4">
            <h1 className="font-bold text-lg text-primary-900">ABSENSI SISWA SMK AL MUNAWWIR IIBS</h1>
            <p className="font-semibold text-sm text-primary-900">TAHUN PELAJARAN {currentAjaran()}</p>
            <p className="font-semibold text-sm text-primary-900">SEMESTER {currentSemesterLabel().toUpperCase()}</p>
          </div>

          <table className="text-sm mb-4">
            <tbody>
              <tr><td className="pr-4 py-0.5 text-gray-700">Kelas</td><td className="pr-2">:</td><td className="font-semibold text-primary-900">{activeClass.name}</td></tr>
              <tr><td className="pr-4 py-0.5 text-gray-700">Kompetensi Keahlian</td><td className="pr-2">:</td><td className="font-semibold text-primary-900">{activeClass.major.name}</td></tr>
              <tr><td className="pr-4 py-0.5 text-gray-700">Hari/Tanggal</td><td className="pr-2">:</td><td className="font-semibold text-primary-900">.......................... {BULAN[now.getMonth()]} {now.getFullYear()}</td></tr>
            </tbody>
          </table>

          <div className="overflow-x-auto">
            <table className="border-collapse w-full text-[10px] print:text-[8px]">
              <thead>
                <tr className="bg-primary-900 text-white">
                  <th rowSpan={2} className="border border-gray-300 px-1 py-1 w-8">No</th>
                  <th rowSpan={2} className="border border-gray-300 px-1 py-1 w-20">NIS</th>
                  <th rowSpan={2} className="border border-gray-300 px-2 py-1 text-left">Nama</th>
                  <th rowSpan={2} className="border border-gray-300 px-1 py-1 w-10">L/P</th>
                  <th colSpan={JAM.length} className="border border-gray-300 px-1 py-1">Jam Pelajaran</th>
                  <th rowSpan={2} className="border border-gray-300 px-1 py-1 w-16">TTD Guru Mapel</th>
                </tr>
                <tr className="bg-primary-800 text-white">
                  {JAM.map(j => <th key={j} className="border border-gray-300 px-1 py-1 w-7">{j}</th>)}
                </tr>
              </thead>
              <tbody>
                {students.length === 0 ? (
                  <tr><td colSpan={5 + JAM.length} className="border border-gray-300 px-2 py-4 text-center text-gray-400">Belum ada siswa aktif di kelas ini.</td></tr>
                ) : students.map((s, i) => (
                  <tr key={s.nis}>
                    <td className="border border-gray-300 px-1 py-1.5 text-center">{i + 1}</td>
                    <td className="border border-gray-300 px-1 py-1.5 text-center font-mono">{s.nis}</td>
                    <td className="border border-gray-300 px-2 py-1.5 whitespace-nowrap">{s.user.name}</td>
                    <td className="border border-gray-300 px-1 py-1.5 text-center">{s.gender ?? ""}</td>
                    {JAM.map(j => <td key={j} className="border border-gray-300 px-1 py-1.5">&nbsp;</td>)}
                    <td className="border border-gray-300 px-1 py-1.5">&nbsp;</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style>{`
        @page { size: A4 landscape; margin: 10mm 8mm; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
      `}</style>
    </>
  );
}
