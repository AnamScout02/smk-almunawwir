import "server-only";
import { prisma } from "@/lib/prisma";
import { daftarLibur } from "@/lib/hari-libur";

/** PEKAN EFEKTIF (18 Sep 2026) — dihitung dari Kalender Pendidikan: satu pekan (Senin–Sabtu) dianggap
 * TIDAK efektif bila seluruh hari sekolahnya libur, dan "sebagian" bila ada sebagian hari libur.
 * Dipakai halaman Prota/Promes guru: jumlah pekan efektif per bulan → alokasi JP. */
export interface PekanBulan { bulan: string; label: string; pekan: number; efektif: number; sebagian: number; libur: number }

const HARI_SEKOLAH = [1, 2, 3, 4, 5, 6]; // Senin–Sabtu (Minggu selalu libur)
const namaBulan = (iso: string) => new Date(`${iso}-01T00:00:00Z`).toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "UTC" });

export async function pekanEfektif(mulai: string, selesai: string): Promise<{ bulan: PekanBulan[]; totalEfektif: number }> {
  const libur = new Set((await daftarLibur(mulai, selesai)).map(l => l.tanggal));
  const awal = new Date(`${mulai}T00:00:00Z`), akhir = new Date(`${selesai}T00:00:00Z`);
  // Kelompokkan hari sekolah per pekan (kunci: Senin pekan itu).
  const pekan = new Map<string, { bulan: string; hari: number; liburHari: number }>();
  for (let t = new Date(awal); t <= akhir; t.setUTCDate(t.getUTCDate() + 1)) {
    const hariKe = t.getUTCDay();
    if (!HARI_SEKOLAH.includes(hariKe)) continue;
    const senin = new Date(t);
    senin.setUTCDate(senin.getUTCDate() - (hariKe - 1));
    const kunci = senin.toISOString().slice(0, 10);
    const iso = t.toISOString().slice(0, 10);
    const p = pekan.get(kunci) ?? { bulan: kunci.slice(0, 7), hari: 0, liburHari: 0 };
    p.hari += 1;
    if (libur.has(iso)) p.liburHari += 1;
    pekan.set(kunci, p);
  }
  const perBulan = new Map<string, PekanBulan>();
  for (const p of pekan.values()) {
    const b = perBulan.get(p.bulan) ?? { bulan: p.bulan, label: namaBulan(p.bulan), pekan: 0, efektif: 0, sebagian: 0, libur: 0 };
    b.pekan += 1;
    if (p.liburHari === 0) b.efektif += 1;
    else if (p.liburHari >= p.hari) b.libur += 1;
    else b.sebagian += 1;
    perBulan.set(p.bulan, b);
  }
  const bulan = [...perBulan.values()].sort((a, b) => a.bulan.localeCompare(b.bulan));
  return { bulan, totalEfektif: bulan.reduce((t, b) => t + b.efektif + b.sebagian, 0) };
}

/** Rentang semester pada sebuah tahun ajaran (Juli–Desember = Ganjil, Januari–Juni = Genap). */
export async function rentangSemesterTA(tahunAjaranId: string, semester: string) {
  const ta = await prisma.academicYear.findUnique({ where: { id: tahunAjaranId }, select: { name: true, startDate: true, endDate: true } });
  if (!ta) return null;
  const tahunAwal = Number(ta.name.slice(0, 4));
  const mulai = semester === "GENAP" ? `${tahunAwal + 1}-01-01` : ta.startDate.toISOString().slice(0, 10);
  const selesai = semester === "GENAP" ? ta.endDate.toISOString().slice(0, 10) : `${tahunAwal}-12-31`;
  return { nama: ta.name, mulai, selesai };
}
