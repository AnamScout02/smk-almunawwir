/**
 * Pembantu netral seputar tempat PKL — TIDAK bertanda `server-only` supaya halaman klien
 * (portal siswa) bisa memakainya, sama seperti pemisahan `dapodik-alamat.ts` vs `dapodik.ts`.
 * Setelan tingkat pendaftar yang menyentuh SiteSetting ada di `pkl-pendaftar.ts`.
 */

/** Perusahaan penanda "penempatan belum ditentukan" pada baris `Internship`. Baris seperti ini
 *  dibuat lewat tombol massal di halaman PKL supaya seluruh peserta sudah terdaftar sebelum
 *  tempatnya pasti — selama masih bernilai ini, siswa tetap boleh mengajukan pilihan tempat. */
export const TEMPAT_BELUM_DITENTUKAN = "Belum ditentukan";

export function penempatanBelumPasti(company?: string | null): boolean {
  return !company?.trim() || company.trim().toLowerCase() === TEMPAT_BELUM_DITENTUKAN.toLowerCase();
}
