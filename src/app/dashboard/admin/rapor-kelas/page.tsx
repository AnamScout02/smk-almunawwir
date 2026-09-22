import { verifyRole } from "@/lib/dal";
import RaporKelasManager from "@/components/rapor/RaporKelasManager";

export const metadata = { title: "Nilai & Rapor Kelas" };

/** Salinan portal ADMIN (22 September 2026, CLAUDE.md #55) — superadmin mengisi/memeriksa rapor semua kelas tanpa lewat
 * portal guru: Isian Rapor, Catatan Wali Kelas, kunci nilai, dan Cetak Rapor. */
export default async function Page() {
  await verifyRole(["ADMIN"]);
  return <RaporKelasManager portal="admin" />;
}
