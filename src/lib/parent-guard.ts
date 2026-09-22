import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/types";

export interface ParentChild {
  id: string;
  nis: string;
  classId: string | null;
  majorId: string;
  class: { id: string; name: string; grade: number } | null;
  major: { name: string; code: string };
  user: { name: string };
}

/** Ambil semua anak yang terhubung ke akun Orang Tua yang sedang login. Redirect ke /login kalau
 * akunnya PARENT tapi entah kenapa tidak punya anak terhubung (kondisi tak wajar — mis. link
 * sudah dihapus admin manual tapi sesi lama masih aktif). WAJIB dipakai di SETIAP halaman/route
 * Parent Portal sebelum query data anak manapun — pola IDOR-safe sama seperti gotcha #10
 * CLAUDE.md (jangan percaya studentId dari client mentah-mentah). */
export async function getParentChildrenOrRedirect(session: SessionPayload): Promise<ParentChild[]> {
  const parent = await prisma.parent.findUnique({
    where: { userId: session.userId },
    include: {
      children: {
        include: {
          student: {
            select: {
              id: true, nis: true, classId: true, majorId: true,
              class: { select: { id: true, name: true, grade: true } },
              major: { select: { name: true, code: true } },
              user: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!parent || parent.children.length === 0) redirect("/login");
  return parent.children.map(c => c.student);
}

/** Pilih anak yang sedang dilihat dari daftar anak yang SAH milik akun ini — TIDAK PERNAH
 * percaya studentIdParam begitu saja (fallback ke anak pertama kalau param kosong/invalid/bukan
 * milik akun ini, bukan error/leak). */
export function resolveSelectedChild(children: ParentChild[], studentIdParam?: string): ParentChild {
  const found = studentIdParam ? children.find(c => c.id === studentIdParam) : undefined;
  return found ?? children[0];
}
