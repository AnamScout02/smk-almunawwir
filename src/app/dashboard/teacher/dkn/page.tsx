export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardList, ChevronRight } from "lucide-react";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";

export default async function TeacherDknIndexPage() {
  const session = await verifyRole(["TEACHER", "ADMIN"]);

  const teacher = await prisma.teacher.findFirst({
    where: { user: { email: session.email } },
    include: { homeroomOf: { select: { id: true, name: true, grade: true, major: { select: { name: true } } }, orderBy: { grade: "asc" } } },
  });
  const classes = teacher?.homeroomOf ?? [];

  // Wali kelas cuma satu kelas — langsung lompat ke halaman DKN kelasnya, tidak perlu pilih dulu.
  if (classes.length === 1) redirect(`/dashboard/teacher/dkn/${classes[0].id}`);

  return (
    <div className="p-6 lg:p-8">
      <PageHeader icon={<ClipboardList size={22} />} title="DKN — Daftar Kumpulan Nilai" description="Input & cetak DKN kelas yang Anda wali kelasi, per semester" />

      {classes.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Anda Bukan Wali Kelas" description="Fitur DKN hanya tersedia untuk guru yang menjabat sebagai wali kelas." />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          {classes.map(c => (
            <Link key={c.id} href={`/dashboard/teacher/dkn/${c.id}`} className="flex items-center gap-3 px-5 py-4 hover:bg-primary-50/40 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-primary-900">{c.name}</p>
                <p className="text-xs text-gray-400">{c.major?.name ?? "—"}</p>
              </div>
              <ChevronRight size={16} className="text-gray-300 shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
