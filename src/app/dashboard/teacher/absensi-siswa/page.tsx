import AbsensiSiswaManager from "@/components/shared/AbsensiSiswaManager";

/** Versi wali kelas biasa (bukan Wakasek Kesiswaan/Guru BK) dari Rekap Absensi Siswa — dropdown
 * kelasnya dibatasi ke kelas walinya sendiri lewat classesEndpoint scope=homeroom (API absensi di
 * baliknya — tanggal/siswa/kalender bulanan — sudah otomatis scope ke kelas wali utk role guru
 * tanpa jabatan Kesiswaan/BK, lihat masing2 route.ts). Menu ini muncul di sidebar utk siapapun
 * berstatus wali kelas (hasHomeroom), terpisah dari /dashboard/teacher/kesiswaan/absensi-siswa
 * yang aksesnya lintas kelas khusus Kesiswaan/BK. */
export default function TeacherAbsensiSiswaPage() {
  return <AbsensiSiswaManager classesEndpoint="/api/teacher/classes?scope=homeroom" kalenderHref="/dashboard/teacher/absensi-siswa/cetak-kalender" />;
}
