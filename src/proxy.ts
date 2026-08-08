import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decrypt, refreshSessionCookie } from "@/lib/session";

const protectedRoutes = ["/dashboard"];
const publicRoutes = ["/login", "/"];

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isProtected = protectedRoutes.some((r) => path.startsWith(r));
  const isPublic = publicRoutes.some((r) => path === r);

  const cookie = req.cookies.get("session")?.value;
  const session = await decrypt(cookie);

  if (isProtected && !session?.userId) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (isPublic && session?.userId && path === "/login") {
    const roleRedirect: Record<string, string> = {
      ADMIN: "/dashboard/admin",
      TAS: "/dashboard/admin",
      TEACHER: "/dashboard/teacher",
      STUDENT: "/dashboard/student",
    };
    return NextResponse.redirect(
      new URL(roleRedirect[session.role] ?? "/dashboard/student", req.nextUrl)
    );
  }

  const res = NextResponse.next();
  // Sesi sliding window (lihat komentar lengkap di refreshSessionCookie, session.ts) — SETIAP
  // request (halaman dashboard maupun API /api/**) dengan cookie sesi valid otomatis diperpanjang
  // 8 jam lagi dari sekarang. Mencakup /api/** SENGAJA (bukan cuma /dashboard/**) supaya halaman
  // yang cuma polling data lewat fetch tanpa pindah halaman (mis. Papan Peringkat mode layar
  // penuh di TV/monitor, JaringanManager auto-refresh tiap 4-10 detik) juga dianggap "aktif" dan
  // tidak ke-logout paksa di tengah tampil — cuma benar2 idle (tidak ada request apa pun) >8 jam
  // yang bikin sesi kadaluarsa.
  if (session?.userId && cookie) {
    await refreshSessionCookie(res, {
      userId: session.userId, role: session.role, name: session.name, email: session.email,
    });
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
