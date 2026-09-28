export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft, Send } from "lucide-react";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";
import { getSettings, getPrincipalName } from "@/lib/site-settings";
import PageHeader from "@/components/admin/PageHeader";
import PrintButton from "@/components/shared/PrintButton";
import PrintKop from "@/components/shared/PrintKop";
import { CARA_KIRIM, labelOf } from "@/lib/tu-konstanta";

/** Buku Ekspedisi per bulan — `?month=YYYY-MM` (default bulan berjalan).
 * Kolom "Tanda Tangan Penerima" sengaja dibiarkan kosong lebar: buku ini memang dibawa petugas
 * saat mengantar surat, lalu penerimanya tanda tangan langsung di kertas. */
export default async function CetakEkspedisiPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await verifyTasAccess();
  const { month } = await searchParams;
  const mm = month && /^\d{4}-\d{2}$/.test(month) ? month : new Date().toLocaleDateString("sv-SE").slice(0, 7);
  const [y, m] = mm.split("-").map(Number);

  const [rows, settings] = await Promise.all([
    prisma.ekspedisi.findMany({
      where: { tanggal: { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) } },
      orderBy: [{ tanggal: "asc" }, { createdAt: "asc" }],
    }),
    getSettings(["logo.full_white", "school.structure"]),
  ]);

  const principalName = getPrincipalName(settings["school.structure"]);
  const monthLabel = new Date(y, m - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  const totalBerkas = rows.reduce((a, r) => a + r.jumlah, 0);

  const th = "border border-gray-800 bg-primary-900 text-white px-2 py-1.5 text-center align-middle";
  const td = "border border-gray-800 px-2 py-1 align-middle";

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0 min-h-dvh print:min-h-0 bg-white">
      <style>{"@page { size: A4 landscape; margin: 1.2cm; }"}</style>

      <PageHeader icon={<Send size={22} />} title="Cetak Buku Ekspedisi" description={monthLabel} printHidden />

      <div className="flex items-center gap-2 mb-5 print:hidden">
        <Link href="/dashboard/admin/ekspedisi"
          className="btn-modal-cancel">
          <ArrowLeft size={18} /> Kembali
        </Link>
        <PrintButton />
      </div>

      <div className="print-doc bg-white">
        <PrintKop title="Buku Ekspedisi" subtitle={`Pengiriman Surat & Dokumen — ${monthLabel}`} logoUrl={settings["logo.full_white"]} />

        <table className="w-full border-collapse text-[11px] mb-6" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "4%" }} /><col style={{ width: "8%" }} /><col style={{ width: "15%" }} />
            <col style={{ width: "18%" }} /><col style={{ width: "16%" }} /><col style={{ width: "5%" }} />
            <col style={{ width: "9%" }} /><col style={{ width: "12%" }} /><col style={{ width: "13%" }} />
          </colgroup>
          <thead>
            <tr>
              <th className={th}>No</th><th className={th}>Tanggal</th><th className={th}>Nomor Surat</th>
              <th className={th}>Perihal</th><th className={th}>Dikirim Kepada</th><th className={th}>Jml</th>
              <th className={th}>Cara Kirim</th><th className={th}>Nama Penerima</th>
              <th className={th}>Tanda Tangan</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td className={`${td} text-center`} colSpan={9}>Belum ada pengiriman pada bulan ini.</td></tr>
            ) : rows.map((r, i) => (
              <tr key={r.id}>
                <td className={`${td} text-center`}>{i + 1}</td>
                <td className={`${td} text-center whitespace-nowrap`}>
                  {new Date(r.tanggal).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}
                </td>
                <td className={`${td} break-words`}>{r.nomorSurat || "—"}</td>
                <td className={td}>{r.perihal}</td>
                <td className={td}>
                  {r.tujuan}
                  {r.alamatTujuan ? <span className="block text-[9px] text-gray-500">{r.alamatTujuan}</span> : null}
                </td>
                <td className={`${td} text-center`}>{r.jumlah}</td>
                <td className={`${td} text-center`}>{labelOf(CARA_KIRIM, r.caraKirim)}</td>
                <td className={td}>
                  {r.penerimaNama || ""}
                  {r.penerimaJabatan ? <span className="block text-[9px] text-gray-500">{r.penerimaJabatan}</span> : null}
                </td>
                {/* Dibiarkan kosong — diisi tanda tangan basah oleh penerima saat dokumen diantar. */}
                <td className={td} style={{ height: "1.1cm" }}></td>
              </tr>
            ))}
            {rows.length > 0 && (
              <tr className="font-semibold">
                <td className={`${td} text-center`} colSpan={5}>JUMLAH</td>
                <td className={`${td} text-center`}>{totalBerkas}</td>
                <td className={td} colSpan={3}>{rows.length} pengiriman</td>
              </tr>
            )}
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
