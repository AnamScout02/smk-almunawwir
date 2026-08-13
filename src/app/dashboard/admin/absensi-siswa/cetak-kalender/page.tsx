export const dynamic = "force-dynamic";

import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getJabatanNames } from "@/lib/jabatan-guard";
import { KESISWAAN_BK_JABATAN } from "@/lib/kesiswaan-guard";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import PrintButton from "@/components/shared/PrintButton";

const STATUS_LETTER: Record<string, string> = { HADIR: "H", IZIN: "I", SAKIT: "S", ALPHA: "A" };
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

/** Kalender absensi 1 bulan penuh per siswa (kolom = tanggal, Minggu diwarnai, rekap S/I/A di
 * ujung) — SATU-SATUNYA tempat lihat rekap bulanan (2026-08-12: dulu ada juga tab "Kalender
 * Bulanan" terpisah di AbsensiSiswaManager yg isinya dobel persis, sudah dihapus — link dari sana
 * sekarang cuma mengarah ke sini). Halaman ini WYSIWYG di layar (bisa dipakai lihat-lihat biasa)
 * SEKALIGUS cetak — tidak perlu 2 tempat terpisah utk 2 kebutuhan itu. Beda dari cetak-form (yang
 * KOSONG/kertas manual), halaman ini terisi data digital SUNGGUHAN yang sudah diinput wali kelas —
 * dimaksudkan sbg pengganti cetak arsip fisik kalau input kertas manual via ketua kelas/sekretaris
 * kelak ditiadakan (data tetap bisa dicetak dari sini). Guard scope kelas sama persis
 * /api/teacher/attendance/monthly-grid (wali kelas → kelas walinya saja; Kesiswaan/BK & ADMIN →
 * bebas kelas manapun via ?classId=).
 *
 * Gaya cetak SENGAJA disamakan dgn lembar "Absensi Siswa"/"Rekap Absensi Bulanan" di
 * /dashboard/admin/absensi-jurnal/cetak-kelas (kop 3-baris, InfoRow, header tabel primary-900,
 * blok Ket + tanda tangan wali kelas) — bedanya di sini landscape (kolom tanggal bisa sampai 31)
 * & datanya hidup dari Attendance digital, bukan kertas kosong. */
export default async function CetakKalenderAbsensiPage({ searchParams }: { searchParams: Promise<{ classId?: string; month?: string }> }) {
  const session = await verifyRole(["ADMIN", "TEACHER"]);
  const { classId: qClassId, month: qMonth } = await searchParams;

  const now = new Date();
  const month = qMonth && /^\d{4}-\d{2}$/.test(qMonth) ? qMonth : `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const dateFilter = { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) };
  const tahunPelajaran = m >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
  const semester = m >= 7 ? "GANJIL" : "GENAP";

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
    include: { major: { select: { name: true } }, homeroom: { select: { user: { select: { name: true } } } } },
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
  const todayUTC = new Date(); todayUTC.setUTCHours(0, 0, 0, 0);
  const suspiciousDays = new Set<number>(); // hari sekolah (bukan Minggu) yg sudah lewat — dipakai per-sel di bawah kalau datanya kosong
  for (let d = 1; d <= daysInMonth; d++) {
    const dUTC = new Date(Date.UTC(y, m - 1, d));
    if (dUTC.getUTCDay() === 0) sundays.push(d);
    else if (dUTC.getTime() <= todayUTC.getTime()) suspiciousDays.add(d);
  }
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const rows = students.map(s => {
    const cells: Record<number, string> = {};
    for (const a of s.attendance) cells[new Date(a.date).getUTCDate()] = STATUS_LETTER[a.status] ?? "";
    return {
      nis: s.nis,
      name: s.user.name,
      gender: s.gender,
      cells,
      SAKIT: s.attendance.filter(a => a.status === "SAKIT").length,
      IZIN: s.attendance.filter(a => a.status === "IZIN").length,
      ALPHA: s.attendance.filter(a => a.status === "ALPHA").length,
    };
  });
  const jumlahL = rows.filter(r => r.gender === "L").length;
  const jumlahP = rows.filter(r => r.gender === "P").length;
  const monthLabel = `${BULAN[m - 1]} ${y}`;
  const homeroomName = activeClass?.homeroom?.user.name ?? "";

  const prevMonthDate = new Date(Date.UTC(y, m - 2, 1));
  const nextMonthDate = new Date(Date.UTC(y, m, 1));
  const prevMonth = `${prevMonthDate.getUTCFullYear()}-${String(prevMonthDate.getUTCMonth() + 1).padStart(2, "0")}`;
  const nextMonth = `${nextMonthDate.getUTCFullYear()}-${String(nextMonthDate.getUTCMonth() + 1).padStart(2, "0")}`;
  const classIdQuery = activeClass ? `classId=${activeClass.id}&` : "";

  return (
    <>
      <div className="print:hidden sticky top-0 z-30">
        <div className="bg-primary-900 text-white px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/admin/absensi-siswa" className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition">
              <ArrowLeft size={16} />
            </Link>
            <div>
              <h1 className="font-heading font-bold">Cetak Kalender Absensi Bulanan{activeClass ? ` — ${activeClass.name}` : ""}</h1>
              <p className="text-white/50 text-xs">Rekap digital 1 bulan — kolom tanggal, Minggu diwarnai, rekap S/I/A</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-white/10 rounded-full px-1 py-1">
              <Link href={`/dashboard/admin/absensi-siswa/cetak-kalender?${classIdQuery}month=${prevMonth}`}
                className="w-7 h-7 rounded-full hover:bg-white/20 flex items-center justify-center transition" title="Bulan sebelumnya">
                <ChevronLeft size={14} />
              </Link>
              <span className="text-xs font-semibold px-1 whitespace-nowrap">{monthLabel}</span>
              <Link href={`/dashboard/admin/absensi-siswa/cetak-kalender?${classIdQuery}month=${nextMonth}`}
                className="w-7 h-7 rounded-full hover:bg-white/20 flex items-center justify-center transition" title="Bulan berikutnya">
                <ChevronRight size={14} />
              </Link>
            </div>
            <PrintButton />
          </div>
        </div>
        <div className="bg-primary-700 px-6 py-2.5 flex gap-1.5 flex-wrap">
          {classes.map(c => (
            <Link key={c.id} href={`/dashboard/admin/absensi-siswa/cetak-kalender?classId=${c.id}&month=${month}`}
              className={`text-[11px] font-semibold px-2 py-1 rounded-full ${c.id === activeClass?.id ? "bg-white text-primary-900" : "bg-white/10 hover:bg-white/20 text-white"}`}>
              {c.name}
            </Link>
          ))}
        </div>
      </div>

      {!activeClass ? (
        <div className="p-8 text-center text-gray-400">Belum ada kelas yang bisa diakses.</div>
      ) : (
        <div className="print-doc bg-white p-6 print:p-2">
          <div className="text-center mb-2">
            <p className="font-bold leading-tight text-sm text-primary-900">REKAP ABSENSI SISWA SMK AL MUNAWWIR IIBS</p>
            <p className="font-bold leading-tight text-xs text-primary-900">TAHUN PELAJARAN {tahunPelajaran}</p>
            <p className="font-bold leading-tight text-xs text-primary-900">SEMESTER {semester}</p>
          </div>
          <div className="mb-2 space-y-0">
            <div className="flex text-xs text-primary-700"><span className="w-40 shrink-0">Kelas</span><span>: {activeClass.name}</span></div>
            <div className="flex text-xs text-primary-700"><span className="w-40 shrink-0">Kompetensi Keahlian</span><span>: {activeClass.major.name}</span></div>
            <div className="flex text-xs text-primary-700"><span className="w-40 shrink-0">Bulan</span><span>: {monthLabel}</span></div>
          </div>

          <div className="overflow-x-auto">
            <table className="border-collapse table-fixed text-[9px] print:text-[7px]">
              <thead>
                <tr className="bg-primary-900 text-white">
                  <th className="border border-primary-900 px-1 py-1 w-6">No</th>
                  <th className="border border-primary-900 px-1 py-1 w-14">NIS</th>
                  <th className="border border-primary-900 px-2 py-1 w-24 text-left">Nama</th>
                  <th className="border border-primary-900 px-1 py-1 w-5">L/P</th>
                  {days.map(d => (
                    <th key={d} className={`border border-primary-900 px-0.5 py-1 w-5 ${sundays.includes(d) ? "bg-red-800" : ""}`}>{d}</th>
                  ))}
                  <th className="border border-primary-900 px-1 py-1 w-6 bg-amber-700">S</th>
                  <th className="border border-primary-900 px-1 py-1 w-6 bg-blue-700">I</th>
                  <th className="border border-primary-900 px-1 py-1 w-6 bg-red-700">A</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={7 + days.length} className="border border-gray-300 px-2 py-4 text-center text-gray-400">Belum ada siswa aktif di kelas ini.</td></tr>
                ) : rows.map((r, i) => (
                  <tr key={r.nis}>
                    <td className="border border-gray-300 text-center h-5">{i + 1}</td>
                    <td className="border border-gray-300 px-1 font-mono text-primary-700 overflow-hidden text-ellipsis whitespace-nowrap">{r.nis}</td>
                    <td className="border border-gray-300 px-2 font-semibold text-gray-800 overflow-hidden text-ellipsis whitespace-nowrap" title={r.name}>{r.name}</td>
                    <td className="border border-gray-300 text-center">{r.gender ?? ""}</td>
                    {days.map(d => {
                      const empty = !r.cells[d];
                      const suspicious = empty && suspiciousDays.has(d);
                      return (
                        <td key={d} className={`border border-gray-300 px-0.5 py-1 text-center ${r.cells[d] ? "font-bold" : suspicious ? "text-amber-600 font-bold" : "text-gray-300"} ${sundays.includes(d) ? "bg-red-50" : suspicious ? "bg-amber-100" : ""}`}>
                          {r.cells[d] === "H" ? "•" : (r.cells[d] ?? "·")}
                        </td>
                      );
                    })}
                    <td className="border border-gray-300 px-1 py-1 text-center font-bold bg-amber-50">{r.SAKIT || ""}</td>
                    <td className="border border-gray-300 px-1 py-1 text-center font-bold bg-blue-50">{r.IZIN || ""}</td>
                    <td className="border border-gray-300 px-1 py-1 text-center font-bold bg-red-50">{r.ALPHA || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-start justify-between mt-3 text-[10px] text-primary-700">
            <div>
              <p className="font-semibold">Ket:</p>
              <p>Laki-Laki : {jumlahL}</p>
              <p>Perempuan : {jumlahP}</p>
              <p>Jumlah : {jumlahL + jumlahP}</p>
              <p className="mt-1">H = Hadir &nbsp; I = Izin &nbsp; S = Sakit &nbsp; A = Alfa &nbsp; · = Belum ada data. Kolom tanggal merah = hari Minggu. Sel kuning = hari sekolah sudah lewat tapi belum ada data (kemungkinan wali kelas belum absen).</p>
            </div>
            <div className="text-xs text-primary-700 text-center">
              <p>Singojuruh, {monthLabel}</p>
              <p>Wali Kelas</p>
              <div className="h-12" />
              <p className="font-bold underline text-primary-900">{homeroomName || "—"}</p>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @page { size: A4 landscape; margin: 2cm; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
      `}</style>
    </>
  );
}
