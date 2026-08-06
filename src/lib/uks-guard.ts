import "server-only";
import { assertJabatan } from "@/lib/jabatan-guard";

export async function assertUks(session: { role: string; email: string }) {
  if (session.role === "TEACHER" || session.role === "TAS") await assertJabatan(session, ["Kepala UKS"]);
}
