export const dynamic = "force-dynamic";
import { Calculator } from "lucide-react";
import { verifySession } from "@/lib/dal";
import { jabatanAtauAlihkan } from "@/lib/jabatan-guard";
import { assertBendahara } from "@/lib/bendahara-guard";
import PageHeader from "@/components/admin/PageHeader";
import AlokasiDanaManager from "@/components/shared/AlokasiDanaManager";

export const metadata = { title: "Alokasi Dana" };

/** Alokasi dana iuran per angkatan (src/lib/alokasi-dana.ts) — Admin & pemegang jabatan Bendahara. */
export default async function Page() {
  const session = await verifySession();
  await jabatanAtauAlihkan(session, () => assertBendahara(session));
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Calculator size={22} />} title="Alokasi Dana"
        description="Pembagian iuran per angkatan ke pos anggaran — rincian per siswa, bulan, semester, tahun, dan saldo realisasinya" />
      <AlokasiDanaManager basePath="/dashboard/teacher/alokasi-dana" />
    </div>
  );
}
