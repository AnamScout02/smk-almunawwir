export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { History, Printer } from "lucide-react";
import { assertBukuIndukSiswaScope } from "@/lib/buku-induk-access";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/admin/PageHeader";
import DaftarRiwayatInduk from "@/components/admin/DaftarRiwayatInduk";
import TombolKembali from "@/components/shared/TombolKembali";

/** Riwayat perubahan data satu siswa — dibaca dari ActivityLog (action UPDATE_BUKU_INDUK dst),
 * termasuk rincian kolom mana yang berubah beserta nilai sebelum & sesudahnya. */
export default async function RiwayatSiswaPage({ params }: { params: Promise<{ id: string }> }) {
  const scope = await assertBukuIndukSiswaScope();
  const { id } = await params;

  const siswa = await prisma.student.findUnique({
    where: { id },
    select: { id: true, nis: true, classId: true, user: { select: { name: true } }, class: { select: { name: true } } },
  });
  if (!siswa) notFound();
  // Wali kelas hanya boleh melihat riwayat siswa di kelas walinya sendiri.
  if (scope.scope === "CLASS" && !scope.classIds.includes(siswa.classId ?? "")) notFound();

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<History size={22} />} title="Riwayat Perubahan Data"
        description={`${siswa.user.name} — ${siswa.nis}${siswa.class ? ` · ${siswa.class.name}` : ""}`} />

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <TombolKembali href={"/dashboard/admin/buku-induk/siswa"} />
        <div className="flex-1" />
        <Link href={`/dashboard/admin/buku-induk/siswa/${siswa.id}/cetak`}
          className="btn-modal-cancel">
          <Printer size={16} /> Buku Induk Siswa
        </Link>
      </div>

      <DaftarRiwayatInduk entitas="Student" id={siswa.id} bolehKembalikan={scope.scope === "ALL"} />
    </div>
  );
}
