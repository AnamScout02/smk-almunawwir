export const dynamic = "force-dynamic";
import { verifyRole } from "@/lib/dal";
import { assertJabatan, jabatanAtauAlihkan } from "@/lib/jabatan-guard";
import LaporanTracerSheet from "@/components/shared/LaporanTracerSheet";

export const metadata = { title: "Laporan Tracer Study" };

export default async function Page() {
  const session = await verifyRole(["TEACHER"]);
  await jabatanAtauAlihkan(session, () => assertJabatan(session, ["Koordinator BKK", "Wakil Kepala Humas"]));
  return <LaporanTracerSheet kembaliHref="/dashboard/teacher/humas/tracer-study/sebaran" />;
}
