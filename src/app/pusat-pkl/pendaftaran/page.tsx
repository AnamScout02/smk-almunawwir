import PageHeader from "@/components/admin/PageHeader";
import { FileCheck2 } from "lucide-react";
import PklRegistrationReview from "@/components/shared/PklRegistrationReview";

/** Pendaftaran PKL di dalam Pusat PKL (permintaan user 9 Okt 2026: "pendaftaran pkl ikut masuk juga ke pusat pkl"). */
export default function Page() {
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<FileCheck2 size={22} />} title="Pendaftaran PKL" description="Tinjau pendaftaran PKL siswa, kelola dokumen syarat, dan atur jendela pendaftaran" />
      <PklRegistrationReview />
    </div>
  );
}
