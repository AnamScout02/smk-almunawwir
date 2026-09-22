import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { tugasHariIni } from "@/lib/tugas-hari-ini";
import { tandaiPengingatSelesai } from "@/lib/kotak-notifikasi";

export const dynamic = "force-dynamic";

/** Dipanggil PusatNotifikasiPortal tiap berpindah halaman: tugas hari ini yang belum selesai + jumlah notifikasi belum dibaca.
 * Pengingat yang tugasnya sudah dikerjakan ditandai dibaca DULU, baru dihitung. */
export async function GET() {
  let session: Awaited<ReturnType<typeof verifySession>>;
  try {
    session = await verifySession();
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tugas = await tugasHariIni(session.userId).catch(() => null);
  // Hanya bila perhitungan tugas berhasil — galat sesaat tidak boleh membuat pengingat yang masih berlaku ikut "dibaca".
  if (tugas) await tandaiPengingatSelesai(session.userId, tugas).catch(() => 0);
  const belumDibaca = await prisma.notifikasiPengguna.count({ where: { userId: session.userId, dibacaAt: null } });
  return Response.json({ tugas: tugas ?? [], belumDibaca });
}
