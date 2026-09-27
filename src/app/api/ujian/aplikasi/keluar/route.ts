import { NextRequest } from "next/server";
import { verifySession } from "@/lib/dal";
import { getSettings } from "@/lib/site-settings";
import { VERSI_APLIKASI } from "@/lib/aplikasi-ujian";

export const dynamic = "force-dynamic";

/** PIN KELUAR Aplikasi Ujian Android (22 Sep 2026). Dipanggil aplikasi (bukan halaman web) saat peserta menekan Keluar ketika
 * sedang mengerjakan. GET = { butuhPin, versiTerbaru }; POST { pin } = { ok }. Percobaan dibatasi per IP supaya PIN pendek
 * tidak bisa ditebak beruntun. PIN tidak pernah dikirim balik. */
const percobaan = new Map<string, { n: number; sejak: number }>();
const BATAS = 5, JENDELA_MS = 10 * 60_000;

function ipDari(req: NextRequest) {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "?";
}

export async function GET() {
  const s = await getSettings(["ujian.pinAplikasi"]);
  return Response.json({ butuhPin: !!(s["ujian.pinAplikasi"] ?? "").trim(), versiTerbaru: VERSI_APLIKASI });
}

export async function POST(req: NextRequest) {
  // WAJIB sudah masuk (temuan audit 24 Sep 2026): sebelumnya siapa pun di internet bisa menebak PIN
  // sekolah lewat endpoint ini — hanya dibatasi per IP, dan satu sekolah memakai satu IP bersama.
  const sesi = await verifySession().catch(() => null);
  if (!sesi) return Response.json({ ok: false, error: "Masuk dulu ke aplikasi sebelum meminta PIN keluar." }, { status: 401 });
  const kini = Date.now();
  // Dibatasi per AKUN + per IP: satu siswa tidak bisa menebak dari banyak jaringan, dan satu jaringan
  // tidak bisa dipakai bergantian banyak akun.
  const ip = `${sesi.userId}|${ipDari(req)}`;
  const p = percobaan.get(ip);
  if (p && kini - p.sejak < JENDELA_MS && p.n >= BATAS) {
    return Response.json({ ok: false, error: "Terlalu banyak percobaan. Tunggu beberapa menit atau minta pengawas." }, { status: 429 });
  }
  const b = await req.json().catch(() => ({})) as { pin?: unknown };
  const pin = String((await getSettings(["ujian.pinAplikasi"]))["ujian.pinAplikasi"] ?? "").trim();
  const ok = !pin || String(b.pin ?? "").trim() === pin;
  if (!ok) percobaan.set(ip, p && kini - p.sejak < JENDELA_MS ? { n: p.n + 1, sejak: p.sejak } : { n: 1, sejak: kini });
  else percobaan.delete(ip);
  return Response.json({ ok, ...(ok ? {} : { error: "PIN salah. Minta PIN kepada pengawas." }) }, { status: ok ? 200 : 403 });
}
