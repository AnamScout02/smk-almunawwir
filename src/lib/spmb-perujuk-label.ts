/** Label jenis perujuk — berkas NETRAL (bukan `server-only`) karena dipakai halaman klien juga.
 *  `src/lib/spmb-perujuk.ts` menyentuh Prisma sehingga tidak bisa diimpor dari komponen klien. */
export const LABEL_JENIS: Record<string, string> = {
  SISWA: "Siswa", PEGAWAI: "Guru / Pegawai", ALUMNI: "Alumni", LUAR: "Perujuk Luar",
};
