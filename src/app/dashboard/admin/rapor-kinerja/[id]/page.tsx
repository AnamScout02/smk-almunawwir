export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import { verifyRole } from "@/lib/dal";
import { jabatanAtauAlihkan } from "@/lib/jabatan-guard";
import { assertPantauGuru } from "@/lib/pantau-guru";
import { susunRaporKinerja } from "@/lib/rapor-kinerja";
import RaporKinerjaLembar from "@/components/kinerja/RaporKinerjaLembar";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  await jabatanAtauAlihkan(session, () => assertPantauGuru(session));
  const r = await susunRaporKinerja((await params).id);
  if (!r) notFound();
  return <RaporKinerjaLembar r={r} kembaliHref="/dashboard/admin/rapor-kinerja" />;
}
