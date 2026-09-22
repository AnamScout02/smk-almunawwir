/** Menjadikan template surat sebagai FORMULIR, bukan teks berisi tanda kurung siku.
 *
 * Template menandai bagian yang perlu diisi dengan [SEPERTI INI]. Modul ini membaca tanda itu
 * langsung dari isi templatenya, lalu memilah tiap tanda jadi tiga jenis:
 *
 *  - `siswa`   : terisi sendiri begitu nama siswa dipilih (dari Buku Induk)
 *  - `sekolah` : terisi sendiri dari pengaturan (kepala sekolah, tahun pelajaran)
 *  - `manual`  : memang harus diketik — nama kegiatan, hari, jam, tempat, dan sejenisnya
 *
 * Sengaja DIBACA dari templatenya, bukan didaftar satu per satu per template: ada 50 template
 * dengan 118 macam tanda, dan daftar manual seperti itu pasti cepat tidak sinkron begitu ada
 * template baru. */

export interface SiswaTemplate {
  name: string; nis: string; nisn?: string | null; className?: string | null;
  majorCode?: string; majorName?: string | null; gender?: string | null;
  address?: string | null; parentName?: string | null; nik?: string | null;
  motherName?: string | null; fatherName?: string | null;
  birthPlace?: string | null; birthDate?: string | null;
}

export interface GuruTemplate {
  name: string; nip?: string | null; position?: string | null; subject?: string | null;
  birthPlace?: string | null; birthDate?: string | null; address?: string | null;
  nik?: string | null; startDate?: string | null;
}

export interface KonteksSekolah { kepalaSekolah: string; tahunPelajaran: string }

export type Subjek = "siswa" | "guru" | undefined;

export type JenisIsian = "siswa" | "guru" | "sekolah" | "manual";
export type TipeInput = "teks" | "tanggal" | "jam" | "panjang";

export interface Isian {
  tanda: string;          // teks asli di dalam kurung siku, mis. "NAMA SISWA"
  label: string;          // versi enak dibaca untuk label formulir
  jenis: JenisIsian;
  tipe: TipeInput;
}

/** Tanda yang bisa diambil dari data siswa. */
const DARI_SISWA: Record<string, (s: SiswaTemplate) => string> = {
  "NAMA SISWA": s => s.name,
  "NAMA ALUMNI": s => s.name,
  "NIS": s => s.nis,
  "NISN": s => s.nisn ?? "",
  "KELAS": s => s.className ?? "",
  "JURUSAN": s => s.majorName ?? s.majorCode ?? "",
  "ALAMAT": s => s.address ?? "",
  "NIK": s => s.nik ?? "",
  "L/P": s => (s.gender === "L" ? "L" : s.gender === "P" ? "P" : ""),
  "NAMA IBU": s => s.motherName ?? "",
  "NAMA AYAH": s => s.fatherName ?? "",
  "NAMA ORANG TUA": s => s.parentName ?? s.fatherName ?? "",
  "NAMA ORANG TUA/WALI": s => s.parentName ?? s.fatherName ?? "",
  "NAMA WALI": s => s.parentName ?? "",
  "TEMPAT, TGL LAHIR": s => [s.birthPlace, s.birthDate].filter(Boolean).join(", "),
  "TEMPAT, TANGGAL LAHIR": s => [s.birthPlace, s.birthDate].filter(Boolean).join(", "),
  "TEMPAT/TGL LAHIR": s => [s.birthPlace, s.birthDate].filter(Boolean).join(", "),
};

/** Tanda yang diambil dari data pegawai. Beberapa tanda dipakai bersama data siswa
 * ([TEMPAT, TGL LAHIR], [ALAMAT], [NIK], [JABATAN]) — yang menentukan artinya adalah `subjek`
 * template, bukan nama tandanya. */
const DARI_GURU: Record<string, (g: GuruTemplate) => string> = {
  "NAMA": g => g.name,
  "NAMA GURU": g => g.name,
  "NAMA PEGAWAI": g => g.name,
  "NIP": g => g.nip ?? "",
  "NOMOR": g => g.nip ?? "",
  "NUPTK/NIP": g => g.nip ?? "",
  "NUPTK": g => g.nip ?? "",
  "JABATAN": g => g.position ?? "",
  "MATA PELAJARAN": g => g.subject ?? "",
  "MAPEL": g => g.subject ?? "",
  "ALAMAT": g => g.address ?? "",
  "NIK": g => g.nik ?? "",
  "TANGGAL MULAI": g => g.startDate ?? "",
  "TEMPAT, TGL LAHIR": g => [g.birthPlace, g.birthDate].filter(Boolean).join(", "),
  "TEMPAT, TANGGAL LAHIR": g => [g.birthPlace, g.birthDate].filter(Boolean).join(", "),
  "TEMPAT/TGL LAHIR": g => [g.birthPlace, g.birthDate].filter(Boolean).join(", "),
};

const DARI_SEKOLAH: Record<string, (k: KonteksSekolah) => string> = {
  "NAMA KEPALA SEKOLAH": k => k.kepalaSekolah,
  "TAHUN PELAJARAN": k => k.tahunPelajaran,
};

/** Tanda bertanggal/berjam supaya formulirnya memakai pemilih yang sesuai. */
const POLA_TANGGAL = /(^|\s)(TANGGAL|TGL)(\s|$)|TANGGAL$/;
const POLA_JAM = /^JAM$|^PUKUL$/;
const POLA_PANJANG = /^(ISI|URAIAN|ALASAN|KETERANGAN|PENJELASAN|HASIL|MAKSUD|DASAR|CATATAN)/;

function rapikan(t: string): string {
  const s = t.toLowerCase().replace(/\s+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Daftar isian yang dibutuhkan sebuah template, urut kemunculan & tanpa duplikat.
 * `subjek` menentukan tanda bersama (mis. [TEMPAT, TGL LAHIR]) dibaca sebagai data siapa. */
export function bacaIsian(html: string, subjek: Subjek = "siswa"): Isian[] {
  const tanda = [...html.matchAll(/\[([A-Z0-9][A-Z0-9 ./&,'\-]{1,45})\]/g)].map(m => m[1].trim());
  const unik = [...new Set(tanda)];
  return unik.map(t => {
    const jenis: JenisIsian =
      subjek === "guru" && t in DARI_GURU ? "guru"
      : subjek === "siswa" && t in DARI_SISWA ? "siswa"
      : t in DARI_SEKOLAH ? "sekolah" : "manual";
    const tipe: TipeInput =
      POLA_JAM.test(t) ? "jam" :
      POLA_TANGGAL.test(t) ? "tanggal" :
      POLA_PANJANG.test(t) ? "panjang" : "teks";
    return { tanda: t, label: rapikan(t), jenis, tipe };
  });
}

export function butuhSiswa(isian: Isian[]): boolean { return isian.some(i => i.jenis === "siswa"); }
export function butuhGuru(isian: Isian[]): boolean { return isian.some(i => i.jenis === "guru"); }

/** Nilai awal formulir: bagian subjek & sekolah langsung terisi, sisanya dikosongkan. */
export function nilaiAwal(
  isian: Isian[], subjekData: SiswaTemplate | GuruTemplate | null, konteks: KonteksSekolah,
): Record<string, string> {
  const v: Record<string, string> = {};
  for (const i of isian) {
    if (i.jenis === "siswa") v[i.tanda] = subjekData ? (DARI_SISWA[i.tanda]?.(subjekData as SiswaTemplate) ?? "") : "";
    else if (i.jenis === "guru") v[i.tanda] = subjekData ? (DARI_GURU[i.tanda]?.(subjekData as GuruTemplate) ?? "") : "";
    else if (i.jenis === "sekolah") v[i.tanda] = DARI_SEKOLAH[i.tanda]?.(konteks) ?? "";
    else v[i.tanda] = "";
  }
  return v;
}

const tglIndonesia = (iso: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(`${iso}T00:00:00`);
  return isNaN(d.getTime()) ? iso
    : d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
};

/** Ganti semua tanda dengan isian formulir. Tanda yang dibiarkan kosong TETAP ditulis sebagai
 * [TANDA] — supaya yang belum terisi masih terlihat jelas di lembar kerja, bukan hilang
 * menjadi ruang kosong yang luput dari perhatian saat surat dicetak. */
export function terapkan(html: string, nilai: Record<string, string>, isian: Isian[]): string {
  const tipe = new Map(isian.map(i => [i.tanda, i.tipe]));
  return html.replace(/\[([A-Z0-9][A-Z0-9 ./&,'\-]{1,45})\]/g, (asli, t: string) => {
    const v = (nilai[t.trim()] ?? "").trim();
    if (!v) return asli;
    return tipe.get(t.trim()) === "tanggal" ? tglIndonesia(v) : v;
  });
}
