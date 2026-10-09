import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { ALAMAT_APLIKASI } from "@/lib/alamat-aplikasi";

// Membaca DB (jurusan, berita, lomba) — tanpa ini metadata route dibekukan saat build (CLAUDE.md #1/#29).
export const dynamic = "force-dynamic";

const BASE_URL = ALAMAT_APLIKASI;

/** Peta situs untuk mesin pencari (7 Okt 2026): semua halaman publik + tiap jurusan, berita, dan lomba yang tampil publik.
 *  Dulu hanya 7 halaman + berita, dan alamatnya domain yang salah. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const sekarang = new Date();
  const statis: [string, MetadataRoute.Sitemap[number]["changeFrequency"], number][] = [
    ["", "weekly", 1.0], ["/admissions", "daily", 0.95], ["/programs", "monthly", 0.9], ["/about", "monthly", 0.8],
    ["/news", "daily", 0.7], ["/agenda", "weekly", 0.6], ["/lomba", "weekly", 0.6], ["/facilities", "monthly", 0.6],
    ["/extracurricular", "monthly", 0.6], ["/gallery", "weekly", 0.6], ["/alumni", "monthly", 0.5], ["/tracer-study", "monthly", 0.4],
    ["/cek-kelulusan", "yearly", 0.4], ["/pasang-aplikasi", "monthly", 0.4], ["/contact", "yearly", 0.6], ["/kebijakan-privasi", "yearly", 0.2],
  ];
  const [jurusan, berita, lomba] = await Promise.all([
    prisma.major.findMany({ select: { code: true } }).catch(() => []),
    prisma.news.findMany({ where: { published: true }, select: { slug: true, updatedAt: true }, orderBy: { updatedAt: "desc" } }).catch(() => []),
    prisma.event.findMany({ where: { aktif: true, tampilPublik: true }, select: { slug: true, updatedAt: true } }).catch(() => []),
  ]);
  return [
    ...statis.map(([p, changeFrequency, priority]) => ({ url: `${BASE_URL}${p}`, lastModified: sekarang, changeFrequency, priority })),
    ...jurusan.map(j => ({ url: `${BASE_URL}/programs/${j.code.toLowerCase()}`, lastModified: sekarang, changeFrequency: "monthly" as const, priority: 0.8 })),
    ...berita.map(n => ({ url: `${BASE_URL}/news/${n.slug}`, lastModified: n.updatedAt, changeFrequency: "monthly" as const, priority: 0.6 })),
    ...lomba.map(e => ({ url: `${BASE_URL}/lomba/${e.slug}`, lastModified: e.updatedAt, changeFrequency: "weekly" as const, priority: 0.5 })),
  ];
}
