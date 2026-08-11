export const dynamic = "force-dynamic";

import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getJabatanNames } from "@/lib/jabatan-guard";
import { KESISWAAN_BK_JABATAN } from "@/lib/kesiswaan-guard";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PrintButton from "@/components/shared/PrintButton";

const STATUS_LETTER: Record<string, string> = { HADIR: "H", IZIN: "I", SAKIT: "S", ALPHA: "A" };
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

/** Cetak kalender absensi 1 bulan penuh per siswa (kolom = tanggal, Minggu diwarnai, rekap S/I/A
 * di ujung) — versi cetak dari tab "Kalender Bulanan" AbsensiSiswaManager. Beda dari cetak-form
 * (yang KOSONG/kertas manual), halaman ini terisi data digital SUNGGUHAN yang sudah diinput wali
 * kelas — dimaksudkan sbg pengganti cetak arsip fisik kalau input kertas manual via ketua kelas/
 * sekretaris kelak ditiadakan (data tetap bisa dicetak dari sini). Guard scope kelas sama persis
 * /api/teacher/attendance/monthly-grid (wali kelas → kelas walinya saja; Kesiswaan/BK & ADMIN →
 * bebas kelas manapun via ?classId=). */
export default async function CetakKalenderAbsensiPage({ searchParams }: { searchParams: Promise<{ classId?: string; month?: string }> }) {
  const session = await verifyRole(["ADMIN", "TEACHER"]);
  const { classId: qClassId, month: qMonth } = await searchParams;

  const now = new Date();
  const month = qMonth && /^\d{4}-\d{2}$/.test(qMonth) ? qMonth : `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const dateFilter = { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) };

  let allowedClassIds: string[] | null = null; // null = bebas (ADMIN/Kesiswaan/BK)
  if (session.role === "TEACHER") {
    const names = await getJabatanNames(session.email);
    if (!KESISWAAN_BK_JABATAN.some(n => names.includes(n))) {
      const teacher = await prisma.teacher.findFirst({
        where: { user: { email: session.email } },
        include: { homeroomOf: { select: { id: true } } },
      });
      allowedClassIds = teacher?.homeroomOf.map(c => c.id) ?? [];
    }
  }

  const classes = await prisma.class.findMany({
    where: allowedClassIds ? { id: { in: allowedClassIds } } : undefined,
    include: { major: { select: { name: true } } },
    orderBy: [{ grade: "asc" }, { name: "asc" }],
  });
  const activeClass = qClassId ? classes.find(c => c.id === qClassId) : classes[0];

  const students = activeClass
    ? await prisma.student.findMany({
        where: { classId: activeClass.id, studentStatus: "AKTIF" },
        include: { user: { select: { name: true } }, attendance: { where: { date: dateFilter } } },
        orderBy: { user: { name: "asc" } },
      })
    : [];

  const sundays: number[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    if (new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 0) sundays.push(d);
  }
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const rows = students.map(s => {
    const cells: Record<number, string> = {};
    for (const a of s.attendance) cells[new Date(a.date).getUTCDate()] = STATUS_LETTER[a.status] ?? "";
    return {
      nis: s.nis,
      name: s.user.name,
      cells,
      SAKIT: s.attendance.filter(a => a.status === "SAKIT").length,
      IZIN: s.attendance.filter(a => a.status === "IZIN").length,
      ALPHA: s.attendance.filter(a => a.status === "ALPHA").length,
    };
  });

  return (
    <>
      <div className="print:hidden bg-primary-900 text-white px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/admin/absensi-siswa" className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="font-heading font-bold">Cetak Kalender Absensi Bulanan</h1>
            <p className="text-white/50 text-xs">Rekap digital 1 bulan — kolom tanggal, Minggu diwarnai, rekap S/I/A</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1 flex-wrap max-w-lg">
            {classes.map(c => (
              <Link key={c.id} href={`/dashboard/admin/absensi-siswa/cetak-kalender?classId=${c.id}&month=${month}`}
                className={`text-[11px] font-semibold px-2 py-1 rounded-full ${c.id === activeClass?.id ? "bg-white text-primary-900" : "bg-white/10 hover:bg-white/20"}`}>
                {c.name}
              </Link>
            ))}
          </div>
          <PrintButton />
        </div>
      </div>

      {!activeClass ? (
        <div className="p-8 text-center text-gray-400">Belum ada kelas yang bisa diakses.</div>
      ) : (
        <div className="print-doc p-6 print:p-2">
          <div className="text-center mb-4">
            <h1 className="font-bold text-lg text-primary-900">KALENDER ABSENSI SISWA SMK AL MUNAWWIR IIBS</h1>
            <p className="font-semibold text-sm text-primary-900">{activeClass.name} — {activeClass.major.name}</p>
            <p className="font-semibold text-sm text-primary-900">{BULAN[m - 1]} {y}</p>
          </div>

          <div className="overflow-x-auto">
            <table className="border-collapse w-full text-[9px] print:text-[7px]">
              <thead>
                <tr className="bg-primary-900 text-white">
                  <th className="border border-gray-300 px-1 py-1 w-6">No</th>
                  <th className="border border-gray-300 px-1 py-1 w-16">NIS</th>
                  <th className="border border-gray-300 px-2 py-1 text-left">Nama</th>
                  {days.map(d => (
                    <th key={d} className={`border border-gray-300 px-0.5 py-1 w-5 ${sundays.includes(d) ? "bg-red-700" : ""}`}>{d}</th>
                  ))}
                  <th className="border border-gray-300 px-1 py-1 w-6 bg-amber-700">S</th>
                  <th className="border border-gray-300 px-1 py-1 w-6 bg-blue-700">I</th>
                  <th className="border border-gray-300 px-1 py-1 w-6 bg-red-700">A</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={6 + days.length} className="border border-gray-300 px-2 py-4 text-center text-gray-400">Belum ada siswa aktif di kelas ini.</td></tr>
                ) : rows.map((r, i) => (
                  <tr key={r.nis}>
                    <td className="border border-gray-300 px-1 py-1 text-center">{i + 1}</td>
                    <td className="border border-gray-300 px-1 py-1 text-center font-mono">{r.nis}</td>
                    <td className="border border-gray-300 px-2 py-1 whitespace-nowrap">{r.name}</td>
                    {days.map(d => (
                      <td key={d} className={`border border-gray-300 px-0.5 py-1 text-center font-bold ${sundays.includes(d) ? "bg-red-50" : ""}`}>
                        {r.cells[d] ?? ""}
                      </td>
                    ))}
                    <td className="border border-gray-300 px-1 py-1 text-center font-bold bg-amber-50">{r.SAKIT || ""}</td>
                    <td className="border border-gray-300 px-1 py-1 text-center font-bold bg-blue-50">{r.IZIN || ""}</td>
                    <td className="border border-gray-300 px-1 py-1 text-center font-bold bg-red-50">{r.ALPHA || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-[9px] text-gray-400 mt-3">Keterangan: H = Hadir, I = Izin, S = Sakit, A = Alpha. Kolom bertanda merah = hari Minggu.</p>
        </div>
      )}

      <style>{`
        @page { size: A4 landscape; margin: 10mm 6mm; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
      `}</style>
    </>
  );
}
