export const dynamic = "force-dynamic";
import { verifyRole } from "@/lib/dal";
import { kelasBukuWali } from "@/lib/buku-wali";
import KartuOrtuCetak from "@/components/wali/KartuOrtuCetak";

export const metadata = { title: "Kartu Aktivasi Orang Tua" };

export default async function Page({ searchParams }: { searchParams: Promise<{ kelas?: string }> }) {
  const session = await verifyRole(["ADMIN"]);
  return <KartuOrtuCetak daftarKelas={await kelasBukuWali(session)} kelas={(await searchParams).kelas} basePath="/dashboard/admin/parents/kartu" kembaliHref="/dashboard/admin/parents" />;
}
