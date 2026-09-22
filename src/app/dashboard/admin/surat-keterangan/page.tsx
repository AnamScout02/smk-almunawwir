import { redirect } from "next/navigation";

/** Surat Keterangan TIDAK lagi punya halaman pembuatan sendiri.
 *
 * Dulu di sini ada formulir terpisah dengan tata letak cetak sendiri — hasilnya sekolah punya
 * dua "buku surat" dan dua bentuk surat untuk hal yang sama. Sejak 13 September 2026 semua surat
 * keluar (termasuk keterangan aktif/kelakuan baik/lulus/pindah) dibuat dari satu tempat:
 * Persuratan, memakai pustaka template yang isian data siswanya terisi sendiri. Permohonan dari
 * portal siswa/orang tua masuk lewat menu Permintaan Surat, dan yang disetujui otomatis jadi
 * surat di sini juga (keputusan user: "iya jangan dipisahkan").
 *
 * Alamat lama tetap hidup sebagai pengalihan supaya tautan/bookmark lama tidak jadi 404. */
export default function Page() {
  redirect("/dashboard/admin/persuratan");
}
