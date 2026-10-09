import { prisma } from "@/lib/prisma";

const TEKS = {
  id: { label: "Praktik Kerja Lapangan", judul: "Belajar langsung di dunia kerja", mitra: "Mitra industri", siswa: "Siswa PKL tahun ini", bidang: "Bidang usaha", wilayah: "Kabupaten / kota", bekerja: "Alumni bekerja di tempat PKL-nya" },
  en: { label: "Industrial Internship", judul: "Learning directly in the workplace", mitra: "Industry partners", siswa: "Interns this year", bidang: "Business fields", wilayah: "Regencies / cities", bekerja: "Alumni hired by their internship host" },
};
const rapi = (s?: string | null) => (s ?? "").toLowerCase().replace(/\b(pt|cv|ud|tbk)\b|[^a-z0-9]/g, "");

/** STATISTIK PKL DI WEB (9 Okt 2026) — ANGKA saja, tanpa nama siswa maupun nama DUDI (logo mitra punya deretnya sendiri
 *  dan sakelar "tampil di web" per DUDI). Sengaja TIDAK tampil sampai datanya layak dipamerkan (≥5 mitra aktif dan ≥10
 *  siswa ditempatkan) — "1 mitra industri" di halaman pendaftaran lebih merugikan daripada tidak ada.
 *  Kueri dibungkus `.catch` (komponen halaman publik, CLAUDE.md #1). Warna ikut tema SPMB bila ada (`--spmb-*`). */
export default async function StatistikPkl({ lang = "id" }: { lang?: "id" | "en" }) {
  const kini = new Date(Date.now() + 7 * 3600_000);
  const ta = kini.getUTCMonth() >= 6 ? kini.getUTCFullYear() : kini.getUTCFullYear() - 1;
  const [mitra, pkl, tracer] = await Promise.all([
    prisma.industryPartner.findMany({ where: { aktif: true }, select: { industryField: true, kabupaten: true } }).catch(() => []),
    prisma.internship.findMany({
      where: { mitraId: { not: null }, status: { not: "CANCELLED" } },
      select: { company: true, startDate: true, endDate: true, studentId: true },
    }).catch(() => []),
    prisma.alumniTracer.findMany({ where: { status: "BEKERJA", institutionName: { not: null } }, select: { studentId: true, institutionName: true } }).catch(() => []),
  ]);
  const awalTa = new Date(Date.UTC(ta, 6, 1)), akhirTa = new Date(Date.UTC(ta + 1, 6, 1));
  const tahunIni = pkl.filter(p => p.startDate < akhirTa && p.endDate >= awalTa).length;
  if (mitra.length < 5 || tahunIni < 10) return null;
  const hitung = (a: (string | null)[]) => new Set(a.map(x => (x ?? "").trim().toLowerCase()).filter(Boolean)).size;
  const tempat = new Map(pkl.map(p => [p.studentId, rapi(p.company)]));
  const bekerja = tracer.filter(t => { const k = tempat.get(t.studentId); return k && k === rapi(t.institutionName); }).length;
  const t = TEKS[lang];
  const angka = [
    { n: mitra.length, l: t.mitra }, { n: tahunIni, l: t.siswa },
    { n: hitung(mitra.map(m => m.industryField)), l: t.bidang }, { n: hitung(mitra.map(m => m.kabupaten)), l: t.wilayah },
    ...(bekerja >= 3 ? [{ n: bekerja, l: t.bekerja }] : []),
  ].filter(x => x.n > 0);
  return (
    <section className="bg-white py-14">
      <div className="container-custom">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--spmb-aksen, #B87D0E)" }}>{t.label}</p>
        <h2 className="mt-2 text-center font-heading text-2xl font-bold" style={{ color: "var(--spmb-utama, #0F1A45)" }}>{t.judul}</h2>
        <div className={`mx-auto mt-8 grid max-w-4xl grid-cols-2 gap-4 ${angka.length >= 5 ? "md:grid-cols-5" : "md:grid-cols-4"}`}>
          {angka.map(x => (
            <div key={x.l} className="min-w-0 rounded-2xl border border-gray-100 p-5 text-center" style={{ background: "var(--spmb-lembut, #F8F7F2)" }}>
              <p className="angka font-heading text-3xl font-bold" style={{ color: "var(--spmb-utama, #0F1A45)" }}>{x.n}</p>
              <p className="mt-1 text-sm text-gray-600">{x.l}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
