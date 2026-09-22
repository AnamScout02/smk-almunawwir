import { verifySession } from "@/lib/dal";
import { surveiUntuk } from "@/lib/survei";

export const dynamic = "force-dynamic";

/** Survei terbuka yang ditujukan ke pengguna ini. */
export async function GET() {
  const session = await verifySession();
  return Response.json({ daftar: await surveiUntuk(session) });
}
