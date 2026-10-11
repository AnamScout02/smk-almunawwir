export const dynamic = "force-dynamic";
import { verifyRole } from "@/lib/dal";
import { kelasBukuWali } from "@/lib/buku-wali";
import KartuOrtuCetak from "@/components/wali/KartuOrtuCetak";

export const metadata = { title: "Kartu Aktivasi Orang Tua" };

/** Wali kelas mencetak kartu untuk kelas walinya saja (daftar kelas dari `kelasBukuWali`, bukan dari alamat). */
export default async function Page({ searchParams }: { searchParams: Promise<{ kelas?: string }> }) {
  const session = await verifyRole(["TEACHER"]);
  return <KartuOrtuCetak daftarKelas={await kelasBukuWali(session)} kelas={(await searchParams).kelas} basePath="/dashboard/teacher/buku-wali/kartu-ortu" kembaliHref="/dashboard/teacher/buku-wali" />;
}
