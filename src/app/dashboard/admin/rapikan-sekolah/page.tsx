export const dynamic = "force-dynamic";
import { verifyRole } from "@/lib/dal";
import { assertJabatan, jabatanAtauAlihkan } from "@/lib/jabatan-guard";
import { BUKU_INDUK_FULL_JABATAN } from "@/lib/buku-induk-access";
import RapikanSekolahManager from "@/components/spmb/RapikanSekolahManager";

/** Rapikan Nama Sekolah di luar Pusat SPMB (8 Okt 2026) — komponen & API yang sama; tab awal Buku Induk Siswa.
 *  Hak mengubah Buku Induk tetap diputuskan API (`/api/spmb/sekolah-asal`): Admin & BUKU_INDUK_FULL_JABATAN. */
export default async function Page() {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  await jabatanAtauAlihkan(session, () => assertJabatan(session, BUKU_INDUK_FULL_JABATAN));
  return <RapikanSekolahManager awal="induk" />;
}
