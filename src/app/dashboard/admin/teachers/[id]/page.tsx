export const dynamic = "force-dynamic";

import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, BookOpen, Phone, Mail, Hash, School,
  Users, ClipboardList, GraduationCap, UserCircle, Pencil,
} from "lucide-react";
import StatTile from "@/components/admin/StatTile";

export default async function AdminTeacherDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await verifyRole(["ADMIN", "TAS"]);
  const { id } = await params;

  const teacher = await prisma.teacher.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true } },
      homeroomOf: {
        include: {
          students: {
            include: { user: { select: { name: true } } },
            orderBy: { nis: "asc" },
          },
          major: { select: { name: true, code: true } },
        },
      },
    },
  });

  if (!teacher) notFound();

  // Rangkuman nilai: groupBy subject + semester + type
  const gradeGroups = await prisma.grade.groupBy({
    by: ["subject", "semester", "type"],
    where: { teacherId: id },
    _count: { studentId: true },
    orderBy: [{ semester: "asc" }, { subject: "asc" }, { type: "asc" }],
  });

  // Hitung total unik
  const totalGrades = gradeGroups.reduce((sum, g) => sum + g._count.studentId, 0);
  const uniqueSubjects = [...new Set(gradeGroups.map(g => g.subject))];
  const uniqueSemesters = [...new Set(gradeGroups.map(g => g.semester))].sort();

  // Kelompokkan per semester → per subject
  const gradesBySemester = uniqueSemesters.map(sem => {
    const rows = gradeGroups.filter(g => g.semester === sem);
    const subjects = [...new Set(rows.map(g => g.subject))];
    return {
      semester: sem,
      subjects: subjects.map(subj => ({
        name: subj,
        types: rows.filter(g => g.subject === subj),
      })),
    };
  });

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/admin/teachers" className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="font-heading text-2xl font-bold text-primary-900">{teacher.user.name}</h1>
          <p className="text-gray-400 text-sm">Detail guru</p>
        </div>
        <Link href={`/dashboard/admin/buku-induk/guru?edit=${teacher.id}`}
          className="flex items-center gap-1.5 px-3 py-2 text-sm bg-primary-700 hover:bg-primary-800 text-white rounded-xl font-semibold transition-colors">
          <Pencil size={14} /> Edit Biodata
        </Link>
      </div>

      {/* Profil */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-2xl bg-primary-50 border border-primary-100 flex items-center justify-center shrink-0">
            <UserCircle size={28} className="text-primary-700" />
          </div>
          <div>
            <h2 className="font-heading text-lg font-bold text-primary-900">{teacher.user.name}</h2>
            <p className="text-gray-400 text-sm">{teacher.subject}</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <div className="flex items-start gap-2.5">
            <Hash size={15} className="text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-gray-400 text-xs">NIP</p>
              <p className="font-mono font-medium">{teacher.nip}</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <Mail size={15} className="text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-gray-400 text-xs">Email</p>
              <p className="font-medium">{teacher.user.email}</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <BookOpen size={15} className="text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-gray-400 text-xs">Mata Pelajaran</p>
              <p className="font-medium">{teacher.subject}</p>
            </div>
          </div>
          {teacher.phone && (
            <div className="flex items-start gap-2.5">
              <Phone size={15} className="text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-gray-400 text-xs">Nomor HP</p>
                <p className="font-medium">{teacher.phone}</p>
              </div>
            </div>
          )}
          <div className="flex items-start gap-2.5">
            <School size={15} className="text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-gray-400 text-xs">Wali Kelas</p>
              {teacher.homeroomOf.length > 0 ? (
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {teacher.homeroomOf.map(c => (
                    <span key={c.id} className="text-xs bg-primary-50 text-primary-700 border border-primary-100 px-2 py-0.5 rounded-full font-medium">{c.name}</span>
                  ))}
                </div>
              ) : (
                <p className="text-gray-300 font-medium">Bukan wali kelas</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Statistik nilai */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatTile size="md" color="primary" value={totalGrades} label="Total Nilai" />
        <StatTile size="md" color="emerald" value={uniqueSubjects.length} label="Mata Pelajaran" />
        <StatTile size="md" color="amber" value={uniqueSemesters.length} label="Semester Aktif" />
      </div>

      {/* Rekap nilai per semester */}
      {gradesBySemester.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
          <h3 className="font-heading font-semibold text-primary-900 mb-4 flex items-center gap-2">
            <ClipboardList size={16} className="text-primary-700" /> Rekap Nilai yang Diinput
          </h3>
          <div className="space-y-5">
            {gradesBySemester.map(({ semester, subjects }) => (
              <div key={semester}>
                <p className="font-semibold text-sm text-primary-800 mb-2 flex items-center gap-2">
                  <span className="text-xs bg-primary-50 text-primary-600 border border-primary-100 px-2.5 py-0.5 rounded-full font-medium">{semester}</span>
                </p>
                <div className="rounded-xl overflow-hidden border border-gray-100">
                  <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-primary-100"
                        style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.05) 0%, rgba(27,43,107,0.03) 100%)" }}>
                        <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Mata Pelajaran</th>
                        <th className="text-center px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Tugas</th>
                        <th className="text-center px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Ulangan Harian</th>
                        <th className="text-center px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">UTS</th>
                        <th className="text-center px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">UAS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subjects.map(({ name, types }) => {
                        const get = (type: string) => types.find(t => t.type === type)?._count.studentId ?? null;
                        const cell = (val: number | null) => val !== null
                          ? <span className="font-semibold text-emerald-700">{val} siswa</span>
                          : <span className="text-gray-300">—</span>;
                        return (
                          <tr key={name} className="border-b border-gray-50 last:border-0 hover:bg-primary-50/30 transition-colors">
                            <td className="px-5 py-3.5 font-medium text-primary-900">{name}</td>
                            <td className="px-5 py-3.5 text-center">{cell(get("Tugas"))}</td>
                            <td className="px-5 py-3.5 text-center">{cell(get("Ulangan Harian"))}</td>
                            <td className="px-5 py-3.5 text-center">{cell(get("UTS"))}</td>
                            <td className="px-5 py-3.5 text-center">{cell(get("UAS"))}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Kelas wali */}
      {teacher.homeroomOf.length > 0 && (
        <div className="space-y-4">
          {teacher.homeroomOf.map(cls => (
            <div key={cls.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-heading font-semibold text-primary-900 mb-4 flex items-center gap-2">
                <GraduationCap size={16} className="text-primary-700" />
                Siswa Wali Kelas — {cls.name}
                <span className="text-xs text-gray-400 font-normal">({cls.major.code})</span>
                <span className="ml-auto text-xs font-semibold text-primary-600 bg-primary-50 border border-primary-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                  <Users size={11} /> {cls.students.length}
                </span>
              </h3>
              {cls.students.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">Belum ada siswa di kelas ini</p>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {cls.students.map((s, i) => (
                    <div key={s.id} className="flex items-center gap-2.5 text-sm bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                      <span className="text-xs text-gray-300 w-5 text-center">{i + 1}</span>
                      <div>
                        <p className="font-medium text-primary-900 text-xs">{s.user.name}</p>
                        <p className="text-gray-400 font-mono text-xs">{s.nis}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {gradesBySemester.length === 0 && teacher.homeroomOf.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400">
          <ClipboardList size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Belum ada data nilai atau kelas wali yang terhubung</p>
        </div>
      )}
    </div>
  );
}
