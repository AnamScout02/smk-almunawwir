import "server-only";
import { assertJabatan } from "@/lib/jabatan-guard";
import { TAS_JABATAN } from "@/lib/tas-access-guard";
import { bolehSpmb } from "@/lib/spmb";
import { JABATAN_PETA } from "@/lib/peta-akses";

type Sesi = { role: string; email: string; userId?: string };

/** Admin, panitia SPMB (semua yang lolos `bolehSpmb`), staf Tata Usaha penuh, dan pemegang `JABATAN_PETA`. */
export async function assertPeta(session: Sesi) {
  if (session.role === "ADMIN") return;
  if (await bolehSpmb(session)) return;
  if (session.role !== "TEACHER" && session.role !== "TAS") throw new Error("FORBIDDEN");
  await assertJabatan(session, session.role === "TAS" ? [...TAS_JABATAN, ...JABATAN_PETA] : JABATAN_PETA);
}

export async function bolehPeta(session: Sesi): Promise<boolean> {
  return assertPeta(session).then(() => true, () => false);
}
