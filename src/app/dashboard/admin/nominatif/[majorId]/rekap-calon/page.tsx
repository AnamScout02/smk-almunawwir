export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";
import { getSettings, getPrincipalName } from "@/lib/site-settings";
import PageHeader from "@/components/admin/PageHeader";
import PrintButton from "@/components/shared/PrintButton";
import PrintKop from "@/components/shared/PrintKop";

export default async function RekapCalonCetakPage({ params, searchParams }: {
  params: Promise<{ majorId: string }>; searchParams: Promise<{ academicYearId?: string }>;
}) {
  await verifyTasAccess();
  const { majorId } = await params;
  const { academicYearId } = await searchParams;

  const major = await prisma.major.findUnique({ where: { id: majorId } });
  if (!major) notFound();

  const [year, settings] = await Promise.all([
    academicYearId ? prisma.academicYear.findUnique({ where: { id: academicYearId } }) : prisma.academicYear.findFirst({ where: { isActive: true } }),
    getSettings([
      "logo.full_white", "school.structure",
      "nominatif.npsn", "nominatif.kdProp", "nominatif.kdRayon", "nominatif.kdSekolah",
      "nominatif.jumlahServerUtama", "nominatif.jumlahServerCadangan", "nominatif.tempatUjian",
      "nominatif.kabKota",
    ]),
  ]);

  let jumlahPeserta = 0;
  if (year && !year.isActive) {
    jumlahPeserta = await prisma.studentClassHistory.count({
      where: { academicYearId: year.id, grade: 12, majorName: major.name, status: { in: ["AKTIF", "LULUS"] } },
    });
  } else {
    jumlahPeserta = await prisma.student.count({ where: { majorId, studentStatus: "AKTIF", class: { grade: 12 } } });
  }

  const principalName = getPrincipalName(settings["school.structure"]);
  const tahunPelajaran = year?.name ?? "—";
  const kabKota = settings["nominatif.kabKota"] || "—";
  const serverUtama = settings["nominatif.jumlahServerUtama"] || "1";
  const serverCadangan = settings["nominatif.jumlahServerCadangan"] || "1";
  const tempatUjian = settings["nominatif.tempatUjian"] || "SMK AL MUNAWWIR IIBS";

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0 min-h-dvh print:min-h-0 bg-white">
      <style>{"@page { size: A4 landscape; margin: 1cm; }"}</style>

      <PageHeader icon={<ClipboardList size={22} />} title={`Rekap Calon — ${major.name}`}
        description={`Jumlah peserta UKK/USP — Tahun Pelajaran ${tahunPelajaran}`} printHidden />

      <div className="flex items-center gap-2 mb-5 print:hidden">
        <Link href="/dashboard/admin/nominatif" className="btn-modal-cancel">
          <ArrowLeft size={18} /> Kembali
        </Link>
        <PrintButton />
      </div>

      <div className="print-doc bg-white">
        <PrintKop title="Rekap Calon Peserta UKK & USP" subtitle={`Tahun Pelajaran ${tahunPelajaran} — Dinas Pendidikan Kabupaten ${kabKota}`} logoUrl={settings["logo.full_white"]} />

        {/* Tabel resmi bergaris penuh, lebar kolom tetap + wrap teks — lihat catatan di
            nominatif/[majorId]/cetak/page.tsx */}
        <table className="w-full border-collapse text-sm mb-8" style={{ tableLayout: "fixed" }}>
          {/* Keterangan sempat cuma 3% — judul kolomnya sendiri ("Keterangan") kepotong tak
              muat (temuan user 2026-09-11). Diperlebar jadi 9%, diambil dari Nama Sekolah &
              Tempat Pelaksanaan Ujian yang sebelumnya kebagian jatah lebih dari cukup. */}
          <colgroup>
            <col style={{ width: "3%" }} /><col style={{ width: "6%" }} /><col style={{ width: "6%" }} /><col style={{ width: "7%" }} />
            <col style={{ width: "8%" }} /><col style={{ width: "11%" }} /><col style={{ width: "5%" }} /><col style={{ width: "5%" }} />
            <col style={{ width: "8%" }} /><col style={{ width: "6%" }} /><col style={{ width: "7%" }} /><col style={{ width: "8%" }} />
            <col style={{ width: "11%" }} /><col style={{ width: "9%" }} />
          </colgroup>
          <thead>
            <tr>
              {["No", "Kd Prop", "Kd Rayon", "Kd Sekolah", "NPSN", "Nama Sekolah"].map(h => (
                <th key={h} rowSpan={2} className="border border-gray-800 bg-primary-900 text-white px-2 py-1.5 align-middle">{h}</th>
              ))}
              <th colSpan={2} className="border border-gray-800 bg-primary-900 text-white px-2 py-1.5">Peserta UKK &amp; USP Tahun</th>
              <th rowSpan={2} className="border border-gray-800 bg-primary-900 text-white px-2 py-1.5 align-middle">Jumlah Peserta</th>
              <th colSpan={2} className="border border-gray-800 bg-primary-900 text-white px-2 py-1.5">Jumlah Server</th>
              {["Jumlah Client", "Tempat Pelaksanaan Ujian", "Keterangan"].map(h => (
                <th key={h} rowSpan={2} className="border border-gray-800 bg-primary-900 text-white px-2 py-1.5 align-middle">{h}</th>
              ))}
            </tr>
            <tr>
              {["Th Lalu", "Th Ini", "Utama", "Cadangan"].map(h => (
                <th key={h} className="border border-gray-800 bg-primary-900 text-white px-2 py-1.5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-800 px-2 py-1 text-center align-middle">1</td>
              <td className="border border-gray-800 px-2 py-1 text-center align-middle">{settings["nominatif.kdProp"] || "—"}</td>
              <td className="border border-gray-800 px-2 py-1 text-center align-middle">{settings["nominatif.kdRayon"] || "—"}</td>
              <td className="border border-gray-800 px-2 py-1 text-center align-middle">{settings["nominatif.kdSekolah"] || "—"}</td>
              <td className="border border-gray-800 px-2 py-1 text-center align-middle">{settings["nominatif.npsn"] || "—"}</td>
              <td className="border border-gray-800 px-2 py-1 text-center align-middle break-words">SMK AL MUNAWWIR IIBS</td>
              <td className="border border-gray-800 px-2 py-1 text-center align-middle">P</td>
              <td className="border border-gray-800 px-2 py-1 text-center align-middle">P</td>
              <td className="border border-gray-800 px-2 py-1 text-center align-middle font-semibold">{jumlahPeserta}</td>
              <td className="border border-gray-800 px-2 py-1 text-center align-middle">{serverUtama}</td>
              <td className="border border-gray-800 px-2 py-1 text-center align-middle">{serverCadangan}</td>
              <td className="border border-gray-800 px-2 py-1 text-center align-middle">{jumlahPeserta}</td>
              <td className="border border-gray-800 px-2 py-1 text-center align-middle break-words">{tempatUjian}</td>
              <td className="border border-gray-800 px-2 py-1"></td>
            </tr>
            <tr className="font-semibold">
              <td colSpan={8} className="border border-gray-800 px-2 py-1 text-center align-middle">JUMLAH</td>
              <td className="border border-gray-800 px-2 py-1 text-center align-middle">{jumlahPeserta}</td>
              <td className="border border-gray-800 px-2 py-1 text-center align-middle">{serverUtama}</td>
              <td className="border border-gray-800 px-2 py-1 text-center align-middle">{serverCadangan}</td>
              <td className="border border-gray-800 px-2 py-1 text-center align-middle">{jumlahPeserta}</td>
              <td className="border border-gray-800 px-2 py-1"></td>
              <td className="border border-gray-800 px-2 py-1"></td>
            </tr>
          </tbody>
        </table>

        {/* breakInside:avoid SEMPAT KELUPAAN di sini (beda dari blok TTD 3-kolom di 2 dokumen
            lain yang sudah punya) — akibatnya baris "Kepala SMK..." kepisah dari nama/TTD-nya
            sendiri ke halaman berikutnya (temuan user 2026-09-12, kelihatan jelas: nama Kepala
            Sekolah sendirian di halaman 2). */}
        <div className="text-xs text-right pr-8" style={{ breakInside: "avoid" }}>
          <p>Banyuwangi, {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
          <p className="font-semibold">Kepala SMK Al Munawwir IIBS</p>
          <div className="h-10" />
          <p className="font-semibold underline">{principalName || "( _____________ )"}</p>
        </div>
      </div>
    </div>
  );
}
