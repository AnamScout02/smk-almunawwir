import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import bcrypt from "bcryptjs";

/** Nonaktifkan 2FA — WAJIB konfirmasi password saat ini dulu (bukan cuma klik tombol), supaya
 * kalau sesi browser admin sedang terbuka tanpa dijaga (lupa logout di komputer bersama), orang
 * lain tidak bisa asal matikan 2FA orang lain semudah itu. */
export async function POST(req: Request) {
  const session = await verifyRole(["ADMIN"]);
  const { password } = await req.json();

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return Response.json({ error: "Akun tidak ditemukan." }, { status: 404 });

  const valid = await bcrypt.compare(String(password ?? ""), user.password);
  if (!valid) return Response.json({ error: "Password salah." }, { status: 400 });

  await prisma.user.update({ where: { id: session.userId }, data: { totpEnabled: false, totpSecret: null, totpBackupCodes: [] } });

  await logActivity(session, {
    action: "DISABLE_2FA", entity: "User", entityId: session.userId,
    description: `${session.name} menonaktifkan autentikasi dua faktor (2FA) untuk akunnya sendiri`,
  });

  return Response.json({ success: true });
}
