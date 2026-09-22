export const dynamic = "force-dynamic";

import { assertBukuIndukSiswaScope } from "@/lib/buku-induk-access";
import BukuIndukSiswaManager from "@/components/shared/BukuIndukSiswaManager";

/** Buku Induk Siswa dari portal guru — dapat diakses WALI KELAS (di-scope otomatis ke kelas
 * walinya sendiri saja) MAUPUN guru berjabatan Operator Sekolah (akses semua kelas, disamakan
 * dengan TAS) — lihat src/lib/buku-induk-access.ts. Guru lain (bukan keduanya) di-redirect balik
 * ke /login oleh assertBukuIndukSiswaScope() sebelum halaman ini sempat dirender. */
export default async function TeacherBukuIndukSiswaPage() {
  const scope = await assertBukuIndukSiswaScope();
  // Wali kelas (scope CLASS) = baca saja + unduh Excel kelasnya (permintaan user 17 Sep 2026); Operator Sekolah tetap bisa mengubah.
  return <BukuIndukSiswaManager backHref="/dashboard/teacher" canManageAccount={scope.scope === "ALL"} hanyaBaca={scope.scope === "CLASS"} />;
}
