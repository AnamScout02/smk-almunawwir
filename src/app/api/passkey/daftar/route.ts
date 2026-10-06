import { cookies } from "next/headers";
import { generateRegistrationOptions, verifyRegistrationResponse } from "@simplewebauthn/server";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { ORIGIN_APLIKASI, COOKIE_TANTANGAN, NAMA_RP, ambilTantangan, bolehPasskey, opsiCookieTantangan, pihakTerpercaya, simpanTantangan } from "@/lib/passkey";

export const dynamic = "force-dynamic";

const MAKS_PER_AKUN = 10;

/** Langkah 1 mendaftarkan passkey: opsi WebAuthn untuk perangkat ini. */
export async function GET(req: Request) {
  try {
    const session = await verifySession();
    if (!bolehPasskey(session.role)) return Response.json({ error: "Akun siswa tidak memakai passkey." }, { status: 403 });
    const rp = pihakTerpercaya(req.headers);
    if (!rp) return Response.json({ error: "Passkey hanya bisa dibuat lewat alamat HTTPS sekolah (https://smkalmunawwiriibs.sch.id)." }, { status: 400 });
    const ada = await prisma.passkey.findMany({ where: { userId: session.userId }, select: { credentialId: true, transports: true } });
    if (ada.length >= MAKS_PER_AKUN) return Response.json({ error: `Maksimal ${MAKS_PER_AKUN} passkey per akun — hapus yang tidak dipakai dulu.` }, { status: 400 });
    const opsi = await generateRegistrationOptions({
      rpName: NAMA_RP, rpID: rp.rpID,
      userName: session.email, userDisplayName: session.name,
      userID: new TextEncoder().encode(session.userId),
      attestationType: "none",
      // Perangkat yang sudah terdaftar tidak bisa didaftarkan dua kali.
      excludeCredentials: ada.map(p => ({ id: p.credentialId, transports: p.transports as never })),
      authenticatorSelection: { residentKey: "required", userVerification: "required" },
    });
    const kunci = simpanTantangan({ challenge: opsi.challenge, userId: session.userId, tujuan: "daftar" });
    (await cookies()).set(COOKIE_TANTANGAN, kunci, opsiCookieTantangan(true));
    return Response.json(opsi);
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal menyiapkan passkey." }, { status: 500 });
  }
}

/** Langkah 2: periksa jawaban perangkat lalu simpan kunci publiknya. */
export async function POST(req: Request) {
  try {
    const session = await verifySession();
    if (!bolehPasskey(session.role)) return Response.json({ error: "Akun siswa tidak memakai passkey." }, { status: 403 });
    const rp = pihakTerpercaya(req.headers);
    const jar = await cookies();
    const t = ambilTantangan(jar.get(COOKIE_TANTANGAN)?.value, "daftar");
    jar.delete(COOKIE_TANTANGAN);
    if (!rp || !t || t.userId !== session.userId) return Response.json({ error: "Waktu pendaftaran habis — coba lagi." }, { status: 400 });
    const b = await req.json().catch(() => ({}));
    const hasil = await verifyRegistrationResponse({
      response: b.respons, expectedChallenge: t.challenge, expectedOrigin: [rp.origin, ORIGIN_APLIKASI], expectedRPID: rp.rpID,
      requireUserVerification: true,
    }).catch(() => null);
    if (!hasil?.verified || !hasil.registrationInfo) return Response.json({ error: "Perangkat tidak bisa diverifikasi." }, { status: 400 });
    const k = hasil.registrationInfo.credential;
    const nama = String(b.nama ?? "").trim().slice(0, 60) || "Perangkat saya";
    const p = await prisma.passkey.create({
      data: {
        userId: session.userId, credentialId: k.id, publicKey: Buffer.from(k.publicKey), counter: BigInt(k.counter),
        transports: k.transports ?? [], rpId: rp.rpID, nama,
      },
      select: { id: true },
    });
    await logActivity(session, { action: "CREATE", entity: "Passkey", entityId: p.id, description: `Menambahkan passkey "${nama}"` }).catch(() => {});
    return Response.json({ ok: true });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal menyimpan passkey." }, { status: 500 });
  }
}
