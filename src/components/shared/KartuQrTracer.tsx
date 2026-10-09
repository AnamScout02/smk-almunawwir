import Link from "next/link";
import { ArrowLeft, QrCode } from "lucide-react";
import { getSettings } from "@/lib/site-settings";
import { generateQrWithLogoDataUrl } from "@/lib/qrcode";
import { ALAMAT_APLIKASI } from "@/lib/alamat-aplikasi";
import PageHeader from "@/components/admin/PageHeader";
import PrintButton from "@/components/shared/PrintButton";
import PrintKop from "@/components/shared/PrintKop";

/** KARTU QR TRACER STUDY (8 Oktober 2026) — A6, pola kartu QR SPMB. Dicetak untuk reuni/legalisir ijazah, atau
 *  gambarnya dibagikan ke grup WhatsApp angkatan. Alamatnya `ALAMAT_APLIKASI` (bukan host permintaan): kartu ini
 *  beredar di LUAR sekolah, jadi harus alamat yang permanen (CLAUDE.md #110). */
export default async function KartuQrTracer({ kembaliHref }: { kembaliHref: string }) {
  const s = await getSettings(["school.name", "logo.full_white"]).catch(() => ({} as Record<string, string>));
  const url = `${ALAMAT_APLIKASI}/tracer-study`;
  const qr = await generateQrWithLogoDataUrl(url);
  const sekolah = s["school.name"] || "SMK Al Munawwir IIBS";
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0">
      <PageHeader icon={<QrCode size={22} />} title="QR Tracer Study"
        description="Cetak A6 atau bagikan ke grup alumni — alumni memindai lalu mengisi kabarnya tanpa akun" printHidden />
      <div className="flex items-center gap-2 mb-5 print:hidden">
        <Link href={kembaliHref} className="btn-modal-cancel"><ArrowLeft size={18} /> Kembali</Link>
        <PrintButton />
      </div>
      <div className="overflow-x-auto pb-2 print:overflow-visible print:pb-0">
        <div className="print-doc bg-white mx-auto w-[105mm] h-[148mm] flex flex-col overflow-hidden rounded-2xl shadow-lg print:shadow-none print:rounded-none">
          <div className="shrink-0">
            <PrintKop title="Tracer Study Alumni" subtitle={sekolah} logoUrl={s["logo.full_white"]} edgeClassName=""
              spacingClassName="px-[6mm] py-[5mm]" titleClassName="text-[15px]" subtitleClassName="text-[9px] tracking-[0.06em]" logoClassName="h-[9mm]" />
          </div>
          <div className="h-[1.2mm] shrink-0" style={{ background: "linear-gradient(90deg, #B87D0E 0%, #F5C842 50%, #B87D0E 100%)" }} />
          <div className="flex-1 flex flex-col items-center justify-center px-[7mm] py-[4mm] text-center">
            <p className="text-[13px] text-primary-900 font-bold leading-snug">Apa kabar, alumni?</p>
            <p className="text-[10.5px] text-gray-600 leading-snug mt-[1.5mm]">
              Pindai kode ini dengan kamera ponsel,<br />lalu ceritakan kabar Anda setelah lulus.
            </p>
            <div className="relative mt-[3mm] p-[2.5mm] rounded-xl border border-primary-100 bg-white">
              <span className="absolute -top-[0.8mm] -left-[0.8mm] w-[4mm] h-[4mm] border-t-2 border-l-2 border-gold rounded-tl-md" />
              <span className="absolute -top-[0.8mm] -right-[0.8mm] w-[4mm] h-[4mm] border-t-2 border-r-2 border-gold rounded-tr-md" />
              <span className="absolute -bottom-[0.8mm] -left-[0.8mm] w-[4mm] h-[4mm] border-b-2 border-l-2 border-gold rounded-bl-md" />
              <span className="absolute -bottom-[0.8mm] -right-[0.8mm] w-[4mm] h-[4mm] border-b-2 border-r-2 border-gold rounded-br-md" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="QR Tracer Study" className="w-[46mm] h-[46mm] block" />
            </div>
            <p className="text-[8.5px] text-gray-400 break-all leading-tight mt-[2mm] px-[2mm]">{url}</p>
          </div>
          <div className="shrink-0 px-[6mm] py-[3.5mm] text-center border-t border-primary-100 bg-primary-50/60">
            <p className="text-[9px] font-bold text-primary-900 uppercase tracking-[0.08em]">Tanpa akun · ± 2 menit</p>
            <p className="text-[8px] text-gray-500 mt-[1mm]">Siapkan NISN (tercetak di ijazah) atau NIS, dan tanggal lahir</p>
          </div>
        </div>
      </div>
      <style>{"@media print { @page { size: A6 portrait; margin: 0; } }"}</style>
    </div>
  );
}
