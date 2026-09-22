import "server-only";
import { prisma } from "@/lib/prisma";
import { resolveExitDate } from "@/lib/student-exit";

/** Pemeriksa mutu data sekolah.
 *
 * Setiap aturan di sini lahir dari kesalahan NYATA yang ditemukan saat impor data alumni &
 * angkatan 8-10 (11-12 September 2026) — waktu itu ditemukan secara manual dan memakan berjam-jam:
 * satu kelas penuh salah tingkat masuk, NISN dipakai dua orang, 12 siswa tanpa angkatan, satu
 * kelas (XII DKV 1) kosong padahal ada 24 siswanya, 21 angkatan meleset, ibu lahir tahun 2023.
 *
 * Semua itu bisa dirumuskan sebagai aturan, dan PASTI terulang tiap ada angkatan/impor baru.
 * Halaman ini mengubah pencarian yang tadinya berjam-jam & kebetulan jadi sekali buka. */

export type Kategori = "kritis" | "penting" | "saran";

export interface Contoh {
  id: string | null;      // studentId — untuk tautan ke Buku Induk (null kalau bukan per-siswa)
  nis: string;
  nama: string;
  detail: string;
}

export interface Temuan {
  id: string;
  kategori: Kategori;
  judul: string;
  penjelasan: string;    // kenapa ini masalah & apa dampaknya
  saran: string;         // apa yang harus dilakukan
  jumlah: number;
  contoh: Contoh[];      // maksimal 50, sisanya cukup dihitung
}

/** Daftar contoh yang dikirim ke layar dipotong 50 — cukup untuk menilai polanya tanpa membuat
 * halaman berat. Unduhan Excel memakai batas tak terhingga supaya daftarnya benar-benar lengkap. */
const BATAS_CONTOH = 50;

function buatTemuan(
  batas: number,
  id: string, kategori: Kategori, judul: string, penjelasan: string, saran: string, items: Contoh[],
): Temuan | null {
  if (items.length === 0) return null;
  return { id, kategori, judul, penjelasan, saran, jumlah: items.length, contoh: items.slice(0, batas) };
}

export async function jalankanPemeriksaan(
  opts: { batasContoh?: number } = {},
): Promise<{ temuan: Temuan[]; ringkasan: Record<Kategori, number>; totalSiswa: number; diperiksaPada: string }> {
  const batasContoh = opts.batasContoh ?? BATAS_CONTOH;
  const buat = (
    id: string, kategori: Kategori, judul: string, penjelasan: string, saran: string, items: Contoh[],
  ) => buatTemuan(batasContoh, id, kategori, judul, penjelasan, saran, items);

  const [students, classes, tahunAktif] = await Promise.all([
    prisma.student.findMany({
      select: {
        id: true, nis: true, nisn: true, enrollYear: true, studentStatus: true, exitDate: true,
        gender: true, birthDate: true, birthPlace: true, address: true, parentName: true,
        previousSchool: true, bukuIndukData: true,
        user: { select: { name: true, email: true } },
        class: { select: { id: true, name: true, grade: true, majorId: true } },
        major: { select: { id: true, code: true, name: true } },
      },
    }),
    prisma.class.findMany({
      select: { id: true, name: true, grade: true, major: { select: { code: true } },
        _count: { select: { students: true } } },
    }),
    prisma.academicYear.findFirst({ where: { isActive: true }, select: { name: true } }),
  ]);

  const tahunMulai = tahunAktif ? parseInt(tahunAktif.name.split("/")[0], 10) : new Date().getFullYear();
  const b = (s: (typeof students)[number], k: string): string => {
    const d = s.bukuIndukData as Record<string, unknown> | null;
    const v = d?.[k];
    return typeof v === "string" ? v.trim() : "";
  };
  const ke = (s: (typeof students)[number], detail: string): Contoh =>
    ({ id: s.id, nis: s.nis, nama: s.user.name, detail });

  const temuan: (Temuan | null)[] = [];

  // ── 1. NISN dipakai lebih dari satu siswa ──────────────────────────────────
  const perNisn = new Map<string, typeof students>();
  for (const s of students) {
    const n = (s.nisn ?? "").trim();
    if (!n) continue;
    if (!perNisn.has(n)) perNisn.set(n, []);
    perNisn.get(n)!.push(s);
  }
  temuan.push(buat("nisn-ganda", "kritis", "NISN dipakai lebih dari satu siswa",
    "NISN adalah nomor induk nasional — satu siswa satu nomor, tidak boleh sama. Kalau ganda, data Dapodik & dokumen resmi bisa tertukar orangnya.",
    "Cek berkas asli, tentukan NISN yang benar milik siapa, lalu kosongkan/perbaiki yang salah lewat Buku Induk.",
    [...perNisn.values()].filter(g => g.length > 1).flatMap(g =>
      g.map(s => ke(s, `NISN ${s.nisn} dipakai bersama: ${g.filter(x => x.id !== s.id).map(x => x.user.name).join(", ")}`)))));

  // ── 2. Siswa tanpa angkatan ───────────────────────────────────────────────
  temuan.push(buat("tanpa-angkatan", "kritis", "Siswa tanpa tahun angkatan",
    "Tanpa angkatan, siswa tidak muncul di Buku Klapper, rekap per angkatan, maupun laporan tahun lampau — seolah tidak pernah ada.",
    "Isi Tahun Angkatan di Buku Induk. Kalau tidak ada catatannya, bisa diperkirakan dari nomor induk siswa bernomor terdekat.",
    students.filter(s => s.enrollYear == null).map(s => ke(s, "Tahun Angkatan kosong"))));

  // ── 3. Tingkat kelas tidak cocok dengan angkatan (siswa aktif) ────────────
  temuan.push(buat("kelas-vs-angkatan", "kritis", "Tingkat kelas tidak cocok dengan angkatan",
    `Pada tahun ajaran ${tahunAktif?.name ?? "berjalan"}, angkatan ${tahunMulai} seharusnya kelas X, ${tahunMulai - 1} kelas XI, ${tahunMulai - 2} kelas XII. Kalau tidak cocok, jumlah siswa per tingkat di semua rekap jadi salah.`,
    "Periksa mana yang keliru: angkatannya, atau penempatan kelasnya. Siswa pindahan yang masuk di tengah jalan tetap mengikuti angkatan teman selulusnya.",
    students.filter(s => s.studentStatus === "AKTIF" && s.enrollYear != null && s.class
      && s.class.grade !== 10 + (tahunMulai - s.enrollYear))
      .map(s => {
        // Pindahan yang diterima Januari–Juni masuk tahun ajaran yang DIMULAI tahun sebelumnya — angkatan yang ditulis sama dengan
        // tahun kalender tanggal diterima adalah penyebab paling sering (temuan 17 Sep 2026: diterima 13 Jan 2025 → angkatan 2025).
        const diterima = b(s, "diterimaDate");
        const m = /^(\d{4})-(\d{2})/.exec(diterima);
        const petunjuk = m && b(s, "pindahanDari") && Number(m[2]) <= 6 && Number(m[1]) === s.enrollYear
          ? ` — pindahan diterima ${diterima} (tahun ajaran ${s.enrollYear! - 1}/${s.enrollYear}), kemungkinan angkatannya ${s.enrollYear! - 1}`
          : "";
        return ke(s, `angkatan ${s.enrollYear} tapi ada di ${s.class!.name} (seharusnya tingkat ${10 + (tahunMulai - s.enrollYear!)})${petunjuk}`);
      })));

  // ── 4. Tahun lulus tidak cocok dengan angkatan ────────────────────────────
  temuan.push(buat("lulus-vs-angkatan", "penting", "Tahun lulus tidak cocok dengan angkatan",
    "Normalnya lulus = angkatan + 3 tahun. Selisih lain berarti siswa pernah tinggal kelas, ATAU angkatannya salah tulis.",
    "Kalau memang pernah tinggal kelas, biarkan & catat di Keterangan. Kalau tidak, perbaiki angkatannya.",
    students.filter(s => {
      if (s.studentStatus !== "LULUS" || s.enrollYear == null) return false;
      const th = parseInt(b(s, "graduationDate").slice(0, 4), 10);
      return !isNaN(th) && th !== s.enrollYear + 3;
    }).map(s => ke(s, `angkatan ${s.enrollYear}, lulus ${b(s, "graduationDate").slice(0, 4)} (selisih ${parseInt(b(s, "graduationDate").slice(0, 4), 10) - s.enrollYear!} tahun)`))));

  // ── 5. Siswa aktif di kelas jurusan lain ──────────────────────────────────
  temuan.push(buat("kelas-beda-jurusan", "kritis", "Siswa ditempatkan di kelas jurusan lain",
    "Jurusan siswa berbeda dengan jurusan kelasnya — rekap per jurusan dan Nominatif UKK jadi salah hitung.",
    "Pindahkan siswa ke kelas jurusan yang benar, atau perbaiki jurusannya di Buku Induk.",
    students.filter(s => s.studentStatus === "AKTIF" && s.class && s.class.majorId !== s.major.id)
      .map(s => ke(s, `jurusan ${s.major.code} tapi kelasnya ${s.class!.name}`))));

  // ── 6. Kelas tanpa siswa ──────────────────────────────────────────────────
  temuan.push(buat("kelas-kosong", "penting", "Kelas tidak ada siswanya",
    "Kelas terdaftar tapi kosong. Bisa berarti kelasnya memang sudah tidak dipakai, ATAU satu rombel siswa belum diinput sama sekali — persis yang terjadi pada XII DKV 1 (24 siswa hilang, ketahuan 12 September 2026).",
    "Kalau kelasnya sudah tidak dipakai, hapus. Kalau seharusnya ada isinya, input siswanya.",
    classes.filter(c => c._count.students === 0)
      .map(c => ({ id: null, nis: "—", nama: c.name, detail: `kelas ${c.name} (${c.major.code}) tidak punya satu pun siswa` }))));

  // ── 7. Siswa keluar/lulus tanpa tanggal ───────────────────────────────────
  temuan.push(buat("keluar-tanpa-tanggal", "penting", "Siswa keluar/lulus tanpa tanggal",
    "Tanpa tanggal, siswa tidak akan muncul di Buku Mutasi (yang disusun per bulan), dan tingkat terakhirnya di Buku Klapper hanya bisa dikira-kira.",
    "Isi Tanggal Pindah/Keluar (atau Tanggal Lulus) di Buku Induk.",
    students.filter(s => s.studentStatus !== "AKTIF" && !resolveExitDate(s))
      .map(s => ke(s, `status ${s.studentStatus}, tanggal keluar kosong`))));

  // ── 8. Kelengkapan data Kelas XII untuk Nominatif ─────────────────────────
  const wajibXII: Contoh[] = [];
  for (const s of students) {
    if (s.studentStatus !== "AKTIF" || s.class?.grade !== 12) continue;
    const kurang: string[] = [];
    if (!s.birthPlace || !s.birthDate) kurang.push("tempat/tgl lahir");
    if (!s.address) kurang.push("alamat");
    if (!s.parentName) kurang.push("nama orang tua");
    if (!s.previousSchool) kurang.push("asal sekolah");
    if (!b(s, "ijazahNo")) kurang.push("no ijazah SMP");
    if (!s.nisn) kurang.push("NISN");
    if (kurang.length) wajibXII.push(ke(s, `${s.class.name} — belum ada: ${kurang.join(", ")}`));
  }
  temuan.push(buat("nominatif-belum-lengkap", "kritis", "Data Kelas XII belum lengkap untuk Nominatif",
    "Kolom-kolom ini wajib ada di dokumen Nominatif UKK/USP yang dikirim ke Dinas. Kalau kosong, dokumen bisa dikembalikan.",
    "Lengkapi lewat Buku Induk sebelum mencetak Nominatif. Bisa juga dilihat per jurusan di halaman Nominatif Kelas XII.",
    wajibXII));

  // ── 9. Tanggal lahir orang tua/wali tidak masuk akal ──────────────────────
  const ortuAneh: Contoh[] = [];
  for (const s of students) {
    const thSiswa = s.birthDate ? new Date(s.birthDate).getFullYear() : null;
    for (const [k, label] of [["fatherBirthDate", "ayah"], ["motherBirthDate", "ibu"], ["guardianBirthDate", "wali"]] as const) {
      const v = b(s, k);
      const th = parseInt(v.slice(0, 4), 10);
      if (isNaN(th)) continue;
      if (th > new Date().getFullYear() || (thSiswa && th >= thSiswa)) {
        ortuAneh.push(ke(s, `tanggal lahir ${label}: ${v}${thSiswa ? ` (siswa lahir ${thSiswa})` : ""}`));
      }
    }
  }
  temuan.push(buat("ortu-lahir-janggal", "penting", "Tanggal lahir orang tua tidak masuk akal",
    "Tanggal lahir orang tua/wali sama atau lebih muda dari anaknya — biasanya sisa isian contoh yang tidak sempat diganti.",
    "Perbaiki atau kosongkan lewat Buku Induk bagian Data Orang Tua.",
    ortuAneh));

  // ── 10. NIS di luar pola ──────────────────────────────────────────────────
  temuan.push(buat("nis-pola-aneh", "penting", "Nomor induk di luar pola sekolah",
    "Pola NIS sekolah ini: nomor-urut/urut-jurusan.kode (mis. 1153/105.4.2.1). Yang di luar pola biasanya masih memakai nomor sementara pendaftaran.",
    "Terbitkan NIS resmi lewat Buku Induk (tombol nomor berikutnya otomatis mengikuti urutan).",
    students.filter(s => !/^\d+\/\d+\.[\d.]+$/.test(s.nis)).map(s => ke(s, `NIS "${s.nis}" tidak mengikuti pola`))));

  // ── 11. Email login tidak sesuai NIS ──────────────────────────────────────
  temuan.push(buat("email-tidak-sinkron", "saran", "Email login tidak sesuai nomor induk",
    "Email login dibentuk dari angka NIS. Kalau NIS pernah diubah tanpa memperbarui email, siswa bisa bingung saat login.",
    "Perbarui emailnya agar sesuai NIS, lalu beri tahu siswa yang bersangkutan.",
    students.filter(s => {
      const harusnya = s.nis.replace(/[^0-9]/g, "") + "@smkalmunawwir.sch.id";
      return s.user.email !== harusnya && s.user.email.endsWith("@smkalmunawwir.sch.id");
    }).map(s => ke(s, `email ${s.user.email}, seharusnya ${s.nis.replace(/[^0-9]/g, "")}@smkalmunawwir.sch.id`))));

  // ── 12. Siswa aktif belum berfoto ─────────────────────────────────────────
  temuan.push(buat("tanpa-foto", "saran", "Siswa aktif belum punya foto",
    "Foto dipakai di Buku Induk cetak dan Kartu Tanda Siswa. Tanpa foto, kartunya kosong.",
    "Unggah lewat Buku Induk (bagian Foto), atau impor massal dari berkas Excel sekolah yang sudah memuat foto.",
    students.filter(s => s.studentStatus === "AKTIF" && !b(s, "fotoMasukUrl"))
      .map(s => ke(s, `${s.class?.name ?? "tanpa kelas"} — belum ada foto`))));

  // ── 13. Siswa aktif tanpa kelas ───────────────────────────────────────────
  temuan.push(buat("aktif-tanpa-kelas", "kritis", "Siswa aktif belum ditempatkan di kelas",
    "Siswa berstatus aktif tapi tidak masuk rombel mana pun — tidak akan muncul di absensi, nilai, maupun rekap per kelas.",
    "Tempatkan ke kelas lewat Buku Induk atau menu Kelas.",
    students.filter(s => s.studentStatus === "AKTIF" && !s.class).map(s => ke(s, "belum punya kelas"))));

  const hasil = temuan.filter((t): t is Temuan => t !== null)
    .sort((a, b2) => {
      const urut: Record<Kategori, number> = { kritis: 0, penting: 1, saran: 2 };
      return urut[a.kategori] - urut[b2.kategori] || b2.jumlah - a.jumlah;
    });

  const ringkasan: Record<Kategori, number> = { kritis: 0, penting: 0, saran: 0 };
  for (const t of hasil) ringkasan[t.kategori] += t.jumlah;

  return { temuan: hasil, ringkasan, totalSiswa: students.length, diperiksaPada: new Date().toISOString() };
}
