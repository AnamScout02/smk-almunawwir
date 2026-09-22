export const dynamic = "force-dynamic";

import Link from "next/link";
import { ClipboardList, ChevronRight } from "lucide-react";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";

const GRADE_LABEL: Record<number, string> = { 10: "X", 11: "XI", 12: "XII" };

/** Beda dari versi guru (yang cuma nampilin kelas walinya sendiri lewat teacher.homeroomOf),
 * ADMIN boleh buka DKN kelas MANAPUN — jadi di sini list SEMUA kelas, dikelompokkan per
 * tingkat. Endpoint /api/teacher/dkn/[classId] sudah mendukung role ADMIN sejak awal
 * (assertHomeroomOwner meloloskan ADMIN tanpa syarat wali kelas). */
export default async function AdminDknIndexPage() {
  await verifyRole(["ADMIN"]);

  type ClassRow = { id: string; name: string; grade: number; major: { name: string } | null; homeroom: { user: { name: string } } | null };
  const classes: ClassRow[] = await prisma.class.findMany({
    select: { id: true, name: true, grade: true, major: { select: { name: true } }, homeroom: { select: { user: { select: { name: true } } } } },
    orderBy: [{ grade: "asc" }, { name: "asc" }],
  }).catch(() => []);

  const byGrade = new Map<number, ClassRow[]>();
  for (const c of classes) {
    if (!byGrade.has(c.grade)) byGrade.set(c.grade, []);
    byGrade.get(c.grade)!.push(c);
  }

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<ClipboardList size={22} />} title="DKN — Daftar Kumpulan Nilai" description="Input & cetak DKN semua kelas, per semester" />

      {classes.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Belum Ada Kelas" description="Tambahkan kelas terlebih dahulu di menu Kelas." />
      ) : (
        <div className="space-y-5">
          {[...byGrade.entries()].map(([grade, list]) => (
            <div key={grade}>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Kelas {GRADE_LABEL[grade] ?? grade}</p>
              <div className="panel divide-y divide-gray-50">
                {list.map(c => (
                  <Link key={c.id} href={`/dashboard/admin/dkn/${c.id}`} className="flex items-center gap-3 px-5 py-4 hover:bg-primary-50/40 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-primary-900">{c.name}</p>
                      <p className="text-xs text-gray-400">{c.major?.name ?? "—"}{c.homeroom ? ` · Wali: ${c.homeroom.user.name}` : " · Belum ada wali kelas"}</p>
                    </div>
                    <ChevronRight size={16} className="text-gray-300 shrink-0" />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
