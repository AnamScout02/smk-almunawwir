export const dynamic = "force-dynamic";

import { verifyRole } from "@/lib/dal";
import { assertEvent } from "@/lib/event-guard";
import { jabatanAtauAlihkan } from "@/lib/jabatan-guard";
import EventManager from "@/components/shared/EventManager";

/** Lomba & Event untuk guru berjabatan JABATAN_EVENT (Humas, Publikasi, Kesiswaan, Pembina OSIS, Kepsek). */
export default async function Page() {
  const session = await verifyRole(["TEACHER", "ADMIN"]);
  await jabatanAtauAlihkan(session, () => assertEvent(session));
  return <EventManager />;
}
