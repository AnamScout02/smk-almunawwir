export const dynamic = "force-dynamic";

import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { ArrowLeft, FileText, Lock, CheckCircle2, Stethoscope, CalendarX, XCircle } from "lucide-react";
import Link from "next/link";
import PrintButton from "@/components/shared/PrintButton";
import PrintKop from "@/components/shared/PrintKop";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import { getOrCreateVerificationToken } from "@/lib/verification";
import { generateQrDataUrl } from "@/lib/qrcode";

export const metadata = { title: "Rapor Nilai — Portal Siswa" };

export default async function RaporPage() {
  const session = await verifyRole(["STUDENT"]);

  const settings = await getSettings(["logo.full_white"]);
  const student = await prisma.student.findFirst({
    where: { user: { email: session.email } },
    include: {
      user: { select: { name: true, email: true } },
      class: { select: { name: true, grade: true } },
      major: { select: { name: true, code: true } },
      grades: { orderBy: [{ semester: "asc" }, { subject: "asc" }] },
      attendance: { orderBy: { date: "asc" } },
    },
  });

  let qrDataUrl = "";
  if (student) {
    const token = await getOrCreateVerificationToken(student.id);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    qrDataUrl = await generateQrDataUrl(`${baseUrl}/verify/${token}`);
  }

  const grades = student?.grades ?? [];
  const semesters = [...new Set(grades.map(g => g.semester))].sort();

  const approvals = student?.classId
    ? await prisma.raporApproval.findMany({ where: { classId: student.classId, semester: { in: semesters } }, select: { semester: true } })
    : [];
  const approvedSemesters = new Set(approvals.map(a => a.semester));

  const gradesBySemester = semesters.map(sem => {
    const sg = grades.filter(g => g.semester === sem);
    const subjects = [...new Set(sg.map(g => g.subject))];
    const bySubject = subjects.map(subject => {
      const rows = sg.filter(g => g.subject === subject);
      const getScore = (type: string) => rows.find(g => g.type === type)?.score ?? null;
      const scores = ["Tugas", "Ulangan Harian", "UTS", "UAS"].map(t => getScore(t)).filter((s): s is number => s !== null);
      const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
      return {
        subject,
        tugas: getScore("Tugas"),
        uh: getScore("Ulangan Harian"),
        uts: getScore("UTS"),
        uas: getScore("UAS"),
        avg,
      };
    });
    const semAvg = bySubject.filter(s => s.avg !== null).reduce((a, s) => a + (s.avg ?? 0), 0) / bySubject.filter(s => s.avg !== null).length;
    return { sem, bySubject, semAvg: isNaN(semAvg) ? null : semAvg };
  });

  // Rekap absensi
  const attSummary = ["HADIR", "IZIN", "SAKIT", "ALPHA"].map(s => ({
    status: s,
    count: student?.attendance.filter(a => a.status === s).length ?? 0,
  }));
  const totalDays = student?.attendance.length ?? 0;
  const presentPct = totalDays ? Math.round(((student?.attendance.filter(a => a.status === "HADIR").length ?? 0) / totalDays) * 100) : 0;

  const today = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

  function scoreCell(val: number | null) {
    if (val === null) return <td className="border border-gray-200 px-3 py-2 text-center text-gray-300 text-xs">—</td>;
    return (
      <td className={`border border-gray-200 px-3 py-2 text-center font-semibold text-sm ${val >= 75 ? "text-emerald-700" : "text-red-600"}`}>
        {val}
      </td>
    );
  }

  return (
    <div className="p-6 lg:p-8 print:p-0">
      {/* Tombol aksi — tidak ikut print */}
      <div className="print:hidden">
        <PageHeader
          icon={<FileText size={22} />}
          title="Rapor Nilai"
          description="Laporan hasil belajar & rekap kehadiran"
          actions={
            <>
              <Link href="/dashboard/student" className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition">
                <ArrowLeft size={18} />
              </Link>
              <PrintButton />
            </>
          }
        />
      </div>

      {/* Konten rapor — ikut print */}
      <div className="print-doc max-w-4xl mx-auto px-6 py-8 print:p-6 print:max-w-none">
        {/* Header rapor */}
        <PrintKop title="Laporan Hasil Belajar Siswa" subtitle="SMK Al Munawwir IIBS" logoUrl={settings["logo.full_white"]} />
        <p className="text-center text-gray-400 text-xs mb-6 -mt-2">Singojuruh, Banyuwangi, Jawa Timur · NPSN 69896523</p>

        {/* Data siswa */}
        <div className="bg-gray-50 rounded-xl p-4 mb-6 grid grid-cols-2 gap-2 text-sm">
          <div><span className="text-gray-500">Nama</span><span className="mx-2">:</span><strong>{student?.user.name ?? session.name}</strong></div>
          <div><span className="text-gray-500">Kelas</span><span className="mx-2">:</span><strong>{student?.class?.name ?? "—"}</strong></div>
          <div><span className="text-gray-500">NIS</span><span className="mx-2">:</span><strong className="font-mono">{student?.nis ?? "—"}</strong></div>
          <div><span className="text-gray-500">Jurusan</span><span className="mx-2">:</span><strong>{student?.major?.name ?? "—"}</strong></div>
          <div><span className="text-gray-500">NISN</span><span className="mx-2">:</span><strong className="font-mono">{student?.nisn ?? "—"}</strong></div>
          <div><span className="text-gray-500">Dicetak</span><span className="mx-2">:</span>{today}</div>
        </div>

        {/* Nilai per semester */}
        {gradesBySemester.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8 print:hidden">Belum ada data nilai.</p>
        ) : (
          gradesBySemester.map(({ sem, bySubject, semAvg }) => (
            <div key={sem} className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-heading font-bold text-primary-900">Semester: {sem}</h4>
                {approvedSemesters.has(sem) && semAvg !== null && (
                  <span className={`text-sm font-bold px-3 py-1 rounded-full border ${semAvg >= 75 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"}`}>
                    Rata-rata: {semAvg.toFixed(1)}
                  </span>
                )}
              </div>
              {!approvedSemesters.has(sem) ? (
                <div className="border border-amber-100 bg-amber-50 rounded-xl py-10 text-center print:border-gray-200 print:bg-gray-50">
                  <Lock size={28} className="text-amber-400 mx-auto mb-2" />
                  <p className="text-amber-700 font-semibold text-sm">Rapor semester ini belum disahkan Kepala Sekolah</p>
                  <p className="text-amber-500 text-xs mt-1">Nilai akan tersedia setelah disahkan.</p>
                </div>
              ) : (
              <>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-primary-900 text-white">
                      <th className="border border-primary-800 px-3 py-2.5 text-left font-medium">Mata Pelajaran</th>
                      <th className="border border-primary-800 px-3 py-2.5 text-center font-medium w-16">Tugas</th>
                      <th className="border border-primary-800 px-3 py-2.5 text-center font-medium w-16">UH</th>
                      <th className="border border-primary-800 px-3 py-2.5 text-center font-medium w-16">UTS</th>
                      <th className="border border-primary-800 px-3 py-2.5 text-center font-medium w-16">UAS</th>
                      <th className="border border-primary-800 px-3 py-2.5 text-center font-medium w-20">Rata-rata</th>
                      <th className="border border-primary-800 px-3 py-2.5 text-center font-medium w-24">Predikat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bySubject.map(({ subject, tugas, uh, uts, uas, avg }, idx) => (
                      <tr key={subject} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="border border-gray-200 px-3 py-2 font-medium text-primary-900">{subject}</td>
                        {scoreCell(tugas)}
                        {scoreCell(uh)}
                        {scoreCell(uts)}
                        {scoreCell(uas)}
                        <td className={`border border-gray-200 px-3 py-2 text-center font-bold ${avg !== null ? (avg >= 75 ? "text-emerald-700" : "text-red-600") : "text-gray-300"}`}>
                          {avg !== null ? avg.toFixed(1) : "—"}
                        </td>
                        <td className="border border-gray-200 px-3 py-2 text-center text-xs font-semibold">
                          {avg === null ? "—" : avg >= 90 ? "A" : avg >= 80 ? "B" : avg >= 70 ? "C" : avg >= 60 ? "D" : "E"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-1">KKM: 75 · UH = Ulangan Harian · UTS = Ujian Tengah Semester · UAS = Ujian Akhir Semester</p>
              </>
              )}
            </div>
          ))
        )}

        {/* Rekap absensi */}
        {totalDays > 0 && (
          <div className="mt-6 border-t pt-6">
            <h4 className="font-heading font-bold text-primary-900 mb-3">Rekap Kehadiran</h4>
            <div className="grid grid-cols-4 gap-3">
              {attSummary.map(({ status, count }) => (
                <StatTile key={status} size="md"
                  color={status === "HADIR" ? "emerald" : status === "IZIN" ? "blue" : status === "SAKIT" ? "amber" : "red"}
                  icon={status === "HADIR" ? CheckCircle2 : status === "IZIN" ? CalendarX : status === "SAKIT" ? Stethoscope : XCircle}
                  value={count} label={status} />
              ))}
            </div>
            <p className="text-sm text-gray-500 mt-2">Total: {totalDays} hari · Persentase kehadiran: <strong>{presentPct}%</strong></p>
          </div>
        )}

        {/* Tanda tangan */}
        <div className="mt-10 grid grid-cols-3 gap-3 sm:gap-8 text-center text-sm">
          <div className="min-w-0">
            <p className="text-gray-500 mb-12">Wali Kelas,</p>
            <div className="border-b border-gray-400 mb-1" />
            <p className="text-gray-500 break-words">( _____________ )</p>
          </div>
          <div className="min-w-0">
            <p className="text-gray-500 mb-12">Mengetahui,<br />Kepala Sekolah</p>
            <div className="border-b border-gray-400 mb-1" />
            <p className="text-gray-500 break-words">( _____________ )</p>
          </div>
          <div className="min-w-0">
            <p className="text-gray-500 mb-12">Orang Tua / Wali,</p>
            <div className="border-b border-gray-400 mb-1" />
            <p className="text-gray-500 break-words">( _____________ )</p>
          </div>
        </div>

        {qrDataUrl && (
          <div className="mt-8 flex justify-center">
            <div className="text-center text-[10px] text-gray-400">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="QR verifikasi dokumen" className="w-20 h-20 mx-auto" />
              <p className="mt-1">Scan untuk verifikasi keaslian dokumen</p>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          body { background: white; }
        }
      `}</style>
    </div>
  );
}
