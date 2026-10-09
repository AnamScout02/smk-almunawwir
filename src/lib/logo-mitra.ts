import "server-only";
import { prisma } from "@/lib/prisma";
import type { LogoMitra } from "@/lib/spmb-konten";

/** DERET LOGO MITRA di halaman SPMB & beranda = logo yang diunggah panitia SPMB (Poster & Promosi, `spmb.logoMitra`)
 *  DITAMBAH logo DUDI dari Pusat PKL (permintaan user 9 Okt 2026: "upload logo dudi, agar nyambung juga dengan spmb").
 *  Hanya DUDI yang aktif, berlogo, dan dicentang "tampil di web"; nama yang sama tidak tampil dua kali (logo panitia
 *  didahulukan). Kueri dibungkus `.catch` — komponen ini dipakai halaman publik (CLAUDE.md #1). */
export async function logoMitraPublik(dariPanitia: LogoMitra[]): Promise<LogoMitra[]> {
  const dudi = await prisma.industryPartner.findMany({
    where: { aktif: true, tampilPublik: true, logoUrl: { not: null } }, orderBy: { name: "asc" }, select: { name: true, logoUrl: true },
  }).catch(() => []);
  const kunci = (s: string) => s.trim().toLowerCase();
  const sudah = new Set(dariPanitia.map(l => kunci(l.nama)).filter(Boolean));
  return [...dariPanitia, ...dudi.filter(d => d.logoUrl && !sudah.has(kunci(d.name))).map(d => ({ nama: d.name, logo: d.logoUrl as string }))];
}
