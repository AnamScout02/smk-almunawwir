import { cookies } from "next/headers";
import { generateAuthenticationOptions, verifyAuthenticationResponse } from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import { masukkanSesi } from "@/lib/sesi-server";
import { logActivity } from "@/lib/activity-log";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { resolveRedirectTarget, ambilLanjut } from "@/lib/tujuan-masuk";
import { ORIGIN_APLIKASI, COOKIE_TANTANGAN, ambilTantangan, bolehPasskey, opsiCookieTantangan, pihakTerpercaya, simpanTantangan } from "@/lib/passkey";

export const dynamic = "force-dynamic";

const GAGAL = "Passkey tidak dikenali. Masuk dengan email & kata sandi, lalu daftarkan passkey di halaman Profil.";

/** Langkah 1 masuk dengan passkey: tantangan tanpa daftar kredensial — perangkat sendiri menawarkan passkey
 *  yang tersimpan untuk domain ini (discoverable credential), jadi pengguna tidak perlu mengetik email. */
export async function GET(req: Request) {
  if (!checkRateLimit(`passkey-masuk:${getClientIp(req)}`, 30, 5 * 60_000)) return Response.json({ error: "Terlalu sering. Coba lagi sebentar." }, { status: 429 });
  const rp = pihakTerpercaya(req.headers);
  if (!rp) return Response.json({ error: "Masuk dengan passkey hanya lewat alamat HTTPS sekolah." }, { status: 400 });
  const opsi = await generateAuthenticationOptions({ rpID: rp.rpID, userVerification: "required" });
  const kunci = simpanTantangan({ challenge: opsi.challenge, tujuan: "masuk" });
  (await cookies()).set(COOKIE_TANTANGAN, kunci, opsiCookieTantangan(true));
  return Response.json(opsi);
}

/** Langkah 2: periksa tanda tangan perangkat, lalu buat sesi lewat jalur yang SAMA dengan login sandi
 *  (`masukkanSesi` — sesi tunggal, cookie per permintaan, pencatatan perangkat). */
export async function POST(req: Request) {
  if (!checkRateLimit(`passkey-masuk:${getClientIp(req)}`, 30, 5 * 60_000)) return Response.json({ error: "Terlalu sering. Coba lagi sebentar." }, { status: 429 });
  const rp = pihakTerpercaya(req.headers);
  const jar = await cookies();
  const t = ambilTantangan(jar.get(COOKIE_TANTANGAN)?.value, "masuk");
  jar.delete(COOKIE_TANTANGAN);
  if (!rp || !t) return Response.json({ error: "Waktu masuk habis — coba lagi." }, { status: 400 });

  const b = await req.json().catch(() => ({}));
  const credId = String(b?.respons?.id ?? "");
  const p = credId ? await prisma.passkey.findUnique({
    where: { credentialId: credId },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  }) : null;
  if (!p || p.rpId !== rp.rpID || !bolehPasskey(p.user.role)) return Response.json({ error: GAGAL }, { status: 401 });

  const hasil = await verifyAuthenticationResponse({
    response: b.respons, expectedChallenge: t.challenge, expectedOrigin: [rp.origin, ORIGIN_APLIKASI], expectedRPID: rp.rpID,
    credential: { id: p.credentialId, publicKey: new Uint8Array(p.publicKey), counter: Number(p.counter), transports: p.transports as never },
    requireUserVerification: true,
  }).catch(() => null);
  if (!hasil?.verified) return Response.json({ error: GAGAL }, { status: 401 });

  await prisma.passkey.update({ where: { id: p.id }, data: { counter: BigInt(hasil.authenticationInfo.newCounter), terakhirDipakai: new Date() } });
  const ingat = b.ingat === true;
  await masukkanSesi({ id: p.user.id, name: p.user.name, email: p.user.email, role: p.user.role }, ingat);
  await logActivity({ userId: p.user.id, name: p.user.name, role: p.user.role }, {
    action: "LOGIN", entity: "Passkey", entityId: p.id, description: `Masuk dengan passkey "${p.nama}"`,
  }).catch(() => {});
  const ke = (await ambilLanjut()) ?? await resolveRedirectTarget(p.user.role, p.user.email);
  return Response.json({ ok: true, ke });
}
