export const dynamic = "force-dynamic";

import { headers } from "next/headers";
import Link from "next/link";
import { ArrowLeft, QrCode } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { verifySpmbAccess } from "@/lib/spmb";
import { getSettings } from "@/lib/site-settings";
import { generateQrWithLogoDataUrl } from "@/lib/qrcode";
import { bacaKontenSpmb } from "@/lib/spmb-konten";
import { gelombangDibuka } from "@/lib/spmb";
import PageHeader from "@/components/admin/PageHeader";
import PrintButton from "@/components/shared/PrintButton";
import PrintKop from "@/components/shared/PrintKop";

/** Kartu QR SPMB — dicetak lalu ditaruh di meja depan, dibawa saat sosialisasi ke SMP/MTs, atau
 *  ditempel di papan pengumuman. Calon memindai dengan kamera ponselnya lalu langsung membuka
 *  halaman SPMB; tidak perlu akun dan tidak perlu mengetik alamat.
 *
 *  Pola sama persis dengan kartu QR Buku Tamu (13 September 2026): A6 (105 × 148 mm) karena ini
 *  KARTU MEJA, bukan poster dinding, dan memakai `PrintKop` yang sama supaya sederet dengan
 *  dokumen sekolah lain.
 *
 *  Alamat QR diambil dari HOST yang sedang dipakai membuka halaman ini, bukan dari setelan —
 *  sekolah membuka situs lewat dua jalur (domain HTTPS & http://<ip>:3000), dan QR yang menunjuk
 *  ke alamat yang tidak bisa dibuka dari ponsel tamu sama saja dengan kartu kosong. */
export default async function Page({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  await verifySpmbAccess();
  const { ref = "" } = await searchParams;
  const kodeRef = ref.trim().toUpperCase().slice(0, 40);
  const [h, s, gelombang, perujuk] = await Promise.all([
    headers(),
    getSettings(["school.name", "logo.full_white", "spmb.tahun", "spmb.judul", "spmb.jalur"])
      .catch(() => ({} as Record<string, string>)),
    gelombangDibuka().catch(() => null),
    kodeRef ? prisma.perujukSpmb.findUnique({ where: { kode: kodeRef }, select: { nama: true, kode: true } }).catch(() => null) : Promise.resolve(null),
  ]);
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "http";
  /* Dengan `?ref=`, QR membawa kode perujuknya sekaligus — calon yang memindai langsung mendapat
     formulir dengan kode terisi, jadi perujuk tidak perlu mendiktekan kode apa pun. */
  const url = perujuk
    ? `${proto}://${host}/admissions?ref=${encodeURIComponent(perujuk.kode)}`
    : `${proto}://${host}/admissions`;
  const qr = await generateQrWithLogoDataUrl(url);
  const jalur = bacaKontenSpmb(s).jalur;
  const sekolah = s["school.name"] || "SMK Al Munawwir IIBS";

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0">
      <PageHeader icon={<QrCode size={22} />} title="QR Pendaftaran SPMB"
        description={perujuk
          ? `Kartu perujuk ${perujuk.nama} — calon yang memindai langsung terdata sebagai rujukannya`
          : "Cetak A6, taruh di meja depan atau bawa saat sosialisasi — calon memindai lalu mendaftar dari ponselnya"} printHidden />

      <div className="flex items-center gap-2 mb-5 print:hidden">
        <Link href={perujuk ? "/pusat-spmb/perujuk" : "/pusat-spmb"} className="btn-modal-cancel"><ArrowLeft size={18} /> Kembali</Link>
        <PrintButton />
      </div>

      {/* Kartu A6 lebih lebar dari layar HP — digeser di dalam wadahnya sendiri, bukan melebarkan halaman. */}
      <div className="overflow-x-auto pb-2 print:overflow-visible print:pb-0">
      <div className="print-doc bg-white mx-auto w-[105mm] h-[148mm] flex flex-col overflow-hidden rounded-2xl shadow-lg print:shadow-none print:rounded-none">
        <div className="shrink-0">
          <PrintKop
            title={`SPMB ${s["spmb.tahun"] ?? ""}`.trim()}
            subtitle={sekolah}
            logoUrl={s["logo.full_white"]}
            edgeClassName=""
            spacingClassName="px-[6mm] py-[5mm]"
            titleClassName="text-[15px]"
            subtitleClassName="text-[9px] tracking-[0.06em]"
            logoClassName="h-[9mm]"
          />
        </div>

        <div className="h-[1.2mm] shrink-0" style={{ background: "linear-gradient(90deg, #B87D0E 0%, #F5C842 50%, #B87D0E 100%)" }} />

        <div className="flex-1 flex flex-col items-center justify-center px-[7mm] py-[4mm] text-center">
          <p className="text-[13px] text-primary-900 font-bold leading-snug">
            {gelombang ? "Pendaftaran dibuka" : "Informasi pendaftaran"}
          </p>
          <p className="text-[10.5px] text-gray-600 leading-snug mt-[1.5mm]">
            Pindai kode ini dengan kamera ponsel Anda,<br />lalu isi formulir pendaftaran.
          </p>

          <div className="relative mt-[3mm] p-[2.5mm] rounded-xl border border-primary-100 bg-white">
            <span className="absolute -top-[0.8mm] -left-[0.8mm] w-[4mm] h-[4mm] border-t-2 border-l-2 border-gold rounded-tl-md" />
            <span className="absolute -top-[0.8mm] -right-[0.8mm] w-[4mm] h-[4mm] border-t-2 border-r-2 border-gold rounded-tr-md" />
            <span className="absolute -bottom-[0.8mm] -left-[0.8mm] w-[4mm] h-[4mm] border-b-2 border-l-2 border-gold rounded-bl-md" />
            <span className="absolute -bottom-[0.8mm] -right-[0.8mm] w-[4mm] h-[4mm] border-b-2 border-r-2 border-gold rounded-br-md" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR pendaftaran SPMB" className="w-[46mm] h-[46mm] block" />
          </div>

          <p className="text-[8.5px] text-gray-400 break-all leading-tight mt-[2mm] px-[2mm]">{url}</p>
        </div>

        <div className="shrink-0 px-[6mm] py-[3.5mm] text-center border-t border-primary-100 bg-primary-50/60">
          {gelombang ? (
            <>
              <p className="text-[9px] font-bold text-primary-900 uppercase tracking-[0.08em]">{gelombang.nama}</p>
              <p className="text-[10px] text-primary-700 font-semibold mt-[1mm]">
                Ditutup {gelombang.tutup.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" })}
              </p>
            </>
          ) : (
            <p className="text-[9px] font-bold text-primary-900 uppercase tracking-[0.08em]">Jadwal & syarat di halaman SPMB</p>
          )}
          {perujuk ? (
            <p className="text-[8px] text-gray-500 mt-[1mm]">
              Diajak oleh <span className="font-semibold text-primary-700">{perujuk.nama}</span> · kode {perujuk.kode}
            </p>
          ) : (
            <p className="text-[8px] text-gray-400 mt-[1mm]">
              {jalur.length ? jalur.slice(0, 4).map(j => j.nama).join(" · ") : "Tanpa akun — cukup nomor pendaftaran & tanggal lahir"}
            </p>
          )}
        </div>
      </div>
      </div>

      <style>{"@media print { @page { size: A6 portrait; margin: 0; } }"}</style>
    </div>
  );
}
