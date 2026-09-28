import { redirect } from "next/navigation";

/** Rute lama yang kembar dengan "Kinerja Pimpinan (KPI)" — keduanya merender KpiDashboard mode="leadership",
 * tetapi hanya /dashboard/admin/kinerja-pimpinan yang ada di menu (temuan sapuan tombol Kembali 24 Sep 2026:
 * halaman ini tidak ditautkan dari mana pun). Dialihkan supaya markah lama tetap berfungsi, bukan dihapus. */
export default function Page() {
  redirect("/dashboard/admin/kinerja-pimpinan");
}
