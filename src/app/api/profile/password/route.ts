import { prisma } from "@/lib/prisma";
import { cabutSemuaSesiPengguna } from "@/lib/sesi-server";
import { verifyRole } from "@/lib/dal";
import { logActivity } from "@/lib/activity-log";
import bcrypt from "bcryptjs";
import { DEFAULT_PASSWORD } from "@/lib/constants";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

/** Apakah akun ini masih memakai sandi awal (ditandai saat login). Dipakai `GantiSandiWajib`. */
export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER", "STUDENT", "PARENT"]);
    const u = await prisma.user.findUnique({ where: { id: session.userId }, select: { wajibGantiSandi: true } });
    // Admin yang sedang "Masuk Sebagai" tidak dipaksa mengganti sandi orang yang ia tirukan.
    return Response.json({ wajib: !!u?.wajibGantiSandi && !session.imp });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ wajib: false });
  }
}

export async function POST(req: Request) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER", "STUDENT", "PARENT"]);
    const { currentPassword, newPassword } = await req.json();

    // Akun yang baru masuk dengan sandi awal (`wajibGantiSandi`) tidak perlu mengetik ulang sandi lamanya — sandi itu
    // memang sandi awal yang baru saja dipakai masuk.
    const awal = await prisma.user.findUnique({ where: { id: session.userId }, select: { wajibGantiSandi: true } });
    if (!newPassword || (!currentPassword && !awal?.wajibGantiSandi)) {
      return Response.json({ error: "Password lama dan baru wajib diisi." }, { status: 400 });
    }
    if (newPassword === DEFAULT_PASSWORD) return Response.json({ error: "Sandi baru tidak boleh sama dengan sandi awal dari sekolah." }, { status: 400 });
    if (newPassword.length < 6) {
      return Response.json({ error: "Password baru minimal 6 karakter." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: session.email } });
    if (!user) return Response.json({ error: "User tidak ditemukan." }, { status: 404 });

    const valid = await bcrypt.compare(currentPassword || (awal?.wajibGantiSandi ? DEFAULT_PASSWORD : ""), user.password);
    if (!valid) {
      return Response.json({ error: "Password lama tidak sesuai." }, { status: 400 });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { password: hashed, wajibGantiSandi: false } });
    // Password berganti = semua perangkat LAIN dikeluarkan (kalau password lama bocor, sesi si
    // pencuri ikut mati). Perangkat yang sedang dipakai mengganti tetap masuk.
    const perangkatDikeluarkan = await cabutSemuaSesiPengguna(user.id, "GANTI_PASSWORD", session.sid);

    await logActivity(session, {
      action: "CHANGE_OWN_PASSWORD", entity: "User", entityId: user.id,
      description: `${session.name} mengganti password akunnya sendiri`,
    });

    return Response.json({ ok: true, perangkatDikeluarkan });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal mengubah password." }, { status: 500 });
  }
}
