import PageHeader from "@/components/admin/PageHeader";
import { FileCheck2 } from "lucide-react";
import PklRegistrationReview from "@/components/shared/PklRegistrationReview";

export default function AdminPklPendaftaranPage() {
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<FileCheck2 size={22} />} title="Pendaftaran PKL" description="Tinjau pendaftaran PKL siswa kelas XI & kelola dokumen syarat" />
      <PklRegistrationReview />
    </div>
  );
}
