export const dynamic = "force-dynamic";

import React from "react";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookOpen, CalendarDays, Briefcase, UserCircle, IdCard, Mail, School, Printer, Pencil, CheckCircle2, FileText, Stethoscope, XCircle } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";

const STATUS_COLOR: Record<string, "emerald" | "blue" | "amber" | "red"> = {
  HADIR: "emerald",
  IZIN:  "blue",
  SAKIT: "amber",
  ALPHA: "red",
};
const STATUS_ICON: Record<string, React.ElementType> = {
  HADIR: CheckCircle2,
  IZIN:  FileText,
  SAKIT: Stethoscope,
  ALPHA: XCircle,
};

export default async function AdminStudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await verifyTasAccess();
  const { id } = await params;

  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true } },
      class: { select: { name: true, grade: true } },
      major: { select: { name: true, code: true } },
      grades: { orderBy: [{ semester: "asc" }, { subject: "asc" }] },
      attendance: { orderBy: { date: "desc" } },
      internship: true,
    },
  });

  if (!student) notFound();

  const grades = student.grades;
  const attendance = student.attendance;
  const semesters = [...new Set(grades.map(g => g.semester))].sort();

  const attSummary = ["HADIR", "IZIN", "SAKIT", "ALPHA"].map(s => ({
    status: s, count: attendance.filter(a => a.status === s).length,
  }));
  const totalDays = attendance.length;
  const presentPct = totalDays ? Math.round((attendance.filter(a => a.status === "HADIR").length / totalDays) * 100) : 0;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<UserCircle size={22} />}
        title={student.user.name}
        description="Detail siswa"
      />

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <Link href="/dashboard/admin/students" className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition">
          <ArrowLeft size={18} />
        </Link>
        <Link href={`/dashboard/admin/buku-induk/siswa/${student.id}/cetak`} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-2 text-sm bg-primary-50 border border-primary-100 hover:bg-primary-100 text-primary-700 rounded-xl font-semibold transition-colors whitespace-nowrap">
          <Printer size={14} /> Lihat Buku Induk
        </Link>
        <Link href={`/dashboard/admin/buku-induk/siswa?edit=${student.id}`}
          className="flex items-center gap-1.5 px-3 py-2 text-sm bg-gold hover:bg-gold-dark text-primary-900 rounded-xl font-semibold transition-colors whitespace-nowrap">
          <Pencil size={14} /> Edit Biodata
        </Link>
      </div>

      {/* Info profil */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-2xl bg-primary-50 border border-primary-100 flex items-center justify-center shrink-0">
            <UserCircle size={28} className="text-primary-700" />
          </div>
          <div>
            <h2 className="font-heading text-lg font-bold text-primary-900">{student.user.name}</h2>
            <p className="text-gray-400 text-sm">{student.class?.name ?? "Belum ada kelas"} · {student.major.name}</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-3 text-sm">
          <div className="flex items-start gap-2.5">
            <IdCard size={15} className="text-gray-400 mt-0.5 shrink-0" />
            <div><p className="text-gray-400 text-xs">NIS</p><p className="font-mono font-medium">{student.nis}</p></div>
          </div>
          {student.nisn && (
            <div className="flex items-start gap-2.5">
              <IdCard size={15} className="text-gray-400 mt-0.5 shrink-0" />
              <div><p className="text-gray-400 text-xs">NISN</p><p className="font-mono font-medium">{student.nisn}</p></div>
            </div>
          )}
          <div className="flex items-start gap-2.5">
            <Mail size={15} className="text-gray-400 mt-0.5 shrink-0" />
            <div><p className="text-gray-400 text-xs">Email</p><p className="font-medium">{student.user.email}</p></div>
          </div>
          <div className="flex items-start gap-2.5">
            <School size={15} className="text-gray-400 mt-0.5 shrink-0" />
            <div><p className="text-gray-400 text-xs">Kelas</p><p className="font-medium">{student.class?.name ?? "—"}</p></div>
          </div>
          <div className="flex items-start gap-2.5">
            <BookOpen size={15} className="text-gray-400 mt-0.5 shrink-0" />
            <div><p className="text-gray-400 text-xs">Jurusan</p><p className="font-medium">{student.major.name}</p></div>
          </div>
        </div>
      </div>

      {/* Rekap absensi */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
        <h3 className="font-heading font-semibold text-primary-900 mb-4 flex items-center gap-2">
          <CalendarDays size={16} className="text-primary-700" /> Kehadiran
        </h3>
        <div className="grid grid-cols-4 gap-3 mb-3">
          {attSummary.map(({ status, count }) => (
            <StatTile key={status} size="md" color={STATUS_COLOR[status]} icon={STATUS_ICON[status]} value={count} label={status} />
          ))}
        </div>
        <p className="text-sm text-gray-500">Total: {totalDays} hari · Kehadiran: <strong>{presentPct}%</strong></p>

        {attendance.length > 0 && (
          <div className="mt-4 rounded-xl overflow-hidden border border-gray-100">
            <div className="max-h-48 overflow-y-auto overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-primary-100"
                    style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.05) 0%, rgba(27,43,107,0.03) 100%)" }}>
                    <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Tanggal</th>
                    <th className="text-center px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.slice(0, 30).map(a => (
                    <tr key={a.id} className="border-b border-gray-50 last:border-0 hover:bg-primary-50/30 transition-colors">
                      <td className="px-5 py-3.5 text-gray-600 text-xs">
                        {new Date(a.date).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLOR[a.status] ?? "bg-gray-50 text-gray-500 border border-gray-200"}`}>{a.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Nilai */}
      {semesters.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
          <h3 className="font-heading font-semibold text-primary-900 mb-4 flex items-center gap-2">
            <BookOpen size={16} className="text-primary-700" /> Nilai per Semester
          </h3>
          <div className="space-y-6">
            {semesters.map(sem => {
              const sg = grades.filter(g => g.semester === sem);
              const subjects = [...new Set(sg.map(g => g.subject))];
              return (
                <div key={sem}>
                  <p className="font-semibold text-sm text-primary-800 mb-2">{sem}</p>
                  <div className="overflow-x-auto rounded-xl border border-gray-100 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-primary-100"
                          style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.05) 0%, rgba(27,43,107,0.03) 100%)" }}>
                          <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Mapel</th>
                          <th className="text-center px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Tugas</th>
                          <th className="text-center px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">UH</th>
                          <th className="text-center px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">UTS</th>
                          <th className="text-center px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">UAS</th>
                          <th className="text-center px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Rata-rata</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subjects.map(subject => {
                          const rows = sg.filter(g => g.subject === subject);
                          const getScore = (type: string) => rows.find(g => g.type === type)?.score ?? null;
                          const scores = ["Tugas", "Ulangan Harian", "UTS", "UAS"].map(t => getScore(t)).filter((s): s is number => s !== null);
                          const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
                          const cell = (val: number | null) => val !== null
                            ? <span className={`font-semibold ${val >= 75 ? "text-emerald-700" : "text-red-600"}`}>{val}</span>
                            : <span className="text-gray-300">—</span>;
                          return (
                            <tr key={subject} className="border-b border-gray-50 last:border-0 hover:bg-primary-50/30 transition-colors">
                              <td className="px-5 py-3.5 font-medium text-primary-900">{subject}</td>
                              <td className="px-5 py-3.5 text-center">{cell(getScore("Tugas"))}</td>
                              <td className="px-5 py-3.5 text-center">{cell(getScore("Ulangan Harian"))}</td>
                              <td className="px-5 py-3.5 text-center">{cell(getScore("UTS"))}</td>
                              <td className="px-5 py-3.5 text-center">{cell(getScore("UAS"))}</td>
                              <td className="px-5 py-3.5 text-center">
                                {avg !== null ? <span className={`font-bold ${avg >= 75 ? "text-emerald-700" : "text-red-600"}`}>{avg.toFixed(1)}</span> : <span className="text-gray-300">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PKL */}
      {student.internship && (
        <div className="bg-primary-50 border border-primary-100 rounded-2xl p-5">
          <h3 className="font-heading font-semibold text-primary-900 mb-4 flex items-center gap-2">
            <Briefcase size={16} className="text-primary-700" /> PKL
          </h3>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div><span className="text-gray-400 text-xs block">Perusahaan</span><strong>{student.internship.company}</strong></div>
            <div><span className="text-gray-400 text-xs block">Posisi</span><strong>{student.internship.position}</strong></div>
            <div><span className="text-gray-400 text-xs block">Supervisor</span><strong>{student.internship.supervisor}</strong></div>
            <div><span className="text-gray-400 text-xs block">Status</span>
              <span className={`inline-flex font-semibold text-xs px-2.5 py-1 rounded-full border ${student.internship.status === "COMPLETED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>
                {student.internship.status === "COMPLETED" ? "Selesai" : "Sedang PKL"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
