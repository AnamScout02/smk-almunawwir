export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import DknTable from "@/components/teacher/DknTable";

export default async function AdminDknClassPage({ params }: { params: Promise<{ classId: string }> }) {
  await verifyRole(["ADMIN"]);
  const { classId } = await params;

  const cls = await prisma.class.findUnique({ where: { id: classId }, select: { id: true } });
  if (!cls) notFound();

  const settings = await getSettings(["logo.full_white"]);

  return <DknTable classId={classId} logoUrl={settings["logo.full_white"]} />;
}
