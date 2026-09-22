export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { verifyBukuIndukFullAccess } from "@/lib/buku-induk-access";
import BukuIndukGuruManager from "@/components/shared/BukuIndukGuruManager";

/** Buku Induk Guru dari portal Guru — untuk guru berjabatan Operator Sekolah (atau merangkap TU). Guru lain dialihkan. */
export default async function TeacherBukuIndukGuruPage() {
  await verifyBukuIndukFullAccess();
  return <Suspense><BukuIndukGuruManager basePath="/dashboard/teacher/buku-induk-guru" /></Suspense>;
}
