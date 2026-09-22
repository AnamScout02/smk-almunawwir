export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import SertifikatPklCetak from "@/components/pkl/SertifikatPklCetak";

export const metadata = { title: "Sertifikat PKL" };

export default async function Page({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const pkl = await prisma.internship.findUnique({ where: { studentId }, select: { id: true } });
  if (!pkl) redirect("/dashboard/teacher/pkl");
  return <SertifikatPklCetak internshipId={pkl.id} kembaliHref={`/dashboard/teacher/pkl/${studentId}`} />;
}
