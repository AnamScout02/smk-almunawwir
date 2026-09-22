import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_SEGAR, getSession } from "@/lib/session";
import { bacaSesiDariTokenSegar, sesiMasihHidup } from "@/lib/sesi-server";
import type { Role, SessionPayload } from "@/types";

/** Sesi sah untuk request ini, atau redirect ke /login.
 *
 * Dua lapis: token akses (JWT) membuktikan identitas, lalu baris UserSession-nya diperiksa masih
 * hidup — satu pencarian primary key, di-cache per request. Pemeriksaan kedua inilah yang membuat
 * logout dari perangkat lain, sesi tunggal, dan pencabutan oleh admin langsung berlaku. */
export const verifySession = cache(async (): Promise<SessionPayload> => {
  let session = await getSession();
  if (!session?.sid) {
    // Cadangan: token akses tidak terbawa (mis. baru saja habis) → baca langsung dari token segar.
    const segar = (await cookies()).get(COOKIE_SEGAR)?.value;
    session = segar ? await bacaSesiDariTokenSegar(segar).catch(() => null) : null;
  } else if (!(await sesiMasihHidup(session.sid).catch(() => false))) {
    session = null;
  }
  if (!session?.userId) redirect("/login");
  return session;
});

export const verifyRole = cache(async (allowed: Role[]) => {
  const session = await verifySession();
  if (!allowed.includes(session.role)) {
    redirect("/login");
  }
  return session;
});
