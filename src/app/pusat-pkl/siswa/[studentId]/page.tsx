export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import { Route } from "lucide-react";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import { BarisKembali } from "@/components/shared/TombolKembali";
import { JENIS_LAPORAN, STATUS_PKL, tglPkl } from "@/lib/pkl-label";

export const metadata = { title: "Linimasa PKL Siswa" };
type Butir = { t: Date; jenis: string; warna: string; judul: string; isi?: string | null };
const W = { biru: "bg-blue-50 text-blue-700 border-blue-200", hijau: "bg-emerald-50 text-emerald-700 border-emerald-200", kuning: "bg-amber-50 text-amber-700 border-amber-200", merah: "bg-red-50 text-red-600 border-red-200", abu: "bg-gray-50 text-gray-600 border-gray-200" };

/** LINIMASA PKL SATU SISWA (9 Okt 2026) — seluruh kejadian PKL-nya dalam satu urutan waktu: pendaftaran, penempatan,
 *  pengantaran, monitoring, alpha, masalah, mutasi, laporan akhir, nilai, penjemputan, sertifikat. Jurnal diringkas per
 *  minggu (bukan satu baris per hari). Akses dijaga layout Pusat PKL. */
export default async function Page({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const [p, daftar] = await Promise.all([
    prisma.internship.findUnique({
      where: { studentId },
      select: {
        id: true, company: true, position: true, startDate: true, endDate: true, status: true, lamaBulan: true,
        diantarPada: true, diantarOleh: true, diterimaOleh: true, dijemputPada: true, dijemputOleh: true,
        laporanAkhirStatus: true, laporanAkhirPada: true, nilaiIndustriRata: true, nilaiIndustriPada: true, penilaiIndustri: true, nilaiAkhirRata: true,
        sertifikatNomor: true, sertifikatPada: true, umpanBalikPada: true,
        student: { select: { nis: true, user: { select: { name: true } }, class: { select: { name: true } } } },
        teacher: { select: { user: { select: { name: true } } } },
        journal: { orderBy: { date: "asc" }, select: { date: true } },
        monitoring: { select: { tanggal: true, cara: true, catatan: true, olehNama: true, jarakMeter: true } },
        presensi: { where: { status: { not: "HADIR" } }, select: { tanggal: true, status: true, keterangan: true } },
        laporanMasalah: { select: { createdAt: true, jenis: true, isi: true, status: true, pelapor: true, tindakLanjut: true } },
        mutasi: { select: { tanggal: true, dariNama: true, keNama: true, alasan: true } },
        _count: { select: { journal: true, presensi: true } },
      },
    }),
    prisma.pklRegistration.findUnique({ where: { studentId }, select: { submittedAt: true, status: true, reviewedAt: true } }),
  ]);
  if (!p) notFound();
  const b: Butir[] = [];
  if (daftar) b.push({ t: daftar.submittedAt, jenis: "Pendaftaran", warna: W.abu, judul: "Mendaftar PKL", isi: daftar.status === "APPROVED" ? "Berkas disetujui" : daftar.status === "REJECTED" ? "Berkas ditolak" : "Menunggu keputusan" });
  b.push({ t: p.startDate, jenis: "Mulai", warna: W.biru, judul: `Masa PKL dimulai${p.lamaBulan ? ` (${p.lamaBulan} bulan)` : ""}`, isi: p.company });
  if (p.diantarPada) b.push({ t: p.diantarPada, jenis: "Pengantaran", warna: W.biru, judul: "Diantar ke tempat PKL", isi: [p.diantarOleh && `oleh ${p.diantarOleh}`, p.diterimaOleh && `diterima ${p.diterimaOleh}`].filter(Boolean).join(" · ") });
  // Jurnal diringkas per minggu (Senin sebagai kunci).
  const minggu = new Map<number, number>();
  for (const j of p.journal) { const d = new Date(j.date); const sen = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); minggu.set(sen, (minggu.get(sen) ?? 0) + 1); }
  for (const [sen, n] of minggu) b.push({ t: new Date(sen + 5 * 86_400_000), jenis: "Jurnal", warna: W.hijau, judul: `${n} jurnal ditulis pada minggu ${tglPkl(new Date(sen))}` });
  for (const m of p.monitoring) b.push({ t: m.tanggal, jenis: "Monitoring", warna: W.hijau, judul: `Monitoring ${m.cara.toLowerCase()} oleh ${m.olehNama}${m.jarakMeter != null && m.jarakMeter <= 300 ? " (di lokasi)" : ""}`, isi: m.catatan });
  for (const x of p.presensi) b.push({ t: x.tanggal, jenis: x.status, warna: x.status === "ALPHA" ? W.merah : W.kuning, judul: `Tidak hadir: ${x.status.toLowerCase()}`, isi: x.keterangan });
  for (const l of p.laporanMasalah) b.push({ t: l.createdAt, jenis: "Masalah", warna: W.merah, judul: `Laporan ${JENIS_LAPORAN[l.jenis] ?? l.jenis} dari ${l.pelapor.toLowerCase()}`, isi: [l.isi, l.tindakLanjut && `Tindak lanjut: ${l.tindakLanjut}`].filter(Boolean).join(" — ") });
  for (const m of p.mutasi) b.push({ t: m.tanggal, jenis: "Mutasi", warna: W.kuning, judul: `Pindah dari ${m.dariNama} ke ${m.keNama}`, isi: m.alasan });
  if (p.nilaiIndustriPada) b.push({ t: p.nilaiIndustriPada, jenis: "Nilai", warna: W.hijau, judul: `Dinilai pembimbing industri: ${p.nilaiIndustriRata ?? "—"}`, isi: p.penilaiIndustri });
  if (p.laporanAkhirPada) b.push({ t: p.laporanAkhirPada, jenis: "Laporan akhir", warna: W.biru, judul: `Laporan akhir dikirim (${(p.laporanAkhirStatus ?? "DIKIRIM").toLowerCase()})` });
  if (p.umpanBalikPada) b.push({ t: p.umpanBalikPada, jenis: "Umpan balik", warna: W.abu, judul: "Siswa menilai tempat PKL-nya" });
  if (p.dijemputPada) b.push({ t: p.dijemputPada, jenis: "Penjemputan", warna: W.biru, judul: "Dijemput dari tempat PKL", isi: p.dijemputOleh && `oleh ${p.dijemputOleh}` });
  if (p.sertifikatPada) b.push({ t: p.sertifikatPada, jenis: "Sertifikat", warna: W.hijau, judul: `Sertifikat terbit ${p.sertifikatNomor ?? ""}` });
  const kini = new Date();
  if (p.endDate <= kini) b.push({ t: p.endDate, jenis: "Selesai", warna: W.biru, judul: "Masa PKL berakhir" });
  b.sort((x, y) => y.t.getTime() - x.t.getTime());
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Route size={22} />} title={p.student.user.name} description={`${p.student.class?.name ?? "—"} · ${p.company} · ${STATUS_PKL[p.status]?.label ?? p.status}`} />
      <BarisKembali />
      <div className="space-y-6">
        <div className="kisi-kartu kisi-kartu-4">
          <StatTile value={p._count.journal} label="Jurnal ditulis" ikon="jurnal" color="primary" />
          <StatTile value={p.monitoring.length} label="Kali dimonitor" ikon="absensi" color="emerald" />
          <StatTile value={p.presensi.length} label="Hari tidak hadir" ikon="alpha" color="amber" />
          <StatTile value={p.nilaiAkhirRata ?? p.nilaiIndustriRata ?? "—"} label={p.nilaiAkhirRata != null ? "Nilai akhir" : "Nilai industri"} ikon="prestasi" color="purple" />
        </div>
        <div className="panel p-5 text-sm text-gray-600">
          <p><span className="font-medium text-primary-900">Masa PKL:</span> {tglPkl(p.startDate)} – {tglPkl(p.endDate)}{p.position && p.position !== "—" ? ` · ${p.position}` : ""}</p>
          <p className="mt-1"><span className="font-medium text-primary-900">Guru pembimbing:</span> {p.teacher?.user.name ?? "belum ditetapkan"} · NIS {p.student.nis}</p>
        </div>
        <div className="panel overflow-hidden">
          <div className="panel-kepala"><p className="panel-judul">Linimasa</p><span className="text-xs text-gray-400">terbaru di atas</span></div>
          <ol className="divide-y divide-gray-100">
            {b.map((x, i) => (
              <li key={i} className="flex flex-wrap items-start gap-x-3 gap-y-1 px-5 py-3 text-sm">
                <span className="angka w-28 shrink-0 text-gray-500">{x.t.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" })}</span>
                <span className={`status-badge shrink-0 ${x.warna}`}>{x.jenis}</span>
                <span className="min-w-0 flex-1 text-gray-700">{x.judul}{x.isi && <span className="mt-0.5 block whitespace-pre-line text-xs text-gray-500">{x.isi}</span>}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
