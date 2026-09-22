import TugasInternalManager from "@/components/shared/TugasInternalManager";

export const metadata = { title: "Papan Tugas" };

export default function Page() {
  return <TugasInternalManager basePath="/dashboard/teacher" />;
}
