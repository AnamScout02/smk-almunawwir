import "server-only";
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getJabatanNames } from "@/lib/jabatan-guard";
import { TAS_JABATAN } from "@/lib/tas-access-guard";

/** HUMAS & PKL (17 Sep 2026). Akses satu PKL: Admin, staf TU, Wakil Kepala Humas, atau guru pembimbingnya. */
export const ASPEK_PKL = [
  { kunci: "disiplin", label: "Disiplin & kehadiran" },
  { kunci: "tanggungJawab", label: "Tanggung jawab" },
  { kunci: "kerjaSama", label: "Kerja sama" },
  { kunci: "inisiatif", label: "Inisiatif & kemandirian" },
  { kunci: "keterampilan", label: "Keterampilan teknis sesuai bidang" },
  { kunci: "kualitas", label: "Kualitas hasil kerja" },
  { kunci: "etika", label: "Etika & sopan santun" },
  { kunci: "k3", label: "Keselamatan & kesehatan kerja (K3)" },
] as const;
export const MASA_TAUTAN_HARI = 30;

export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
export const tokenBaru = () => randomBytes(24).toString("base64url");

export { predikatPkl } from "@/lib/pkl-label";

export async function aksesHumas(s: { role: string; email: string }) {
  if (s.role === "ADMIN") return true;
  if (s.role !== "TEACHER" && s.role !== "TAS") return false;
  const j = await getJabatanNames(s.email);
  return j.includes("Wakil Kepala Humas") || j.some(n => TAS_JABATAN.includes(n));
}

/** PANITIA PKL tambahan (9 Okt 2026, permintaan user: "menambahkan panitia pkl juga seperti spmb, jadi bisa akses juga").
 *  Daftar userId di SiteSetting `pkl.panitia`, diatur di /pusat-pkl/panitia. Wakil Kepala Humas, staf TU penuh, dan Admin
 *  tetap otomatis; daftar ini MENAMBAH guru/staf lain tanpa memberi mereka jabatan (jabatan Humas membawa hak lain:
 *  tracer study, dashboard Humas). Disinggahkan 30 detik — penjaga dipanggil di setiap rute PKL. */
export const PENANDA_PANITIA_PKL = "Panitia PKL";
let singgahPanitia: { at: number; ids: string[] } | null = null;
export async function anggotaPanitiaPkl(): Promise<string[]> {
  if (singgahPanitia && Date.now() - singgahPanitia.at < 30_000) return singgahPanitia.ids;
  const row = await prisma.siteSetting.findUnique({ where: { key: "pkl.panitia" } }).catch(() => null);
  let ids: string[] = [];
  try { const v = JSON.parse(row?.value || "[]"); if (Array.isArray(v)) ids = v.map(String); } catch { /* kosong */ }
  singgahPanitia = { at: Date.now(), ids };
  return ids;
}
export function lupakanPanitiaPkl() { singgahPanitia = null; }

/** Boleh membuka & mengelola PUSAT PKL: `aksesHumas` ATAU anggota panitia PKL tambahan. Dipakai SEMUA rute urusan PKL;
 *  `aksesHumas` sendiri tetap untuk hal Humas di luar PKL dan untuk memutuskan siapa boleh MENGATUR daftar panitia. */
export async function aksesPusatPkl(s: { role: string; email: string; userId?: string }) {
  if (await aksesHumas(s)) return true;
  if (s.role !== "TEACHER" && s.role !== "TAS") return false;
  return !!s.userId && (await anggotaPanitiaPkl()).includes(s.userId);
}

/** Penjaga rute PKL lama (pengganti `assertHumas` di rute pendaftaran/penempatan/jurnal): melempar FORBIDDEN. */
export async function assertPkl(s: { role: string; email: string; userId?: string }) {
  if (!(await aksesPusatPkl(s))) throw new Error("FORBIDDEN");
}

export async function aksesPkl(s: { role: string; email: string; userId: string }, internshipId: string) {
  const pkl = await prisma.internship.findUnique({
    where: { id: internshipId },
    include: { student: { select: { id: true, nis: true, user: { select: { name: true } }, class: { select: { name: true } }, major: { select: { name: true } } } }, teacher: { select: { userId: true } } },
  });
  if (!pkl) return null;
  if (pkl.teacher?.userId === s.userId || (await aksesPusatPkl(s))) return pkl;
  return null;
}

/** Nomor sertifikat berurutan per tahun: 001/PKL/SMK-AM/2026. */
export async function nomorSertifikatBerikutnya(tahun: number) {
  const n = await prisma.internship.count({ where: { sertifikatNomor: { endsWith: `/PKL/SMK-AM/${tahun}` } } });
  return `${String(n + 1).padStart(3, "0")}/PKL/SMK-AM/${tahun}`;
}
