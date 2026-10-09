export const dynamic = "force-dynamic";

import { Briefcase } from "lucide-react";
import { verifyRole } from "@/lib/dal";
import { getParentChildrenOrRedirect, resolveSelectedChild } from "@/lib/parent-guard";
import { hariPkl, pantauPklSiswa } from "@/lib/pkl-harian";
import { penempatanBelumPasti } from "@/lib/pkl-tempat";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";

export const metadata = { title: "PKL Anak — Portal Orang Tua" };

const WARNA: Record<string, string> = {
  HADIR: "bg-emerald-50 text-emerald-700 border-emerald-200", IZIN: "bg-blue-50 text-blue-700 border-blue-200",
  SAKIT: "bg-amber-50 text-amber-700 border-amber-200", ALPHA: "bg-red-50 text-red-600 border-red-200",
};
const tgl = (d: Date, z = "UTC") => d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: z });
const jam = (d: Date | null) => (d ? d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) : "—");

/** PANTAUAN PKL UNTUK ORANG TUA (9 Okt 2026) — hanya BACA: tempat, masa, guru pembimbing, kehadiran, dan jurnal terbaru anak. */
export default async function Page({ searchParams }: { searchParams: Promise<{ studentId?: string }> }) {
  const session = await verifyRole(["PARENT"]);
  const { studentId } = await searchParams;
  const child = resolveSelectedChild(await getParentChildrenOrRedirect(session), studentId);
  const p = await pantauPklSiswa(child.id);
  const judul = <PageHeader icon={<Briefcase size={22} />} title="PKL Anak" description={`Praktik Kerja Lapangan — ${child.user.name}`} />;
  if (!p || p.status === "CANCELLED") return <div className="p-6 lg:p-8 pt-16 lg:pt-8">{judul}<p className="py-10 text-center text-sm text-gray-400">{child.user.name} belum terdaftar sebagai peserta PKL.</p></div>;
  const belum = !p.mitraId && penempatanBelumPasti(p.company);
  const hari = hariPkl();
  const total = Math.max(1, p.endDate.getTime() - p.startDate.getTime()), lewat = Math.min(total, Math.max(0, hari.getTime() - p.startDate.getTime()));
  const persen = p.status === "COMPLETED" ? 100 : Math.round((lewat / total) * 100);
  const n = (s: string) => p.presensi.filter(x => x.status === s).length;
  const keadaan = p.status === "COMPLETED" ? "Selesai" : belum ? "Menunggu penempatan" : hari < p.startDate ? "Belum mulai" : hari > p.endDate ? "Masa PKL habis" : "Sedang PKL";
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      {judul}
      <div className="space-y-6">
        <div className="kisi-kartu kisi-kartu-4">
          <StatTile value={n("HADIR")} label="Hadir (30 hari)" ikon="hadir" color="emerald" />
          <StatTile value={n("IZIN") + n("SAKIT")} label="Izin & sakit (30 hari)" ikon="izin" color="blue" />
          <StatTile value={n("ALPHA")} label="Alpha (30 hari)" ikon="alpha" color="red" sorot={n("ALPHA") > 0} />
          <StatTile value={p._count.journal} label="Jurnal ditulis" ikon="jurnal" color="primary" />
        </div>
        <div className="panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="panel-judul">{belum ? "Tempat PKL belum ditetapkan" : p.company}</p>
            <span className="status-badge bg-primary-50 text-primary-700 border-primary-100">{keadaan}</span>
          </div>
          {belum ? <p className="mt-2 text-sm text-gray-500">Sekolah sedang menyiapkan penempatan. Halaman ini terisi begitu tempat PKL ditetapkan.</p> : (
            <>
              <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <div><dt className="text-xs text-gray-400">Masa PKL</dt><dd className="font-medium text-primary-900">{tgl(p.startDate)} – {tgl(p.endDate)}</dd></div>
                <div><dt className="text-xs text-gray-400">Guru pembimbing</dt><dd className="font-medium text-primary-900">{p.teacher?.user.name ?? "Belum ditetapkan"}</dd></div>
                {p.mitra?.address && <div className="sm:col-span-2"><dt className="text-xs text-gray-400">Alamat</dt><dd className="font-medium text-primary-900">{p.mitra.address}{p.mitra.kecamatan ? `, ${p.mitra.kecamatan}` : ""}</dd></div>}
                {p.mitra?.jamKerja && <div><dt className="text-xs text-gray-400">Jam kerja</dt><dd className="font-medium text-primary-900">{p.mitra.jamKerja}</dd></div>}
                <div><dt className="text-xs text-gray-400">Kunjungan guru</dt><dd className="font-medium text-primary-900">{p._count.monitoring ? `${p._count.monitoring} kali, terakhir ${tgl(p.monitoring[0].tanggal, "Asia/Jakarta")}` : "Belum ada"}</dd></div>
              </dl>
              <div className="mt-4 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${persen}%` }} /></div>
                <span className="angka text-sm text-gray-600">{persen}% masa PKL</span>
              </div>
            </>
          )}
        </div>
        {!belum && (
          <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
            <div className="panel min-w-0 overflow-hidden xl:col-span-5">
              <div className="panel-kepala"><p className="panel-judul">Kehadiran terbaru</p></div>
              {p.presensi.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">Belum ada catatan kehadiran.</p> : (
                <ul className="divide-y divide-gray-100">
                  {p.presensi.slice(0, 10).map(x => (
                    <li key={x.tanggal.toISOString()} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                      <span className="angka min-w-0 flex-1 text-gray-700">{x.tanggal.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}</span>
                      {x.status === "HADIR" && <span className="angka text-xs text-gray-400">{jam(x.jamMasuk)}–{jam(x.jamPulang)}</span>}
                      <span className={`status-badge ${WARNA[x.status] ?? ""}`}>{x.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="panel min-w-0 overflow-hidden xl:col-span-7">
              <div className="panel-kepala"><p className="panel-judul">Jurnal kegiatan terbaru</p></div>
              {p.journal.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">Belum ada jurnal yang ditulis.</p> : (
                <ul className="divide-y divide-gray-100">
                  {p.journal.map(j => (
                    <li key={j.id} className="px-5 py-3 text-sm">
                      <p className="angka text-xs text-gray-400">{tgl(j.date)}{j.parafIndustriAt ? " · diparaf pembimbing industri" : ""}</p>
                      <p className="mt-0.5 whitespace-pre-line text-gray-700">{j.activity}</p>
                      {j.teacherNote && <p className="mt-1.5 rounded-lg bg-primary-50 px-3 py-2 text-xs text-primary-700"><span className="font-semibold">Catatan guru:</span> {j.teacherNote}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
