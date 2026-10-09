import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { diffBukuIndukRaw, DIFF_SELECT, type Perubahan } from "@/lib/buku-induk-diff";
import { GURU_COLUMNS, type TeacherRow } from "@/lib/buku-induk-guru-columns";

/** RIWAYAT PERUBAHAN BUKU INDUK — siswa & guru, SATU pintu (9 Okt 2026).
 *  Tiap catatan (ActivityLog `UPDATE_BUKU_INDUK`) memuat dua hal:
 *  - `perubahan` = yang DIBACA orang: label kolom, nilai sebelum/sesudah yang sudah diformat;
 *  - `mentah`    = yang dipakai untuk MENGEMBALIKAN: nilai asli per tempat simpannya
 *    (`kolom:<nama>` kolom tabel, `induk:<kunci>` isi bukuIndukData, `akun:name` nama akun).
 *  Nilai berformat tidak bisa dibalik jadi nilai simpan (tanggal, kode L/P), itu sebabnya dua-duanya disimpan.
 *  Jalur baru yang mengubah Buku Induk: ambil `potret…` SEBELUM menulis, lalu panggil `catatRiwayat…` sesudahnya. */

export type Jenis = "SISWA" | "GURU";
export type Mentah = { jalur: string; lama: unknown; baru: unknown };
export type Pelaku = { userId: string | null; name: string; role: string; imp?: { userId: string; name: string } | null };
export const PELAKU_SISTEM: Pelaku = { userId: null, name: "Sistem", role: "SYSTEM" };

const KOLOM: Record<Jenis, string[]> = {
  SISWA: ["nisn", "birthPlace", "birthDate", "gender", "religion", "address", "parentName", "parentPhone", "parentJob",
    "previousSchool", "enrollYear", "studentStatus", "exitDate", "studentNotes"],
  GURU: ["nip", "subject", "phone", "birthPlace", "birthDate", "gender", "religion", "address", "education", "position",
    "startDate", "teacherStatus", "teacherNotes"],
};
const KOLOM_TANGGAL = new Set(["birthDate", "exitDate", "startDate"]);
/** Kunci teknis di bukuIndukData — bukan isian Buku Induk, tidak dicatat & tidak dikembalikan. */
const KUNCI_TEKNIS = new Set(["mutasiCentang", "pklDariPusat", "sklSuratId", "sklNomor"]);

const SELECT_GURU = {
  nip: true, subject: true, phone: true, birthPlace: true, birthDate: true, gender: true, religion: true, address: true,
  education: true, position: true, startDate: true, teacherStatus: true, teacherNotes: true, shortCode: true, bukuIndukData: true,
  userId: true, user: { select: { name: true } }, homeroomOf: { select: { name: true } },
} as const;

type Baris = Record<string, unknown> & { user: { name: string }; bukuIndukData?: unknown };

export async function potretSiswa(id: string) {
  return prisma.student.findUnique({ where: { id }, select: { userId: true, ...DIFF_SELECT } });
}
export async function potretGuru(id: string) {
  return prisma.teacher.findUnique({ where: { id }, select: SELECT_GURU });
}

const objek = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const kosong = (v: unknown) => v === null || v === undefined || v === "";
const tulis = (v: unknown) => (kosong(v) ? "" : v instanceof Date ? v.toISOString() : typeof v === "object" ? JSON.stringify(v) : String(v));
const sama = (a: unknown, b: unknown) => tulis(a) === tulis(b);

/** Meratakan satu baris menjadi {jalur: nilai simpan}. */
function ratakan(jenis: Jenis, baris: Baris): Record<string, unknown> {
  const h: Record<string, unknown> = { "akun:name": baris.user.name };
  for (const k of KOLOM[jenis]) h[`kolom:${k}`] = baris[k] instanceof Date ? (baris[k] as Date).toISOString() : baris[k] ?? null;
  for (const [k, v] of Object.entries(objek(baris.bukuIndukData))) if (!KUNCI_TEKNIS.has(k)) h[`induk:${k}`] = v;
  return h;
}
function bedaMentah(jenis: Jenis, a: Baris, b: Baris): Mentah[] {
  const x = ratakan(jenis, a), y = ratakan(jenis, b);
  return [...new Set([...Object.keys(x), ...Object.keys(y)])].filter(j => !sama(x[j], y[j])).map(j => ({ jalur: j, lama: x[j] ?? null, baru: y[j] ?? null }));
}
function bedaGuru(a: Baris, b: Baris): Perubahan[] {
  const rapi = (t: Baris) => ({ ...t, bukuIndukData: objek(t.bukuIndukData) }) as unknown as TeacherRow;
  const p = rapi(a), q = rapi(b), h: Perubahan[] = [];
  for (const c of GURU_COLUMNS) {
    let s = "", t = "";
    try { s = c.get(p); } catch { /* kolom tak terbaca = kosong */ }
    try { t = c.get(q); } catch { /* idem */ }
    if (s !== t) h.push({ key: c.key, label: c.label, group: c.group, sebelum: s, sesudah: t });
  }
  return h;
}

async function simpanCatatan(pelaku: Pelaku, jenis: Jenis, id: string, nama: string, nomor: string, perubahan: Perubahan[], mentah: Mentah[], sumber?: string) {
  if (perubahan.length === 0) return 0;
  await prisma.activityLog.create({
    data: {
      userId: pelaku.userId, userName: pelaku.name, userRole: pelaku.role, action: "UPDATE_BUKU_INDUK",
      entity: jenis === "SISWA" ? "Student" : "Teacher", entityId: id,
      description: `${pelaku.name} mengubah ${perubahan.length} data Buku Induk milik "${nama}" (${nomor})${sumber ? ` — ${sumber}` : ""}: ${perubahan.slice(0, 5).map(p => p.label).join(", ")}${perubahan.length > 5 ? ", dll" : ""}`,
      metadata: { nama, nomor, perubahan, mentah, ...(sumber ? { sumber } : {}) } as unknown as Prisma.InputJsonValue,
      impersonatorId: pelaku.imp?.userId ?? null, impersonatorName: pelaku.imp?.name ?? null,
    },
  });
  return perubahan.length;
}

/** Bandingkan keadaan sekarang dengan potret `sebelum`, lalu catat. Gagal mencatat TIDAK boleh menggagalkan simpan — pemanggil
 *  cukup `.catch(() => 0)`. Mengembalikan jumlah kolom yang berubah. */
export async function catatRiwayatSiswa(pelaku: Pelaku, id: string, sebelum: Awaited<ReturnType<typeof potretSiswa>>, sumber?: string) {
  if (!sebelum) return 0;
  const sesudah = await potretSiswa(id);
  if (!sesudah) return 0;
  return simpanCatatan(pelaku, "SISWA", id, sesudah.user.name, sesudah.nis, diffBukuIndukRaw(sebelum, sesudah),
    bedaMentah("SISWA", sebelum as unknown as Baris, sesudah as unknown as Baris), sumber);
}
export async function catatRiwayatGuru(pelaku: Pelaku, id: string, sebelum: Awaited<ReturnType<typeof potretGuru>>, sumber?: string) {
  if (!sebelum) return 0;
  const sesudah = await potretGuru(id);
  if (!sesudah) return 0;
  return simpanCatatan(pelaku, "GURU", id, sesudah.user.name, sesudah.nip, bedaGuru(sebelum as unknown as Baris, sesudah as unknown as Baris),
    bedaMentah("GURU", sebelum as unknown as Baris, sesudah as unknown as Baris), sumber);
}

/** Perubahan MASSAL satu kolom siswa (mis. Rapikan Nama Sekolah mengganti ratusan baris sekaligus): satu catatan per siswa
 *  tanpa memotret tiap baris. `lama` diambil pemanggil SEBELUM `updateMany`. */
export async function catatRiwayatSatuKolom(pelaku: Pelaku, baris: { id: string; nama: string; nomor: string; lama: string | null }[],
  o: { kunci: string; label: string; grup: string; baru: string; sumber: string }) {
  const data = baris.filter(x => (x.lama ?? "") !== o.baru).map(x => ({
    userId: pelaku.userId, userName: pelaku.name, userRole: pelaku.role, action: "UPDATE_BUKU_INDUK", entity: "Student", entityId: x.id,
    description: `${pelaku.name} mengubah 1 data Buku Induk milik "${x.nama}" (${x.nomor}) — ${o.sumber}: ${o.label}`,
    metadata: { nama: x.nama, nomor: x.nomor, sumber: o.sumber,
      perubahan: [{ key: o.kunci, label: o.label, group: o.grup, sebelum: x.lama ?? "", sesudah: o.baru }],
      mentah: [{ jalur: `kolom:${o.kunci}`, lama: x.lama, baru: o.baru }] } as unknown as Prisma.InputJsonValue,
    impersonatorId: pelaku.imp?.userId ?? null, impersonatorName: pelaku.imp?.name ?? null,
  }));
  if (data.length) await prisma.activityLog.createMany({ data });
  return data.length;
}

/** MENGEMBALIKAN satu catatan (atau sebagian jalurnya) ke nilai SEBELUM-nya.
 *  Isian yang sudah diubah LAGI sejak catatan itu TIDAK ditimpa — mengembalikannya akan menghapus perubahan yang lebih
 *  baru tanpa terlihat. Yang dilewati dilaporkan supaya petugas mengembalikannya dari catatan yang lebih baru. */
export async function kembalikanRiwayat(pelaku: Pelaku, logId: string, pilih?: string[]) {
  const log = await prisma.activityLog.findUnique({ where: { id: logId } });
  if (!log || log.action !== "UPDATE_BUKU_INDUK" || !log.entityId) return { error: "Catatan tidak ditemukan.", status: 404 as const };
  const jenis: Jenis | null = log.entity === "Student" ? "SISWA" : log.entity === "Teacher" ? "GURU" : null;
  const meta = objek(log.metadata);
  const semua = Array.isArray(meta.mentah) ? (meta.mentah as Mentah[]) : [];
  if (!jenis || semua.length === 0) return { error: "Catatan ini dibuat sebelum fitur kembalikan ada, jadi nilai aslinya tidak tersimpan.", status: 400 as const };
  const id = log.entityId;
  const sebelum = jenis === "SISWA" ? await potretSiswa(id) : await potretGuru(id);
  if (!sebelum) return { error: "Datanya sudah tidak ada.", status: 404 as const };
  const kini = ratakan(jenis, sebelum as unknown as Baris);

  const sasaran = semua.filter(m => typeof m?.jalur === "string" && (!pilih?.length || pilih.includes(m.jalur)));
  const dipakai = sasaran.filter(m => sama(kini[m.jalur], m.baru));
  const dilewati = sasaran.filter(m => !sama(kini[m.jalur], m.baru) && !sama(kini[m.jalur], m.lama)).map(m => m.jalur.split(":")[1]);
  if (dipakai.length === 0) {
    return { error: dilewati.length ? "Isian itu sudah diubah lagi setelah catatan ini, jadi tidak dikembalikan. Kembalikan dari catatan yang lebih baru." : "Tidak ada yang perlu dikembalikan — nilainya sudah sama.", status: 409 as const };
  }

  const kolom: Record<string, unknown> = {}, induk = { ...objek(sebelum.bukuIndukData) };
  let nama: string | null = null, sentuhInduk = false;
  for (const m of dipakai) {
    const [tempat, kunci] = [m.jalur.slice(0, m.jalur.indexOf(":")), m.jalur.slice(m.jalur.indexOf(":") + 1)];
    if (tempat === "akun" && kunci === "name") { if (!kosong(m.lama)) nama = String(m.lama); }
    else if (tempat === "induk") { sentuhInduk = true; if (kosong(m.lama)) delete induk[kunci]; else induk[kunci] = m.lama; }
    else if (tempat === "kolom" && KOLOM[jenis].includes(kunci)) {
      if (KOLOM_TANGGAL.has(kunci)) kolom[kunci] = kosong(m.lama) ? null : new Date(String(m.lama));
      else if (kunci === "enrollYear") kolom[kunci] = kosong(m.lama) ? null : Number(m.lama);
      else if (kunci === "studentStatus" || kunci === "teacherStatus") kolom[kunci] = kosong(m.lama) ? "AKTIF" : String(m.lama);
      else if (kunci === "nip" || kunci === "subject") { if (!kosong(m.lama)) kolom[kunci] = String(m.lama); }
      else kolom[kunci] = kosong(m.lama) ? null : m.lama;
    }
  }
  if (typeof kolom.nip === "string" && (await prisma.teacher.findFirst({ where: { nip: kolom.nip, id: { not: id } }, select: { id: true } }))) {
    return { error: `NIP ${kolom.nip} sekarang dipakai pegawai lain, jadi tidak bisa dikembalikan.`, status: 409 as const };
  }
  const data = { ...kolom, ...(sentuhInduk ? { bukuIndukData: induk as Prisma.InputJsonValue } : {}) };
  if (Object.keys(data).length) {
    if (jenis === "SISWA") await prisma.student.update({ where: { id }, data });
    else await prisma.teacher.update({ where: { id }, data });
  }
  if (nama) await prisma.user.update({ where: { id: sebelum.userId }, data: { name: nama } });

  const kapan = log.createdAt.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });
  const sumber = `mengembalikan perubahan ${log.userName} tanggal ${kapan}`;
  const jumlah = jenis === "SISWA"
    ? await catatRiwayatSiswa(pelaku, id, sebelum as Awaited<ReturnType<typeof potretSiswa>>, sumber).catch(() => 0)
    : await catatRiwayatGuru(pelaku, id, sebelum as Awaited<ReturnType<typeof potretGuru>>, sumber).catch(() => 0);
  return { ok: true as const, jenis, id, dikembalikan: dipakai.length, kolom: jumlah, dilewati };
}
