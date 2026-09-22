import "server-only";
import { prisma } from "@/lib/prisma";
import { cekLibur } from "@/lib/hari-libur";
import { hariIniWib } from "@/lib/absensi-qr";

/** PRESENSI PEGAWAI MANDIRI (18 Sep 2026) — guru & staf mengisi kehadirannya sendiri dengan memindai QR
 * absensi (berganti tiap 30 detik) atau dengan menempelkan kartu tanda pegawai di stasiun pindai.
 *
 * Aturan sama dengan absensi siswa (CLAUDE.md #33): **tidak pernah menimpa keputusan TU**. Bila TU sudah
 * mencatat IZIN/SAKIT/DINAS_LUAR/CUTI hari itu, pindaian hanya dilaporkan balik, tidak mengubah apa pun.
 * Pindaian pertama mengisi jam masuk, pindaian berikutnya (minimal 60 menit sesudahnya) mengisi jam pulang. */

export const STATUS_TETAP = ["IZIN", "SAKIT", "DINAS_LUAR", "CUTI"];
const JEDA_PULANG_MENIT = 60;

export type HasilPresensi =
  | { hasil: "LIBUR" }
  | { hasil: "TERKUNCI"; status: string }
  | { hasil: "MASUK"; jam: string }
  | { hasil: "PULANG"; jam: string }
  | { hasil: "SUDAH_ADA"; jamMasuk: string | null; jamPulang: string | null };

const jamWib = () => new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).replace(".", ":");

export async function catatPresensiPegawai(userId: string, metode: "QR" | "KARTU"): Promise<HasilPresensi> {
  const h = hariIniWib();
  if (h.hariKe === 0 || (await cekLibur(h.tanggal))) return { hasil: "LIBUR" };

  const jam = jamWib();
  const ada = await prisma.staffAttendance.findUnique({ where: { userId_tanggal: { userId, tanggal: h.awal } } });
  if (!ada) {
    await prisma.staffAttendance.create({
      data: { userId, tanggal: h.awal, status: "HADIR", jamMasuk: jam, keterangan: metode === "QR" ? "Pindai QR mandiri" : "Pindai kartu" },
    });
    return { hasil: "MASUK", jam };
  }
  if (STATUS_TETAP.includes(ada.status)) return { hasil: "TERKUNCI", status: ada.status };
  if (!ada.jamMasuk) {
    await prisma.staffAttendance.update({ where: { id: ada.id }, data: { jamMasuk: jam } });
    return { hasil: "MASUK", jam };
  }
  const [jm, mm] = ada.jamMasuk.split(":").map(Number);
  const selisih = h.menit - ((jm || 0) * 60 + (mm || 0));
  if (!ada.jamPulang && selisih >= JEDA_PULANG_MENIT) {
    await prisma.staffAttendance.update({ where: { id: ada.id }, data: { jamPulang: jam } });
    return { hasil: "PULANG", jam };
  }
  return { hasil: "SUDAH_ADA", jamMasuk: ada.jamMasuk, jamPulang: ada.jamPulang };
}

/** Pegawai dari kode kartu: NIP, atau awalan email (staf non-guru tidak punya NIP). */
export async function pegawaiDariKartu(kode: string) {
  const bersih = kode.trim();
  if (!bersih) return null;
  const guru = await prisma.teacher.findFirst({
    where: { nip: bersih },
    select: { teacherStatus: true, position: true, user: { select: { id: true, name: true, avatar: true, role: true } } },
  });
  if (guru) return { userId: guru.user.id, nama: guru.user.name, avatar: guru.user.avatar, keterangan: guru.position ?? "Guru", nonaktif: guru.teacherStatus === "KELUAR" || guru.teacherStatus === "PENSIUN" };
  const user = await prisma.user.findFirst({
    where: { role: { in: ["TEACHER", "TAS"] }, email: { startsWith: `${bersih}@` } },
    select: { id: true, name: true, avatar: true, role: true },
  });
  if (!user) return null;
  return { userId: user.id, nama: user.name, avatar: user.avatar, keterangan: user.role === "TAS" ? "Tenaga Administrasi" : "Pegawai", nonaktif: false };
}
