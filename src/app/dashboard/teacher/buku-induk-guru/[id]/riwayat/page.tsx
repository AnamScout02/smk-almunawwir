export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { History } from "lucide-react";
import { verifyBukuIndukFullAccess } from "@/lib/buku-induk-access";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/admin/PageHeader";
import { BarisKembali } from "@/components/shared/TombolKembali";
import DaftarRiwayatInduk from "@/components/admin/DaftarRiwayatInduk";

/** Riwayat perubahan Buku Induk satu guru/pegawai — padanan halaman riwayat siswa (9 Okt 2026). */
export default async function RiwayatGuruPage({ params }: { params: Promise<{ id: string }> }) {
  await verifyBukuIndukFullAccess();
  const { id } = await params;
  const guru = await prisma.teacher.findUnique({ where: { id }, select: { id: true, nip: true, user: { select: { name: true } } } });
  if (!guru) notFound();
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<History size={22} />} title="Riwayat Perubahan Data" description={`${guru.user.name} — ${guru.nip}`} />
      <BarisKembali href="/dashboard/teacher/buku-induk-guru" />
      <DaftarRiwayatInduk entitas="Teacher" id={guru.id} bolehKembalikan />
    </div>
  );
}
