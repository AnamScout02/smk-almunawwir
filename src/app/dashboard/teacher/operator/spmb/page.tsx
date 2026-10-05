import { redirect } from "next/navigation";

/** Lihat catatan di /dashboard/admin/spmb-konversi — dilebur ke Pusat SPMB. */
export default function Page() {
  redirect("/pusat-spmb/konversi");
}
