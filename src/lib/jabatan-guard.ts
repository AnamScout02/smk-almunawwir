import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

/** Lempar error "FORBIDDEN" kalau requester bukan ADMIN dan tidak punya salah satu jabatan di `allowed`. */
export async function assertJabatan(session: { role: string; email: string }, allowed: string[]) {
  if (session.role === "ADMIN") return;
  const names = await getJabatanNames(session.email);
  if (!allowed.some(n => names.includes(n))) throw new Error("FORBIDDEN");
}

// Ambil jabatan dari SUMBER YANG SESUAI role pengguna — guru lewat TeacherJabatan, TAS/staf lewat
// StaffJabatan (dua tabel terpisah karena TAS tidak punya baris Teacher). Dulu fungsi ini CUMA
// cek TeacherJabatan, jadi kalau dipanggil untuk user TAS selalu balik array kosong — makanya pola
// guard di seluruh proyek sengaja SKIP total pengecekan jabatan untuk role TAS (anggap otomatis
// lolos semua fitur, sama seperti ADMIN). Sekarang StaffJabatan ikut dibaca supaya TAS bisa
// benar-benar dibatasi sesuai jabatan aslinya (Kebersihan/Security/dll TIDAK otomatis dapat akses
// ke fitur yang tidak relevan dengan jabatannya).
export async function getJabatanNames(email: string): Promise<string[]> {
  const user = await prisma.user.findFirst({
    where: { email },
    select: {
      teacher: { select: { jabatan: { select: { jabatan: { select: { name: true } } } } } },
      staffJabatan: { select: { jabatan: { select: { name: true } } } },
    },
  });
  if (!user) return [];
  if (user.teacher) return user.teacher.jabatan.map(j => j.jabatan.name);
  return user.staffJabatan.map(j => j.jabatan.name);
}

/** Jabatan (id+name) yang dipegang guru via TeacherJabatan — dipakai untuk scoping kepemilikan
 * Program Kerja. TAS/Admin tidak butuh ini karena otomatis dapat akses penuh ke semua jabatan. */
export async function getOwnedJabatanIds(email: string): Promise<{ id: string; name: string }[]> {
  const teacher = await prisma.teacher.findFirst({
    where: { user: { email } },
    select: { jabatan: { select: { jabatan: { select: { id: true, name: true } } } } },
  });
  return teacher?.jabatan.map(j => j.jabatan) ?? [];
}

/** Untuk HALAMAN server (bukan route API): jalankan penjaga jabatan; bila ditolak ("FORBIDDEN") alihkan ke dashboard portal
 * pengguna. Tanpa ini galat FORBIDDEN tidak tertangkap dan pengguna tanpa jabatan melihat halaman 500 (temuan 15 Sep 2026:
 * /dashboard/teacher/wakasek/kurikulum/penugasan/print). Route API tetap memakai assertJabatan langsung → 403. */
export async function jabatanAtauAlihkan(session: { role: string }, penjaga: () => Promise<unknown>) {
  try {
    await penjaga();
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      redirect(session.role === "TEACHER" ? "/dashboard/teacher" : session.role === "STUDENT" ? "/dashboard/student" : "/dashboard/admin");
    }
    throw e;
  }
}
