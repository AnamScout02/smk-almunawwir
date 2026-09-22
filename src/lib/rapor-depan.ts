import "server-only";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { SISWA_COLUMNS, type StudentRow } from "@/lib/buku-induk-siswa-columns";

/** HALAMAN DEPAN RAPOR (22 September 2026) — padanan lembar HAL.1-2 & HAL.3 makro rapor sekolah: sampul, identitas sekolah (i),
 * petunjuk pengisian (ii), keterangan tentang diri peserta didik (iii), keterangan pindah sekolah, catatan prestasi. Semua dari
 * data yang sudah ada: identitas sekolah dari setelan Nominatif & Kontak, biodata siswa dari Buku Induk (getter kolom yang sama
 * dengan tabel/ekspor Buku Induk). Yang tidak tercatat di situs (mis. Status dalam Keluarga) dicetak bertitik untuk diisi tangan. */
export interface BiodataRapor {
  id: string; nama: string; nis: string; nisn: string; ttl: string; jk: string; agama: string; statusKeluarga: string; anakKe: string;
  alamat: string; telp: string; sekolahAsal: string; diterimaKelas: string; diterimaTanggal: string;
  ayah: string; ibu: string; alamatOrtu: string; telpOrtu: string; kerjaAyah: string; kerjaIbu: string;
  wali: string; alamatWali: string; telpWali: string; kerjaWali: string;
}

const ANGKA = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas", "Dua Belas"];
const gabung = (...x: (string | undefined)[]) => x.map(v => (v ?? "").trim()).filter(Boolean).join(", ");
const rtrw = (rt: string, rw: string) => (rt || rw ? `RT ${rt || "-"}/RW ${rw || "-"}` : "");

export async function susunHalamanDepan(classId: string) {
  const [st, siswa] = await Promise.all([
    getSettings(["nominatif.npsn", "nominatif.nss", "nominatif.kodePos", "nominatif.kecamatan", "nominatif.kabKota", "contact.address", "contact.email"]),
    prisma.student.findMany({
      where: { classId, studentStatus: "AKTIF" },
      select: {
        id: true, nis: true, nisn: true, birthPlace: true, birthDate: true, gender: true, religion: true, address: true,
        parentName: true, parentPhone: true, parentJob: true, previousSchool: true, enrollYear: true, studentStatus: true,
        bukuIndukData: true, user: { select: { name: true, email: true } }, class: { select: { name: true } }, major: { select: { name: true } },
      },
      orderBy: { user: { name: "asc" } },
    }),
  ]);
  // Alamat sekolah dari Kontak ("Jl. …, Ds. Kemiri, Kec. Singojuruh, Banyuwangi, Jawa Timur"): jalan, desa, provinsi.
  const alamat = st["contact.address"] ?? "";
  const bagian = alamat.split(",").map(x => x.trim()).filter(Boolean);
  const sekolah = {
    npsn: st["nominatif.npsn"] ?? "", nss: st["nominatif.nss"] ?? "", alamat: bagian[0] ?? alamat,
    kodePos: st["nominatif.kodePos"] ?? "", desa: /\b(?:Ds|Desa|Kel|Kelurahan)\.?\s+([^,]+)/i.exec(alamat)?.[1]?.trim() ?? "",
    kecamatan: st["nominatif.kecamatan"] ?? "", kabKota: st["nominatif.kabKota"] ?? "",
    provinsi: bagian.length > 1 && !/^(Kab|Kota|Kec|Ds|Desa)\b/i.test(bagian[bagian.length - 1]) ? bagian[bagian.length - 1] : "",
    website: "", email: st["contact.email"] ?? "",
  };
  const kol = new Map(SISWA_COLUMNS.map(c => [c.key, c.get]));
  const ambil = (s: StudentRow, k: string) => (kol.get(k)?.(s) ?? "").trim();
  const biodata: BiodataRapor[] = siswa.map(x => {
    const s = { ...x, bukuIndukData: (x.bukuIndukData ?? null) as Record<string, unknown> | null } as StudentRow & { id: string };
    const anak = ambil(s, "childOrder");
    const n = Number(anak);
    const alamatSiswa = x.address?.trim() || gabung(ambil(s, "dusun"), rtrw(ambil(s, "rt"), ambil(s, "rw")), ambil(s, "desa"), ambil(s, "kecamatan"), ambil(s, "kabupaten"));
    const alamatDari = (awal: string) => gabung(ambil(s, `${awal}Dusun`), rtrw(ambil(s, `${awal}Rt`), ambil(s, `${awal}Rw`)), ambil(s, `${awal}Desa`), ambil(s, `${awal}Kecamatan`), ambil(s, `${awal}Kabupaten`));
    return {
      id: x.id, nama: x.user.name.toUpperCase(), nis: x.nis, nisn: x.nisn ?? "",
      ttl: gabung(x.birthPlace ?? "", ambil(s, "birthDate")), jk: ambil(s, "gender"), agama: x.religion ?? "", statusKeluarga: "",
      anakKe: anak ? (Number.isInteger(n) && ANGKA[n] ? `${n} (${ANGKA[n]})` : anak) : "",
      alamat: alamatSiswa, telp: ambil(s, "studentPhone"), sekolahAsal: x.previousSchool ?? "",
      diterimaKelas: ambil(s, "tingkatMasuk"), diterimaTanggal: ambil(s, "diterimaDate"),
      ayah: ambil(s, "fatherName") || (x.parentName ?? ""), ibu: ambil(s, "motherName"),
      alamatOrtu: alamatDari("father") || alamatDari("mother") || alamatSiswa, telpOrtu: x.parentPhone ?? "",
      kerjaAyah: ambil(s, "fatherJob") || (x.parentJob ?? ""), kerjaIbu: ambil(s, "motherJob"),
      wali: ambil(s, "guardianName"), alamatWali: alamatDari("guardian"), telpWali: ambil(s, "guardianPhone"), kerjaWali: ambil(s, "guardianJob"),
    };
  });
  return { sekolah, biodata };
}
export type DataHalamanDepan = Awaited<ReturnType<typeof susunHalamanDepan>>;
