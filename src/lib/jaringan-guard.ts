import "server-only";
import { assertJabatan } from "@/lib/jabatan-guard";

export async function assertJaringan(session: { role: string; email: string }) {
  if (session.role === "TEACHER" || session.role === "TAS") await assertJabatan(session, ["Pengelola Jaringan Sekolah"]);
}
