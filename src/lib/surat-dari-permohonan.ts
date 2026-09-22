import "server-only";
import { prisma } from "@/lib/prisma";
import { getSettings, getPrincipalName } from "@/lib/site-settings";
import { templateSurat, type TemplateSurat } from "@/lib/template-surat";
import { bacaIsian, nilaiAwal, terapkan, type SiswaTemplate } from "@/lib/template-isian";
import { nomorSuratBerikutnya } from "@/lib/nomor-surat-berikutnya";

/** Permohonan surat dari portal → SURAT KELUAR BIASA.
 *
 * Dulu Surat Keterangan punya jalur sendiri: tabel sendiri, halaman cetak sendiri, tata letak
 * sendiri yang tidak sama dengan surat keluar lain. Akibatnya satu sekolah punya dua "buku surat"
 * dan dua bentuk surat untuk hal yang sama.
 *
 * Sekarang permohonan yang DISETUJUI langsung melahirkan baris `Surat` dari pustaka template
 * (50 template hasil penambangan arsip sekolah) dengan identitas siswa yang sudah terisi sendiri.
 * Petugas TU tinggal membuka, merapikan kalimatnya kalau perlu, lalu mencetak — persis seperti
 * surat keluar lainnya. Tabel `SuratKeterangan` tetap ada sebagai catatan PERMOHONAN (siapa yang
 * minta, kapan, diputus siapa, alasan penolakan) — riwayat yang memang tidak muat di tabel `Surat`.
 *
 * Keputusan user 13 September 2026: "iya jangan dipisahkan". */

/** Jenis permohonan lama → template di pustaka Persuratan. */
const TEMPLATE_PER_JENIS: Record<string, string> = {
  AKTIF: "KET_AKTIF",
  KELAKUAN_BAIK: "KET_KELAKUAN_BAIK",
  PINDAH: "MUT_KELUAR",
  LULUS: "KET_LULUS",
};

export function templateUntukJenis(jenis: string): TemplateSurat | undefined {
  return templateSurat(TEMPLATE_PER_JENIS[jenis] ?? "KET_AKTIF");
}

const tgl = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : null;

/** Ambil data siswa dalam bentuk yang dimengerti pengisi template. Bentuknya sengaja sama persis
 * dengan /api/admin/siswa-lookup supaya hasil isian otomatis identik dengan yang dilihat petugas
 * saat membuat surat manual. */
async function dataSiswa(studentId: string | null): Promise<SiswaTemplate | null> {
  if (!studentId) return null;
  const s = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      nis: true, nisn: true, birthPlace: true, birthDate: true, gender: true,
      address: true, parentName: true, bukuIndukData: true,
      user: { select: { name: true } },
      class: { select: { name: true } },
      major: { select: { code: true, name: true } },
    },
  });
  if (!s) return null;
  const d = (s.bukuIndukData ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : null);
  return {
    name: s.user.name, nis: s.nis, nisn: s.nisn,
    className: s.class?.name ?? null, majorCode: s.major.code, majorName: s.major.name,
    gender: s.gender, address: s.address, parentName: s.parentName,
    nik: str("nik"), motherName: str("motherName"), fatherName: str("fatherName"),
    birthPlace: s.birthPlace, birthDate: tgl(s.birthDate),
  };
}

export interface PermohonanUntukSurat {
  id: string;
  jenis: string;
  tanggal: Date;
  studentId: string | null;
  namaSiswa: string;
  nisSiswa: string | null;
  kelasSiswa: string | null;
  keperluan: string;
  tujuan: string | null;
  nomorSurat: string | null;
}

/** Buat surat keluar dari satu permohonan, lalu tautkan balik ke permohonannya.
 * Mengembalikan id surat yang terbentuk. Kalau permohonan sudah pernah punya surat, id lama
 * yang dikembalikan — persetujuan ulang tidak menggandakan surat. */
export async function buatSuratDariPermohonan(p: PermohonanUntukSurat): Promise<string> {
  const sudah = await prisma.suratKeterangan.findUnique({
    where: { id: p.id }, select: { suratId: true },
  });
  if (sudah?.suratId) return sudah.suratId;

  const t = templateUntukJenis(p.jenis);
  if (!t) throw new Error(`Template untuk jenis "${p.jenis}" tidak ditemukan.`);

  const [settings, tahun, siswa] = await Promise.all([
    getSettings(["school.structure"]),
    prisma.academicYear.findFirst({ where: { isActive: true }, select: { name: true } }),
    dataSiswa(p.studentId),
  ]);
  const konteks = {
    kepalaSekolah: getPrincipalName(settings["school.structure"]) || "",
    tahunPelajaran: tahun?.name ?? "",
  };

  const isian = bacaIsian(t.html, t.subjek ?? "siswa");
  const nilai = nilaiAwal(isian, siswa, konteks);

  // Identitas siswa yang tersimpan di permohonan dipakai sebagai cadangan — permohonan lama
  // bisa saja tidak tertaut ke `Student` (diketik manual oleh TU).
  if (!nilai["NAMA SISWA"]) nilai["NAMA SISWA"] = p.namaSiswa;
  if (!nilai["NIS"] && p.nisSiswa) nilai["NIS"] = p.nisSiswa;
  if (!nilai["KELAS"] && p.kelasSiswa) nilai["KELAS"] = p.kelasSiswa;

  // Yang hanya diketahui dari permohonannya sendiri.
  if (p.keperluan.trim()) nilai["KEPERLUAN"] = p.keperluan.trim();
  if (p.tujuan?.trim()) {
    nilai["SEKOLAH TUJUAN"] = p.tujuan.trim();
    if (!nilai["ALASAN"]) nilai["ALASAN"] = p.keperluan.trim();
  }

  const nomor = p.nomorSurat ?? (await nomorSuratBerikutnya(t.klasifikasi, p.tanggal));

  const surat = await prisma.surat.create({
    data: {
      tipe: "KELUAR",
      nomor,
      tanggal: p.tanggal,
      pihak: p.tujuan?.trim() ? `Kepala ${p.tujuan.trim()}` : t.pihak,
      perihal: t.perihal,
      klasifikasi: t.klasifikasi,
      content: terapkan(t.html, nilai, isian),
      penandaTangan: "Kepala SMK Al Munawwir IIBS",
      templateValue: t.value,
      templateIsi: nilai,
    },
  });

  await prisma.suratKeterangan.update({
    where: { id: p.id },
    data: { suratId: surat.id, nomorSurat: nomor },
  });
  return surat.id;
}
