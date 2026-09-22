import KpiDashboard from "@/components/shared/KpiDashboard";

/** Salinan portal ADMIN (19 September 2026) — superadmin berakses penuh tetapi bukan guru/pegawai,
 * jadi halaman ini disediakan di portalnya sendiri. Isinya komponen yang sama, bukan duplikat kode. */
export default function Page() {
  return <KpiDashboard mode="leadership" />;
}
