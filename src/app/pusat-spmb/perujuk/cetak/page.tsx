export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft, Scissors } from "lucide-react";
import { verifySpmbAccess } from "@/lib/spmb";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { generateQrWithLogoDataUrl } from "@/lib/qrcode";
import { LABEL_JENIS } from "@/lib/spmb-perujuk-label";
import { ALAMAT_APLIKASI } from "@/lib/alamat-aplikasi";
import PageHeader from "@/components/admin/PageHeader";
import PrintButton from "@/components/shared/PrintButton";

export const metadata = { title: "Cetak Kartu Referral" };

/** Cetak kartu referral BANYAK SEKALIGUS — 8 kartu per lembar A4, untuk digunting lalu dibagikan.
 *
 *  Dibatasi 200 kartu sekali cetak: tiap kartu memuat satu QR sebagai data URL, dan 1.180 kartu
 *  dalam satu halaman akan menjadi muatan puluhan megabita yang membuat peramban sekolah berhenti
 *  menanggapi. Panitia mencetak per jenis / per gelombang, bukan sekali jalan.
 *
 *  Alamat QR memakai ALAMAT_APLIKASI (domain sekolah), BUKAN host permintaan — kartu ini dicetak
 *  di atas kertas lalu beredar berbulan-bulan di luar sekolah, jadi alamatnya harus yang permanen,
 *  bukan `http://<ip>:3000` yang hanya hidup di jaringan sekolah. */
export default async function Page({ searchParams }: { searchParams: Promise<{ jenis?: string }> }) {
  await verifySpmbAccess();
  const { jenis = "" } = await searchParams;
  const saring = ["SISWA", "PEGAWAI", "LUAR"].includes(jenis) ? jenis : undefined;

  const [daftar, s] = await Promise.all([
    prisma.perujukSpmb.findMany({
      where: { aktif: true, ...(saring ? { jenis: saring } : {}) },
      orderBy: [{ jenis: "asc" }, { nama: "asc" }],
      take: 200,
      select: { id: true, kode: true, nama: true, jenis: true },
    }).catch(() => []),
    getSettings(["school.name", "spmb.tahun"]).catch(() => ({} as Record<string, string>)),
  ]);

  const sekolah = s["school.name"] || "SMK Al Munawwir IIBS";
  const kartu = await Promise.all(daftar.map(async p => ({
    ...p,
    qr: await generateQrWithLogoDataUrl(`${ALAMAT_APLIKASI}/admissions?ref=${encodeURIComponent(p.kode)}`).catch(() => ""),
  })));

  const TAB = [
    { id: "", label: "Semua" },
    { id: "SISWA", label: "Siswa" },
    { id: "PEGAWAI", label: "Guru / Pegawai" },
    { id: "LUAR", label: "Perujuk Luar" },
  ];

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0">
      <PageHeader icon={<Scissors size={22} />} title="Cetak Kartu Referral"
        description={`${kartu.length} kartu · 8 kartu per lembar A4, tinggal digunting`} printHidden />

      <div className="baris-alat mb-5 print:hidden">
        <div className="alat-tab flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-gray-100 bg-white p-1 scrollbar-hide">
          {TAB.map(t => (
            <Link key={t.id} href={t.id ? `?jenis=${t.id}` : "?"}
              className={`sentuh whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                (saring ?? "") === t.id ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
              {t.label}
            </Link>
          ))}
        </div>
        <div className="alat-aksi">
          <Link href="/pusat-spmb/perujuk" className="btn-modal-cancel"><ArrowLeft size={16} /> Kembali</Link>
          <PrintButton />
        </div>
      </div>

      {kartu.length === 0 ? (
        <div className="panel p-5 print:hidden">
          <p className="py-10 text-center text-sm text-gray-400">Belum ada perujuk aktif untuk dicetak.</p>
        </div>
      ) : (
        <div className="print-doc bg-white mx-auto grid max-w-[21cm] grid-cols-2 gap-[4mm] p-[8mm] print:max-w-none print:p-0">
          {kartu.map(p => (
            <div key={p.id}
              className="flex h-[6.2cm] items-center gap-[3mm] rounded-lg border border-dashed border-gray-300 p-[3mm] break-inside-avoid">
              {p.qr && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={p.qr} alt={`QR ${p.kode}`} className="h-[4.4cm] w-[4.4cm] shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-gold-dark">SPMB {s["spmb.tahun"] ?? ""}</p>
                <p className="mt-[1mm] text-[12px] font-bold leading-tight text-primary-900">{p.nama}</p>
                <p className="text-[8.5px] text-gray-500">{LABEL_JENIS[p.jenis] ?? p.jenis}</p>
                <p className="mt-[2mm] text-[8px] uppercase tracking-wide text-gray-400">Kode</p>
                <p className="angka text-[11px] font-bold tracking-wide text-primary-700 break-all">{p.kode}</p>
                <p className="mt-[2mm] text-[8px] leading-tight text-gray-500">
                  Pindai untuk mendaftar di {sekolah} — kode terisi otomatis.
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{"@media print { @page { size: A4 portrait; margin: 8mm; } }"}</style>
    </div>
  );
}
