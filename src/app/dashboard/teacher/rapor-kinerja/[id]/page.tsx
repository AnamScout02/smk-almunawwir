export const dynamic = "force-dynamic";
import { notFound, redirect } from "next/navigation";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { bolehPantauGuru } from "@/lib/pantau-guru";
import { susunRaporKinerja } from "@/lib/rapor-kinerja";
import RaporKinerjaLembar from "@/components/kinerja/RaporKinerjaLembar";

/** Guru hanya boleh membuka rapornya SENDIRI; pimpinan (Kepala Sekolah, Kurikulum, Penjamin Mutu) boleh semua. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const session = await verifyRole(["TEACHER"]);
  const { id } = await params;
  const pimpinan = await bolehPantauGuru(session);
  if (!pimpinan) {
    const t = await prisma.teacher.findFirst({ where: { userId: session.userId }, select: { id: true } });
    if (t?.id !== id) redirect("/dashboard/teacher/rapor-kinerja");
  }
  const r = await susunRaporKinerja(id);
  if (!r) notFound();
  return <RaporKinerjaLembar r={r} kembaliHref={pimpinan ? "/dashboard/teacher/rapor-kinerja" : undefined} />;
}
