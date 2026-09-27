import "server-only";
import { butirBerparameter, isiButirParameter } from "@/lib/soal-parameter";
import { variabelSiswaUjian } from "@/lib/soal-parameter-server";
import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { nilaiButir, butuhKoreksi, ikutDinilai, durasiLisan, type Opsi, type Kunci, type Jawaban } from "@/lib/soal";
import { acakUntukSiswa, paketDariKursi, HURUF_PAKET, type HasilAcak } from "@/lib/ujian-acak";
import { getSettings } from "@/lib/site-settings";
import { bolehAturUjian } from "@/lib/kegiatan-ujian-server";

/** Pekerjaan sisi server untuk Ujian Online yang dipakai lebih dari satu route: cakupan akses,
 * tenggat, pengacakan-sekali-simpan, penyusunan tampilan soal untuk siswa (tanpa kunci), dan
 * penilaian. Dikumpulkan di sini supaya route-route tetap tipis dan aturannya cuma ada satu. */

/* ------------------------------ cakupan akses ------------------------------ */

export async function teacherIdDariSesi(session: { role: string; email: string }): Promise<string | null> {
  if (session.role !== "TEACHER") return null;
  const t = await prisma.teacher.findFirst({ where: { user: { email: session.email } }, select: { id: true } });
  return t?.id ?? null;
}

/** Filter pemilik untuk DAFTAR ujian. null = semua ujian (ADMIN, TAS, Wakil Kepala Kurikulum);
 * selain itu id guru. Guru tanpa data Teacher mendapat id yang tidak cocok dengan ujian mana pun. */
export async function cakupanUjian(session: { role: string; email: string }): Promise<string | null> {
  if (session.role !== "TEACHER") return null;
  if (await bolehAturUjian(session)) return null;
  return (await teacherIdDariSesi(session)) ?? "__tanpa-data-guru__";
}

/** Ujian yang boleh disentuh pemanggil.
 *   - ADMIN/TAS & Wakil Kepala Kurikulum: semua ujian.
 *   - Guru PEMBUAT: ujiannya sendiri, termasuk mengubah soal/pengaturan & menghapus.
 *   - Guru PENGAMPU: mengajar mapel yang sama di salah satu kelas peserta — boleh memantau,
 *     mengoreksi, mengelola peserta & melihat hasil, TETAPI tidak boleh mengubah (`ubah: true`).
 *     Contoh: ujian Matematika XI buatan satu guru yang juga diikuti kelas guru Matematika lain. */
export async function ujianDalamCakupan(session: { role: string; email: string }, id: string, opsi: { ubah?: boolean } = {}) {
  if (session.role === "ADMIN" || session.role === "TAS") return prisma.exam.findUnique({ where: { id } });
  if (await bolehAturUjian(session)) return prisma.exam.findUnique({ where: { id } });
  const teacherId = await teacherIdDariSesi(session);
  if (!teacherId) return null;
  const exam = await prisma.exam.findUnique({ where: { id } });
  if (!exam) return null;
  if (exam.teacherId === teacherId) return exam;
  if (opsi.ubah) return null;
  const ampu = await prisma.teachingAssignment.count({
    where: { teacherId, classId: { in: kelasPeserta(exam) }, subject: { name: exam.subject } },
  });
  return ampu > 0 ? exam : null;
}

/* ------------------------------ kelas peserta ------------------------------ */

/** Semua kelas peserta sebuah ujian. Ujian dari sebelum fitur banyak-kelas hanya punya `classId`. */
export function kelasPeserta(e: { classId: string; kelasIds?: string[] | null }): string[] {
  return e.kelasIds && e.kelasIds.length ? e.kelasIds : [e.classId];
}

/** Filter Prisma: ujian yang diikuti sebuah kelas. */
export function ujianUntukKelas(classId: string): Prisma.ExamWhereInput {
  return { OR: [{ kelasIds: { has: classId } }, { classId }] };
}

/** Filter Prisma: ujian yang BOLEH diikuti seorang siswa — kelasnya peserta DAN (ujian tanpa daftar peserta khusus ATAU siswa
 * ada di daftar itu). Ujian susulan/remedial memakai `pesertaIds` (17 Sep 2026). Pakai ini di SEMUA jalur siswa. */
export function ujianUntukSiswa(classId: string, studentId: string): Prisma.ExamWhereInput {
  return { AND: [ujianUntukKelas(classId), { OR: [{ pesertaIds: { isEmpty: true } }, { pesertaIds: { has: studentId } }] }] };
}

/** Pemeriksaan di memori untuk ujian yang sudah dimuat. */
export function pesertaBoleh(e: { classId: string; kelasIds?: string[] | null; pesertaIds?: string[] | null }, s: { id: string; classId: string | null }) {
  if (!s.classId || !kelasPeserta(e).includes(s.classId)) return false;
  return !e.pesertaIds?.length || e.pesertaIds.includes(s.id);
}

/** Filter siswa peserta sebuah ujian (roster papan pantau, notifikasi, rekap). */
export function filterSiswaPeserta(e: { classId: string; kelasIds?: string[] | null; pesertaIds?: string[] | null }): Prisma.StudentWhereInput {
  return { classId: { in: kelasPeserta(e) }, studentStatus: "AKTIF", ...(e.pesertaIds?.length ? { id: { in: e.pesertaIds } } : {}) };
}

/** Kelas peserta dari body permintaan: `kelasIds` (banyak) atau `classId` lama (satu). */
export function bacaKelasIds(body: { kelasIds?: unknown; classId?: unknown }): string[] {
  const daftar: unknown[] = Array.isArray(body.kelasIds) ? body.kelasIds : body.classId ? [body.classId] : [];
  return [...new Set(daftar.map(v => String(v ?? "")).filter(Boolean))];
}

/** Filter DAFTAR ujian guru: miliknya + ujian mapel yang ia ampu di salah satu kelas pesertanya.
 * null = semua ujian (ADMIN, TAS, Wakil Kepala Kurikulum). */
export async function filterDaftarUjian(session: { role: string; email: string }): Promise<Prisma.ExamWhereInput | null> {
  const teacherId = await cakupanUjian(session);
  if (!teacherId) return null;
  const tugas = await prisma.teachingAssignment.findMany({
    where: { teacherId }, select: { classId: true, subject: { select: { name: true } } },
  });
  return { OR: [{ teacherId }, ...tugas.map(t => ({ subject: t.subject.name, kelasIds: { has: t.classId } }))] };
}

/** Periksa kelas peserta untuk sebuah mapel dan tentukan guru PEMBUAT (pemilik) ujian.
 * Guru biasa hanya boleh memilih kelas yang ia ampu mapelnya; Admin/TAS/Kurikulum bebas, dan
 * pemiliknya jatuh ke guru pengampu kelas pertama. */
export async function periksaKelasPeserta(
  session: { role: string; email: string }, subject: string, kelasIds: string[],
): Promise<{ error: string } | { pemilik: string; namaKelas: string[] }> {
  if (!kelasIds.length) return { error: "Pilih minimal satu kelas peserta." };
  const kelas = await prisma.class.findMany({ where: { id: { in: kelasIds } }, select: { id: true, name: true } });
  if (kelas.length !== kelasIds.length) return { error: "Ada kelas peserta yang tidak ditemukan." };
  const nama = new Map(kelas.map(k => [k.id, k.name]));
  const tugas = await prisma.teachingAssignment.findMany({
    where: { classId: { in: kelasIds }, subject: { name: subject } }, select: { classId: true, teacherId: true },
  });
  const guruSesi = await teacherIdDariSesi(session);
  const bebas = session.role !== "TEACHER" || (await bolehAturUjian(session));
  if (!bebas) {
    const diampu = new Set(tugas.filter(t => t.teacherId === guruSesi).map(t => t.classId));
    const tidak = kelasIds.filter(k => !diampu.has(k)).map(k => nama.get(k));
    if (tidak.length) {
      return { error: `Anda tidak mengajar ${subject} di kelas ${tidak.join(", ")}. Pilih kelas Anda saja, atau minta Admin/Kurikulum membuat ujian bersama.` };
    }
  }
  const pemilik = guruSesi && tugas.some(t => t.teacherId === guruSesi)
    ? guruSesi
    : tugas.find(t => t.classId === kelasIds[0])?.teacherId ?? tugas[0]?.teacherId ?? null;
  if (!pemilik) return { error: `Belum ada guru ${subject} di Penugasan Mengajar untuk kelas yang dipilih.` };
  return { pemilik, namaKelas: kelasIds.map(k => nama.get(k) ?? "?") };
}

/** Nama kelas untuk banyak ujian sekaligus (satu query). */
export async function petaNamaKelas(exams: { classId: string; kelasIds?: string[] | null }[]) {
  const ids = [...new Set(exams.flatMap(e => kelasPeserta(e)))];
  const rows = ids.length ? await prisma.class.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
  const m = new Map(rows.map(r => [r.id, r.name]));
  const daftar = (e: { classId: string; kelasIds?: string[] | null }) =>
    kelasPeserta(e).map(k => m.get(k) ?? "?").sort((x, y) => x.localeCompare(y, "id", { numeric: true }));
  return { daftar, label: (e: { classId: string; kelasIds?: string[] | null }) => daftar(e).join(", ") };
}

/** Jumlah siswa AKTIF per kelas. */
export async function jumlahSiswaAktif(classIds: string[]): Promise<Map<string, number>> {
  if (!classIds.length) return new Map();
  const g = await prisma.student.groupBy({
    by: ["classId"], where: { classId: { in: classIds }, studentStatus: "AKTIF" }, _count: { _all: true },
  });
  return new Map(g.map(x => [x.classId ?? "", x._count._all]));
}

export async function siswaDariSesi(session: { email: string }) {
  return prisma.student.findFirst({
    where: { user: { email: session.email } },
    select: { id: true, classId: true, nis: true, user: { select: { name: true } } },
  });
}

/* ------------------------------ tenggat ------------------------------ */

/** Tenggat SATU siswa = mulai + durasi, tapi tidak pernah melewati jam tutup ujian. Dihitung di
 * server dari `startedAt` — jam di komputer siswa tidak dipercaya.
 *
 * `tambahanMenit` = tambahan waktu khusus siswa ini dari pengawas; ikut menggeser batas jam tutup
 * untuk siswa itu saja (siswa lain tidak ikut mendapat waktu lebih). */
export function tenggat(startedAt: Date, durationMenit: number, endTime: Date, tambahanMenit = 0): Date {
  const t = Math.max(0, tambahanMenit) * 60_000;
  return new Date(Math.min(startedAt.getTime() + durationMenit * 60_000 + t, endTime.getTime() + t));
}

/** Tambahan menit (total) yang dibutuhkan supaya sisa waktu siswa minimal `targetMenit` dari
 * sekarang. Tidak pernah MENGURANGI tambahan yang sudah diberikan. Dipakai Tambah Waktu,
 * Reset Waktu, dan Buka Kembali. */
export function tambahanUntukSisa(
  a: { startedAt: Date; tambahanMenit: number },
  exam: { duration: number; endTime: Date },
  targetMenit: number,
  sekarang = Date.now(),
): number {
  const target = sekarang + Math.max(0, targetMenit) * 60_000;
  const perlu = Math.max(
    0,
    Math.ceil((target - (a.startedAt.getTime() + exam.duration * 60_000)) / 60_000),
    Math.ceil((target - exam.endTime.getTime()) / 60_000),
  );
  return Math.max(a.tambahanMenit, perlu);
}

/** Tanpa denyut selama ini = dianggap terputus. Halaman ujian berdenyut tiap 20 detik. */
export const JEDA_TERPUTUS_MS = 60_000;

/* ------------------------------ jejak aktivitas (audit trail) ------------------------------ */

export interface Jejak { jenis: string; waktu: string; ket?: string; oleh?: string }

/** Tambahkan catatan ke jejak attempt; hanya 500 catatan terakhir yang disimpan. */
export function tambahJejak(lama: unknown, ...baru: Omit<Jejak, "waktu">[]): Jejak[] {
  const daftar = Array.isArray(lama) ? [...(lama as Jejak[])] : [];
  const waktu = new Date().toISOString();
  for (const b of baru) daftar.push({ ...b, waktu });
  return daftar.slice(-500);
}

/* ------------------------------ kunci perangkat ------------------------------ */

/** Nama header yang membawa ID perangkat dari browser siswa. */
export const HEADER_PERANGKAT = "x-perangkat-ujian";

/** "KLAIM" = attempt belum dipegang perangkat mana pun (perangkat ini mengambilnya);
 * "BOLEH" = perangkat yang sama; "TOLAK" = perangkat lain — perlu Reset Login dari pengawas. */
export function cekPerangkat(a: { perangkatId: string | null }, perangkat: string | null): "KLAIM" | "BOLEH" | "TOLAK" {
  const p = (perangkat ?? "").trim().slice(0, 64);
  if (!a.perangkatId) return p ? "KLAIM" : "BOLEH";
  if (!p) return "TOLAK";
  return a.perangkatId === p ? "BOLEH" : "TOLAK";
}

/* ------------------------------ token ------------------------------ */

const HURUF_TOKEN = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // tanpa 0/O & 1/I yang mudah keliru dibaca

export async function buatTokenUnik(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    let t = "";
    // randomInt (bukan Math.random) — token tidak boleh bisa diperkirakan dari token sebelumnya (audit 24 Sep 2026).
    for (let k = 0; k < 6; k++) t += HURUF_TOKEN[randomInt(HURUF_TOKEN.length)];
    // Token kegiatan & token ujian berada di RUANG YANG SAMA — siswa cuma mengetik satu kotak,
    // jadi satu token tidak boleh menunjuk dua hal berbeda.
    const [bentrokUjian, bentrokKegiatan] = await Promise.all([
      prisma.exam.findFirst({ where: { OR: [{ token: t }, { tokenLama: t }] }, select: { id: true } }),
      prisma.kegiatanUjian.findFirst({ where: { OR: [{ token: t }, { tokenLama: t }] }, select: { id: true } }),
    ]);
    if (!bentrokUjian && !bentrokKegiatan) return t;
  }
  throw new Error("Gagal membuat token unik");
}

/** Token lama masih diterima selama ini setelah token berganti. */
export const TENGGANG_TOKEN_MS = 2 * 60_000;

/** Putar token kalau ujian memakai token berjangka dan masanya sudah habis. Dipanggil dari
 * layar pengawas (Ruang Kendali, papan pantau) yang memang dibuka terus selama ujian — tidak
 * dari halaman siswa, supaya token tidak berganti tepat saat siswa sedang memasukkannya. */
export async function putarTokenBilaPerlu(e: { id: string; token: string; tokenOtomatisMenit: number; tokenDiperbarui: Date }) {
  if (e.tokenOtomatisMenit <= 0) return { token: e.token, tokenDiperbarui: e.tokenDiperbarui };
  if (Date.now() - e.tokenDiperbarui.getTime() < e.tokenOtomatisMenit * 60_000) return { token: e.token, tokenDiperbarui: e.tokenDiperbarui };
  const token = await buatTokenUnik();
  const tokenDiperbarui = new Date();
  // ATOMIK (21 Sep 2026): hanya berhasil bila token di basis data masih yang tadi dibaca. Dua layar petugas
  // yang memutar bersamaan dulu sama-sama menulis — tiap layar menampilkan token berbeda dan token yang
  // kalah hilang tanpa masa tenggang. Yang kalah kini membaca ulang token pemenang.
  const n = await prisma.exam.updateMany({ where: { id: e.id, token: e.token }, data: { tokenLama: e.token, token, tokenDiperbarui } });
  if (n.count === 0) {
    const kini = await prisma.exam.findUnique({ where: { id: e.id }, select: { token: true, tokenDiperbarui: true } });
    return kini ?? { token: e.token, tokenDiperbarui: e.tokenDiperbarui };
  }
  return { token, tokenDiperbarui };
}

/** Putar TOKEN KEGIATAN kalau berjangka dan masanya habis — kembaran `putarTokenBilaPerlu` untuk
 * token bersama satu kegiatan (20 September 2026). Sama seperti versi ujian, hanya dipanggil dari
 * layar pengawas supaya token tidak berganti tepat saat siswa sedang mengetiknya. */
export async function putarTokenKegiatanBilaPerlu(k: { id: string; token: string | null; tokenOtomatisMenit: number; tokenDiperbarui: Date }) {
  if (!k.token || k.tokenOtomatisMenit <= 0) return { token: k.token, tokenDiperbarui: k.tokenDiperbarui };
  if (Date.now() - k.tokenDiperbarui.getTime() < k.tokenOtomatisMenit * 60_000) return { token: k.token, tokenDiperbarui: k.tokenDiperbarui };
  const token = await buatTokenUnik();
  const tokenDiperbarui = new Date();
  // Atomik — lihat putarTokenBilaPerlu.
  const n = await prisma.kegiatanUjian.updateMany({ where: { id: k.id, token: k.token }, data: { tokenLama: k.token, token, tokenDiperbarui } });
  if (n.count === 0) {
    const kini = await prisma.kegiatanUjian.findUnique({ where: { id: k.id }, select: { token: true, tokenDiperbarui: true } });
    return kini ?? { token: k.token, tokenDiperbarui: k.tokenDiperbarui };
  }
  return { token, tokenDiperbarui };
}

/** Pastikan kegiatan AKTIF punya token bersama — dibuatkan sendiri bila belum ada.
 *
 * Semula token bersama harus dinyalakan manual per kegiatan, dan itu keliru: permintaan aslinya
 * justru "satu hari ada ujian aktif mapel apa pun, tokennya sama saja" (user 20 September 2026),
 * lalu di layar Ruang Kendali token tiap mapel tetap berbeda karena tombolnya ada di halaman lain
 * dan tidak pernah ditekan. Sekarang layar petugas (daftar kegiatan & Ruang Kendali) yang
 * membuatkannya. Token per-ujian TIDAK dihapus — tetap berlaku sebagai cadangan, dan token
 * bersama masih bisa dimatikan dari Pengaturan Ujian bila sekolah memang ingin berbeda per mapel. */
export async function pastikanTokenKegiatan(k: { id: string; token: string | null; aktif: boolean }): Promise<string | null> {
  if (!k.aktif) return k.token;
  if (k.token) return k.token;
  const token = await buatTokenUnik();
  // Ikut setelan sekolah `ujian.tokenOtomatisMenit` (Pengaturan Ujian) — token bersama harus
  // berganti berkala seperti token per-ujian; tanpa ini ia dibuat dengan 0 dan tidak pernah
  // berganti (temuan user 20 September 2026: "harusnya token bersama tetap otomatis ganti").
  const st = await getSettings(["ujian.tokenOtomatisMenit"]).catch(() => ({} as Record<string, string>));
  const menit = Math.min(240, Math.max(0, Math.round(Number(st["ujian.tokenOtomatisMenit"]) || 0)));
  // Atomik: hanya bila masih kosong — dua layar yang membuka bersamaan tidak membuat dua token berbeda.
  const n = await prisma.kegiatanUjian.updateMany({
    where: { id: k.id, token: null },
    data: { token, tokenDiperbarui: new Date(), ...(menit > 0 ? { tokenOtomatisMenit: menit } : {}) },
  });
  if (n.count === 0) return (await prisma.kegiatanUjian.findUnique({ where: { id: k.id }, select: { token: true } }))?.token ?? null;
  return token;
}

export interface TokenTampil {
  /** Token yang DIBACAKAN ke peserta: token bersama kegiatan bila ada, selain itu token ujian. */
  token: string;
  /** Token ujian itu sendiri — cadangan teknis, tidak ditampilkan bila ada token bersama. */
  tokenUjian: string;
  tokenBersama: boolean;
  /** Kapan token yang dibacakan berganti (ISO), null = tetap. */
  tokenBerganti: string | null;
}

/** SATU SUMBER token yang ditampilkan di semua layar petugas (21 Sep 2026): halaman detail ujian, Daftar Ujian,
 * papan pantau, dan pembaruan berkala `/api/teacher/exams/token`. Token berjangka ikut diputar di sini — layar
 * petugas memang terbuka terus selama ujian. `singgahKeg` mencegah kegiatan yang sama diputar berulang dalam
 * satu permintaan berisi banyak ujian. */
export async function tokenTampilUjian(
  exam: { id: string; token: string; tokenOtomatisMenit: number; tokenDiperbarui: Date; isPublished: boolean; kegiatanId: string | null; endTime?: Date },
  singgahKeg: Map<string, { token: string | null; berganti: string | null }> = new Map(),
): Promise<TokenTampil> {
  // Ujian yang sudah lewat tidak perlu diputar lagi — Daftar Ujian memuat puluhan ujian lama tiap beberapa detik.
  const berlaku = exam.isPublished && (!exam.endTime || Date.now() <= exam.endTime.getTime());
  const t = berlaku ? await putarTokenBilaPerlu(exam).catch(() => null) : null;
  const tokenUjian = t?.token ?? exam.token;
  const diperbaruiUjian = t?.tokenDiperbarui ?? exam.tokenDiperbarui;

  let keg = exam.kegiatanId ? singgahKeg.get(exam.kegiatanId) : undefined;
  if (exam.kegiatanId && !keg) {
    const k = await prisma.kegiatanUjian.findUnique({
      where: { id: exam.kegiatanId },
      select: { id: true, aktif: true, token: true, tokenDiperbarui: true, tokenOtomatisMenit: true },
    }).catch(() => null);
    keg = { token: null, berganti: null };
    if (k) {
      const tokenAda = await pastikanTokenKegiatan(k).catch(() => k.token);
      const tk = tokenAda && berlaku
        ? await putarTokenKegiatanBilaPerlu({ ...k, token: tokenAda }).catch(() => null) : null;
      const token = tk?.token ?? tokenAda;
      const diperbarui = tk?.tokenDiperbarui ?? k.tokenDiperbarui;
      keg = { token, berganti: token && k.tokenOtomatisMenit > 0 ? new Date(diperbarui.getTime() + k.tokenOtomatisMenit * 60_000).toISOString() : null };
    }
    singgahKeg.set(exam.kegiatanId, keg);
  }
  if (keg?.token) return { token: keg.token, tokenUjian, tokenBersama: true, tokenBerganti: keg.berganti };
  return {
    token: tokenUjian, tokenUjian, tokenBersama: false,
    tokenBerganti: exam.tokenOtomatisMenit > 0 ? new Date(diperbaruiUjian.getTime() + exam.tokenOtomatisMenit * 60_000).toISOString() : null,
  };
}

/** Toleransi keterlambatan jaringan saat menyimpan/mengumpulkan setelah tenggat. */
export const TOLERANSI_MS = 3 * 60_000;

/* ------------------------------ pengacakan-sekali ------------------------------ */

type SoalDb = {
  id: string; tipe: string; stimulusId: string | null; posisiKunci: number | null;
  opsi: unknown; order: number;
};

/** Ambil urutan soal/opsi milik attempt ini. Kalau belum pernah dibuat, buat sekarang dan SIMPAN —
 * supaya muat-ulang halaman berikutnya memakai urutan yang sama. */
export async function urutanUntukAttempt(
  attempt: { id: string; urutan: unknown; studentId: string },
  exam: { id: string; kegiatanId: string | null; paketDenah: number; acakSoal: boolean; acakOpsi: boolean; jumlahDikerjakan: number | null },
  soal: SoalDb[],
): Promise<HasilAcak> {
  const ada = attempt.urutan as Partial<HasilAcak> | null;
  if (ada && Array.isArray(ada.urutanSoal) && ada.urutanSoal.length > 0) {
    return { urutanSoal: ada.urutanSoal, urutanOpsi: ada.urutanOpsi ?? {}, ...(ada.paket ? { paket: ada.paket } : {}) };
  }
  // Paket menurut denah: benih = paket (bukan attempt), jadi semua siswa berpaket sama melihat urutan yang sama dan siswa
  // yang duduk berdekatan melihat urutan berbeda. Siswa tanpa kursi di denah tetap diacak per siswa.
  let benih = attempt.id;
  let paket: string | undefined;
  if (exam.paketDenah >= 2 && exam.kegiatanId) {
    const kursi = await prisma.penempatanRuangUjian.findUnique({
      where: { kegiatanId_studentId: { kegiatanId: exam.kegiatanId, studentId: attempt.studentId } },
      select: { kursi: true, ruang: { select: { kolom: true } } },
    }).catch(() => null);
    if (kursi) {
      paket = HURUF_PAKET[paketDariKursi(kursi.kursi, kursi.ruang.kolom, exam.paketDenah)];
      benih = `${exam.id}:paket:${paket}`;
    }
  }
  const hasil: HasilAcak = acakUntukSiswa(
    soal.map(s => ({
      id: s.id, tipe: s.tipe, stimulusId: s.stimulusId, posisiKunci: s.posisiKunci,
      opsi: Array.isArray(s.opsi) ? (s.opsi as Opsi[]) : [], order: s.order,
    })),
    { acakSoal: exam.acakSoal, acakOpsi: exam.acakOpsi, jumlahDikerjakan: exam.jumlahDikerjakan },
    benih,
  );
  if (paket) hasil.paket = paket;
  await prisma.examAttempt.update({ where: { id: attempt.id }, data: { urutan: hasil as object } });
  return hasil;
}

/* ------------------------------ tampilan untuk siswa ------------------------------ */

export interface SoalUntukSiswa {
  id: string;
  nomor: number;
  tipe: string;
  pertanyaan: string;
  /** Opsi yang sudah diurutkan untuk siswa ini, TANPA penanda benar.
   *
   * `kode` = kode ASLI butir (dipakai menyimpan & menilai jawaban, tidak boleh berubah).
   * `label` = huruf yang DITAMPILKAN, selalu berurut A, B, C, ... mengikuti posisi tampil.
   *
   * Dua-duanya perlu: kalau yang ditampilkan ikut kode asli, siswa melihat pilihan berhuruf
   * acak (D, C, B, A, E) dan mengira layarnya rusak — padahal yang diacak memang isinya, bukan
   * hurufnya (temuan user 13 September 2026). */
  opsi: { kode: string; label: string; teks: string }[];
  /** MENJODOHKAN: pilihan kanan (tanpa pasangan). */
  kanan?: { kode: string; teks: string }[];
  /** TITIK_GAMBAR & SERET_LEPAS: gambar soal. Area jawabannya TIDAK ikut (hanya di kunci setelah dikumpulkan). */
  gambar?: string;
  /** TITIK_GAMBAR: banyaknya titik yang harus diketuk. */
  jumlahTitik?: number;
  /** LISAN: lama rekaman maksimal (detik). */
  durasiMaks?: number;
  skor: number;
  stimulus?: { id: string; judul: string; konten: string } | null;
  /** Waktu soal ini diperbaiki pengawas SETELAH siswa mulai (edit live). Kosong = tidak pernah. */
  diperbarui?: string | null;
}

/** Bentuk soal yang aman dikirim ke siswa: kunci dibuang, opsi diurutkan sesuai pengacakan.
 * `setelahSubmit` = true menyertakan kunci (untuk halaman hasil kalau guru mengizinkan). */
export function soalUntukSiswa(
  q: {
    id: string; tipe: string; pertanyaan: string; opsi: unknown; kunci: unknown; skor: number;
    stimulus: { id: string; judul: string; konten: string } | null;
    diperbaruiLiveAt?: Date | null;
  },
  nomor: number,
  urutanOpsi: string[] | undefined,
  setelahSubmit = false,
  /** Jam siswa ini mulai — catatan "diperbaiki" hanya muncul untuk perbaikan sesudahnya. */
  mulaiSiswa?: Date,
): SoalUntukSiswa & { kunci?: Kunci | null; opsiBenar?: string[] } {
  const opsiAsli = Array.isArray(q.opsi) ? (q.opsi as Opsi[]) : [];
  const urut = urutanOpsi
    ? urutanOpsi.map(k => opsiAsli.find(o => o.kode === k)).filter((o): o is Opsi => !!o)
    : opsiAsli;
  const kunci = (q.kunci ?? null) as Kunci | null;
  const huruf = ["A", "B", "C", "D", "E", "F", "G", "H"];
  // Benar/Salah & Menjodohkan memakai penomoran 1..n yang urutannya bermakna — labelnya tetap
  // kode aslinya, tidak diberi huruf.
  const pakaiHuruf = q.tipe !== "BENAR_SALAH" && q.tipe !== "MENJODOHKAN";
  const dasar: SoalUntukSiswa & { kunci?: Kunci | null; opsiBenar?: string[] } = {
    id: q.id, nomor, tipe: q.tipe, pertanyaan: q.pertanyaan,
    opsi: urut.map((o, i) => ({ kode: o.kode, label: pakaiHuruf ? (huruf[i] ?? o.kode) : o.kode, teks: o.teks })),
    skor: q.skor, stimulus: q.stimulus,
    diperbarui: q.diperbaruiLiveAt && (!mulaiSiswa || q.diperbaruiLiveAt > mulaiSiswa) ? q.diperbaruiLiveAt.toISOString() : null,
  };
  if (q.tipe === "MENJODOHKAN") dasar.kanan = (kunci?.kanan ?? []).map(o => ({ kode: o.kode, teks: o.teks }));
  if (q.tipe === "TITIK_GAMBAR" || q.tipe === "SERET_LEPAS") dasar.gambar = kunci?.gambar ?? "";
  if (q.tipe === "TITIK_GAMBAR") dasar.jumlahTitik = kunci?.area?.length ?? 1;
  if (q.tipe === "LISAN") dasar.durasiMaks = durasiLisan(kunci);
  if (setelahSubmit) {
    dasar.kunci = kunci;
    dasar.opsiBenar = opsiAsli.filter(o => o.benar).map(o => o.kode);
  }
  return dasar;
}

/* ------------------------------ penilaian ------------------------------ */

export interface HasilNilai {
  /** Skor per butir; null untuk butir yang menunggu koreksi manual. */
  skorButir: Record<string, number | null>;
  /** Total skor yang diraih dari butir yang sudah ternilai. */
  raih: number;
  /** Total skor maksimum dari butir yang IKUT dinilai (SURVEI tidak ikut). */
  maksimum: number;
  /** Nilai 0-100, LANGSUNG dihitung saat dikumpulkan. Kalau masih ada butir uraian/unggah yang
   * belum dikoreksi, butir itu dihitung 0 — nilai ini SEMENTARA (`menungguKoreksi` > 0) dan naik
   * sendiri begitu guru mengoreksi. null hanya kalau ujian tidak punya butir bernilai. */
  nilai: number | null;
  menungguKoreksi: number;
}

/** Nilai satu attempt. Butir yang sudah dikoreksi manual (ada di `skorManual`) memakai skor
 * manual; butir objektif dinilai otomatis; uraian/unggah tanpa skor manual = menunggu. Hanya
 * butir yang BENAR-BENAR diterima siswa ini (menurut `urutanSoal`) yang dihitung — penting saat
 * ujian memakai sampel "yang harus dikerjakan". */
export function nilaiAttempt(
  soal: { id: string; tipe: string; opsi: unknown; kunci: unknown; skor: number }[],
  jawaban: Record<string, Jawaban>,
  urutanSoal: string[],
  skorManual: Record<string, number | null>,
): HasilNilai {
  const dipakai = urutanSoal.length ? soal.filter(s => urutanSoal.includes(s.id)) : soal;
  const skorButir: Record<string, number | null> = {};
  let raih = 0, maksimum = 0, menunggu = 0;
  for (const s of dipakai) {
    if (!ikutDinilai(s.tipe)) { skorButir[s.id] = 0; continue; }
    maksimum += s.skor;
    if (butuhKoreksi(s.tipe)) {
      const m = skorManual[s.id];
      if (typeof m === "number") { skorButir[s.id] = m; raih += m; }
      else { skorButir[s.id] = null; menunggu += 1; }
      continue;
    }
    const n = nilaiButir(
      { tipe: s.tipe, opsi: Array.isArray(s.opsi) ? (s.opsi as Opsi[]) : [], kunci: (s.kunci ?? null) as Kunci | null, skor: s.skor },
      jawaban[s.id] ?? null,
    );
    skorButir[s.id] = n ?? 0;
    raih += n ?? 0;
  }
  // Dulu nilai ditahan (null) sampai semua uraian dikoreksi, sehingga siswa & pengawas melihat
  // "menunggu koreksi" walau soal pilihan gandanya sudah pasti (temuan user 13 Sep 2026).
  const nilai = maksimum === 0 ? null : Math.round((raih / maksimum) * 10000) / 100;
  return { skorButir, raih: Math.round(raih * 100) / 100, maksimum, nilai, menungguKoreksi: menunggu };
}

/** Hitung ulang & simpan nilai sebuah attempt (dipakai saat submit dan setelah koreksi manual). */
export async function simpanNilaiAttempt(attemptId: string): Promise<HasilNilai | null> {
  const a = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    include: { exam: { include: { questions: { select: { id: true, tipe: true, opsi: true, kunci: true, skor: true } } } } },
  });
  if (!a) return null;
  const urutan = (a.urutan as Partial<HasilAcak> | null)?.urutanSoal ?? [];
  const skorManual = (a.skorButir as Record<string, number | null>) ?? {};
  // Hanya skor uraian/unggah yang dianggap "manual" — skor otomatis dihitung ulang tiap kali.
  const manualSaja: Record<string, number | null> = {};
  for (const q of a.exam.questions) if (butuhKoreksi(q.tipe) && typeof skorManual[q.id] === "number") manualSaja[q.id] = skorManual[q.id];
  // Soal berparameter: kunci isian dinilai dengan nilai variabel milik siswa ini (src/lib/soal-parameter.ts).
  let soal = a.exam.questions;
  if (soal.some(q => butirBerparameter({ pertanyaan: "", opsi: q.opsi, kunci: q.kunci }))) {
    const v = (await variabelSiswaUjian(a.examId, [a.studentId])).get(a.studentId);
    if (v) soal = soal.map(q => isiButirParameter({ ...q, pertanyaan: "" }, v));
  }
  const h = nilaiAttempt(soal, (a.answers as Record<string, Jawaban>) ?? {}, urutan, manualSaja);
  await prisma.examAttempt.update({
    where: { id: attemptId },
    data: { skorButir: h.skorButir as object, score: h.nilai },
  });
  return h;
}

/* ------------------------------ versi soal (edit live) ------------------------------ */

/** Penanda versi naskah sebuah ujian = waktu perbaikan live terakhir. Halaman peserta
 * membandingkannya tiap simpan-otomatis; kalau berubah, soal dimuat ulang. */
export async function versiSoal(examId: string): Promise<string | null> {
  const r = await prisma.examQuestion.aggregate({ where: { examId }, _max: { diperbaruiLiveAt: true } });
  return r._max.diperbaruiLiveAt ? r._max.diperbaruiLiveAt.toISOString() : null;
}

/* ------------------------------ penjaga attempt siswa ------------------------------ */

type AttemptJaga = {
  id: string; perangkatId: string | null; terkunci: boolean; alasanKunci: string | null;
  submittedAt: Date | null; lastSeenAt: Date; jejak: unknown;
};

/** Penjaga yang dipanggil SEBELUM siswa memuat soal, menyimpan jawaban, berdenyut, atau
 * mengumpulkan:
 *   1. Kunci perangkat — perangkat lain ditolak (423, kode "PERANGKAT") sampai Reset Login.
 *   2. Terkunci — ditolak (423, kode "TERKUNCI") sampai pengawas membuka kunci.
 *   3. Kunci otomatis — tanpa denyut lebih lama dari `ujian.kunciTerputusMenit` → dikunci.
 * Pengerjaan yang sudah dikumpulkan tidak dijaga (halaman hasil boleh dibuka di mana saja).
 * `jejak` yang dikembalikan adalah jejak TERBARU — pakai ini kalau pemanggil menambah catatan,
 * supaya catatan dari penjaga tidak tertimpa. */
export async function jagaAttempt(a: AttemptJaga, perangkat: string | null): Promise<{ tolak: Response | null; jejak: unknown }> {
  if (a.submittedAt) return { tolak: null, jejak: a.jejak };
  const sekarang = Date.now();
  const cek = cekPerangkat(a, perangkat);

  if (cek === "TOLAK") {
    const daftar = Array.isArray(a.jejak) ? (a.jejak as Jejak[]) : [];
    const akhir = daftar[daftar.length - 1];
    // Catat penolakan, tapi jangan membanjiri jejak kalau perangkat itu terus mencoba.
    if (!akhir || akhir.jenis !== "DITOLAK_PERANGKAT" || sekarang - new Date(akhir.waktu).getTime() > 60_000) {
      await prisma.examAttempt.update({ where: { id: a.id }, data: { jejak: tambahJejak(a.jejak, { jenis: "DITOLAK_PERANGKAT", ket: "Dibuka dari perangkat lain" }) as object } });
    }
    return {
      tolak: Response.json({ error: "Ujian ini sedang dipegang perangkat lain. Kalau Anda memang pindah komputer, minta pengawas menekan \"Reset Login\".", kode: "PERANGKAT" }, { status: 423 }),
      jejak: a.jejak,
    };
  }
  if (a.terkunci) {
    return { tolak: Response.json({ error: a.alasanKunci || "Pengerjaan dikunci pengawas.", kode: "TERKUNCI" }, { status: 423 }), jejak: a.jejak };
  }
  const menit = Number((await getSettings(["ujian.kunciTerputusMenit"]))["ujian.kunciTerputusMenit"]) || 0;
  const putus = sekarang - a.lastSeenAt.getTime();
  if (menit > 0 && putus > menit * 60_000) {
    const alasan = `Pengerjaan dikunci karena terputus lebih dari ${menit} menit. Minta pengawas membuka kunci.`;
    const jejak = tambahJejak(a.jejak, { jenis: "KUNCI_OTOMATIS", ket: `Terputus ${Math.round(putus / 60_000)} menit` });
    await prisma.examAttempt.update({ where: { id: a.id }, data: { terkunci: true, alasanKunci: alasan, jejak: jejak as object } });
    return { tolak: Response.json({ error: alasan, kode: "TERKUNCI" }, { status: 423 }), jejak };
  }
  if (cek === "KLAIM") {
    const jejak = tambahJejak(a.jejak, { jenis: "PERANGKAT_TERDAFTAR" });
    await prisma.examAttempt.update({ where: { id: a.id }, data: { perangkatId: (perangkat ?? "").trim().slice(0, 64), jejak: jejak as object } });
    return { tolak: null, jejak };
  }
  return { tolak: null, jejak: a.jejak };
}
