/** Beranda portal sesuai peran akun — dipakai tombol "Kembali" di halaman yang TIDAK ada di menu
 * sidebar (mis. Notifikasi, yang dibuka dari lonceng di halaman mana pun), supaya semua portal
 * memakai tujuan yang sama. ADMIN & TAS berbagi satu portal (/dashboard/admin, sidebar berbeda). */
export function berandaPortal(role: string | null | undefined): string {
  if (role === "TEACHER") return "/dashboard/teacher";
  if (role === "STUDENT") return "/dashboard/student";
  if (role === "PARENT") return "/dashboard/parent";
  return "/dashboard/admin";
}
