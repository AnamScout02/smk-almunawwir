export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Forward } from "lucide-react";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";
import { getSettings, getPrincipalName } from "@/lib/site-settings";
import PageHeader from "@/components/admin/PageHeader";
import PrintButton from "@/components/shared/PrintButton";
import PrintKop from "@/components/shared/PrintKop";
import { SIFAT_DISPOSISI, TUJUAN_DISPOSISI_UMUM, labelOf } from "@/lib/tu-konstanta";
import GambarTtd from "@/components/shared/GambarTtd";
import { petaTtd, ttdDariNama } from "@/lib/ttd";

const tgl = (d: Date | string | null) =>
  d ? new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }) : "—";

/** Lembar disposisi — satu halaman per surat, meniru blanko disposisi yang biasa ditempel di
 * berkas surat masuk: identitas surat di atas, kotak centang tujuan, lalu kolom isi instruksi. */
export default async function CetakDisposisiPage({ params }: { params: Promise<{ id: string }> }) {
  await verifyTasAccess();
  const { id } = await params;

  const [d, settings] = await Promise.all([
    prisma.disposisi.findUnique({
      where: { id },
      include: { surat: { select: { nomor: true, tanggal: true, pihak: true, perihal: true } } },
    }),
    getSettings(["logo.full_white", "school.structure"]),
  ]);
  if (!d) notFound();

  const principalName = getPrincipalName(settings["school.structure"]);
  // Tujuan yang diketik bebas ikut ditampilkan di bawah daftar baku, supaya tidak ada yang hilang
  // dari lembar cetak hanya karena tidak ada di daftar pilihan.
  const tujuanLain = d.tujuan.filter(t => !TUJUAN_DISPOSISI_UMUM.includes(t));

  const label = "text-[11px] font-semibold text-gray-600";
  const nilai = "text-[12px] text-gray-900";

  // TTD pribadi penanda tangan: nama pemberi disposisi bila diisi manual (Plt./Wakil), selain itu Kepala Sekolah.
  // Disposisi yang ditulis pimpinan sendiri dari HP: TTD-nya HANYA tercetak bila ia memang menandatanganinya di layar.
  const ttdKepala = d.dariUserId
    ? (d.ditandatanganiAt ? (await petaTtd([d.dariUserId])).get(d.dariUserId) : undefined)
    : await ttdDariNama(d.dariNama || principalName);
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0 min-h-dvh print:min-h-0 bg-white">
      <style>{"@page { size: A4; margin: 1.5cm; }"}</style>

      <PageHeader icon={<Forward size={22} />} title="Lembar Disposisi" description={d.surat.perihal} printHidden />

      <div className="flex items-center gap-2 mb-5 print:hidden">
        <Link href="/dashboard/admin/disposisi"
          className="btn-modal-cancel">
          <ArrowLeft size={18} /> Kembali
        </Link>
        <PrintButton />
      </div>

      <div className="print-doc bg-white">
        <PrintKop title="Lembar Disposisi" subtitle="Surat Masuk" logoUrl={settings["logo.full_white"]} />

        <table className="w-full border-collapse text-[12px] mb-4">
          <tbody>
            <tr>
              <td className="border border-gray-800 px-2 py-1.5 w-[18%]"><span className={label}>Nomor Surat</span></td>
              <td className="border border-gray-800 px-2 py-1.5 w-[32%]"><span className={nilai}>{d.surat.nomor}</span></td>
              <td className="border border-gray-800 px-2 py-1.5 w-[18%]"><span className={label}>Tanggal Surat</span></td>
              <td className="border border-gray-800 px-2 py-1.5"><span className={nilai}>{tgl(d.surat.tanggal)}</span></td>
            </tr>
            <tr>
              <td className="border border-gray-800 px-2 py-1.5"><span className={label}>Diterima Dari</span></td>
              <td className="border border-gray-800 px-2 py-1.5"><span className={nilai}>{d.surat.pihak}</span></td>
              <td className="border border-gray-800 px-2 py-1.5"><span className={label}>Tanggal Disposisi</span></td>
              <td className="border border-gray-800 px-2 py-1.5"><span className={nilai}>{tgl(d.tanggal)}</span></td>
            </tr>
            <tr>
              <td className="border border-gray-800 px-2 py-1.5"><span className={label}>Perihal</span></td>
              <td className="border border-gray-800 px-2 py-1.5" colSpan={3}><span className={nilai}>{d.surat.perihal}</span></td>
            </tr>
            <tr>
              <td className="border border-gray-800 px-2 py-1.5"><span className={label}>Sifat</span></td>
              <td className="border border-gray-800 px-2 py-1.5" colSpan={3}>
                <span className={`${nilai} font-semibold`}>{labelOf(SIFAT_DISPOSISI, d.sifat)}</span>
                {d.batasWaktu && <span className={`${nilai} ml-4`}>Batas waktu: <b>{tgl(d.batasWaktu)}</b></span>}
              </td>
            </tr>
          </tbody>
        </table>

        <p className="text-[11px] font-bold uppercase tracking-wide text-primary-900 mb-2">Diteruskan Kepada</p>
        <div className="border border-gray-800 p-3 mb-4">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            {TUJUAN_DISPOSISI_UMUM.map(t => (
              <div key={t} className="flex items-center gap-2 text-[12px]">
                {/* Kotak centang digambar manual (bukan <input type=checkbox>) supaya pasti ikut
                    tercetak di semua browser & printer, tidak bergantung tema kontrol form. */}
                <span className="inline-flex items-center justify-center w-[13px] h-[13px] border border-gray-800 shrink-0 leading-none">
                  {d.tujuan.includes(t) ? <span className="text-[11px] font-bold">✓</span> : null}
                </span>
                <span className={d.tujuan.includes(t) ? "font-semibold" : "text-gray-600"}>{t}</span>
              </div>
            ))}
          </div>
          {tujuanLain.length > 0 && (
            <p className="text-[12px] mt-2 pt-2 border-t border-gray-300">
              <span className={label}>Lainnya: </span><span className="font-semibold">{tujuanLain.join(", ")}</span>
            </p>
          )}
        </div>

        <p className="text-[11px] font-bold uppercase tracking-wide text-primary-900 mb-2">Isi Disposisi / Instruksi</p>
        <div className="border border-gray-800 p-3 min-h-[4.5cm] text-[12px] whitespace-pre-wrap mb-4">
          {d.instruksi}
        </div>

        <p className="text-[11px] font-bold uppercase tracking-wide text-primary-900 mb-2">Tindak Lanjut</p>
        <div className="border border-gray-800 p-3 min-h-[3cm] text-[12px] whitespace-pre-wrap mb-6">
          {d.tindakLanjut ?? ""}
        </div>

        <div className="alat-aksi justify-end" style={{ breakInside: "avoid" }}>
          <div className="text-xs text-center w-[7cm]">
            <p>Banyuwangi, {tgl(d.tanggal)}</p>
            <p className="font-semibold">Kepala SMK Al Munawwir IIBS</p>
            <GambarTtd src={ttdKepala} tinggi={56} />
            {/* Nama pemberi disposisi boleh diisi manual (mis. Plt./Wakil yang menandatangani);
                kalau kosong, jatuh ke nama Kepala Sekolah dari Struktur Organisasi. */}
            <p className="font-semibold underline">{d.dariNama || principalName || "( _____________ )"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
