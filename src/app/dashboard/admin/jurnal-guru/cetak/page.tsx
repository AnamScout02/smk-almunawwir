"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Printer, ArrowLeft, Loader2 } from "lucide-react";
import PrintKop from "@/components/shared/PrintKop";
import { usePrintTitle } from "@/lib/usePrintTitle";
import { buildPrintFilename } from "@/lib/print-filename";

interface HistoryRow {
  id: string; date: string; className: string; subject: string; materi: string;
  hadir: number; izin: number; sakit: number; alpha: number;
  avgPengetahuan: number | null; avgKeterampilan: number | null; catatanCount: number;
}

function CetakJurnalGuruContent() {
  const router = useRouter();
  const params = useSearchParams();
  const teacherId = params.get("teacherId") ?? "";
  const classId = params.get("classId") ?? "";
  const subject = params.get("subject") ?? "";
  const semester = params.get("semester") ?? "";

  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [teacherName, setTeacherName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!classId || !subject || !teacherId) return;
    Promise.all([
      fetch(`/api/teacher/journal/history?teacherId=${teacherId}&classId=${classId}&subject=${encodeURIComponent(subject)}&semester=${encodeURIComponent(semester)}`).then(r => r.json()),
      fetch(`/api/teacher/me?teacherId=${teacherId}`).then(r => r.json()),
      fetch("/api/settings/logos").then(r => r.json()),
    ]).then(([hist, me, logos]) => {
      setRows(Array.isArray(hist) ? hist : []);
      setTeacherName(me.name ?? "");
      setLogoUrl(logos.fullWhite ?? "");
      setLoading(false);
    }).catch(() => { setLoading(false); });
  }, [classId, subject, semester, teacherId]);

  const className = rows[0]?.className ?? "";
  usePrintTitle(buildPrintFilename("REKAP_JURNAL", className, subject, semester));
  const totalHadir = rows.reduce((a, r) => a + r.hadir, 0);
  const totalIzin = rows.reduce((a, r) => a + r.izin, 0);
  const totalSakit = rows.reduce((a, r) => a + r.sakit, 0);
  const totalAlpha = rows.reduce((a, r) => a + r.alpha, 0);

  if (loading) return <div className="p-6 lg:p-8 pt-16 lg:pt-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0 print:pt-0">
      <style>{`@page { size: A4 landscape; margin: 1.5cm; }`}</style>

      <div className="print:hidden sticky top-0 z-10 bg-white border border-gray-200 rounded-2xl px-6 py-3 flex items-center justify-between shadow-sm mb-6">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800">
          <ArrowLeft size={16} /> Kembali
        </button>
        <h1 className="text-sm font-semibold text-gray-700">Cetak Rekap Jurnal Mengajar — {className} · {subject}</h1>
        <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-primary-700 text-white rounded-lg text-sm hover:bg-primary-900">
          <Printer size={15} /> Cetak / Simpan PDF
        </button>
      </div>

      <div className="print-doc bg-white max-w-[1150px] mx-auto">
        <PrintKop title="Rekap Jurnal Mengajar" subtitle="SMK Al Munawwir IIBS" logoUrl={logoUrl} />
        <div className="mb-3 space-y-0.5 text-xs text-primary-700">
          <div className="flex"><span className="w-32 shrink-0">Kelas</span><span>: {className}</span></div>
          <div className="flex"><span className="w-32 shrink-0">Mata Pelajaran</span><span>: {subject}</span></div>
          <div className="flex"><span className="w-32 shrink-0">Guru Mapel</span><span>: {teacherName}</span></div>
          <div className="flex"><span className="w-32 shrink-0">Semester</span><span>: {semester}</span></div>
        </div>

        {rows.length === 0 ? (
          <p className="text-center text-gray-400 py-10">Belum ada pertemuan tercatat untuk semester ini.</p>
        ) : (
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr className="bg-primary-900 text-white">
                <th className="border border-primary-900 px-2 py-1.5 w-8">No</th>
                <th className="border border-primary-900 px-2 py-1.5 w-24">Tanggal</th>
                <th className="border border-primary-900 px-2 py-1.5">Materi yang Diajarkan</th>
                <th className="border border-primary-900 px-2 py-1.5 w-12">Hadir</th>
                <th className="border border-primary-900 px-2 py-1.5 w-12">Izin</th>
                <th className="border border-primary-900 px-2 py-1.5 w-12">Sakit</th>
                <th className="border border-primary-900 px-2 py-1.5 w-12">Alfa</th>
                <th className="border border-primary-900 px-2 py-1.5 w-20">Rata Pengetahuan</th>
                <th className="border border-primary-900 px-2 py-1.5 w-20">Rata Keterampilan</th>
                <th className="border border-primary-900 px-2 py-1.5 w-24">Catatan Siswa</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id}>
                  <td className="border border-gray-300 text-center">{i + 1}</td>
                  <td className="border border-gray-300 text-center whitespace-nowrap">
                    {new Date(r.date).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td className="border border-gray-300 px-1.5 py-1">{r.materi}</td>
                  <td className="border border-gray-300 text-center">{r.hadir}</td>
                  <td className="border border-gray-300 text-center">{r.izin}</td>
                  <td className="border border-gray-300 text-center">{r.sakit}</td>
                  <td className="border border-gray-300 text-center">{r.alpha}</td>
                  <td className="border border-gray-300 text-center">{r.avgPengetahuan ?? "—"}</td>
                  <td className="border border-gray-300 text-center">{r.avgKeterampilan ?? "—"}</td>
                  <td className="border border-gray-300 text-center">{r.catatanCount > 0 ? `${r.catatanCount} siswa` : "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-bold bg-gray-50">
                <td className="border border-gray-300 text-center" colSpan={3}>Total {rows.length} pertemuan</td>
                <td className="border border-gray-300 text-center">{totalHadir}</td>
                <td className="border border-gray-300 text-center">{totalIzin}</td>
                <td className="border border-gray-300 text-center">{totalSakit}</td>
                <td className="border border-gray-300 text-center">{totalAlpha}</td>
                <td className="border border-gray-300" colSpan={3} />
              </tr>
            </tfoot>
          </table>
        )}

        <div className="flex justify-end mt-8 text-xs text-primary-700 text-center">
          <div>
            <p>Singojuruh, {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
            <p>Guru Mata Pelajaran</p>
            <div className="h-12" />
            <p className="font-bold underline text-primary-900">{teacherName || "—"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CetakJurnalGuruPage() {
  return (
    <Suspense fallback={<div className="p-6 lg:p-8 pt-16 lg:pt-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>}>
      <CetakJurnalGuruContent />
    </Suspense>
  );
}
