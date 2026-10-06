"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Printer, ArrowLeft } from "lucide-react";
import BukuIndukPrintSheet, { PrintStudent } from "@/components/admin/BukuIndukPrintSheet";
import { usePrintTitle } from "@/lib/usePrintTitle";
import { buildPrintFilename } from "@/lib/print-filename";
import TombolKembali from "@/components/shared/TombolKembali";

export default function CetakKelasPage() {
  const { classId } = useParams<{ classId: string }>();
  const router = useRouter();
  const [students, setStudents] = useState<PrintStudent[]>([]);
  const [className, setClassName] = useState("");
  usePrintTitle(className ? buildPrintFilename("BUKU_INDUK-Kelas", className) : null);
  const [logo, setLogo] = useState("");
  const [principalName, setPrincipalName] = useState("");
  const [ttdKepala, setTtdKepala] = useState<string | null>(null);
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/buku-induk/siswa?classId=${classId}`)
      .then(r => r.json())
      .then((d: PrintStudent[]) => {
        setStudents(Array.isArray(d) ? d : []);
        if (Array.isArray(d) && d[0]?.class?.name) setClassName(d[0].class.name);
        setLoading(false);
      }).catch(() => { setLoading(false); });
    fetch("/api/settings/logos").then(r => r.json()).then(d => setLogo(d.fullWhite ?? "")).catch(() => {});
    fetch("/api/settings/school-info").then(r => r.json()).then(d => setPrincipalName(d.principalName ?? "")).catch(() => {});
    fetch("/api/ttd/kepala").then(r => (r.ok ? r.json() : null)).then(d => setTtdKepala(d?.ttd ?? null)).catch(() => {});
    fetch(`/api/admin/buku-induk/siswa/qr?classId=${classId}`).then(r => r.json()).then(setQrMap).catch(() => {});
  }, [classId]);

  if (loading) return <div className="p-6 lg:p-8 pt-16 lg:pt-8 flex items-center justify-center min-h-[60vh] text-gray-400">Memuat data...</div>;
  if (students.length === 0) {
    return (
      <div className="p-6 lg:p-8 pt-16 lg:pt-8 flex flex-col items-center justify-center gap-3 min-h-[60vh] text-gray-400">
        <p>Belum ada siswa di kelas ini</p>
        <TombolKembali />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0 print:pt-0">
      <style>{`@page { size: A4; margin: 0; }`}</style>

      {/* Print controls — hidden on print */}
      <div className="print:hidden sticky top-0 z-10 bg-white border border-gray-200 rounded-2xl px-6 py-3 flex items-center justify-between shadow-sm mb-6">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800">
          <ArrowLeft size={16} /> Kembali
        </button>
        <h1 className="text-sm font-semibold text-gray-700">
          Cetak Buku Induk Kelas {className || ""} — {students.length} siswa
        </h1>
        <button onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-primary-700 text-white rounded-lg text-sm hover:bg-primary-900">
          <Printer size={15} /> Cetak / Simpan PDF
        </button>
      </div>

      {/* Print container */}
      <div className="py-8 print:py-0 px-4 print:px-0 max-w-[850px] mx-auto print:max-w-none print:mx-0 space-y-8 print:space-y-0 overflow-x-auto print:overflow-visible">
        {students.map((s, i) => (
          <div key={s.id} className="shadow-lg print:shadow-none">
            <BukuIndukPrintSheet student={s} logoUrl={logo} principalName={principalName} ttdKepala={ttdKepala} qrDataUrl={qrMap[s.id]} isLastInSequence={i === students.length - 1} />
          </div>
        ))}
      </div>
    </div>
  );
}
