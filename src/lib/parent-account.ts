import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { toProperCaseName } from "@/lib/text";
import { DEFAULT_PASSWORD } from "@/lib/constants";

/** Normalisasi nomor HP jadi kunci dedup akun Orang Tua ("62xxxxxxxxxx", hanya digit) — supaya
 * "08123456789", "+62 812-3456-789", dan "62812 3456 789" semuanya dianggap orang yang sama. */
export function normalizePhoneKey(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return "62" + digits.slice(1);
  if (digits.startsWith("62")) return digits;
  return "62" + digits;
}

/** Buat/hubungkan akun Orang Tua (role PARENT) ke seorang siswa berdasarkan Student.parentPhone
 * — dipanggil OTOMATIS setelah Student dibuat/diubah (keputusan eksplisit user: admin TIDAK
 * perlu bikin akun ortu manual). Satu nomor HP = satu akun Parent (dedup via phoneKey), satu
 * akun Parent bisa terhubung ke banyak Student (kakak-adik — lihat DESIGN_SYSTEM.md/plan Portal
 * Orang Tua). HANYA MENAMBAH link, tidak pernah menghapus otomatis — kalau parentPhone kosong
 * lagi/diubah, link lama yang sudah ada dibiarkan (penghapusan manual lewat
 * /dashboard/admin/parents kalau memang perlu, mis. nomor bekas orang lain).
 *
 * Sengaja tidak melempar (throw) — dipanggil fire-and-forget dibungkus try/catch di tiap call
 * site, supaya kegagalan sinkron akun ortu TIDAK PERNAH menggagalkan simpan data siswa. */
export async function syncParentAccountForStudent(
  studentId: string,
  parentPhone: string | null | undefined,
  parentName?: string | null,
): Promise<void> {
  if (!parentPhone?.trim()) return;
  const phoneKey = normalizePhoneKey(parentPhone);
  if (phoneKey.length < 10 || phoneKey.length > 15) return; // nomor terlalu pendek/panjang/rusak → skip diam-diam

  let parent = await prisma.parent.findUnique({ where: { phoneKey } });
  if (!parent) {
    const email = `ortu${phoneKey}@smkalmunawwir.sch.id`;
    const existingUser = await prisma.user.findUnique({ where: { email } });
    const user = existingUser ?? await prisma.user.create({
      data: {
        name: parentName?.trim() ? toProperCaseName(parentName) : "Orang Tua/Wali",
        email,
        password: await bcrypt.hash(DEFAULT_PASSWORD, 12),
        role: "PARENT",
      },
    });
    parent = await prisma.parent.upsert({
      where: { userId: user.id },
      create: { userId: user.id, phoneKey },
      update: {},
    });
  }

  await prisma.parentStudent.upsert({
    where: { parentId_studentId: { parentId: parent.id, studentId } },
    create: { parentId: parent.id, studentId },
    update: {},
  });
}
