export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft, Stamp } from "lucide-react";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";
import { getSettings, getPrincipalName } from "@/lib/site-settings";
import PageHeader from "@/components/admin/PageHeader";
import PrintButton from "@/components/shared/PrintButton";
import PrintKop from "@/components/shared/PrintKop";
import GambarTtd from "@/components/shared/GambarTtd";
import { ttdDariNama } from "@/lib/ttd";

const DOC_LABEL: Record<string, string> = {
  IJAZAH: "Ijazah", SKHUN: "SKHUN", RAPOR: "Rapor", SKL: "Surat Ket. Lulus", LAINNYA: "Lainnya",
};
const STATUS_LABEL: Record<string, string> = {
  DIPROSES: "Diproses", SELESAI: "Siap Diambil", DIAMBIL: "Sudah Diambil",
};

/** Rekap permintaan legalisir per bulan — `?month=YYYY-MM` (default bulan berjalan). */
export default async function CetakLegalisirPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await verifyTasAccess();
  const { month } = await searchParams;
  const mm = month && /^\d{4}-\d{2}$/.test(month) ? month : new Date().toLocaleDateString("sv-SE").slice(0, 7);
  const [y, m] = mm.split("-").map(Number);

  const [rows, settings] = await Promise.all([
    prisma.legalisirRequest.findMany({
      where: { requestDate: { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) } },
      include: { student: { select: { nis: true, enrollYear: true, user: { select: { name: true } }, major: { select: { code: true } } } } },
      orderBy: [{ requestDate: "asc" }, { createdAt: "asc" }],
    }),
    getSettings(["logo.full_white", "school.structure"]),
  ]);

  const principalName = getPrincipalName(settings["school.structure"]);

  const ttdKepala = await ttdDariNama(principalName); // TTD pribadi Kepala Sekolah (src/lib/ttd.ts)
  const monthLabel = new Date(y, m - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  const totalLembar = rows.reduce((a, r) => a + r.copies, 0);

  const th = "border border-gray-800 bg-primary-900 text-white px-2 py-1.5 text-center align-middle";
  const td = "border border-gray-800 px-2 py-1 align-middle";

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0 min-h-dvh print:min-h-0 bg-white">
      <style>{"@page { size: A4 landscape; margin: 1.2cm; }"}</style>

      <PageHeader icon={<Stamp size={22} />} title="Cetak Rekap Legalisir" description={monthLabel} printHidden />

      <div className="flex items-center gap-2 mb-5 print:hidden">
        <Link href="/dashboard/admin/legalisir" className="btn-modal-cancel">
          <ArrowLeft size={18} /> Kembali
        </Link>
        <PrintButton />
      </div>

      <div className="print-doc bg-white">
        <PrintKop title="Buku Legalisir Dokumen" subtitle={`Rekapitulasi Permintaan Legalisir — ${monthLabel}`} logoUrl={settings["logo.full_white"]} />

        <table className="w-full border-collapse text-[11px] mb-6" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "4%" }} /><col style={{ width: "9%" }} /><col style={{ width: "15%" }} />
            <col style={{ width: "14%" }} /><col style={{ width: "9%" }} /><col style={{ width: "16%" }} />
            <col style={{ width: "6%" }} /><col style={{ width: "15%" }} /><col style={{ width: "12%" }} />
          </colgroup>
          <thead>
            <tr>
              <th className={th}>No</th><th className={th}>Tanggal</th><th className={th}>Nama Pemohon</th>
              <th className={th}>Siswa/Alumni</th><th className={th}>Dokumen</th><th className={th}>No. Dokumen</th>
              <th className={th}>Rangkap</th><th className={th}>Keperluan</th><th className={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td className={`${td} text-center`} colSpan={9}>Belum ada permintaan legalisir pada bulan ini.</td></tr>
            ) : rows.map((r, i) => (
              <tr key={r.id}>
                <td className={`${td} text-center`}>{i + 1}</td>
                <td className={`${td} text-center whitespace-nowrap`}>
                  {new Date(r.requestDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}
                </td>
                <td className={td}>{r.applicantName}</td>
                <td className={td}>
                  {r.student ? `${r.student.user.name}${r.student.enrollYear ? ` (${r.student.enrollYear})` : ""}` : "—"}
                </td>
                <td className={`${td} text-center`}>{DOC_LABEL[r.documentType] ?? r.documentType}</td>
                <td className={`${td} break-words`}>{r.documentNo || "—"}</td>
                <td className={`${td} text-center`}>{r.copies}</td>
                <td className={td}>{r.purpose}</td>
                <td className={`${td} text-center`}>
                  {STATUS_LABEL[r.status] ?? r.status}
                  {r.pickupDate ? ` (${new Date(r.pickupDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })})` : ""}
                </td>
              </tr>
            ))}
            {rows.length > 0 && (
              <tr className="font-semibold">
                <td className={`${td} text-center`} colSpan={6}>JUMLAH</td>
                <td className={`${td} text-center`}>{totalLembar}</td>
                <td className={td} colSpan={2}>{rows.length} permintaan</td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="text-xs text-right pr-8" style={{ breakInside: "avoid" }}>
          <p>Banyuwangi, {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
          <p className="font-semibold">Kepala SMK Al Munawwir IIBS</p>
          <GambarTtd src={ttdKepala} tinggi={40} />
          <p className="font-semibold underline">{principalName || "( _____________ )"}</p>
        </div>
      </div>
    </div>
  );
}
