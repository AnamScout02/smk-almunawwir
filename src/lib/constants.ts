/** Password default untuk akun baru yang dibuat sistem (siswa/guru/staf via form manual atau
 * impor, dan sekarang akun Orang Tua otomatis — lihat src/lib/parent-account.ts). Sebelumnya
 * string "Almunawwir1" ditulis berulang di banyak tempat (BukuIndukSiswaModal.tsx, import
 * routes, admin/users/page.tsx, prisma/reset-users.ts) — konstanta ini TIDAK menggantikan
 * lokasi lama itu (blast radius kecil, sengaja tidak disentuh), cukup dipakai kode baru supaya
 * tidak menambah duplikasi ke-6. Keputusan default password ini: eksplisit user 2026-08-09. */
export const DEFAULT_PASSWORD = "Almunawwir1";
