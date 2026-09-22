import "server-only";
import { assertJabatan } from "@/lib/jabatan-guard";

export const JABATAN_BRANDING = "Koordinator Tim Branding & Publikasi";

export async function assertBranding(session: { role: string; email: string }) {
  if (session.role === "TEACHER" || session.role === "TAS") await assertJabatan(session, ["Koordinator Tim Branding & Publikasi"]);
}
