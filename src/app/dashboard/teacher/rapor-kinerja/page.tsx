export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { bolehPantauGuru } from "@/lib/pantau-guru";
import RaporKinerjaDaftar from "@/components/kinerja/RaporKinerjaDaftar";

export const metadata = { title: "Rapor Kinerja" };

/** Pimpinan melihat daftar semua guru; guru lain langsung ke rapornya sendiri. */
export default async function Page() {
  const session = await verifyRole(["TEACHER"]);
  if (await bolehPantauGuru(session)) return <RaporKinerjaDaftar basePath="/dashboard/teacher/rapor-kinerja" />;
  const t = await prisma.teacher.findFirst({ where: { userId: session.userId }, select: { id: true } });
  redirect(t ? `/dashboard/teacher/rapor-kinerja/${t.id}` : "/dashboard/teacher");
}
