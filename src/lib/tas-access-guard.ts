import "server-only";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { getJabatanNames } from "@/lib/jabatan-guard";

// Daftar & pemeriksanya kini di src/lib/tas-jabatan.ts (aman dipakai klien juga) — diekspor ulang
// dari sini supaya pemanggil lama tidak perlu diubah.
export { TAS_JABATAN, isFullTasJabatan } from "@/lib/tas-jabatan";
import { TAS_JABATAN } from "@/lib/tas-jabatan";

/** Sama seperti verifyRole(["ADMIN","TAS"]), TAPI mensyaratkan jabatan "Tenaga Administrasi
 * Sekolah"/"Kepala Tenaga Administrasi Sekolah" utk role TEACHER **MAUPUN role TAS** (ADMIN
 * otomatis lolos tanpa syarat jabatan).
 *
 * PERBAIKAN KRITIS 2026-08-10 (temuan user): sebelumnya SIAPAPUN dgn role TAS otomatis lolos di
 * sini tanpa cek jabatan sama sekali — padahal role TAS dipakai sbg wadah umum utk SEMUA staf
 * non-guru (lihat komentar getJabatanNames, jabatan-guard.ts), termasuk yang jabatannya cuma
 * "Security"/"Kebersihan"/"Tim Perpustakaan" dll, BUKAN staf Tata Usaha. Akibatnya security guard
 * & petugas kebersihan bisa akses PENUH modul Tata Usaha (Buku Induk, Persuratan, dst) DAN puluhan
 * endpoint /api/admin/** generik lain yg cuma cek verifyRole(["ADMIN","TAS"]) mentah (Siswa, Kelas,
 * Guru, Jabatan, Pendaftaran, dst) — celah privilege escalation nyata. Sekarang role TAS
 * DIPERLAKUKAN SAMA seperti TEACHER: wajib jabatan TU eksplisit via StaffJabatan. Staf TAS lain
 * (Security, Kebersihan, dst) tetap bisa login & lihat dashboard TAPI cuma menu yg sesuai jabatan
 * asli mereka (lihat TasSidebar.tsx `isFullTas` — HARUS pakai isFullTasJabatan() di bawah, bukan
 * `role === "TAS"` mentah).
 *
 * Dipakai di layout admin + semua endpoint modul Tata Usaha (Buku Induk, Buku Mutasi, Persuratan,
 * Pengarsipan, Notulen Rapat, Verifikasi Data) DAN sekarang JUGA menggantikan
 * verifyRole(["ADMIN","TAS"]) mentah di endpoint /api/admin/** generik lain (Siswa, Kelas, Guru,
 * Jabatan, Pendaftaran, Pengumuman, Jurusan, dst — lihat commit yg sama utk daftar lengkap). */
export async function verifyTasAccess() {
  const session = await verifySession();
  if (session.role === "ADMIN") return session;
  if (session.role === "TEACHER" || session.role === "TAS") {
    const names = await getJabatanNames(session.email);
    if (names.some(n => TAS_JABATAN.includes(n))) return session;
  }
  redirect("/login");
}

/** Versi non-redirect dari cek di atas — dipakai admin/layout.tsx utk hitung prop `isFullTas`
 * TasSidebar (harus konsisten dgn verifyTasAccess supaya menu yg TAMPIL sinkron dgn yg BENAR2 bisa
 * diakses; sebelum perbaikan ini isFullTas cuma `role === "TAS"` mentah, beda dgn guard API-nya). */
/** Versi boolean untuk route API: true bila Admin atau staf TU (tanpa redirect). */
export async function petugasTu() {
  const session = await verifySession();
  if (session.role === "ADMIN") return true;
  if (session.role !== "TEACHER" && session.role !== "TAS") return false;
  return (await getJabatanNames(session.email)).some(n => TAS_JABATAN.includes(n));
}

/** Gate PALING LUAR admin layout (`/dashboard/admin/**`) — BEDA dgn verifyTasAccess() di atas.
 * ADMIN & SEMUA staf role TAS (apapun jabatannya — Security, Kebersihan, Tim Perpustakaan, dst)
 * TETAP boleh MASUK layout supaya bisa login & lihat dashboard yg discoped sesuai jabatan asli
 * mereka lewat TasSidebar (jabatanNames + isFullTasJabatan menentukan menu APA yg tampil/bisa
 * diakses, bukan gate masuk ini). Guru (TEACHER) cuma boleh masuk kalau merangkap jabatan TU
 * (sama seperti verifyTasAccess) — guru tanpa jabatan TU tetap pakai portal guru biasa.
 * Modul/endpoint yg BENAR2 khusus Tata Usaha (Buku Induk, Persuratan, dst) DAN endpoint generik
 * /api/admin/** lain (Siswa, Kelas, dst) tetap pakai verifyTasAccess() yg ketat, BUKAN fungsi ini. */
export async function verifyAdminLayoutAccess() {
  const session = await verifySession();
  if (session.role === "ADMIN" || session.role === "TAS") return session;
  if (session.role === "TEACHER") {
    const names = await getJabatanNames(session.email);
    if (names.some(n => TAS_JABATAN.includes(n))) return session;
  }
  redirect("/login");
}
