import { NextResponse } from "next/server";
import { verifySession } from "@/lib/dal";
import { akhiriMasukSebagai } from "@/lib/sesi-server";
import { logActivity } from "@/lib/activity-log";

/** Kembali dari "Masuk sebagai" ke akun Admin asli. SENGAJA TIDAK pakai verifyRole(["ADMIN"]) —
 * identitas aktif saat ini adalah akun yang sedang dimasuki (bisa TEACHER/STUDENT/TAS). Otorisasi
 * sebenarnya dari baris UserSession: `imp` hanya pernah diisi endpoint impersonate yang sudah
 * membatasi ke ADMIN, dan pemilik barisnya tetap akun admin tersebut. */
export async function POST() {
  const current = await verifySession();
  if (!current.imp) {
    return NextResponse.json({ error: "Tidak sedang masuk sebagai akun lain." }, { status: 400 });
  }

  const admin = await akhiriMasukSebagai(current);
  if (!admin) return NextResponse.json({ error: "Sesi tidak dikenal." }, { status: 400 });

  await logActivity({ userId: admin.id, name: admin.name, role: admin.role }, {
    action: "IMPERSONATE_STOP",
    entity: "User",
    entityId: current.userId,
    description: `${admin.name} kembali dari akun ${current.name} (${current.role}) ke akun Admin`,
  });

  return NextResponse.json({ success: true, redirectTo: "/dashboard/admin/users" });
}
