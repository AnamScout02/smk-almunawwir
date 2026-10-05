export const dynamic = "force-dynamic";

import { verifyRole } from "@/lib/dal";
import { assertEvent } from "@/lib/event-guard";
import { jabatanAtauAlihkan } from "@/lib/jabatan-guard";
import EventManager from "@/components/shared/EventManager";

export default async function Page() {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  await jabatanAtauAlihkan(session, () => assertEvent(session));
  return <EventManager />;
}
