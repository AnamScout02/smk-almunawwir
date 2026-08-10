import { NextResponse } from "next/server";
import { verifySession } from "@/lib/dal";
import { createSession, getImpersonatorSession, clearImpersonatorCookie } from "@/lib/session";
import { logActivity } from "@/lib/activity-log";

/** Kembali dari "Masuk sebagai" ke akun Admin asli. SENGAJA TIDAK pakai verifyRole(["ADMIN"]) —
 * sesi aktif saat ini adalah akun yang sedang diimpersonasi (bisa TEACHER/STUDENT/TAS), bukan
 * ADMIN. Otorisasi sebenarnya dari validitas cookie `impersonator` itu sendiri (cuma pernah diisi
 * oleh endpoint impersonate/start yang sudah membatasi ke ADMIN). */
export async function POST() {
  const current = await verifySession(); // pastikan ada sesi aktif apa pun, bukan request nyasar
  const admin = await getImpersonatorSession();
  if (!admin?.userId) {
    return NextResponse.json({ error: "Tidak sedang masuk sebagai akun lain." }, { status: 400 });
  }

  await createSession({ userId: admin.userId, name: admin.name, email: admin.email, role: admin.role });
  await clearImpersonatorCookie();

  await logActivity(admin, {
    action: "IMPERSONATE_STOP",
    entity: "User",
    entityId: current.userId,
    description: `${admin.name} kembali dari akun ${current.name} (${current.role}) ke akun Admin`,
  });

  return NextResponse.json({ success: true, redirectTo: "/dashboard/admin/users" });
}
