import "server-only";
import { randomInt } from "crypto";
import { prisma } from "@/lib/prisma";

/** KODE REFERRAL SPMB (2 Oktober 2026). Calon murid boleh menyebut siapa yang mengajaknya; panitia
 *  bisa melihat pendaftar datang dari perujuk mana.
 *
 *  Cara kerjanya:
 *  1. Tiap perujuk punya satu baris `PerujukSpmb` dengan `kode` UNIK — siswa diisi dari NIS,
 *     pegawai dari NIP/nomor induk yayasan, dan perujuk luar diberi kode sendiri.
 *  2. Perujuk membagikan tautan `…/admissions?ref=KODE` (atau QR-nya). Halaman menyimpan kode itu
 *     dan mengisikannya sendiri ke formulir — jadi calon tidak perlu mengetik apa pun.
 *  3. Saat formulir dikirim, server MENCOCOKKAN ULANG kodenya. Kode yang diketik disimpan apa
 *     adanya di `Admission.perujukKode`, dan `perujukId` hanya terisi bila kodenya benar-benar ada
 *     dan masih aktif. Dua kolom, bukan satu, supaya jejaknya tetap terbaca kalau baris perujuknya
 *     kelak dihapus.
 */

export const JENIS_PERUJUK = ["SISWA", "PEGAWAI", "ALUMNI", "LUAR"] as const;
export const LABEL_JENIS: Record<string, string> = {
  SISWA: "Siswa", PEGAWAI: "Guru / Pegawai", ALUMNI: "Alumni", LUAR: "Perujuk Luar",
};

/** Kode diseragamkan: huruf besar, spasi dibuang. Tanda baca DIBIARKAN karena NIS sekolah ini
 *  memang memakai garis miring & titik (`001/001.064`) — membuangnya akan merusak kodenya. */
export function rapikanKode(mentah: string): string {
  return (mentah ?? "").trim().replace(/\s+/g, "").toUpperCase().slice(0, 40);
}

/** Nama perujuk yang boleh dilihat PUBLIK — disamarkan.
 *
 *  Ini bukan kehati-hatian berlebihan: NIS di sekolah ini berpola `001/001.064` dan NIP `TMP-004`,
 *  keduanya mudah ditebak, dan ada 1.180 siswa. Tanpa penyamaran, siapa pun bisa menelusuri kode
 *  satu per satu dan memanen seluruh nama siswa dari halaman pendaftaran yang terbuka untuk umum.
 *  Yang perlu diketahui calon hanyalah "kodenya benar dan memang milik orang yang mengajak saya". */
export function samarkanNama(nama: string): string {
  return nama.trim().split(/\s+/)
    .map((p, i) => (i === 0 ? p : p.slice(0, 1) + "." ))
    .join(" ");
}

/** Pencarian kode untuk halaman publik. Mengembalikan null bila tidak ada atau tidak aktif —
 *  jawaban yang SAMA untuk keduanya, supaya tidak bisa dipakai membedakan "kode ada tapi mati". */
export async function cariPerujukPublik(kode: string) {
  const k = rapikanKode(kode);
  if (k.length < 3) return null;
  const r = await prisma.perujukSpmb.findFirst({
    where: { kode: k, aktif: true },
    select: { kode: true, nama: true, jenis: true },
  }).catch(() => null);
  if (!r) return null;
  return { kode: r.kode, nama: samarkanNama(r.nama), jenis: r.jenis, label: LABEL_JENIS[r.jenis] ?? r.jenis };
}

/** Dipakai SAAT MENYIMPAN pendaftaran. Tidak pernah menolak pendaftaran — kode yang salah hanya
 *  membuat `perujukId` kosong, sebab kesalahan ketik kode tidak boleh menggagalkan pendaftaran
 *  anak orang. */
export async function cocokkanPerujuk(kode?: string | null) {
  const k = rapikanKode(kode ?? "");
  if (!k) return { perujukKode: null, perujukId: null };
  const r = await prisma.perujukSpmb.findFirst({ where: { kode: k, aktif: true }, select: { id: true } }).catch(() => null);
  return { perujukKode: k, perujukId: r?.id ?? null };
}

/** Kode referral dari NIS / NIP: ANGKANYA SAJA, tanda baca dibuang (permintaan user 2 Oktober
 *  2026 — `924/001.10.2.1` → `9240011021`). Mudah didiktekan dan diketik di HP.
 *
 *  Diperiksa ke data nyata sebelum dipakai: 1.180 NIS menghasilkan 1.180 kode unik, NOL tabrakan,
 *  panjang 9–11 digit. Dan karena pemindai kartu gerbang mencocokkan NIS PERSIS (`where: { nis }`,
 *  tanpa membuang tanda baca), kode angka ini TIDAK bisa dipakai sebagai kartu absensi — jadi
 *  menyebarkannya tidak membocorkan nomor kartu siapa pun.
 *
 *  NIP di sekolah ini berbentuk `TMP-004`, yang bila diambil angkanya saja menjadi `004` — tiga
 *  digit, terlalu pendek dan mudah ditebak. Karena itu bila angkanya kurang dari 6 digit, yang
 *  dipakai adalah bentuk huruf+angkanya (`TMP004`), bukan angka pendek. */
export function kodeDariNomor(nomor: string): string {
  const angka = (nomor ?? "").replace(/\D/g, "");
  if (angka.length >= 6) return angka;
  return (nomor ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Kode ANGKA untuk perujuk yang ditambahkan manual (permintaan user 2 Oktober 2026: "kode
 *  referral angka saja seperti NIS untuk orang yang ditambahkan"). Enam digit, mudah didiktekan
 *  lewat telepon dan mudah diketik di HP.
 *
 *  Angkanya DIACAK, bukan berurutan. Kode berurutan membuat siapa pun bisa menebak kode perujuk
 *  lain hanya dengan menambah satu — dan setiap kode yang tertebak adalah satu nama yang bocor
 *  dari halaman pendaftaran. Diacak, 6 digit memberi 900.000 kemungkinan.
 *
 *  Tidak akan bertabrakan dengan kode siswa/pegawai: kode siswa memakai format NIS sekolah ini
 *  (`001/001.064`) dan kode pegawai `TMP-004` — keduanya memuat tanda baca/huruf. */
export async function kodeAngkaBaru(): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const kode = String(randomInt(100000, 1000000));
    const ada = await prisma.perujukSpmb.findUnique({ where: { kode }, select: { id: true } }).catch(() => null);
    if (!ada) return kode;
  }
  // Sangat tidak mungkin tercapai; bila ya, lebarkan jadi 8 digit daripada menyerah.
  return String(randomInt(10000000, 100000000));
}

/* ------------------------------------------------------------------ pembatas laju pencarian */

/** Pembatas di memori, satu proses Node — sama dengan pola pembatas tebakan token CBT
 *  (CLAUDE.md #72b). Tujuannya bukan menghalangi pemakaian wajar (satu calon memeriksa satu
 *  kode), melainkan membuat penelusuran 1.180 kode tidak mungkin dilakukan diam-diam. */
const jejak = new Map<string, { n: number; sejak: number }>();
const JENDELA = 10 * 60_000;
const BATAS = 20;

export function bolehCariKode(penanda: string): boolean {
  const kini = Date.now();
  const j = jejak.get(penanda);
  if (!j || kini - j.sejak > JENDELA) { jejak.set(penanda, { n: 1, sejak: kini }); return true; }
  j.n++;
  if (jejak.size > 5000) for (const [k, v] of jejak) if (kini - v.sejak > JENDELA) jejak.delete(k);
  return j.n <= BATAS;
}

/** Kode referral milik satu akun, DIBUAT SENDIRI bila belum ada (8 Oktober 2026). Laporan user: "beberapa kartu identitas
 *  tidak muncul referral" — kode massal hanya mencakup yang ada saat tombolnya ditekan, jadi staf TAS (tanpa baris Teacher)
 *  dan siswa/guru yang masuk belakangan tidak pernah punya kartu. Aturannya:
 *  - hanya GURU, STAF (TAS), dan SISWA AKTIF — orang tua & admin tidak dibuatkan;
 *  - baris yang sudah ada tetapi DINONAKTIFKAN panitia tidak dihidupkan/dibuat ulang (mengembalikan null);
 *  - bentuk kode sama dengan kode massal bawaan: nomor induk + 4 karakter acak; tanpa nomor induk = 6 angka acak. */
const HURUF_KODE = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export async function pastikanPerujukAkun(session: { userId: string; role: string; name: string }) {
  const pilih = { kode: true, nama: true, jenis: true, aktif: true, _count: { select: { pendaftar: true } } } as const;
  const siswa = session.role === "STUDENT"
    ? await prisma.student.findFirst({ where: { userId: session.userId }, select: { id: true, nis: true, studentStatus: true } })
    : null;
  const ada = await prisma.perujukSpmb.findFirst({
    where: { OR: [{ userId: session.userId }, ...(siswa ? [{ studentId: siswa.id }] : [])] }, select: pilih,
  });
  if (ada) return ada.aktif ? ada : null;

  let nomor = "";
  if (session.role === "STUDENT") {
    if (!siswa || siswa.studentStatus !== "AKTIF") return null;
    nomor = siswa.nis ?? "";
  } else if (session.role === "TEACHER") {
    nomor = (await prisma.teacher.findFirst({ where: { userId: session.userId }, select: { nip: true } }))?.nip ?? "";
  } else if (session.role !== "TAS") return null;

  const akhiran = () => Array.from({ length: 4 }, () => HURUF_KODE[randomInt(HURUF_KODE.length)]).join("");
  for (let i = 0; i < 8; i++) {
    const kode = nomor.trim() ? rapikanKode(`${nomor.trim()}-${akhiran()}`) : await kodeAngkaBaru();
    try {
      return await prisma.perujukSpmb.create({
        data: { kode, nama: session.name, jenis: siswa ? "SISWA" : "PEGAWAI", ...(siswa ? { studentId: siswa.id } : { userId: session.userId }) },
        select: pilih,
      });
    } catch { /* kode kebetulan sudah dipakai → coba lagi */ }
  }
  return null;
}

/** Kode referral ALUMNI (8 Oktober 2026) — dibuat saat alumni mengisi Tracer Study (`/tracer-study`), jadi satu formulir
 *  menghasilkan dua hal: kabar lulusan untuk sekolah, dan tautan ajakan mendaftar untuk alumninya.
 *  - Kode 6 ANGKA ACAK, bukan turunan NIS/NISN: NISN adalah kunci masuk formulir tracer, tidak boleh ikut tersebar.
 *  - Alumni yang semasa siswa sudah punya kode tetap memakai kode itu (jenisnya saja yang menjadi ALUMNI), supaya
 *    tautan yang pernah ia bagikan tidak mati.
 *  - Baris yang DINONAKTIFKAN panitia tidak dihidupkan lagi (mengembalikan null), sama dengan `pastikanPerujukAkun`. */
export async function pastikanPerujukAlumni(studentId: string, nama: string, kontak?: string | null) {
  const ada = await prisma.perujukSpmb.findFirst({ where: { studentId }, select: { id: true, kode: true, aktif: true, jenis: true } });
  if (ada) {
    if (!ada.aktif) return null;
    if (ada.jenis !== "ALUMNI") await prisma.perujukSpmb.update({ where: { id: ada.id }, data: { jenis: "ALUMNI" } }).catch(() => {});
    return { kode: ada.kode };
  }
  for (let i = 0; i < 5; i++) {
    try {
      return await prisma.perujukSpmb.create({
        data: { kode: await kodeAngkaBaru(), nama, jenis: "ALUMNI", studentId, kontak: kontak || null, keterangan: "Dari Tracer Study" },
        select: { kode: true },
      });
    } catch { /* kode kebetulan terpakai → coba lagi */ }
  }
  return null;
}
