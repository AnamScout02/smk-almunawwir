export const dynamic = "force-dynamic";

import { verifyRole } from "@/lib/dal";
import { hakSurvei } from "@/lib/survei";
import SurveiResponden from "@/components/survei/SurveiResponden";

export const metadata = { title: "Survei & Angket" };

export default async function Page() {
  const session = await verifyRole(["TEACHER"]);
  const hak = await hakSurvei(session);
  return <SurveiResponden kelolaHref={hak.boleh ? "/dashboard/teacher/survei/kelola" : undefined} />;
}
