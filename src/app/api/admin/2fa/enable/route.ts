import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { verifyTotpToken, generateBackupCodes, hashBackupCodes } from "@/lib/totp";

/** Langkah 2 aktivasi 2FA — admin masukkan kode 6-digit dari authenticator app untuk BUKTI QR
 * tadi sudah benar ke-scan sebelum totpEnabled=true beneran. Kalau valid, generate 8 kode
 * cadangan sekali-pakai dan kembalikan PLAINTEXT-nya (SATU KALI SAJA — setelah ini cuma hash yang
 * tersimpan, kalau admin tidak sempat simpan, cuma bisa reset ulang seluruh 2FA lewat /disable). */
export async function POST(req: Request) {
  const session = await verifyRole(["ADMIN"]);
  const { code } = await req.json();

  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { totpSecret: true } });
  if (!user?.totpSecret) {
    return Response.json({ error: "Belum ada proses setup 2FA yang berjalan. Mulai ulang dari awal." }, { status: 400 });
  }

  const valid = await verifyTotpToken(String(code ?? ""), user.totpSecret);
  if (!valid) {
    return Response.json({ error: "Kode salah. Cek lagi aplikasi authenticator Anda." }, { status: 400 });
  }

  const backupCodes = generateBackupCodes();
  const hashed = await hashBackupCodes(backupCodes);
  await prisma.user.update({ where: { id: session.userId }, data: { totpEnabled: true, totpBackupCodes: hashed } });

  await logActivity(session, {
    action: "ENABLE_2FA", entity: "User", entityId: session.userId,
    description: `${session.name} mengaktifkan autentikasi dua faktor (2FA) untuk akunnya sendiri`,
  });

  return Response.json({ success: true, backupCodes });
}
