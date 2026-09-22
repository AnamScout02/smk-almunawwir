export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft, BookUser } from "lucide-react";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";
import { getSettings, getPrincipalName } from "@/lib/site-settings";
import PageHeader from "@/components/admin/PageHeader";
import PrintButton from "@/components/shared/PrintButton";
import PrintKop from "@/components/shared/PrintKop";

const CATEGORY_LABEL: Record<string, string> = {
  DINAS: "Dinas/Instansi", WALI_MURID: "Wali Murid", VENDOR: "Vendor", UMUM: "Umum", LAINNYA: "Lainnya",
};

/** Rekap Buku Tamu per bulan — `?month=YYYY-MM` (default bulan berjalan). */
export default async function CetakBukuTamuPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await verifyTasAccess();
  const { month } = await searchParams;
  const mm = month && /^\d{4}-\d{2}$/.test(month) ? month : new Date().toLocaleDateString("sv-SE").slice(0, 7);
  const [y, m] = mm.split("-").map(Number);

  const [entries, settings] = await Promise.all([
    prisma.guestBookEntry.findMany({
      where: { visitDate: { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) } },
      include: { student: { select: { nis: true, user: { select: { name: true } }, class: { select: { name: true } } } } },
      orderBy: [{ visitDate: "asc" }, { createdAt: "asc" }],
    }),
    getSettings(["logo.full_white", "school.structure"]),
  ]);

  const principalName = getPrincipalName(settings["school.structure"]);
  const monthLabel = new Date(y, m - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  const th = "border border-gray-800 bg-primary-900 text-white px-2 py-1.5 text-center align-middle";
  const td = "border border-gray-800 px-2 py-1 align-middle";

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0 min-h-screen print:min-h-0 bg-white">
      <style>{"@page { size: A4 landscape; margin: 1.2cm; }"}</style>

      <PageHeader icon={<BookUser size={22} />} title="Cetak Rekap Buku Tamu" description={monthLabel} printHidden />

      <div className="flex items-center gap-2 mb-5 print:hidden">
        <Link href="/dashboard/admin/buku-tamu" className="btn-modal-cancel">
          <ArrowLeft size={18} /> Kembali
        </Link>
        <PrintButton />
      </div>

      <div className="print-doc bg-white">
        <PrintKop title="Buku Tamu" subtitle={`Rekapitulasi Kunjungan — ${monthLabel}`} logoUrl={settings["logo.full_white"]} />

        <table className="w-full border-collapse text-[11px] mb-6" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "4%" }} /><col style={{ width: "9%" }} /><col style={{ width: "8%" }} />
            <col style={{ width: "16%" }} /><col style={{ width: "10%" }} /><col style={{ width: "16%" }} />
            <col style={{ width: "21%" }} /><col style={{ width: "12%" }} /><col style={{ width: "4%" }} />
          </colgroup>
          <thead>
            <tr>
              <th className={th}>No</th><th className={th}>Tanggal</th><th className={th}>Jam</th>
              <th className={th}>Nama Tamu</th><th className={th}>Kategori</th>
              <th className={th}>Asal / Siswa Terkait</th><th className={th}>Keperluan</th>
              <th className={th}>Ditemui</th><th className={th}>TTD</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr><td className={`${td} text-center`} colSpan={9}>Belum ada kunjungan pada bulan ini.</td></tr>
            ) : entries.map((e, i) => (
              <tr key={e.id}>
                <td className={`${td} text-center`}>{i + 1}</td>
                <td className={`${td} text-center whitespace-nowrap`}>
                  {new Date(e.visitDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}
                </td>
                <td className={`${td} text-center whitespace-nowrap`}>{e.timeIn || "—"}{e.timeOut ? `–${e.timeOut}` : ""}</td>
                <td className={td}>{e.guestName}</td>
                <td className={`${td} text-center`}>{CATEGORY_LABEL[e.category] ?? e.category}</td>
                <td className={td}>
                  {e.student ? `${e.student.user.name} (${e.student.class?.name ?? "—"})` : (e.institution || "—")}
                </td>
                <td className={td}>{e.purpose}</td>
                <td className={td}>{e.metWith || "—"}</td>
                <td className={td}></td>
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
