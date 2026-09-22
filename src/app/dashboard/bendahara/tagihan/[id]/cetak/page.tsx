export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { verifyBendaharaLayoutAccess } from "@/lib/bendahara-guard";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { formatRupiah } from "@/lib/currency";
import PrintKop from "@/components/shared/PrintKop";
import PrintButton from "@/components/shared/PrintButton";

type Status = "LUNAS" | "BELUM_LUNAS" | "TERLAMBAT";
const STATUS_BADGE: Record<Status, string> = {
  LUNAS: "bg-emerald-50 text-emerald-700 border-emerald-200",
  BELUM_LUNAS: "bg-amber-50 text-amber-700 border-amber-200",
  TERLAMBAT: "bg-red-50 text-red-600 border-red-200",
};
const STATUS_LABEL: Record<Status, string> = { LUNAS: "Lunas", BELUM_LUNAS: "Belum Lunas", TERLAMBAT: "Terlambat" };

export default async function CetakKwitansiPage({ params }: { params: Promise<{ id: string }> }) {
  await verifyBendaharaLayoutAccess();
  const { id } = await params;

  const [invoice, settings] = await Promise.all([
    prisma.invoice.findUnique({
      where: { id },
      include: {
        student: { include: { user: { select: { name: true } }, class: { select: { name: true } } } },
        feeType: { select: { name: true } },
      },
    }),
    getSettings(["logo.full_white"]),
  ]);
  if (!invoice) notFound();

  const status: Status = invoice.paidAmount >= invoice.amount ? "LUNAS"
    : invoice.dueDate && invoice.dueDate < new Date() ? "TERLAMBAT" : "BELUM_LUNAS";
  const sisa = Math.max(0, invoice.amount - invoice.paidAmount);
  const today = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0">
      <style>{"@page { size: A4; margin: 1cm; }"}</style>

      <div className="flex items-center gap-2 mb-5 print:hidden">
        <Link href="/dashboard/bendahara/tagihan" className="btn-modal-cancel">
          <ArrowLeft size={18} /> Kembali
        </Link>
        <PrintButton />
      </div>

      <div className="print-doc bg-white max-w-3xl mx-auto">
        <PrintKop title="Kwitansi Tagihan" subtitle="SMK Al Munawwir IIBS" logoUrl={settings["logo.full_white"]} />

        <div className="px-8 pb-8">
          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            <div>
              <p className="text-gray-400 text-xs mb-1">Kepada</p>
              <p className="font-semibold text-primary-900">{invoice.student.user.name}</p>
              <p className="text-gray-500">{invoice.student.class?.name ?? "—"} · NIS {invoice.student.nis}</p>
            </div>
            <div className="text-right">
              <p className="text-gray-400 text-xs mb-1">Dicetak</p>
              <p className="text-gray-600">{today}</p>
              <span className={`inline-flex mt-2 items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_BADGE[status]}`}>
                {STATUS_LABEL[status]}
              </span>
            </div>
          </div>

          <table className="w-full border-collapse text-sm mb-6">
            <thead>
              <tr className="bg-primary-900 text-white">
                <th className="border border-primary-900 px-3 py-2.5 text-left font-medium">Jenis Biaya</th>
                <th className="border border-primary-900 px-3 py-2.5 text-left font-medium">Periode</th>
                <th className="border border-primary-900 px-3 py-2.5 text-center font-medium">Jatuh Tempo</th>
                <th className="border border-primary-900 px-3 py-2.5 text-right font-medium">Jumlah</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-200 px-3 py-2.5">{invoice.feeType.name}</td>
                <td className="border border-gray-200 px-3 py-2.5">{invoice.period}</td>
                <td className="border border-gray-200 px-3 py-2.5 text-center">
                  {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "—"}
                </td>
                <td className="border border-gray-200 px-3 py-2.5 text-right font-semibold">{formatRupiah(invoice.amount)}</td>
              </tr>
            </tbody>
          </table>

          <div className="ml-auto max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Total Tagihan</span><span className="font-semibold">{formatRupiah(invoice.amount)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Terbayar</span><span className="font-semibold text-emerald-700">{formatRupiah(invoice.paidAmount)}</span></div>
            <div className="flex justify-between border-t border-gray-200 pt-1.5">
              <span className="font-semibold text-primary-900">Sisa Tagihan</span>
              <span className="font-bold text-primary-900">{formatRupiah(sisa)}</span>
            </div>
            {invoice.paidAt && (
              <div className="flex justify-between text-xs text-gray-400 pt-1">
                <span>Tanggal Bayar</span>
                <span>{new Date(invoice.paidAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}{invoice.paymentMethod ? ` · ${invoice.paymentMethod}` : ""}</span>
              </div>
            )}
          </div>

          <div className="mt-12 grid grid-cols-2 gap-8 text-center text-sm max-w-md ml-auto">
            <div>
              <p className="text-gray-500 mb-12">Bendahara,</p>
              <div className="border-b border-gray-400 mb-1" />
              <p className="text-gray-500">( _____________ )</p>
            </div>
            <div>
              <p className="text-gray-500 mb-12">Orang Tua / Wali,</p>
              <div className="border-b border-gray-400 mb-1" />
              <p className="text-gray-500">( _____________ )</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
