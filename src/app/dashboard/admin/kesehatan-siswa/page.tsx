export const dynamic = "force-dynamic";

import { HeartPulse } from "lucide-react";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { riwayatUks } from "@/lib/uks-akses";
import PageHeader from "@/components/admin/PageHeader";
import RiwayatUksTabel from "@/components/uks/RiwayatUksTabel";

export const metadata = { title: "Kesehatan Siswa" };

/** Salinan portal ADMIN (19 September 2026) — superadmin berakses penuh tetapi bukan guru/pegawai,
 * jadi halaman ini disediakan di portalnya sendiri. Isinya komponen yang sama, bukan duplikat kode. */
export default async function Page() {
  await verifyTasAccess();
  const data = await riwayatUks({});
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<HeartPulse size={22} />} title="Kesehatan Siswa"
        description="Riwayat kunjungan UKS 6 bulan terakhir seluruh sekolah — data rahasia, hanya untuk pendampingan" />
      <RiwayatUksTabel data={data} />
    </div>
  );
}
