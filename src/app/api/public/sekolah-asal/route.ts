import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { bakuNamaSekolah, kunciSekolah } from "@/lib/nama-sekolah";

export const dynamic = "force-dynamic";

/** SARAN NAMA SEKOLAH di formulir SPMB (6 Okt 2026) — dari nama sekolah asal yang sudah dikenal (Buku Induk + pendaftar),
 *  ditulis baku & satu per sekolah. Hanya NAMA SEKOLAH (bukan data pribadi). Disinggahkan 10 menit. */
let singgah: { sampai: number; daftar: { nama: string; kunci: string; jumlah: number }[] } | null = null;

async function daftarDikenal() {
  if (singgah && singgah.sampai > Date.now()) return singgah.daftar;
  const [a, b] = await Promise.all([
    prisma.student.groupBy({ by: ["previousSchool"], where: { previousSchool: { not: null } }, _count: { _all: true } }).catch(() => []),
    prisma.admission.groupBy({ by: ["previousSchool"], where: { previousSchool: { not: null } }, _count: { _all: true } }).catch(() => []),
  ]);
  const peta = new Map<string, { nama: string; jumlah: number; terbanyak: number }>();
  for (const x of [...a, ...b]) {
    const nama = x.previousSchool?.trim();
    if (!nama) continue;
    const k = kunciSekolah(nama);
    const n = x._count._all;
    const ada = peta.get(k);
    // Label = penulisan baku dari varian TERBANYAK.
    if (!ada) peta.set(k, { nama: bakuNamaSekolah(nama), jumlah: n, terbanyak: n });
    else { ada.jumlah += n; if (n > ada.terbanyak) { ada.terbanyak = n; ada.nama = bakuNamaSekolah(nama); } }
  }
  const daftar = [...peta].map(([kunci, v]) => ({ nama: v.nama, kunci, jumlah: v.jumlah })).sort((x, y) => y.jumlah - x.jumlah);
  singgah = { sampai: Date.now() + 10 * 60_000, daftar };
  return daftar;
}

export async function GET(req: NextRequest) {
  if (!checkRateLimit(`sekolah-asal:${getClientIp(req)}`, 120, 60_000)) return Response.json([], { status: 429 });
  const q = kunciSekolah(req.nextUrl.searchParams.get("q") ?? "");
  if (q.length < 2) return Response.json([]);
  const kata = q.split(" ");
  const cocok = (await daftarDikenal()).filter(d => kata.every(w => d.kunci.includes(w)));
  return Response.json(cocok.slice(0, 8).map(d => d.nama));
}
