import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

interface LogParams {
  action: string;
  entity: string;
  entityId?: string;
  description: string;
  metadata?: Record<string, unknown>;
}

/** Catat aksi SENSITIF (reset password, ubah jabatan, hapus akun, keputusan PPDB, ubah biodata
 * inti) ke ActivityLog. Dipanggil SETELAH aksi utama berhasil — kalau logging gagal, ditelan diam-
 * diam (`.catch`) supaya tidak pernah menggagalkan request utama gara-gara audit trail.
 *
 * Kalau sesi sedang "Masuk Sebagai" (`session.imp`), nama admin aslinya ikut dicatat — tanpa ini
 * log menuduh pemilik akun atas tindakan yang sebenarnya dilakukan admin. */
export async function logActivity(
  session: { userId: string; name: string; role: string; imp?: { userId: string; name: string } | null },
  params: LogParams,
) {
  await prisma.activityLog.create({
    data: {
      userId: session.userId,
      userName: session.name,
      userRole: session.role,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      description: params.description,
      metadata: params.metadata as Prisma.InputJsonValue | undefined,
      impersonatorId: session.imp?.userId ?? null,
      impersonatorName: session.imp?.name ?? null,
    },
  }).catch(() => {});
}
