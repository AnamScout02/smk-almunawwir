import { Suspense } from "react";
import FormNilaiRaporManager from "@/components/rapor/FormNilaiRaporManager";

export const metadata = { title: "Form Nilai Rapor" };

export default function Page() {
  return <Suspense><FormNilaiRaporManager basePath="/dashboard/teacher/form-nilai-rapor" /></Suspense>;
}
