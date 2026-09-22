export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ListOrdered } from "lucide-react";
import { verifyRole } from "@/lib/dal";
import { getSettings, getPrincipalName } from "@/lib/site-settings";
import { muatDenah } from "@/lib/denah-ruang";
import { hariTanggal } from "@/lib/administrasi-ujian";
import PageHeader from "@/components/admin/PageHeader";
import PrintButton from "@/components/shared/PrintButton";
import PrintKop from "@/components/shared/PrintKop";

/** REKAP PEMBAGIAN RUANG — satu tabel semua ruang × sesi: kelas, rentang nomor peserta, jumlah. Untuk panitia & pengawas. */
export default async function RekapRuangPage({ searchParams }: { searchParams: Promise<{ kegiatan?: string }> }) {
  await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  const { kegiatan: kegiatanId } = await searchParams;
  if (!kegiatanId) notFound();
  const [data, settings] = await Promise.all([muatDenah(kegiatanId), getSettings(["logo.full_white", "school.structure"])]);
  if (!data) notFound();

  const judul = `${data.kegiatan.nama}${data.kegiatan.tahunAjaran ? ` Tahun Pelajaran ${data.kegiatan.tahunAjaran}` : ""}`;
  const kepala = getPrincipalName(settings["school.structure"]);
  const th = "border border-gray-800 bg-primary-900 text-white px-2 py-1.5 text-center align-middle";
  const td = "border border-gray-800 px-2 py-1 align-top";

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0 bg-white">
      <style>{"@page { size: A4 portrait; margin: 1.5cm; }"}</style>
      <PageHeader icon={<ListOrdered size={22} />} title="Rekap Pembagian Ruang" description={judul} printHidden />
      <div className="flex items-center gap-2 mb-5 print:hidden">
        <Link href="/pusat-ujian/administrasi/ruang" className="btn-modal-cancel">
          <ArrowLeft size={18} /> Kembali
        </Link>
        <PrintButton />
      </div>

      <div className="print-doc bg-white max-w-[180mm] mx-auto text-[12px]">
        <PrintKop title="Rekap Pembagian Ruang Ujian" subtitle={judul} logoUrl={settings["logo.full_white"]} />
        <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
          <colgroup><col style={{ width: "7%" }} /><col style={{ width: "25%" }} />{data.jumlahSesi > 1 && <col style={{ width: "9%" }} />}<col /><col style={{ width: "11%" }} /></colgroup>
          <thead>
            <tr><th className={th}>No</th><th className={th}>Ruang</th>{data.jumlahSesi > 1 && <th className={th}>Sesi</th>}<th className={th}>Kelas & Nomor Peserta</th><th className={th}>Jumlah</th></tr>
          </thead>
          <tbody>
            {data.ruangSesi.map((rs, i) => (
              <tr key={`${rs.ruang.id}-${rs.sesi}`}>
                <td className={`${td} text-center`}>{i + 1}</td>
                <td className={td}><p className="font-semibold">{rs.ruang.nama}</p>{rs.ruang.lokasi && <p className="text-[10.5px] text-gray-600">{rs.ruang.lokasi}</p>}</td>
                {data.jumlahSesi > 1 && <td className={`${td} text-center`}>{rs.sesi}</td>}
                <td className={td}>
                  {rs.kelas.map(k => (
                    <p key={k.nama}>{k.nama}: {k.jumlah} peserta <span className="font-mono text-[10.5px] text-gray-600">({k.nomorAwal} – {k.nomorAkhir})</span></p>
                  ))}
                </td>
                <td className={`${td} text-center font-semibold`}>{rs.jumlah}</td>
              </tr>
            ))}
            <tr>
              <td className={`${td} text-right font-bold`} colSpan={data.jumlahSesi > 1 ? 4 : 3}>Jumlah peserta ditempatkan</td>
              <td className={`${td} text-center font-bold`}>{data.ditempatkan}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2 text-[11px]">
          Peserta kegiatan: <strong>{data.total}</strong> · belum ditempatkan: <strong>{data.belumDitempatkan.length}</strong>
          {data.belumDitempatkan.length > 0 && <> ({data.belumDitempatkan.slice(0, 8).map(p => p.nama).join(", ")}{data.belumDitempatkan.length > 8 ? ", …" : ""})</>}
        </p>
        <div className="flex justify-end mt-10">
          <div className="text-center w-64">
            <p>{hariTanggal(new Date())}</p>
            <p>Mengetahui, Kepala Sekolah</p>
            <div className="h-16" />
            <p className="font-semibold underline">{kepala || "( .............................................. )"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
