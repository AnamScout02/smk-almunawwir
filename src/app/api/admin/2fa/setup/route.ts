import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { generateTotpSecret, totpKeyUri } from "@/lib/totp";
import { generateQrDataUrl } from "@/lib/qrcode";

/** Langkah 1 aktivasi 2FA — generate secret baru (BELUM aktif, totpEnabled masih false sampai
 * kode pertama diverifikasi lewat /enable) + QR untuk di-scan authenticator app. Boleh dipanggil
 * ulang (mis. admin batal di tengah jalan lalu coba lagi) — secret lama otomatis ditimpa. */
export async function POST() {
  const session = await verifyRole(["ADMIN"]);

  const secret = generateTotpSecret();
  await prisma.user.update({ where: { id: session.userId }, data: { totpSecret: secret, totpEnabled: false, totpBackupCodes: [] } });

  const uri = totpKeyUri(session.email, secret);
  const qrDataUrl = await generateQrDataUrl(uri);

  return Response.json({ secret, qrDataUrl });
}
