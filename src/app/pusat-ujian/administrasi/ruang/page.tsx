export const dynamic = "force-dynamic";

import { verifyRole } from "@/lib/dal";
import { bolehAturUjian } from "@/lib/kegiatan-ujian-server";
import DenahRuangManager from "@/components/ujian/DenahRuangManager";

/** DENAH RUANG UJIAN — pengatur (Admin/Wakil Kepala Kurikulum) membagi peserta; petugas lain melihat & mencetak. */
export default async function DenahRuangPage() {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  const bolehAtur = await bolehAturUjian(session).catch(() => false);
  return <DenahRuangManager basePath="/pusat-ujian" bolehAtur={bolehAtur} />;
}
