export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { getSettings, getPrincipalName } from "@/lib/site-settings";
import { bangunMatriks } from "@/lib/kalender-matriks";
import PageHeader from "@/components/admin/PageHeader";
import PrintButton from "@/components/shared/PrintButton";
import PrintKop from "@/components/shared/PrintKop";
import GambarTtd from "@/components/shared/GambarTtd";
import { ttdDariNama } from "@/lib/ttd";

/** Kalender Pendidikan bentuk MATRIKS — baris bulan × kolom tanggal 1–31.
 *
 * Bentuk inilah yang ditempel di dinding sekolah dan dilampirkan ke dokumen kurikulum; daftar
 * agenda per bulan (halaman `/cetak`) tetap ada sebagai lampiran rinciannya. Selalu MENDATAR:
 * 31 kolom tanggal mustahil terbaca di A4 potret. */
export default async function Page({ searchParams }: { searchParams: Promise<{ academicYearId?: string }> }) {
  await verifyTasAccess();
  // Tahun ajaran bisa ditentukan lewat ?academicYearId= — dipakai tombol "Cetak Matriks" yang
  // mengikuti saringan tahun di halaman Kalender Pendidikan, supaya kalender tahun DEPAN sudah
  // bisa dicetak sebelum tahunnya diaktifkan (dan arsip tahun lalu tetap bisa dibuka).
  const { academicYearId } = await searchParams;
  const [m, settings] = await Promise.all([
    bangunMatriks(academicYearId),
    getSettings(["logo.full_white", "school.structure"]).catch(() => ({} as Record<string, string>)),
  ]);
  const principalName = getPrincipalName(settings["school.structure"] ?? "");
  const ttdKepala = await ttdDariNama(principalName); // TTD pribadi Kepala Sekolah (src/lib/ttd.ts)

  const th = "border border-primary-900/30 bg-primary-900 text-white text-[8px] font-bold text-center px-0.5 py-1";

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0">
      <PageHeader icon={<CalendarDays size={22} />} title="Kalender Pendidikan (Matriks)"
        description={m ? `Tahun Pelajaran ${m.tahun}` : "Tahun ajaran aktif belum diatur"} printHidden />

      <div className="flex items-center gap-2 mb-5 print:hidden">
        <Link href="/dashboard/admin/kalender-pendidikan"
          className="btn-modal-cancel">
          <ArrowLeft size={18} /> Kembali
        </Link>
        <PrintButton />
      </div>

      {!m ? (
        <p className="text-sm text-gray-500">Tahun ajaran aktif belum diatur.</p>
      ) : (
        <div className="print-doc lembar-matriks bg-white overflow-x-auto scrollbar-visible">
          <PrintKop title="Kalender Pendidikan"
            subtitle={`Tahun Pelajaran ${m.tahun}`}
            logoUrl={settings["logo.full_white"]} edgeClassName=""
            spacingClassName="mb-2 px-6 py-3" titleClassName="text-base" subtitleClassName="text-[10px]"
            logoClassName="h-9" />

          <table className="w-full border-collapse mb-2" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "2.2%" }} />
              <col style={{ width: "10.5%" }} />
              {Array.from({ length: 31 }, (_, i) => <col key={i} style={{ width: "2.82%" }} />)}
            </colgroup>
            <thead>
              <tr>
                <th className={th}>No</th>
                <th className={th}>BULAN</th>
                <th className={th} colSpan={31}>TANGGAL</th>
              </tr>
              <tr>
                <th className={th} />
                <th className={th} />
                {Array.from({ length: 31 }, (_, i) => <th key={i} className={th}>{i + 1}</th>)}
              </tr>
            </thead>
            <tbody>
              {m.baris.map((b, i) => (
                <tr key={b.label}>
                  <td className="border border-primary-900/20 text-[8px] text-center px-0.5 py-[2px] bg-primary-50 text-primary-900 font-semibold">{i + 1}</td>
                  <td className={`border border-primary-900/20 text-[8px] px-1 py-[2px] font-bold text-primary-900 ${b.semester === "GANJIL" ? "bg-primary-50" : "bg-primary-100"}`}>
                    {b.label}
                  </td>
                  {b.sel.map(s => (
                    <td key={s.tanggal}
                      title={s.judul ?? undefined}
                      className="border border-primary-900/20 text-[8px] text-center px-0 py-[2px] font-semibold"
                      style={{
                        backgroundColor: !s.ada ? "#E5E7EB" : (s.kode ? s.kode.warna : "#FFFFFF"),
                        color: !s.ada ? "#E5E7EB" : (s.kode ? s.kode.teks : "#0F1A45"),
                      }}>
                      {!s.ada ? "" : (s.nomor !== null ? s.nomor : s.kode?.kode ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Kaki kalender sengaja MEMANJANG MENDATAR, bukan bertumpuk.
              Versi pertama menaruh keterangan, rekap hari efektif, dan daftar hari besar sebagai
              blok bertingkat — totalnya melewati tinggi satu lembar sehingga daftar hari besarnya
              terlempar ke halaman kedua dan meninggalkan ruang kosong sehalaman penuh (temuan user
              13 September 2026). Melebar ke samping memanfaatkan lebar kertas mendatar yang memang
              masih longgar, dan seluruh kalender kembali muat dalam SATU lembar. */}
          <div className="flex items-start gap-3 mb-2 text-[7px]">
            <p className="font-bold text-[8px] bg-primary-50 text-primary-900 px-1.5 py-0.5 shrink-0 self-stretch flex items-center">KETERANGAN</p>
            <div className="flex-1 flex flex-wrap gap-x-3 gap-y-[3px]">
              {m.kodeTerpakai.map(k => (
                <span key={k.kode} className="inline-flex items-center gap-1 whitespace-nowrap">
                  <span className="w-6 text-center font-bold border border-primary-900/20 shrink-0 text-[7px]"
                    style={{ backgroundColor: k.warna, color: k.teks }}>{k.kode}</span>
                  {k.label}
                </span>
              ))}
            </div>
            <div className="shrink-0 border-l border-gray-300 pl-3 leading-[1.5]">
              <div className="flex justify-between gap-3"><span>Hari efektif Semester Ganjil</span><span className="font-bold">: {m.efektifGanjil}</span></div>
              <div className="flex justify-between gap-3"><span>Hari efektif Semester Genap</span><span className="font-bold">: {m.efektifGenap}</span></div>
              {m.jumlahNonEfektif.map(({ kode, jumlah }) => (
                <div key={kode.kode} className="flex justify-between gap-3"><span>{kode.label}</span><span className="font-bold">: {jumlah}</span></div>
              ))}
            </div>
          </div>

          {/* Daftar hari besar dipecah dua kolom (seperti kalender aslinya) supaya tingginya
              separuh, lalu cuti bersama & tanda tangan mengisi sisa lebarnya. */}
          <div className="flex items-start gap-4 text-[7px]">
            {(() => {
              const tengah = Math.ceil(m.hariBesar.length / 2);
              const potong = [m.hariBesar.slice(0, tengah), m.hariBesar.slice(tengah)];
              const Tabel = ({ isi, mulai }: { isi: typeof m.hariBesar; mulai: number }) => (
                <table className="border-collapse w-full">
                  <thead><tr>
                    <th className="border border-primary-900/20 px-1 py-[1px] w-6">No.</th>
                    <th className="border border-primary-900/20 px-1 py-[1px] w-24">Tanggal</th>
                    <th className="border border-primary-900/20 px-1 py-[1px] text-left">Hari Besar</th>
                  </tr></thead>
                  <tbody>
                    {isi.map((h, i) => (
                      <tr key={h.nama}>
                        <td className="border border-primary-900/20 px-1 py-[1px] text-center">{mulai + i}</td>
                        <td className="border border-primary-900/20 px-1 py-[1px] whitespace-nowrap">{h.tanggal}</td>
                        <td className="border border-primary-900/20 px-1 py-[1px]">{h.nama}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
              return (
                <>
                  <div className="flex-1 min-w-0"><Tabel isi={potong[0]} mulai={1} /></div>
                  {potong[1].length > 0 && <div className="flex-1 min-w-0"><Tabel isi={potong[1]} mulai={tengah + 1} /></div>}
                </>
              );
            })()}

            <div className="w-[22%] shrink-0">
              <table className="border-collapse w-full">
                <thead><tr>
                  <th className="border border-primary-900/20 px-1 py-[1px] w-6">No.</th>
                  <th className="border border-primary-900/20 px-1 py-[1px] w-24">Tanggal</th>
                  <th className="border border-primary-900/20 px-1 py-[1px] text-left">Keterangan</th>
                </tr></thead>
                <tbody>
                  {m.cutiBersama.map((h, i) => (
                    <tr key={h.nama}>
                      <td className="border border-primary-900/20 px-1 py-[1px] text-center">{i + 1}</td>
                      <td className="border border-primary-900/20 px-1 py-[1px] whitespace-nowrap">{h.tanggal}</td>
                      <td className="border border-primary-900/20 px-1 py-[1px]">{h.nama}</td>
                    </tr>
                  ))}
                  {m.cutiBersama.length === 0 && <tr><td colSpan={3} className="border border-gray-500 px-1 py-1 text-center text-gray-400">—</td></tr>}
                </tbody>
              </table>
            </div>

            <div className="w-[20%] shrink-0 text-center text-[7px] leading-[1.6]">
              <p>Banyuwangi, {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
              <p className="font-semibold">Kepala SMK Al Munawwir IIBS</p>
              <GambarTtd src={ttdKepala} tinggi={32} />
              <p className="font-semibold underline">{principalName || "( _____________ )"}</p>
            </div>
          </div>
        </div>
      )}

      <style>{"@media print { @page { size: A4 landscape; margin: 0; } .lembar-matriks { padding: 1cm; overflow: visible !important; } }"}</style>
    </div>
  );
}
