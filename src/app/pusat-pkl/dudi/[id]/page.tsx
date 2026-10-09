export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import { History } from "lucide-react";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import { BarisKembali } from "@/components/shared/TombolKembali";
import { labelTa, tahunAjaranPkl } from "@/lib/pkl-arsip";
import { JENIS_LAPORAN, STATUS_PKL, keadaanMou, tglPkl } from "@/lib/pkl-label";

export const metadata = { title: "Riwayat DUDI" };
const rata = (a: number[]) => (a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : null);

/** RIWAYAT PER MITRA (9 Okt 2026) — semua siswa yang pernah PKL di satu DUDI (termasuk yang sudah lulus dan yang kemudian
 *  pindah lewat Mutasi), per tahun ajaran, dengan nilai, masalah, dan umpan balik siswa. Akses dijaga layout Pusat PKL. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await prisma.industryPartner.findUnique({ where: { id }, select: { id: true, name: true, industryField: true, kecamatan: true, kabupaten: true, quota: true, mouStartDate: true, mouEndDate: true, aktif: true, contactPerson: true } });
  if (!d) notFound();
  const [pkl, keluar] = await Promise.all([
    prisma.internship.findMany({
      where: { mitraId: id }, orderBy: [{ startDate: "desc" }, { student: { user: { name: "asc" } } }],
      select: {
        id: true, startDate: true, endDate: true, status: true, nilaiIndustriRata: true, nilaiAkhirRata: true, umpanBalik: true,
        student: { select: { studentStatus: true, user: { select: { name: true } }, class: { select: { name: true } }, major: { select: { code: true } } } },
        teacher: { select: { user: { select: { name: true } } } },
        laporanMasalah: { select: { jenis: true, status: true, createdAt: true } },
        _count: { select: { journal: true, monitoring: true } },
      },
    }),
    prisma.mutasiPkl.findMany({ where: { dariMitraId: id }, orderBy: { tanggal: "desc" }, select: { id: true, tanggal: true, keNama: true, alasan: true, internship: { select: { student: { select: { user: { select: { name: true } } } } } } } }),
  ]);
  const umpan = pkl.map(p => p.umpanBalik as { bintang?: number; saran?: string; rekomendasi?: boolean } | null).filter((x): x is { bintang: number; saran?: string; rekomendasi?: boolean } => !!x && typeof x.bintang === "number");
  const masalah = pkl.flatMap(p => p.laporanMasalah);
  const perTa = new Map<number, typeof pkl>(); for (const p of pkl) { const t = tahunAjaranPkl(p.startDate); perTa.set(t, [...(perTa.get(t) ?? []), p]); }
  const mou = keadaanMou(d.mouEndDate);
  const jenisMasalah = new Map<string, number>(); for (const m of masalah) jenisMasalah.set(m.jenis, (jenisMasalah.get(m.jenis) ?? 0) + 1);
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<History size={22} />} title={`Riwayat ${d.name}`} description={[d.industryField, [d.kecamatan, d.kabupaten].filter(Boolean).join(", "), d.aktif ? null : "nonaktif"].filter(Boolean).join(" · ") || "Riwayat kerja sama PKL"} />
      <BarisKembali href="/pusat-pkl/dudi" />
      <div className="space-y-6">
        <div className="kisi-kartu kisi-kartu-5">
          <StatTile value={pkl.length} label="Siswa pernah PKL di sini" ikon="siswa" color="primary" />
          <StatTile value={perTa.size} label="Tahun ajaran bekerja sama" ikon="kalender" color="blue" />
          <StatTile value={rata(pkl.flatMap(p => (p.nilaiIndustriRata != null ? [p.nilaiIndustriRata] : []))) ?? "—"} label="Rata-rata nilai industri" ikon="prestasi" color="emerald" />
          <StatTile value={umpan.length ? `${rata(umpan.map(u => u.bintang))} / 5` : "—"} label={`Penilaian siswa (${umpan.length})`} ikon="tren" color="purple" />
          <StatTile value={masalah.length + keluar.length} label="Masalah & pindah keluar" ikon="peringatan" color="amber" />
        </div>
        <div className="panel p-5 text-sm text-gray-600">
          <p><span className="font-medium text-primary-900">MoU:</span> {d.mouEndDate ? `${tglPkl(d.mouStartDate)} – ${tglPkl(d.mouEndDate)}` : "belum dicatat"} <span className={`status-badge ml-1 ${mou.kelas}`}>{mou.label}</span></p>
          <p className="mt-1"><span className="font-medium text-primary-900">Kuota:</span> {d.quota ?? "belum diisi"}{d.contactPerson ? ` · Narahubung: ${d.contactPerson}` : ""}</p>
          {jenisMasalah.size > 0 && <p className="mt-1"><span className="font-medium text-primary-900">Masalah yang dilaporkan:</span> {[...jenisMasalah].map(([j, n]) => `${JENIS_LAPORAN[j] ?? j} (${n})`).join(", ")}</p>}
        </div>
        {pkl.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">Belum pernah ada siswa PKL di DUDI ini.</p> : [...perTa].sort((a, b) => b[0] - a[0]).map(([ta, baris]) => (
          <div key={ta} className="panel overflow-hidden">
            <div className="panel-kepala"><p className="panel-judul">Tahun ajaran {labelTa(ta)}</p><span className="text-xs text-gray-400">{baris.length} siswa</span></div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th className="w-10">No</th><th>Siswa</th><th>Masa</th><th>Guru pembimbing</th><th>Status</th><th className="text-right">Jurnal</th><th className="text-right">Nilai industri</th><th className="text-right">Nilai akhir</th></tr></thead>
                <tbody>{baris.map((p, i) => (
                  <tr key={p.id}>
                    <td className="angka">{i + 1}</td>
                    <td><span className="font-medium text-primary-900">{p.student.user.name}</span><span className="block text-xs text-gray-400">{p.student.class?.name ?? p.student.major?.code ?? "—"}{p.student.studentStatus && p.student.studentStatus !== "AKTIF" ? ` · ${p.student.studentStatus.toLowerCase()}` : ""}</span></td>
                    <td className="whitespace-nowrap text-gray-600">{tglPkl(p.startDate)} – {tglPkl(p.endDate)}</td>
                    <td className="text-gray-600">{p.teacher?.user.name ?? "—"}</td>
                    <td><span className={`status-badge ${STATUS_PKL[p.status]?.kelas ?? ""}`}>{STATUS_PKL[p.status]?.label ?? p.status}</span></td>
                    <td className="angka text-right">{p._count.journal}</td>
                    <td className="angka text-right">{p.nilaiIndustriRata ?? "—"}</td>
                    <td className="angka text-right">{p.nilaiAkhirRata ?? "—"}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        ))}
        {keluar.length > 0 && (
          <div className="panel overflow-hidden">
            <div className="panel-kepala"><p className="panel-judul">Siswa yang pindah dari DUDI ini</p></div>
            <ul className="divide-y divide-gray-100">{keluar.map(m => <li key={m.id} className="px-5 py-3 text-sm"><p className="text-gray-700"><span className="font-medium text-primary-900">{m.internship.student.user.name}</span> pindah ke {m.keNama} <span className="angka text-xs text-gray-400">· {tglPkl(m.tanggal)}</span></p><p className="mt-0.5 text-gray-500">{m.alasan}</p></li>)}</ul>
          </div>
        )}
        {umpan.some(u => u.saran) && (
          <div className="panel overflow-hidden">
            <div className="panel-kepala"><p className="panel-judul">Cerita & saran siswa</p><span className="text-xs text-gray-400">tanpa nama</span></div>
            <ul className="divide-y divide-gray-100">{umpan.filter(u => u.saran).map((u, i) => <li key={i} className="px-5 py-3 text-sm text-gray-600"><span className="angka mr-2 font-semibold text-amber-600">{u.bintang}/5</span>{u.saran}</li>)}</ul>
          </div>
        )}
      </div>
    </div>
  );
}
