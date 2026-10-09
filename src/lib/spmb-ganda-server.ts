import "server-only";
import { prisma } from "@/lib/prisma";
import { cariGanda, type KelompokGanda } from "@/lib/spmb-ganda";

/** Pasangan yang sudah dinyatakan panitia "bukan ganda" (kembar, nama pasaran) — SiteSetting JSON array "idA|idB". */
export const KUNCI_ABAIKAN = "spmb.gandaAbaikan";

export async function bacaAbaikan(): Promise<string[]> {
  const s = await prisma.siteSetting.findUnique({ where: { key: KUNCI_ABAIKAN } }).catch(() => null);
  try { const v = JSON.parse(s?.value ?? "[]"); return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []; }
  catch { return []; }
}

export async function simpanAbaikan(daftar: string[]) {
  const value = JSON.stringify([...new Set(daftar)]);
  await prisma.siteSetting.upsert({ where: { key: KUNCI_ABAIKAN }, update: { value }, create: { key: KUNCI_ABAIKAN, value } });
}

const tglIso = (d: Date) => d.toISOString().slice(0, 10);

/** Kelompok pendaftar yang diduga ganda — selalu dihitung dari SELURUH pendaftar (ganda lintas gelombang justru yang tersering). */
export async function kelompokGandaSpmb(): Promise<{ kelompok: KelompokGanda[]; diabaikan: number }> {
  const [baris, abaikan] = await Promise.all([
    prisma.admission.findMany({ select: { id: true, fullName: true, birthDate: true, nik: true, nisn: true, phone: true } }),
    bacaAbaikan(),
  ]);
  const ada = new Set(baris.map(b => b.id));
  // Pasangan yang salah satu barisnya sudah dihapus tidak dihitung lagi sebagai "diabaikan".
  const hidup = abaikan.filter(k => k.split("|").every(id => ada.has(id)));
  const kelompok = cariGanda(baris.map(b => ({ id: b.id, nama: b.fullName, lahir: tglIso(b.birthDate), nik: b.nik, nisn: b.nisn, phone: b.phone })), hidup);
  return { kelompok, diabaikan: hidup.length };
}
