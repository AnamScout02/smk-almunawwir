"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Printer, ArrowLeft } from "lucide-react";
import BukuIndukPrintSheet, { PrintStudent } from "@/components/admin/BukuIndukPrintSheet";

export default function CetakKelasPage() {
  const { classId } = useParams<{ classId: string }>();
  const router = useRouter();
  const [students, setStudents] = useState<PrintStudent[]>([]);
  const [className, setClassName] = useState("");
  const [letterhead, setLetterhead] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/buku-induk/siswa?classId=${classId}`)
      .then(r => r.json())
      .then((d: PrintStudent[]) => {
        setStudents(Array.isArray(d) ? d : []);
        if (Array.isArray(d) && d[0]?.class?.name) setClassName(d[0].class.name);
        setLoading(false);
      });
    fetch("/api/settings/letterhead").then(r => r.json()).then(d => setLetterhead(d.url ?? "")).catch(() => {});
  }, [classId]);

  if (loading) return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-100 text-gray-400">Memuat data...</div>;
  if (students.length === 0) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-gray-100 text-gray-400">
        <p>Belum ada siswa di kelas ini</p>
        <button onClick={() => router.back()} className="text-primary-600 hover:underline text-sm">Kembali</button>
      </div>
    );
  }

  return (
    <div className="fixed print:static inset-0 print:inset-auto z-[60] bg-gray-100 print:bg-white overflow-y-auto print:overflow-visible print:h-auto">
      <style>{`@page { size: A4; margin: 12mm; }`}</style>

      {/* Print controls — hidden on print */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800">
          <ArrowLeft size={16} /> Kembali
        </button>
        <h1 className="text-sm font-semibold text-gray-700">
          Cetak Buku Induk Kelas {className || ""} — {students.length} siswa
        </h1>
        <button onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-primary-700 text-white rounded-lg text-sm hover:bg-primary-800">
          <Printer size={15} /> Cetak / Simpan PDF
        </button>
      </div>

      {/* Print container */}
      <div className="py-8 print:py-0 px-4 print:px-0 space-y-8 print:space-y-0">
        {students.map(s => (
          <BukuIndukPrintSheet key={s.id} student={s} letterheadUrl={letterhead} />
        ))}
      </div>
    </div>
  );
}
