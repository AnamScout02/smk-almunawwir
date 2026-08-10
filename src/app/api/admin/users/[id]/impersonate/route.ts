import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { createSession, setImpersonatorCookie } from "@/lib/session";
import { logActivity } from "@/lib/activity-log";
import type { Role } from "@/types";

const ROLE_DASHBOARD: Record<Role, string> = {
  ADMIN: "/dashboard/admin",
  TAS: "/dashboard/admin",
  TEACHER: "/dashboard/teacher",
  STUDENT: "/dashboard/student",
};

/** "Masuk sebagai" akun lain — KHUSUS ADMIN (superadmin), sengaja TIDAK diloloskan TAS sekalipun
 * TAS bisa membuka halaman Akun Pengguna (lihat tas-access-guard.ts) — impersonasi adalah aksi
 * paling sensitif di sistem ini (bisa bertindak sebagai siapa pun tanpa tahu passwordnya), jadi
 * dibatasi lebih ketat drpd CRUD akun biasa. Target juga tidak boleh sesama ADMIN — supaya satu
 * admin tidak diam-diam bisa bertindak sebagai admin lain tanpa sepengetahuannya. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN"]);
    const { id } = await params;

    if (id === session.userId) {
      return NextResponse.json({ error: "Tidak bisa masuk sebagai akun sendiri." }, { status: 400 });
    }

    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, role: true } });
    if (!target) return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });
    if (target.role === "ADMIN") {
      return NextResponse.json({ error: "Tidak bisa masuk sebagai sesama akun Admin." }, { status: 403 });
    }

    // Simpan identitas admin ASLI dulu sebelum cookie sesi ditimpa.
    await setImpersonatorCookie({ userId: session.userId, name: session.name, email: session.email, role: session.role });
    await createSession({ userId: target.id, name: target.name, email: target.email, role: target.role as Role });

    await logActivity(session, {
      action: "IMPERSONATE_START",
      entity: "User",
      entityId: target.id,
      description: `${session.name} masuk sebagai akun ${target.name} (${target.role})`,
    });

    return NextResponse.json({ success: true, redirectTo: ROLE_DASHBOARD[target.role as Role] ?? "/dashboard/student" });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
