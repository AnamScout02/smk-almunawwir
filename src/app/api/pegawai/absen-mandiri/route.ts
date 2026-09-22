import { NextRequest } from "next/server";
import { verifyRole } from "@/lib/dal";
import { getSettings } from "@/lib/site-settings";
import { checkRateLimit } from "@/lib/rate-limit";
import { hariIniWib, menitDariJam, periksaToken } from "@/lib/absensi-qr";
import { catatPresensiPegawai } from "@/lib/presensi-pegawai";

export const dynamic = "force-dynamic";

/** ABSEN MANDIRI PEGAWAI — guru/staf memindai QR absensi yang sama dengan siswa (gerbang) memakai HP-nya.
 * Aturannya di src/lib/presensi-pegawai.ts: tidak pernah menimpa keputusan TU. */
export async function POST(req: NextRequest) {
  let session: Awaited<ReturnType<typeof verifyRole>>;
  try {
    session = await verifyRole(["TEACHER", "TAS", "ADMIN"]);
  } catch {
    return Response.json({ error: "Silakan masuk dengan akun pegawai." }, { status: 401 });
  }
  if (!checkRateLimit(`absen-pegawai:${session.userId}`, 12, 60_000)) {
    return Response.json({ error: "Terlalu banyak percobaan. Tunggu sebentar." }, { status: 429 });
  }
  const { kode } = (await req.json().catch(() => ({}))) as { kode?: string };
  const token = periksaToken(kode ?? "");
  if (!token.ok) return Response.json({ error: token.alasan }, { status: 400 });

  const h = hariIniWib();
  const s = await getSettings(["absensiQr.jamBuka", "absensiQr.jamTutup"]);
  const buka = menitDariJam(s["absensiQr.jamBuka"]);
  // Pegawai pulang lebih lambat dari jam absensi siswa — jam tutup diberi kelonggaran 4 jam untuk jam pulang.
  const tutup = menitDariJam(s["absensiQr.jamTutup"]) + 240;
  if ((Number.isFinite(buka) && h.menit < buka) || (Number.isFinite(tutup) && h.menit > tutup)) {
    return Response.json({ error: `Presensi mandiri dibuka pukul ${s["absensiQr.jamBuka"]} WIB sampai 4 jam setelah jam pulang siswa.` }, { status: 409 });
  }

  const r = await catatPresensiPegawai(session.userId, "QR");
  if (r.hasil === "LIBUR") return Response.json({ error: "Hari ini libur — presensi tidak diperlukan." }, { status: 409 });
  return Response.json({ ...r, nama: session.name }, { status: r.hasil === "MASUK" ? 201 : 200 });
}
