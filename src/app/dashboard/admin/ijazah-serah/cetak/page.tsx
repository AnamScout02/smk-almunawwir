export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft, GraduationCap } from "lucide-react";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";
import { getSettings, getPrincipalName } from "@/lib/site-settings";
import PageHeader from "@/components/admin/PageHeader";
import PrintButton from "@/components/shared/PrintButton";
import PrintKop from "@/components/shared/PrintKop";
import { DOKUMEN_IJAZAH, PENGAMBIL_IJAZAH, labelOf } from "@/lib/tu-konstanta";

/** Buku Penyerahan Ijazah per tahun — `?year=YYYY` (default tahun berjalan).
 * Kolom tanda tangan dibiarkan kosong: buku ini ditandatangani basah oleh pengambil saat
 * dokumen diserahkan, dan itulah bukti yang dicari asesor akreditasi. */
export default async function CetakIjazahSerahPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  await verifyTasAccess();
  const { year } = await searchParams;
  const y = year && /^\d{4}$/.test(year) ? Number(year) : new Date().getFullYear();

  const [rows, settings] = await Promise.all([
    prisma.ijazahHandover.findMany({
      where: { tanggalSerah: { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) } },
      include: {
        student: {
          select: {
            nis: true, nisn: true, enrollYear: true,
            user: { select: { name: true } }, major: { select: { code: true } },
          },
        },
      },
      orderBy: [{ tanggalSerah: "asc" }, { createdAt: "asc" }],
    }),
    getSettings(["logo.full_white", "school.structure"]),
  ]);

  const principalName = getPrincipalName(settings["school.structure"]);
  const th = "border border-gray-800 bg-primary-900 text-white px-2 py-1.5 text-center align-middle";
  const td = "border border-gray-800 px-2 py-1 align-middle";

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0 min-h-dvh print:min-h-0 bg-white">
      <style>{"@page { size: A4 landscape; margin: 1.2cm; }"}</style>

      <PageHeader icon={<GraduationCap size={22} />} title="Cetak Buku Penyerahan Ijazah" description={`Tahun ${y}`} printHidden />

      <div className="flex items-center gap-2 mb-5 print:hidden">
        <Link href="/dashboard/admin/ijazah-serah"
          className="btn-modal-cancel">
          <ArrowLeft size={18} /> Kembali
        </Link>
        <PrintButton />
      </div>

      <div className="print-doc bg-white">
        <PrintKop title="Buku Penyerahan Ijazah &amp; SKHUN" subtitle={`Tahun ${y} — ${rows.length} penyerahan`} logoUrl={settings["logo.full_white"]} />

        <table className="w-full border-collapse text-[11px] mb-6" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "4%" }} /><col style={{ width: "8%" }} /><col style={{ width: "17%" }} />
            <col style={{ width: "10%" }} /><col style={{ width: "13%" }} /><col style={{ width: "13%" }} />
            <col style={{ width: "16%" }} /><col style={{ width: "19%" }} />
          </colgroup>
          <thead>
            <tr>
              <th className={th}>No</th><th className={th}>Tanggal</th><th className={th}>Nama Alumni</th>
              <th className={th}>Angkatan</th><th className={th}>Dokumen</th><th className={th}>No. Ijazah</th>
              <th className={th}>Diambil Oleh</th><th className={th}>Tanda Tangan</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td className={`${td} text-center`} colSpan={8}>Belum ada penyerahan pada tahun {y}.</td></tr>
            ) : rows.map((r, i) => (
              <tr key={r.id}>
                <td className={`${td} text-center`}>{i + 1}</td>
                <td className={`${td} text-center whitespace-nowrap`}>
                  {new Date(r.tanggalSerah).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}
                </td>
                <td className={td}>
                  {r.student.user.name}
                  <span className="block text-[9px] text-gray-500">{r.student.nis}</span>
                </td>
                <td className={`${td} text-center`}>
                  {r.student.enrollYear ?? "—"}
                  <span className="block text-[9px] text-gray-500">{r.student.major.code}</span>
                </td>
                <td className={`${td} text-[10px]`}>{r.dokumen.map(d => labelOf(DOKUMEN_IJAZAH, d)).join(", ")}</td>
                <td className={`${td} break-words text-[10px]`}>{r.nomorIjazah || "—"}</td>
                <td className={td}>
                  {r.pengambilNama}
                  <span className="block text-[9px] text-gray-500">
                    {labelOf(PENGAMBIL_IJAZAH, r.diambilOleh)}
                    {r.pengambilHubungan ? ` · ${r.pengambilHubungan}` : ""}
                    {r.pengambilNik ? ` · NIK ${r.pengambilNik}` : ""}
                  </span>
                </td>
                {/* Sengaja kosong — ditandatangani basah oleh pengambil di hadapan petugas TU. */}
                <td className={td} style={{ height: "1.2cm" }}></td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="text-xs text-right pr-8" style={{ breakInside: "avoid" }}>
          <p>Banyuwangi, {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
          <p className="font-semibold">Kepala SMK Al Munawwir IIBS</p>
          <div className="h-10" />
          <p className="font-semibold underline">{principalName || "( _____________ )"}</p>
        </div>
      </div>
    </div>
  );
}
