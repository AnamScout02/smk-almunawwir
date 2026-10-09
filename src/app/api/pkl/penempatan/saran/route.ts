import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { balasTolak, muatPeserta, sesiPkl, terisiPerDudi } from "@/lib/pkl-server";

export const dynamic = "force-dynamic";
const rapi = (s: unknown) => String(s ?? "").trim().toLowerCase();

/** SARAN PENEMPATAN OTOMATIS (9 Okt 2026) — untuk siswa yang BELUM dapat DUDI. Aturan, bukan AI:
 *  DUDI aktif, menerima jurusan siswa (daftar jurusan kosong = semua), dan MASIH punya sisa kuota; di antara yang
 *  memenuhi, didahulukan yang sekecamatan dengan rumah siswa, lalu yang sisa kuotanya terbanyak (supaya merata).
 *  DUDI tanpa kuota TIDAK ikut — tanpa angka itu sistem tidak tahu berapa siswa yang sanggup diterima.
 *  Keluarannya USULAN: tidak ada yang tersimpan sampai panitia memilih dan menekan Terapkan (lewat POST penempatan biasa). */
export async function GET() {
  try {
    await sesiPkl();
    const [peserta, dudi, terisi] = await Promise.all([
      muatPeserta(),
      prisma.industryPartner.findMany({ where: { aktif: true, quota: { not: null } }, select: { id: true, name: true, quota: true, jurusanIds: true, kecamatan: true }, orderBy: { name: "asc" } }),
      terisiPerDudi(),
    ]);
    const belum = peserta.filter(p => p.status === "ONGOING" && !p.tempat);
    const rumah = new Map((await prisma.student.findMany({ where: { id: { in: belum.map(p => p.studentId) } }, select: { id: true, bukuIndukData: true } }))
      .map(s => [s.id, rapi(((s.bukuIndukData ?? {}) as Record<string, unknown>).kecamatan)]));
    const sisa = new Map(dudi.map(d => [d.id, (d.quota as number) - (terisi.get(d.id) ?? 0)]));
    const usulan: { studentId: string; nama: string; kelas: string | null; jurusan: string; mitraId: string; dudi: string; alasan: string }[] = [];
    const tanpa: { nama: string; kelas: string | null; sebab: string }[] = [];
    // Siswa yang pilihannya paling sedikit ditempatkan lebih dulu, supaya tidak kehabisan tempat oleh yang pilihannya banyak.
    const cocok = (p: (typeof belum)[number]) => dudi.filter(d => !d.jurusanIds.length || (p.jurusanId != null && d.jurusanIds.includes(p.jurusanId)));
    for (const p of [...belum].sort((a, b) => cocok(a).length - cocok(b).length || a.nama.localeCompare(b.nama, "id"))) {
      const calon = cocok(p);
      if (!calon.length) { tanpa.push({ nama: p.nama, kelas: p.kelas, sebab: "tidak ada DUDI berkuota yang menerima jurusannya" }); continue; }
      const ada = calon.filter(d => (sisa.get(d.id) ?? 0) > 0);
      if (!ada.length) { tanpa.push({ nama: p.nama, kelas: p.kelas, sebab: "kuota DUDI yang cocok sudah habis" }); continue; }
      const kec = rumah.get(p.studentId) ?? "";
      const pilih = ada.sort((a, b) => Number(!!kec && rapi(b.kecamatan) === kec) - Number(!!kec && rapi(a.kecamatan) === kec) || (sisa.get(b.id) ?? 0) - (sisa.get(a.id) ?? 0))[0];
      sisa.set(pilih.id, (sisa.get(pilih.id) ?? 0) - 1);
      const dekat = !!kec && rapi(pilih.kecamatan) === kec;
      usulan.push({ studentId: p.studentId, nama: p.nama, kelas: p.kelas, jurusan: p.jurusan, mitraId: pilih.id, dudi: pilih.name, alasan: [pilih.jurusanIds.length ? "menerima jurusannya" : "menerima semua jurusan", dekat ? "sekecamatan dengan rumah" : null].filter(Boolean).join(" · ") });
    }
    usulan.sort((a, b) => a.dudi.localeCompare(b.dudi, "id") || a.nama.localeCompare(b.nama, "id"));
    return Response.json({ belum: belum.length, usulan, tanpa, dudiBerkuota: dudi.length });
  } catch (e) { lemparBilaPengalihan(e); return balasTolak(e); }
}
