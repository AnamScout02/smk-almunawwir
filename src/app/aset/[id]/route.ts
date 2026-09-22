import { NextResponse } from "next/server";
import { getSession, pakaiSecure } from "@/lib/session";

/** Location relatif — alamat asal bisa HTTP lab atau HTTPS terowongan; req.url di balik proksi tidak bisa dipercaya. */
const alihkan = (ke: string) => new NextResponse(null, { status: 307, headers: { Location: ke } });

export const dynamic = "force-dynamic";

/** Tujuan QR label aset (alamat pendek supaya QR kecil). Hanya MENGARAHKAN — halaman tujuan memeriksa hak lewat verifyRole.
 * Belum masuk → titip tujuan di cookie lalu ke /login (dipakai ambilLanjut di actions/auth.ts). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const aman = /^[A-Za-z0-9_-]{1,40}$/.test(id) ? id : "";
  const s = await getSession().catch(() => null);
  if (!s?.userId) {
    const res = alihkan("/login");
    if (aman) res.cookies.set("lanjut_masuk", `/aset/${aman}`, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600, secure: pakaiSecure(req.headers) });
    return res;
  }
  const portal = s.role === "TEACHER" ? "teacher" : s.role === "ADMIN" || s.role === "TAS" ? "admin" : null;
  return alihkan(portal && aman ? `/dashboard/${portal}/aset/${aman}` : "/login");
}
