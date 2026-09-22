export const dynamic = "force-dynamic";

import { headers } from "next/headers";
import Link from "next/link";
import { ArrowLeft, BookUser } from "lucide-react";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { getSettings } from "@/lib/site-settings";
import { generateQrWithLogoDataUrl } from "@/lib/qrcode";
import PageHeader from "@/components/admin/PageHeader";
import PrintButton from "@/components/shared/PrintButton";
import PrintKop from "@/components/shared/PrintKop";

/** Kartu QR Buku Tamu — dicetak lalu ditaruh di standing acrylic meja depan.
 *
 * SATU QR saja, bukan satu per kategori. Dengan QR terpisah per kategori, tamu dinas yang memindai
 * papan "umum" akan tercatat salah kategori selamanya dan tidak ada yang mengoreksi; dengan satu
 * QR, kategori jadi pertanyaan PERTAMA di formulir sehingga tamu sendiri yang menentukan
 * (keputusan bersama user 13 September 2026).
 *
 * Ukuran A6 (105 × 148 mm), bukan A4 — kartu meja, bukan poster dinding.
 *
 * Alamat QR diambil dari host yang sedang dipakai membuka halaman ini, BUKAN dari
 * NEXT_PUBLIC_APP_URL — nilai env itu masih "localhost:3000" di server, dan QR yang menunjuk ke
 * localhost tidak akan bisa dibuka dari ponsel tamu. */

export default async function Page() {
  await verifyTasAccess();
  const [h, settings] = await Promise.all([
    headers(),
    getSettings(["school.name", "logo.emblem", "logo.full_white"]).catch(() => ({} as Record<string, string>)),
  ]);
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const url = `${proto}://${host}/tamu`;
  const qr = await generateQrWithLogoDataUrl(url);

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0">
      <PageHeader icon={<BookUser size={22} />} title="QR Buku Tamu"
        description="Cetak A6, taruh di meja depan — tamu mengisi sendiri lewat ponselnya, tanpa perlu akun" printHidden />

      <div className="flex items-center gap-2 mb-5 print:hidden">
        <Link href="/dashboard/admin/buku-tamu"
          className="btn-modal-cancel">
          <ArrowLeft size={18} /> Kembali
        </Link>
        <PrintButton />
      </div>

      {/* Lebar & tinggi dipatok dalam milimeter supaya pratinjau di layar sebesar hasil cetaknya. */}
      {/* Kartu A6 (105mm) lebih lebar dari layar HP 360px — di layar digeser dalam wadahnya sendiri, bukan melebarkan halaman. */}
      <div className="overflow-x-auto pb-2 print:overflow-visible print:pb-0">
      <div className="print-doc bg-white mx-auto w-[105mm] h-[148mm] flex flex-col overflow-hidden rounded-2xl shadow-lg print:shadow-none print:rounded-none">

        {/* Kop yang SAMA PERSIS dengan dokumen cetak lain (Profil Sekolah, Ekspedisi, Buku Tamu):
            komponen PrintKop — judul rata KIRI, logo full-putih di KANAN. Sebelumnya kop kartu ini
            diracik sendiri (lambang & judul di tengah) sehingga terlihat beda sendiri di antara
            dokumen sekolah (temuan user 13 September 2026). */}
        <div className="shrink-0">
          <PrintKop
            title="Buku Tamu"
            subtitle={settings["school.name"] || "SMK Al Munawwir IIBS"}
            logoUrl={settings["logo.full_white"]}
            edgeClassName=""
            spacingClassName="px-[6mm] py-[5mm]"
            titleClassName="text-[15px]"
            subtitleClassName="text-[9px] tracking-[0.06em]"
            logoClassName="h-[9mm]"
          />
        </div>

        {/* Garis emas pemisah */}
        <div className="h-[1.2mm] shrink-0" style={{ background: "linear-gradient(90deg, #B87D0E 0%, #F5C842 50%, #B87D0E 100%)" }} />

        {/* Badan kartu */}
        <div className="flex-1 flex flex-col items-center justify-center px-[7mm] py-[4mm] text-center">
          <p className="text-[13px] text-primary-900 font-bold leading-snug">Selamat datang</p>
          <p className="text-[10.5px] text-gray-600 leading-snug mt-[1.5mm]">
            Pindai kode ini dengan kamera ponsel Anda,<br />lalu isi data kunjungan.
          </p>

          {/* Bingkai QR dengan empat sudut emas */}
          <div className="relative mt-[3mm] p-[2.5mm] rounded-xl border border-primary-100 bg-white">
            <span className="absolute -top-[0.8mm] -left-[0.8mm] w-[4mm] h-[4mm] border-t-2 border-l-2 border-gold rounded-tl-md" />
            <span className="absolute -top-[0.8mm] -right-[0.8mm] w-[4mm] h-[4mm] border-t-2 border-r-2 border-gold rounded-tr-md" />
            <span className="absolute -bottom-[0.8mm] -left-[0.8mm] w-[4mm] h-[4mm] border-b-2 border-l-2 border-gold rounded-bl-md" />
            <span className="absolute -bottom-[0.8mm] -right-[0.8mm] w-[4mm] h-[4mm] border-b-2 border-r-2 border-gold rounded-br-md" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR Buku Tamu" className="w-[46mm] h-[46mm] block" />
          </div>

          <p className="text-[8.5px] text-gray-400 break-all leading-tight mt-[2mm] px-[2mm]">{url}</p>
        </div>

        {/* Kaki kartu */}
        <div className="shrink-0 px-[6mm] py-[3.5mm] text-center border-t border-primary-100 bg-primary-50/60">
          <p className="text-[9px] font-bold text-primary-900 uppercase tracking-[0.08em]">Untuk semua jenis tamu</p>
          <p className="text-[10px] text-primary-700 font-semibold mt-[1mm]">Dinas &middot; Wali Murid &middot; Vendor &middot; Umum</p>
          <p className="text-[8px] text-gray-400 mt-[1mm]">Jenis tamu dipilih sendiri setelah memindai</p>
        </div>
      </div>
      </div>

      <style>{"@media print { @page { size: A6 portrait; margin: 0; } }"}</style>
    </div>
  );
}
