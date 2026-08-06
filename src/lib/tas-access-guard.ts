import "server-only";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { getJabatanNames } from "@/lib/jabatan-guard";

const TAS_JABATAN = ["Tenaga Administrasi Sekolah", "Kepala Tenaga Administrasi Sekolah"];

/** Sama seperti verifyRole(["ADMIN","TAS"]), TAPI juga meloloskan guru (role TEACHER) yang punya
 * jabatan "Tenaga Administrasi Sekolah"/"Kepala Tenaga Administrasi Sekolah" — untuk guru yang
 * MERANGKAP tugas TU (contoh nyata: Mutmainnah, M. Khoirul Anam). Mereka sengaja TIDAK dipindah
 * ke role TAS karena itu akan menghilangkan akses fitur mengajar mereka (Nilai/Absensi/Jadwal —
 * mereka juga punya TeachingAssignment aktif), jadi tetap role TEACHER, cuma jabatan TU-nya yang
 * membuka akses ke fitur Tata Usaha ini. Dipakai di layout admin + semua endpoint modul Tata Usaha
 * (Buku Induk, Buku Mutasi, Persuratan, Pengarsipan, Notulen Rapat, Verifikasi Data). */
export async function verifyTasAccess() {
  const session = await verifySession();
  if (session.role === "ADMIN" || session.role === "TAS") return session;
  if (session.role === "TEACHER") {
    const names = await getJabatanNames(session.email);
    if (names.some(n => TAS_JABATAN.includes(n))) return session;
  }
  redirect("/login");
}
