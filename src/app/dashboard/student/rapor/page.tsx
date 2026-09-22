export const dynamic = "force-dynamic";

import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";
import PrintButton from "@/components/shared/PrintButton";
import PrintKop from "@/components/shared/PrintKop";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import { getOrCreateVerificationToken } from "@/lib/verification";
import { generateQrDataUrl } from "@/lib/qrcode";
import { susunRaporSiswa } from "@/lib/rapor-data";
import RaporSemester from "@/components/shared/RaporSemester";
import { buildPrintFilename } from "@/lib/print-filename";
import { semesterRaporSekolah } from "@/components/rapor/RaporSekolahSiswa";
import { TautanIkon } from "@/components/shared/IkonNama";

export async function generateMetadata() {
  const session = await verifyRole(["STUDENT"]);
  const student = await prisma.student.findFirst({ where: { user: { email: session.email } }, select: { nis: true } });
  return { title: { absolute: buildPrintFilename("RAPOR", session.name, student?.nis) } };
}

export default async function RaporPage() {
  const session = await verifyRole(["STUDENT"]);

  const settings = await getSettings(["logo.full_white"]);
  const student = await prisma.student.findFirst({
    where: { user: { email: session.email } },
    include: {
      user: { select: { name: true, email: true } },
      class: { select: { name: true, grade: true } },
      major: { select: { name: true, code: true } },
      attendance: { orderBy: { date: "asc" } },
    },
  });

  let qrDataUrl = "";
  if (student) {
    const token = await getOrCreateVerificationToken(student.id);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    qrDataUrl = await generateQrDataUrl(`${baseUrl}/verify/${token}`);
  }

  // Nilai dihitung dari rata-rata skor Pengetahuan/Keterampilan yang guru mapel isi di Jurnal
  // Mengajar tiap pertemuan — lihat komentar di src/lib/journal-grades.ts.
  // Nilai, KKM per mapel, predikat, deskripsi capaian & kehadiran per semester — satu sumber: src/lib/rapor-data.ts.
  const raporSemester = student ? await susunRaporSiswa({ id: student.id, classId: student.classId, majorId: student.majorId, grade: student.class?.grade ?? null }) : [];

  // Rapor format sekolah (Form Nilai Rapor + isian wali kelas) — hanya semester yang sudah disahkan.
  const semSekolah = await semesterRaporSekolah(student?.classId ?? null);

  // Rekap absensi
  const attSummary = ["HADIR", "IZIN", "SAKIT", "ALPHA"].map(s => ({
    status: s,
    count: student?.attendance.filter(a => a.status === s).length ?? 0,
  }));
  const totalDays = student?.attendance.length ?? 0;
  const presentPct = totalDays ? Math.round(((student?.attendance.filter(a => a.status === "HADIR").length ?? 0) / totalDays) * 100) : 0;

  const today = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });


  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0">
      <PageHeader
        icon={<FileText size={22} />}
        title="Rapor Nilai"
        description="Laporan hasil belajar & rekap kehadiran"
        printHidden
      />

      <div className="flex items-center gap-2 mb-5 print:hidden">
        <Link href="/dashboard/student" className="btn-modal-cancel">
          <ArrowLeft size={18} /> Kembali
        </Link>
        <PrintButton />
      </div>

      {semSekolah.length > 0 && (
        <div className="panel p-4 mb-5 print:hidden">
          <p className="text-sm font-semibold text-primary-900">Rapor sekolah (sudah disahkan)</p>
          <p className="text-xs text-gray-500 mb-3">Rapor Akhir, Tengah Semester, dan Diniyah dalam format buku rapor sekolah — bisa dicetak.</p>
          <div className="flex flex-wrap gap-2">
            {semSekolah.map(s => (
              <TautanIkon key={s} href={`/dashboard/student/rapor/sekolah?semester=${encodeURIComponent(s)}`} ikon="cetak" className="btn-modal-cancel">{s}</TautanIkon>
            ))}
          </div>
        </div>
      )}

      {/* Konten rapor — ikut print */}
      <div className="print-doc bg-white max-w-4xl mx-auto px-6 py-8 print:p-6 print:max-w-none">
        {/* Header rapor */}
        <PrintKop title="Laporan Hasil Belajar Siswa" subtitle="SMK Al Munawwir IIBS" logoUrl={settings["logo.full_white"]} />
        <p className="text-center text-gray-400 text-xs mb-6 -mt-2">Singojuruh, Banyuwangi, Jawa Timur · NPSN 69896523</p>

        {/* Data siswa */}
        <div className="bg-gray-50 rounded-xl p-4 mb-6 grid grid-cols-2 gap-2 text-sm">
          <div><span className="text-gray-500">Nama</span><span className="mx-2">:</span><strong>{student?.user.name ?? session.name}</strong></div>
          <div><span className="text-gray-500">Kelas</span><span className="mx-2">:</span><strong>{student?.class?.name ?? "—"}</strong></div>
          <div><span className="text-gray-500">NIS</span><span className="mx-2">:</span><strong className="font-mono">{student?.nis ?? "—"}</strong></div>
          <div><span className="text-gray-500">Jurusan</span><span className="mx-2">:</span><strong>{student?.major?.name ?? "—"}</strong></div>
          <div><span className="text-gray-500">NISN</span><span className="mx-2">:</span><strong className="font-mono">{student?.nisn ?? "—"}</strong></div>
          <div><span className="text-gray-500">Dicetak</span><span className="mx-2">:</span>{today}</div>
        </div>

        {/* Nilai per semester */}
        <RaporSemester data={raporSemester} formatSekolah={semSekolah} />

        {/* Rekap absensi */}
        {totalDays > 0 && (
          <div className="mt-6 border-t pt-6">
            <h4 className="font-heading font-bold text-primary-900 mb-3">Rekap Kehadiran Keseluruhan</h4>
            <div className="grid grid-cols-4 gap-3">
              {attSummary.map(({ status, count }) => (
                <StatTile key={status} size="md" tampilan="gradien"
                  color={status === "HADIR" ? "emerald" : status === "IZIN" ? "blue" : status === "SAKIT" ? "amber" : "red"}
                  ikon={status === "HADIR" ? "centang" : status === "IZIN" ? "izin" : status === "SAKIT" ? "sakit" : "alpha"}
                  value={count} label={status} />
              ))}
            </div>
            <p className="text-sm text-gray-500 mt-2">Total: {totalDays} hari · Persentase kehadiran: <strong>{presentPct}%</strong></p>
          </div>
        )}

        {/* Tanda tangan */}
        <div className="mt-10 grid grid-cols-3 gap-3 sm:gap-8 text-center text-sm">
          <div className="min-w-0">
            <p className="text-gray-500 mb-12">Wali Kelas,</p>
            <div className="border-b border-gray-400 mb-1" />
            <p className="text-gray-500 break-words">( _____________ )</p>
          </div>
          <div className="min-w-0">
            <p className="text-gray-500 mb-12">Mengetahui,<br />Kepala Sekolah</p>
            <div className="border-b border-gray-400 mb-1" />
            <p className="text-gray-500 break-words">( _____________ )</p>
          </div>
          <div className="min-w-0">
            <p className="text-gray-500 mb-12">Orang Tua / Wali,</p>
            <div className="border-b border-gray-400 mb-1" />
            <p className="text-gray-500 break-words">( _____________ )</p>
          </div>
        </div>

        {qrDataUrl && (
          <div className="mt-8 flex justify-center">
            <div className="text-center text-[10px] text-gray-400">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="QR verifikasi dokumen" className="w-20 h-20 mx-auto" />
              <p className="mt-1">Scan untuk verifikasi keaslian dokumen</p>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          body { background: white; }
        }
      `}</style>
    </div>
  );
}
