import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getJabatanNames } from "@/lib/jabatan-guard";
import { TAS_JABATAN } from "@/lib/tas-access-guard";

/** PENGUMUMAN BERTARGET + TANDA DIBACA (17 Sep 2026) — satu sumber aturan sasaran.
 * - targetRole: ALL | STUDENT | TEACHER | ADMIN | PARENT | STUDENT_PARENT
 * - targetKelasIds/targetJurusanIds hanya menyaring SISWA & ORANG TUA (orang tua lewat kelas/jurusan anaknya)
 * - targetJabatan hanya menyaring GURU/staf
 * Pembuat: Admin & staf TU = semua sasaran; Kepala Sekolah & Wakil Kepala = semua sasaran;
 * wali kelas = siswa/orang tua kelas walinya saja. */

export const PERAN_SASARAN: Record<string, string> = {
  ALL: "Semua pengguna", STUDENT: "Siswa", PARENT: "Orang tua", STUDENT_PARENT: "Siswa & orang tua", TEACHER: "Guru & staf", ADMIN: "Admin",
};
const PERAN_SISWA_ORTU = ["STUDENT", "PARENT", "STUDENT_PARENT"];

type Sesi = { userId: string; email: string; role: string };

export interface KonteksPenerima { peran: string[]; kelasIds: string[]; jurusanIds: string[]; jabatan: string[] }

/** Peran & atribut pengguna untuk mencocokkan sasaran. */
export async function konteksPenerima(s: Sesi): Promise<KonteksPenerima> {
  if (s.role === "STUDENT") {
    const st = await prisma.student.findFirst({ where: { userId: s.userId }, select: { classId: true, majorId: true } });
    return { peran: ["ALL", "STUDENT", "STUDENT_PARENT"], kelasIds: st?.classId ? [st.classId] : [], jurusanIds: st?.majorId ? [st.majorId] : [], jabatan: [] };
  }
  if (s.role === "PARENT") {
    const anak = await prisma.parentStudent.findMany({ where: { parent: { userId: s.userId } }, select: { student: { select: { classId: true, majorId: true } } } });
    return {
      peran: ["ALL", "PARENT", "STUDENT_PARENT"],
      kelasIds: anak.map(a => a.student.classId).filter((x): x is string => !!x),
      jurusanIds: anak.map(a => a.student.majorId).filter((x): x is string => !!x),
      jabatan: [],
    };
  }
  if (s.role === "TEACHER" || s.role === "TAS") return { peran: ["ALL", "TEACHER"], kelasIds: [], jurusanIds: [], jabatan: await getJabatanNames(s.email) };
  return { peran: ["ALL", "ADMIN"], kelasIds: [], jurusanIds: [], jabatan: [] };
}

/** Syarat sasaran (peran, kelas, jurusan, jabatan) — dipakai model mana pun yang punya kolom target* (Pengumuman, Survei). */
export function syaratSasaran(k: KonteksPenerima) {
  return {
    targetRole: { in: k.peran },
    AND: [
      { OR: [{ targetKelasIds: { isEmpty: true } }, { targetKelasIds: { hasSome: k.kelasIds.length ? k.kelasIds : ["-"] } }] },
      { OR: [{ targetJurusanIds: { isEmpty: true } }, { targetJurusanIds: { hasSome: k.jurusanIds.length ? k.jurusanIds : ["-"] } }] },
      { OR: [{ targetJabatan: { isEmpty: true } }, { targetJabatan: { hasSome: k.jabatan.length ? k.jabatan : ["-"] } }] },
    ],
  };
}

/** Filter Prisma pengumuman AKTIF yang ditujukan ke pengguna ini. */
export function wherePengumumanUntuk(k: KonteksPenerima, now = new Date()): Prisma.AnnouncementWhereInput {
  const sy = syaratSasaran(k);
  return { active: true, startDate: { lte: now }, targetRole: sy.targetRole, AND: [{ OR: [{ endDate: null }, { endDate: { gte: now } }] }, ...sy.AND] };
}

export interface PengumumanTampil { id: string; title: string; content: string; priority: string; wajibKonfirmasi: boolean; dibaca: boolean; pembuatNama: string | null; startDate: Date }

/** Pengumuman aktif untuk pengguna + status dibaca. */
export async function pengumumanUntuk(s: Sesi, take?: number): Promise<PengumumanTampil[]> {
  const k = await konteksPenerima(s);
  const daftar = await prisma.announcement.findMany({
    where: wherePengumumanUntuk(k),
    orderBy: [{ priority: "desc" }, { startDate: "desc" }, { createdAt: "desc" }],
    take,
    select: { id: true, title: true, content: true, priority: true, wajibKonfirmasi: true, pembuatNama: true, startDate: true, dibaca: { where: { userId: s.userId }, select: { id: true } } },
  });
  return daftar.map(({ dibaca, ...a }) => ({ ...a, dibaca: dibaca.length > 0 }));
}

/** Jumlah pengumuman wajib konfirmasi yang belum ditandai dibaca (untuk antrean Perlu tindakan). */
export async function jumlahBelumKonfirmasi(s: Sesi): Promise<number> {
  const k = await konteksPenerima(s);
  return prisma.announcement.count({ where: { ...wherePengumumanUntuk(k), wajibKonfirmasi: true, dibaca: { none: { userId: s.userId } } } });
}

/** Seluruh userId sasaran sebuah pengumuman (untuk notifikasi & statistik pembaca). */
export async function penerimaPengumuman(a: { targetRole: string; targetKelasIds: string[]; targetJurusanIds: string[]; targetJabatan: string[]; targetUserIds?: string[] }): Promise<{ userId: string; peran: string }[]> {
  // ORANG TERTENTU menang atas saringan peran/kelas/jabatan (dipakai Kegiatan sejak 30 Sep 2026):
  // kalau panitia menyebut namanya satu per satu, itulah pesertanya — bukan ditambahkan ke satu kelas
  // penuh, karena hasilnya akan membingungkan ("sudah pilih 5 orang kok semua siswa jadi sasaran").
  if (a.targetUserIds?.length) {
    const u = await prisma.user.findMany({
      where: { id: { in: a.targetUserIds } },
      select: { id: true, role: true },
    });
    const label: Record<string, string> = { STUDENT: "Siswa", PARENT: "Orang tua", TEACHER: "Guru", TAS: "Staf", ADMIN: "Admin" };
    return u.map(x => ({ userId: x.id, peran: label[x.role] ?? x.role }));
  }
  const r = a.targetRole;
  const hasil: { userId: string; peran: string }[] = [];
  const saringSiswa: Prisma.StudentWhereInput = {
    studentStatus: "AKTIF",
    ...(a.targetKelasIds.length ? { classId: { in: a.targetKelasIds } } : {}),
    ...(a.targetJurusanIds.length ? { majorId: { in: a.targetJurusanIds } } : {}),
  };
  if (["ALL", "STUDENT", "STUDENT_PARENT"].includes(r)) {
    const s = await prisma.student.findMany({ where: saringSiswa, select: { userId: true } });
    hasil.push(...s.map(x => ({ userId: x.userId, peran: "Siswa" })));
  }
  if (["ALL", "PARENT", "STUDENT_PARENT"].includes(r)) {
    const p = await prisma.parent.findMany({ where: { children: { some: { student: saringSiswa } } }, select: { userId: true } });
    hasil.push(...p.map(x => ({ userId: x.userId, peran: "Orang tua" })));
  }
  if (["ALL", "TEACHER"].includes(r)) {
    const j = a.targetJabatan;
    const [g, st] = await Promise.all([
      prisma.teacher.findMany({ where: { ...(j.length ? { jabatan: { some: { jabatan: { name: { in: j } } } } } : {}) }, select: { userId: true } }),
      prisma.user.findMany({ where: { role: "TAS", ...(j.length ? { staffJabatan: { some: { jabatan: { name: { in: j } } } } } : {}) }, select: { id: true } }),
    ]);
    hasil.push(...g.map(x => ({ userId: x.userId, peran: "Guru" })), ...st.map(x => ({ userId: x.id, peran: "Staf" })));
  }
  if (["ALL", "ADMIN"].includes(r)) {
    const ad = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
    hasil.push(...ad.map(x => ({ userId: x.id, peran: "Admin" })));
  }
  const lihat = new Set<string>();
  return hasil.filter(h => (lihat.has(h.userId) ? false : (lihat.add(h.userId), true)));
}

export interface HakPengumuman { boleh: boolean; semua: boolean; waliKelas: { id: string; name: string }[] }

/** Siapa boleh membuat pengumuman dan dengan sasaran apa. */
export async function hakPengumuman(s: Sesi): Promise<HakPengumuman> {
  if (s.role === "ADMIN") return { boleh: true, semua: true, waliKelas: [] };
  if (s.role !== "TEACHER" && s.role !== "TAS") return { boleh: false, semua: false, waliKelas: [] };
  const jabatan = await getJabatanNames(s.email);
  const pimpinan = jabatan.some(j => TAS_JABATAN.includes(j) || j === "Kepala Sekolah" || j.startsWith("Wakil Kepala"));
  const waliKelas = s.role === "TEACHER"
    ? await prisma.class.findMany({ where: { homeroom: { userId: s.userId } }, select: { id: true, name: true }, orderBy: { name: "asc" } })
    : [];
  return { boleh: pimpinan || waliKelas.length > 0, semua: pimpinan, waliKelas };
}

type Sasaran = { targetRole: string; targetKelasIds: string[]; targetJurusanIds: string[]; targetJabatan: string[] };

/** Validasi & rapikan isian sasaran sesuai hak. Mengembalikan `galat` bila tidak sah. */
export function rapikanSasaran(b: { targetRole?: unknown; targetKelasIds?: unknown; targetJurusanIds?: unknown; targetJabatan?: unknown; targetUserIds?: unknown }, hak: HakPengumuman):
  { galat: string; sasaran?: undefined; orang?: undefined } | { galat?: undefined; sasaran: Sasaran; orang: string[] } {
  const daftar = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && !!x))].slice(0, 200) : []);
  let targetRole = typeof b.targetRole === "string" && PERAN_SASARAN[b.targetRole] ? b.targetRole : "ALL";
  let targetKelasIds = daftar(b.targetKelasIds);
  let targetJurusanIds = daftar(b.targetJurusanIds);
  let targetJabatan = daftar(b.targetJabatan);
  // Daftar ORANG TERTENTU; siapa yang boleh dipilih divalidasi pemanggil (lihat /api/kegiatan).
  const targetUserIds = daftar(b.targetUserIds);
  if (!PERAN_SISWA_ORTU.includes(targetRole)) { targetKelasIds = []; targetJurusanIds = []; }
  if (targetRole !== "TEACHER") targetJabatan = [];
  if (!hak.semua && !targetUserIds.length) {
    const milik = new Set(hak.waliKelas.map(k => k.id));
    if (!PERAN_SISWA_ORTU.includes(targetRole)) targetRole = "STUDENT_PARENT";
    targetJurusanIds = [];
    targetKelasIds = targetKelasIds.filter(id => milik.has(id));
    if (!targetKelasIds.length) return { galat: "Pilih kelas wali Anda sebagai sasaran." };
  }
  // `orang` SENGAJA di luar `sasaran`: Announcement & Survei menyebar `...sasaran` langsung ke Prisma
  // dan kedua model itu tidak punya kolom targetUserIds. Hanya Kegiatan yang memakainya.
  return { sasaran: { targetRole, targetKelasIds, targetJurusanIds, targetJabatan }, orang: targetUserIds };
}
