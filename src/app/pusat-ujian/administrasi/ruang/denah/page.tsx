export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, LayoutGrid } from "lucide-react";
import { verifyRole } from "@/lib/dal";
import { getSettings } from "@/lib/site-settings";
import { muatDenah, type KursiDenah } from "@/lib/denah-ruang";
import PageHeader from "@/components/admin/PageHeader";
import PrintButton from "@/components/shared/PrintButton";
import PrintKop from "@/components/shared/PrintKop";

function potong(kursi: KursiDenah[], kolom: number): KursiDenah[][] {
  const baris: KursiDenah[][] = [];
  for (let i = 0; i < kursi.length; i += kolom) baris.push(kursi.slice(i, i + kolom));
  return baris;
}

/** DENAH TEMPAT DUDUK — ditempel di pintu ruang: lembar 1 denah kursi (meja pengawas di depan), lembar 2 daftar
 * peserta urut kursi. `?ruang=&sesi=` untuk mencetak satu ruang saja. */
export default async function CetakDenahPage({ searchParams }: { searchParams: Promise<{ kegiatan?: string; ruang?: string; sesi?: string }> }) {
  await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  const { kegiatan: kegiatanId, ruang: ruangId, sesi } = await searchParams;
  if (!kegiatanId) notFound();
  const [data, settings] = await Promise.all([muatDenah(kegiatanId), getSettings(["logo.full_white"])]);
  if (!data) notFound();

  const daftar = data.ruangSesi.filter(rs => (!ruangId || rs.ruang.id === ruangId) && (!sesi || rs.sesi === Number(sesi)));
  const judul = `${data.kegiatan.nama}${data.kegiatan.tahunAjaran ? ` Tahun Pelajaran ${data.kegiatan.tahunAjaran}` : ""}`;
  const th = "border border-gray-800 bg-primary-900 text-white px-2 py-1 text-center align-middle";
  const td = "border border-gray-800 px-2 py-0.5 align-middle";

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0 bg-white">
      <style>{"@page { size: A4 portrait; margin: 1cm; }"}</style>
      <PageHeader icon={<LayoutGrid size={22} />} title="Denah Tempat Duduk" description={`${judul} · ${daftar.length} ruang/sesi`} printHidden />
      <div className="flex flex-wrap items-center gap-2 mb-5 print:hidden">
        <Link href="/pusat-ujian/administrasi/ruang" className="btn-modal-cancel">
          <ArrowLeft size={18} /> Kembali
        </Link>
        <PrintButton />
        <span className="text-xs text-gray-400">Tiap ruang: lembar denah + lembar daftar peserta — tempel di pintu ruang.</span>
      </div>

      {daftar.length === 0 ? (
        <p className="text-sm text-gray-500">Belum ada pembagian ruang untuk pilihan ini.</p>
      ) : daftar.map((rs, idx) => (
        <div key={`${rs.ruang.id}-${rs.sesi}`} className={`print-doc bg-white max-w-[190mm] mx-auto ${idx < daftar.length - 1 ? "print:break-after-page mb-10 print:mb-0" : ""}`}>
          <PrintKop title="Denah Tempat Duduk Peserta Ujian" subtitle={judul} logoUrl={settings["logo.full_white"]} />
          <div className="flex items-end justify-between gap-4 mb-3 text-[12px]">
            <div>
              <p className="text-2xl font-bold leading-tight">{rs.ruang.nama}{data.jumlahSesi > 1 ? ` · Sesi ${rs.sesi}` : ""}</p>
              {rs.ruang.lokasi && <p className="text-gray-600">{rs.ruang.lokasi}</p>}
            </div>
            <div className="text-right">
              <p>Jumlah peserta: <strong>{rs.jumlah}</strong></p>
              <p>{rs.kelas.map(k => `${k.nama} (${k.jumlah})`).join(" · ")}</p>
            </div>
          </div>
          <div className="border-2 border-gray-800 rounded text-center text-[11px] font-bold py-1 mb-3 tracking-widest">MEJA PENGAWAS · DEPAN RUANG</div>
          <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
            <tbody>
              {potong(rs.kursi, rs.ruang.kolom).map((b, i) => (
                <tr key={i}>
                  {b.map(k => (
                    <td key={k.kursi} className="border border-gray-700 align-top p-1" style={{ height: "17mm" }}>
                      <div className="flex justify-between gap-1 text-[8.5px] text-gray-500">
                        <span>Kursi {k.kursi}</span>{k.peserta && <span>{k.peserta.kelas}</span>}
                      </div>
                      {k.peserta ? (
                        <>
                          <p className="font-mono text-[8.5px] font-bold leading-tight">{k.peserta.nomor}</p>
                          <p className="text-[9.5px] leading-tight line-clamp-2">{k.peserta.nama}</p>
                        </>
                      ) : <p className="text-[9px] text-gray-300 text-center mt-2">kosong</p>}
                    </td>
                  ))}
                  {b.length < rs.ruang.kolom && Array.from({ length: rs.ruang.kolom - b.length }).map((_, j) => <td key={`kosong-${j}`} />)}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="print:break-before-page mt-8 print:mt-0">
            <p className="font-bold text-[13px] mb-1">Daftar Peserta — {rs.ruang.nama}{data.jumlahSesi > 1 ? ` · Sesi ${rs.sesi}` : ""}</p>
            <table className="w-full border-collapse text-[10.5px]" style={{ tableLayout: "fixed" }}>
              <colgroup><col style={{ width: "9%" }} /><col style={{ width: "25%" }} /><col style={{ width: "15%" }} /><col /><col style={{ width: "15%" }} /></colgroup>
              <thead><tr><th className={th}>Kursi</th><th className={th}>Nomor Peserta</th><th className={th}>NIS</th><th className={th}>Nama</th><th className={th}>Kelas</th></tr></thead>
              <tbody>
                {rs.kursi.filter(k => k.peserta).map(k => (
                  <tr key={k.kursi}>
                    <td className={`${td} text-center`}>{k.kursi}</td>
                    <td className={`${td} font-mono`}>{k.peserta!.nomor}</td>
                    <td className={`${td} font-mono`}>{k.peserta!.nis}</td>
                    <td className={td}>{k.peserta!.nama}</td>
                    <td className={td}>{k.peserta!.kelas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
