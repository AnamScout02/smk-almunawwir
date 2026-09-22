import "server-only";
import { prisma } from "@/lib/prisma";

/** Kalender Pendidikan bentuk MATRIKS — baris bulan, kolom tanggal 1–31.
 *
 * Inilah bentuk yang benar-benar dipakai sekolah: ditempel di dinding dan dilampirkan ke dokumen
 * kurikulum. Sebelum ini sistem cuma punya daftar agenda per bulan (temuan user 13 September 2026:
 * "tampilan seperti ini tidak ada?"), padahal datanya sudah lengkap di `SchoolEvent`.
 *
 * Isi tiap sel mengikuti aturan kalender sekolah:
 *   0. Sebelum hari sekolah pertama → di luar kalender (abu-abu). Tahun ajaran resmi mulai
 *                         1 Juli, tapi sekolah baru masuk pertengahan Juli — hari-hari sebelumnya
 *                         masih libur akhir semester tahun ajaran SEBELUMNYA, jadi tidak boleh
 *                         ikut dihitung sebagai hari efektif (kalau dihitung, seluruh penomoran
 *                         meleset: terukur 146 vs 136 pada kalender asli sekolah).
 *   1. Minggu           → LU (libur umum), selalu, tanpa perlu didaftarkan sebagai agenda.
 *   2. Ada agenda       → kode agenda itu. Agenda yang TIDAK meliburkan (sumatif, rapor, UKK, dsb)
 *                         tetap memperlihatkan NOMOR hari efektif, kodenya cuma jadi warna.
 *   3. Selebihnya       → nomor hari efektif yang berjalan naik.
 *
 * Nomor hari efektif dihitung ulang dari nol tiap semester (Ganjil Juli–Desember, Genap
 * Januari–Juni) — sama seperti dua angka "Hari efektif" di kaki kalender aslinya.
 */

export type SifatKode = "LIBUR" | "NONEFEKTIF" | "EFEKTIF";

export interface Kode {
  kode: string;
  label: string;
  warna: string;      // latar sel
  teks: string;       // warna tulisan di atas latar itu
  sifat: SifatKode;
}

/** Daftar kode + warnanya. Disalin dari keterangan pada kalender cetak sekolah sendiri supaya
 * hasil sistem bisa ditumpuk dengan lembar lama tanpa terasa beda. */
export const KODE: Record<string, Kode> = {
  // Palet sengaja TENANG, bukan merah-oranye-kuning pekat seperti kalender Excel aslinya
  // (permintaan user 13 September 2026). Dasarnya navy sekolah dengan pendukung pastel:
  //  - LU muncul ~90 kali (tiap Minggu) sehingga WAJIB paling pucat — kalau pekat, seluruh
  //    matriks terbaca sebagai bidang merah dan angka hari efektifnya tenggelam.
  //  - Merah sungguhan hanya untuk LHB yang memang jarang, supaya tetap langsung tertangkap mata.
  //  - Kegiatan efektif (STS/SAS/PR/UP/UKK/PSAJ/PRM) memakai pastel berbeda rona tapi setara
  //    terang, karena sel-sel itu tetap memuat ANGKA yang harus terbaca di atasnya.
  LHB:  { kode: "LHB",  label: "Libur Hari Besar",          warna: "#D2544F", teks: "#FFFFFF", sifat: "LIBUR" },
  LU:   { kode: "LU",   label: "Libur Umum",                warna: "#F6E3E3", teks: "#A33A36", sifat: "LIBUR" },
  LS1:  { kode: "LS1",  label: "Libur Semester 1",          warna: "#E6E9F4", teks: "#2E3F8F", sifat: "LIBUR" },
  LS2:  { kode: "LS2",  label: "Libur Semester 2",          warna: "#E6E9F4", teks: "#2E3F8F", sifat: "LIBUR" },
  CB:   { kode: "CB",   label: "Cuti Bersama",              warna: "#F4E3BE", teks: "#7A5A10", sifat: "LIBUR" },
  LHR:  { kode: "LHR",  label: "Libur Sekitar Hari Raya",   warna: "#F3DCE2", teks: "#8C3B54", sifat: "LIBUR" },
  KPP:  { kode: "KPP",  label: "Kegiatan Permulaan Puasa",  warna: "#F7EFC8", teks: "#6E5A12", sifat: "NONEFEKTIF" },
  KTS:  { kode: "KTS",  label: "Kegiatan Tengah Semester",  warna: "#D5EBD9", teks: "#1E5B2C", sifat: "NONEFEKTIF" },
  STS:  { kode: "STS",  label: "Sumatif Tengah Semester",   warna: "#CFE7EF", teks: "#0F4653", sifat: "EFEKTIF" },
  SAS:  { kode: "SAS",  label: "Sumatif Akhir Semester",    warna: "#B9CAEA", teks: "#152C63", sifat: "EFEKTIF" },
  PR:   { kode: "PR",   label: "Pembagian Rapor",           warna: "#2E3F8F", teks: "#FFFFFF", sifat: "EFEKTIF" },
  UP:   { kode: "UP",   label: "Ujian Praktik",             warna: "#E4DAF2", teks: "#41246E", sifat: "EFEKTIF" },
  UKK:  { kode: "UKK",  label: "UKK",                       warna: "#F2D7CE", teks: "#7A3520", sifat: "EFEKTIF" },
  PSAJ: { kode: "PSAJ", label: "PSAJ",                      warna: "#D9CDEF", teks: "#3B2270", sifat: "EFEKTIF" },
  PRM:  { kode: "PRM",  label: "Pondok Ramadhan",           warna: "#D3ECD8", teks: "#1B5128", sifat: "EFEKTIF" },
};


/** Tebak kode dari judul & jenis agenda. Dipakai kalau `SchoolEvent.kode` kosong — sehingga 52
 * agenda yang sudah telanjur diimpor tidak perlu ditandai ulang satu per satu. */
export function tebakKode(judul: string, jenis: string, hariEfektif: boolean): string | null {
  const j = judul.toLowerCase();
  const punya = (...kata: string[]) => kata.some(k => j.includes(k));

  if (punya("cuti bersama")) return "CB";
  if (punya("libur semester ganjil", "libur akhir semester ganjil")) return "LS1";
  if (punya("libur akhir semester genap", "libur semester genap")) return "LS2";
  if (punya("idul fitri", "'idul fitri", "hari raya idul")) return "LHR";
  if (punya("permulaan puasa")) return "KPP";
  if (punya("kegiatan tengah semester")) return "KTS";
  if (punya("pembagian rapor")) return "PR";
  if (punya("sumatif tengah semester")) return "STS";
  if (punya("sumatif akhir semester")) return "SAS";
  if (punya("sumatif akhir jenjang", "psaj")) return "PSAJ";
  if (punya("uji kompetensi keahlian", "ukk")) return "UKK";
  if (punya("ujian praktik")) return "UP";
  if (punya("pondok ramadhan")) return "PRM";
  // Sisa agenda berjenis LIBUR yang tidak masuk kategori di atas = hari besar nasional/keagamaan.
  if (jenis === "LIBUR" || !hariEfektif) return "LHB";
  return null; // kegiatan efektif biasa — tampil sebagai nomor hari efektif tanpa warna
}

export interface Sel {
  tanggal: number;
  ada: boolean;          // false untuk tanggal yang tidak ada di bulan itu (mis. 31 Februari)
  kode: Kode | null;
  nomor: number | null;  // nomor hari efektif
  judul: string | null;  // untuk tooltip
}

export interface BarisBulan {
  label: string;         // "JULI 2026"
  semester: "GANJIL" | "GENAP";
  sel: Sel[];            // selalu 31 elemen
}

export interface HasilMatriks {
  tahun: string;
  /** Hari sekolah pertama yang dipakai sebagai titik mulai penomoran. */
  mulaiSekolah: string;
  baris: BarisBulan[];
  efektifGanjil: number;
  efektifGenap: number;
  /** Jumlah hari untuk tiap kode non-efektif (mis. KTS: 3) — ikut dicantumkan di kaki kalender. */
  jumlahNonEfektif: { kode: Kode; jumlah: number }[];
  hariBesar: { tanggal: string; nama: string }[];
  cutiBersama: { tanggal: string; nama: string }[];
  kodeTerpakai: Kode[];
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** `academicYearId` kosong = tahun ajaran aktif. Diisi kalau ingin mencetak kalender tahun lain
 * (arsip tahun lalu, atau tahun depan yang sudah disiapkan tapi belum diaktifkan). */
export async function bangunMatriks(academicYearId?: string): Promise<HasilMatriks | null> {
  const tahun = academicYearId
    ? await prisma.academicYear.findUnique({ where: { id: academicYearId } })
    : await prisma.academicYear.findFirst({ where: { isActive: true } });
  if (!tahun) return null;

  const agenda = await prisma.schoolEvent.findMany({
    where: { OR: [{ academicYearId: tahun.id }, { academicYearId: null }] },
    orderBy: { tanggalMulai: "asc" },
    select: { judul: true, jenis: true, hariEfektif: true, kode: true, tanggalMulai: true, tanggalSelesai: true },
  });

  // Petakan tiap TANGGAL ke agenda yang menutupinya. Agenda yang lebih spesifik (rentang lebih
  // pendek) menang atas yang panjang — "Pembagian Rapor" satu hari harus mengalahkan "Kegiatan
  // Pembelajaran" sebulan penuh yang melingkupinya.
  const perTanggal = new Map<string, { kode: string | null; judul: string; lebar: number }>();
  for (const a of agenda) {
    const mulai = new Date(a.tanggalMulai);
    const selesai = new Date(a.tanggalSelesai);
    const lebar = Math.round((selesai.getTime() - mulai.getTime()) / 86_400_000) + 1;
    const kode = a.kode ?? tebakKode(a.judul, a.jenis, a.hariEfektif);
    for (let d = new Date(mulai); d <= selesai; d.setUTCDate(d.getUTCDate() + 1)) {
      const k = iso(d);
      const ada = perTanggal.get(k);
      if (!ada || lebar < ada.lebar) perTanggal.set(k, { kode, judul: a.judul, lebar });
    }
  }

  const mulaiTahun = new Date(tahun.startDate);
  const akhirTahun = new Date(tahun.endDate);

  // Hari sekolah pertama = tanggal agenda paling awal di tahun ajaran ini. `AcademicYear.startDate`
  // (1 Juli) adalah batas administratif, bukan hari masuk — di kalender sekolah, 1–12 Juli masih
  // abu-abu karena libur akhir semester genap tahun sebelumnya.
  const mulaiSekolah = agenda.length
    ? new Date(Math.max(
        mulaiTahun.getTime(),
        Math.min(...agenda.map(a => new Date(a.tanggalMulai).getTime())),
      ))
    : mulaiTahun;
  const baris: BarisBulan[] = [];
  let efektifGanjil = 0, efektifGenap = 0;
  const hitungNonEfektif = new Map<string, number>();
  const terpakai = new Set<string>();
  const hariBesar: { tanggal: string; nama: string }[] = [];
  const cutiBersama: { tanggal: string; nama: string }[] = [];

  // Penomoran berjalan per semester; direset saat berpindah dari Desember ke Januari.
  let nomor = 0;
  let semesterSebelumnya: "GANJIL" | "GENAP" | null = null;

  const kursor = new Date(Date.UTC(mulaiTahun.getUTCFullYear(), mulaiTahun.getUTCMonth(), 1));
  const batas = new Date(Date.UTC(akhirTahun.getUTCFullYear(), akhirTahun.getUTCMonth(), 1));

  while (kursor <= batas) {
    const th = kursor.getUTCFullYear(), bl = kursor.getUTCMonth();
    const semester: "GANJIL" | "GENAP" = bl >= 6 ? "GANJIL" : "GENAP";
    if (semester !== semesterSebelumnya) { nomor = 0; semesterSebelumnya = semester; }

    const jumlahHari = new Date(Date.UTC(th, bl + 1, 0)).getUTCDate();
    const sel: Sel[] = [];
    for (let t = 1; t <= 31; t++) {
      if (t > jumlahHari) { sel.push({ tanggal: t, ada: false, kode: null, nomor: null, judul: null }); continue; }
      const d = new Date(Date.UTC(th, bl, t));
      const diLuarTahun = d < mulaiSekolah || d > akhirTahun;
      if (diLuarTahun) {
        // Minggu tetap digambar merah walau di luar masa sekolah — mengikuti kalender aslinya.
        const minggu = d.getUTCDay() === 0 && d >= mulaiTahun;
        sel.push({ tanggal: t, ada: minggu, kode: minggu ? KODE.LU : null, nomor: null, judul: null });
        continue;
      }

      const acara = perTanggal.get(iso(d));
      // Minggu selalu libur umum — tidak perlu didaftarkan sebagai agenda.
      let kode: Kode | null = d.getUTCDay() === 0 ? KODE.LU : null;
      if (!kode && acara?.kode) kode = KODE[acara.kode] ?? null;

      let nomorSel: number | null = null;
      if (!kode || kode.sifat === "EFEKTIF") {
        nomor += 1;
        nomorSel = nomor;
        if (semester === "GANJIL") efektifGanjil += 1; else efektifGenap += 1;
      } else if (kode.sifat === "NONEFEKTIF") {
        hitungNonEfektif.set(kode.kode, (hitungNonEfektif.get(kode.kode) ?? 0) + 1);
      }
      if (kode) terpakai.add(kode.kode);

      // Daftar hari besar & cuti bersama di kaki kalender.
      if (acara && kode && (kode.kode === "LHB" || kode.kode === "CB")) {
        const baris2 = {
          tanggal: d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }),
          nama: acara.judul,
        };
        const tujuan = kode.kode === "CB" ? cutiBersama : hariBesar;
        if (!tujuan.some(x => x.nama === baris2.nama)) tujuan.push(baris2);
      }

      sel.push({ tanggal: t, ada: true, kode, nomor: nomorSel, judul: acara?.judul ?? null });
    }

    baris.push({
      label: new Date(Date.UTC(th, bl, 1)).toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).toUpperCase(),
      semester, sel,
    });
    kursor.setUTCMonth(kursor.getUTCMonth() + 1);
  }

  return {
    tahun: tahun.name,
    mulaiSekolah: iso(mulaiSekolah),
    baris,
    efektifGanjil,
    efektifGenap,
    jumlahNonEfektif: [...hitungNonEfektif.entries()].map(([k, jumlah]) => ({ kode: KODE[k], jumlah })),
    hariBesar,
    cutiBersama,
    kodeTerpakai: Object.values(KODE).filter(k => terpakai.has(k.kode)),
  };
}
