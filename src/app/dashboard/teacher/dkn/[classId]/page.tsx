export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import DknTable from "@/components/teacher/DknTable";

export default async function TeacherDknClassPage({ params }: { params: Promise<{ classId: string }> }) {
  const session = await verifyRole(["TEACHER", "ADMIN"]);
  const { classId } = await params;

  if (session.role === "TEACHER") {
    const teacher = await prisma.teacher.findFirst({
      where: { user: { email: session.email } },
      include: { homeroomOf: { select: { id: true } } },
    });
    if (!teacher?.homeroomOf.some(c => c.id === classId)) notFound();
  }

  const settings = await getSettings(["logo.full_white"]);

  return <DknTable classId={classId} logoUrl={settings["logo.full_white"]} backHref="/dashboard/teacher/dkn" />;
}
