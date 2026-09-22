export const dynamic = "force-dynamic";

import { verifyDapodikAccess } from "@/lib/dapodik-guard";
import { konfigurasiDapodik } from "@/lib/dapodik";
import DapodikManager from "@/components/admin/DapodikManager";

/** SINKRON DAPODIK — tes koneksi Web Service dan daftar perbaikan untuk operator Dapodik. Data TU di situs adalah acuan;
 * halaman ini hanya membaca Dapodik dan tidak menulis ke mana pun (lihat src/lib/dapodik-sinkron.ts). */
export default async function DapodikPage() {
  const { bolehUbah } = await verifyDapodikAccess();
  const k = await konfigurasiDapodik();
  return (
    <DapodikManager url={k.url} urlBawaan={k.urlBawaan} alamatManual={k.alamatManual} ipServer={k.ipServer} ipManual={k.ipManual}
      adaKunci={k.adaKunci} kunciManual={k.kunciManual} kunciRusak={k.kunciRusak} adaKunciBawaan={k.adaKunciBawaan}
      npsn={k.npsn} bolehUbah={bolehUbah} />
  );
}
