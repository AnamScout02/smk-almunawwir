export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";
import { getSettings, getPrincipalName } from "@/lib/site-settings";
import PageHeader from "@/components/admin/PageHeader";
import PrintButton from "@/components/shared/PrintButton";
import PrintKop from "@/components/shared/PrintKop";
import { JENIS_AGENDA, labelOf } from "@/lib/tu-konstanta";

const dotOf = (j: string) => JENIS_AGENDA.find(x => x.value === j)?.dot ?? "#9ca3af";

/** Kalender Pendidikan siap cetak — dikelompokkan per bulan, disertai rekap hari efektif. */
export default async function CetakKalenderPendidikanPage({ searchParams }: { searchParams: Promise<{ academicYearId?: string }> }) {
  await verifyTasAccess();
  const { academicYearId } = await searchParams;

  const [rows, tahun, settings] = await Promise.all([
    prisma.schoolEvent.findMany({
      where: academicYearId ? { academicYearId } : {},
      orderBy: { tanggalMulai: "asc" },
    }),
    academicYearId
      ? prisma.academicYear.findUnique({ where: { id: academicYearId }, select: { name: true } })
      : prisma.academicYear.findFirst({ where: { isActive: true }, select: { name: true } }),
    getSettings(["logo.full_white", "school.structure"]),
  ]);

  const principalName = getPrincipalName(settings["school.structure"]);

  const perBulan = new Map<string, typeof rows>();
  for (const a of rows) {
    const d = new Date(a.tanggalMulai);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    if (!perBulan.has(key)) perBulan.set(key, []);
    perBulan.get(key)!.push(a);
  }
  const bulanUrut = [...perBulan.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  const hariEfektif = rows.reduce((t, a) => {
    if (!a.hariEfektif) return t;
    const ms = new Date(a.tanggalSelesai).getTime() - new Date(a.tanggalMulai).getTime();
    return t + Math.max(1, Math.round(ms / 86400000) + 1);
  }, 0);

  const tgl = (d: Date) => new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "UTC" });
  const rentang = (a: { tanggalMulai: Date; tanggalSelesai: Date }) =>
    new Date(a.tanggalMulai).getTime() === new Date(a.tanggalSelesai).getTime()
      ? tgl(a.tanggalMulai) : `${tgl(a.tanggalMulai)} – ${tgl(a.tanggalSelesai)}`;
  const namaBulan = (k: string) => {
    const [y, m] = k.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "UTC" });
  };

  const th = "border border-gray-800 bg-primary-900 text-white px-2 py-1 text-center align-middle text-[10px]";
  const td = "border border-gray-800 px-2 py-1 align-middle text-[10px]";

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0 min-h-dvh print:min-h-0 bg-white">
      {/* MENDATAR: kalender pendidikan berisi belasan tabel bulanan berdampingan — di A4 potret
          kolom "Kegiatan" jadi sempit sehingga judul agenda terpotong jadi dua-tiga baris dan
          tabelnya terlihat berantakan (permintaan user 13 September 2026). Mendatar memuat TIGA
          bulan sebaris dengan lebar kolom yang lega.
          Margin dipasang sebagai padding wadah, bukan di @page — dropdown "Margins" di dialog
          cetak Chrome mengalahkan @page (lihat catatan sama di Buku Mutasi & Rekap Siswa). */}
      <style>{"@media print { @page { size: A4 landscape; margin: 0; } .lembar-kalender { padding: 1.2cm; } }"}</style>

      <PageHeader icon={<CalendarDays size={22} />} title="Cetak Kalender Pendidikan"
        description={tahun?.name ?? "Semua tahun ajaran"} printHidden />

      <div className="flex items-center gap-2 mb-5 print:hidden">
        <Link href="/dashboard/admin/kalender-pendidikan"
          className="btn-modal-cancel">
          <ArrowLeft size={18} /> Kembali
        </Link>
        <PrintButton />
      </div>

      <div className="print-doc lembar-kalender bg-white">
        <PrintKop title="Kalender Pendidikan"
          subtitle={`Tahun Pelajaran ${tahun?.name ?? "—"} — ${rows.length} agenda, ${hariEfektif} hari efektif`}
          logoUrl={settings["logo.full_white"]} />

        {bulanUrut.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center">Belum ada agenda yang tercatat.</p>
        ) : (
          <div className="grid grid-cols-2 print:grid-cols-3 gap-x-5 gap-y-3">
            {bulanUrut.map(([key, items]) => (
              // break-inside dihindari per-bulan (bukan per-tabel besar) supaya satu bulan tidak
              // terpotong di tengah, tapi halaman tetap boleh mengalir wajar ke lembar berikutnya.
              <div key={key} style={{ breakInside: "avoid" }}>
                <p className="text-[11px] font-bold uppercase tracking-wide text-primary-900 mb-1">{namaBulan(key)}</p>
                <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
                  <colgroup>
                    <col style={{ width: "26%" }} /><col style={{ width: "52%" }} /><col style={{ width: "22%" }} />
                  </colgroup>
                  <thead>
                    <tr><th className={th}>Tanggal</th><th className={th}>Kegiatan</th><th className={th}>Jenis</th></tr>
                  </thead>
                  <tbody>
                    {items.map(a => (
                      <tr key={a.id}>
                        <td className={`${td} text-center whitespace-nowrap`}>{rentang(a)}</td>
                        <td className={td}>
                          <span className="inline-flex items-baseline gap-1.5">
                            <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: dotOf(a.jenis) }} />
                            <span>{a.judul}</span>
                          </span>
                          {a.keterangan ? <span className="block text-[9px] text-gray-500 ml-3">{a.keterangan}</span> : null}
                        </td>
                        <td className={`${td} text-center`}>{labelOf(JENIS_AGENDA, a.jenis)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

        <div className="text-xs text-right pr-8 mt-8" style={{ breakInside: "avoid" }}>
          <p>Banyuwangi, {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
          <p className="font-semibold">Kepala SMK Al Munawwir IIBS</p>
          <div className="h-10" />
          <p className="font-semibold underline">{principalName || "( _____________ )"}</p>
        </div>
      </div>
    </div>
  );
}
