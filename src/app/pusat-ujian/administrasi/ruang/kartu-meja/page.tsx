export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, IdCard } from "lucide-react";
import { verifyRole } from "@/lib/dal";
import { muatDenah } from "@/lib/denah-ruang";
import PageHeader from "@/components/admin/PageHeader";
import PrintButton from "@/components/shared/PrintButton";

/** KARTU MEJA — label tempel di meja/komputer: nomor peserta, nama, kelas, ruang & kursi. 14 label per A4
 * (2 × 7, ±93 × 37 mm), urut ruang → sesi → kursi supaya mudah dibagikan per ruang. */
export default async function KartuMejaPage({ searchParams }: { searchParams: Promise<{ kegiatan?: string; ruang?: string; sesi?: string }> }) {
  await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  const { kegiatan: kegiatanId, ruang: ruangId, sesi } = await searchParams;
  if (!kegiatanId) notFound();
  const data = await muatDenah(kegiatanId);
  if (!data) notFound();

  const label = data.ruangSesi
    .filter(rs => (!ruangId || rs.ruang.id === ruangId) && (!sesi || rs.sesi === Number(sesi)))
    .flatMap(rs => rs.kursi.filter(k => k.peserta).map(k => ({
      key: `${rs.ruang.id}-${rs.sesi}-${k.kursi}`, peserta: k.peserta!, kursi: k.kursi,
      tempat: `${rs.ruang.nama}${data.jumlahSesi > 1 ? ` · Sesi ${rs.sesi}` : ""}`,
    })));
  const lembar: typeof label[] = [];
  for (let i = 0; i < label.length; i += 14) lembar.push(label.slice(i, i + 14));

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0">
      <style>{"@page { size: A4 portrait; margin: 1cm; }"}</style>
      <PageHeader icon={<IdCard size={22} />} title="Kartu Meja Peserta" description={`${data.kegiatan.nama} · ${label.length} label`} printHidden />
      <div className="flex flex-wrap items-center gap-2 mb-5 print:hidden">
        <Link href="/pusat-ujian/administrasi/ruang" className="btn-modal-cancel">
          <ArrowLeft size={18} /> Kembali
        </Link>
        <PrintButton />
        <span className="text-xs text-gray-400">Cetak skala 100%, gunting sesuai garis putus-putus, tempel di meja sesuai nomor kursi.</span>
      </div>

      {label.length === 0 ? <p className="text-sm text-gray-500">Belum ada pembagian ruang untuk pilihan ini.</p> : lembar.map((isi, li) => (
        <div key={li} className={`print-doc bg-white mx-auto grid grid-cols-2 gap-x-[4mm] gap-y-[2mm] content-start ${li < lembar.length - 1 ? "print:break-after-page mb-6 print:mb-0" : ""}`} style={{ width: "190mm" }}>
          {isi.map(l => (
            <div key={l.key} className="border border-dashed border-gray-500 rounded-[2mm] px-[4mm] py-[2.5mm] flex flex-col justify-between break-inside-avoid" style={{ height: "37mm" }}>
              <div className="flex justify-between items-start gap-2 text-[9px] text-gray-600">
                <span className="font-bold uppercase tracking-wide text-primary-900">{data.kegiatan.singkatan} · Kartu Meja</span>
                <span className="text-right">{l.tempat} · <strong className="text-gray-900">Kursi {l.kursi}</strong></span>
              </div>
              <p className="font-mono font-bold text-[15px] leading-tight">{l.peserta.nomor}</p>
              <p className="font-bold text-[12px] leading-tight line-clamp-2">{l.peserta.nama}</p>
              <div className="flex justify-between text-[10px] text-gray-700">
                <span>{l.peserta.kelas}</span><span className="font-mono">NIS {l.peserta.nis}</span>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
