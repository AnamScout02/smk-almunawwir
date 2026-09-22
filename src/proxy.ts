import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_AKSES, COOKIE_SEGAR, decrypt, opsiCookieAkses, opsiCookieSegar } from "@/lib/session";
import { migrasiTokenLama, segarkanSesi, sesiMasihHidup } from "@/lib/sesi-server";
import { getClientIpFromHeaders } from "@/lib/rate-limit";
import type { SessionPayload } from "@/types";

const protectedRoutes = ["/dashboard", "/pusat-ujian", "/ujian-online"];
/** Jalur yang isinya data pribadi pengguna — tidak boleh disimpan cache mana pun (browser, proxy
 * jaringan sekolah, CDN) supaya halaman akun A tidak pernah tersaji ke akun B. Gambar /uploads
 * sengaja tidak termasuk: foto boleh di-cache, dan tanpa itu dashboard jadi berat. */
const tanpaCache = ["/dashboard", "/api", "/pusat-ujian", "/ujian-online", "/login"];

const ROLE_REDIRECT: Record<string, string> = {
  ADMIN: "/dashboard/admin",
  TAS: "/dashboard/admin",
  TEACHER: "/dashboard/teacher",
  STUDENT: "/dashboard/student",
  PARENT: "/dashboard/parent",
};

type Perubahan = {
  akses?: string;
  segar?: { nilai: string; ingatSaya: boolean };
  hapusSemua?: boolean;
  hapusImpLama?: boolean;
};

/** Penjaga sesi di depan SEMUA request (lihat komentar lengkap di src/lib/session.ts).
 *
 *  1. Token akses masih sah → lewat tanpa menyentuh database.
 *  2. Token akses habis tapi ada token segar → terbitkan token akses baru DIAM-DIAM dan teruskan
 *     ke halaman di request yang SAMA (bukan menunggu request berikutnya) — padanan "silent
 *     refresh" tanpa perlu interceptor di browser, dan berlaku juga untuk Server Component.
 *  3. Token lama tanpa `sid` (sebelum 14 Sep 2026) → dipindahkan ke sesi server tanpa login ulang. */
export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  // Berkas rahasia (mis. foto surat dokter izin siswa) TIDAK boleh dibuka lewat alamat publik — hanya lewat rute berizin.
  if (path.startsWith("/uploads/rahasia/") || path.startsWith("/api/uploads/rahasia/")) {
    return new NextResponse("Not found", { status: 404 });
  }
  const info = { userAgent: req.headers.get("user-agent"), ip: getClientIpFromHeaders(req.headers) };
  const tokenSegar = req.cookies.get(COOKIE_SEGAR)?.value;
  let session: SessionPayload | null = await decrypt(req.cookies.get(COOKIE_AKSES)?.value);
  const ubah: Perubahan = {};

  try {
    if (session && !session.sid) {
      const impLama = await decrypt(req.cookies.get("impersonator")?.value);
      const m = await migrasiTokenLama(session, impLama, info);
      if (m) {
        session = m.payload;
        Object.assign(ubah, { akses: m.akses, segar: { nilai: m.tokenSegar, ingatSaya: false }, hapusImpLama: true });
      } else {
        session = null;
        ubah.hapusSemua = true;
      }
    } else if (!session && tokenSegar) {
      const r = await segarkanSesi(tokenSegar, info);
      if (r) {
        session = r.payload;
        // Pasang ulang cookie token segar juga, supaya Max-Age 30 hari "ingat saya" ikut bergeser.
        Object.assign(ubah, { akses: r.akses, segar: { nilai: tokenSegar, ingatSaya: r.ingatSaya } });
      } else {
        ubah.hapusSemua = true;
      }
    } else if (session?.sid && path === "/login" && !(await sesiMasihHidup(session.sid))) {
      // Sesi sudah dicabut: JANGAN pantulkan ke dashboard (verifySession akan memantulkannya balik
      // ke sini → putaran redirect tanpa akhir). Bersihkan cookie dan tampilkan halaman login.
      session = null;
      ubah.hapusSemua = true;
    }
  } catch {
    // Database sesaat tak terjangkau: jangan hapus cookie apa pun — verifySession yang memutuskan.
  }

  if (protectedRoutes.some((r) => path.startsWith(r)) && !session) {
    return terapkan(NextResponse.redirect(new URL("/login", req.nextUrl)), ubah, req.headers);
  }

  if (path === "/login" && session?.sid) {
    return terapkan(
      NextResponse.redirect(new URL(ROLE_REDIRECT[session.role] ?? "/dashboard/student", req.nextUrl)),
      ubah,
      req.headers,
    );
  }

  // Token akses baru harus terlihat oleh Server Component/Route Handler di request INI juga.
  const reqHeaders = new Headers(req.headers);
  if (ubah.akses || ubah.hapusSemua || ubah.hapusImpLama) {
    const ganti: Record<string, string | null> = {};
    if (ubah.hapusSemua || ubah.hapusImpLama) ganti.impersonator = null;
    if (ubah.hapusSemua) { ganti[COOKIE_AKSES] = null; ganti[COOKIE_SEGAR] = null; }
    if (ubah.akses) ganti[COOKIE_AKSES] = ubah.akses;
    if (ubah.segar) ganti[COOKIE_SEGAR] = ubah.segar.nilai;
    reqHeaders.set("cookie", susunHeaderCookie(req, ganti));
  }

  const res = terapkan(NextResponse.next({ request: { headers: reqHeaders } }), ubah, req.headers);
  if (session && tanpaCache.some((r) => path.startsWith(r))) {
    res.headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
  }
  return res;
}

function susunHeaderCookie(req: NextRequest, ganti: Record<string, string | null>) {
  const semua = new Map(req.cookies.getAll().map((c) => [c.name, c.value] as const));
  for (const [nama, nilai] of Object.entries(ganti)) {
    if (nilai === null) semua.delete(nama);
    else semua.set(nama, nilai);
  }
  return [...semua].map(([nama, nilai]) => `${nama}=${nilai}`).join("; ");
}

function terapkan(res: NextResponse, u: Perubahan, h: Headers) {
  if (u.hapusSemua) {
    res.cookies.delete(COOKIE_AKSES);
    res.cookies.delete(COOKIE_SEGAR);
  }
  if (u.hapusSemua || u.hapusImpLama) res.cookies.delete("impersonator");
  if (u.akses) res.cookies.set(COOKIE_AKSES, u.akses, opsiCookieAkses(h));
  if (u.segar) res.cookies.set(COOKIE_SEGAR, u.segar.nilai, opsiCookieSegar(u.segar.ingatSaya, h));
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
