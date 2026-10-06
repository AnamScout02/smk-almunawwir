"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Printer, ArrowLeft } from "lucide-react";
import BukuIndukPrintSheet, { PrintStudent } from "@/components/admin/BukuIndukPrintSheet";
import { usePrintTitle } from "@/lib/usePrintTitle";
import { buildPrintFilename } from "@/lib/print-filename";
import TombolKembali from "@/components/shared/TombolKembali";

export default function CetakBukuIndukPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [student, setStudent] = useState<PrintStudent | null>(null);
  usePrintTitle(student ? buildPrintFilename("BUKU_INDUK", student.user.name, student.nis) : null);
  const [logo, setLogo] = useState("");
  const [principalName, setPrincipalName] = useState("");
  const [ttdKepala, setTtdKepala] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/buku-induk/siswa/${id}`)
      .then(r => { if (!r.ok) { setNotFound(true); return null; } return r.json(); })
      .then(d => { if (d) setStudent(d); setLoading(false); }).catch(() => { setLoading(false); });
    fetch("/api/settings/logos").then(r => r.json()).then(d => setLogo(d.fullWhite ?? "")).catch(() => {});
    fetch("/api/settings/school-info").then(r => r.json()).then(d => setPrincipalName(d.principalName ?? "")).catch(() => {});
    fetch("/api/ttd/kepala").then(r => (r.ok ? r.json() : null)).then(d => setTtdKepala(d?.ttd ?? null)).catch(() => {});
    fetch(`/api/admin/buku-induk/siswa/${id}/qr`).then(r => r.json()).then(d => setQrDataUrl(d.qrDataUrl ?? "")).catch(() => {});
  }, [id]);

  if (loading) return <div className="p-6 lg:p-8 pt-16 lg:pt-8 flex items-center justify-center min-h-[60vh] text-gray-400">Memuat data...</div>;
  if (notFound || !student) return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 flex flex-col items-center justify-center gap-3 min-h-[60vh] text-gray-400">
      <p>Data tidak ditemukan</p>
      <TombolKembali />
    </div>
  );

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0 print:pt-0">
      <style>{`@page { size: A4; margin: 0; }`}</style>

      {/* Print controls — hidden on print */}
      <div className="print:hidden sticky top-0 z-10 bg-white border border-gray-200 rounded-2xl px-6 py-3 flex items-center justify-between shadow-sm mb-6">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800">
          <ArrowLeft size={16} /> Kembali
        </button>
        <h1 className="text-sm font-semibold text-gray-700">Cetak Buku Induk Siswa</h1>
        <button onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-primary-700 text-white rounded-lg text-sm hover:bg-primary-900">
          <Printer size={15} /> Cetak / Simpan PDF
        </button>
      </div>

      {/* Print container */}
      <div className="py-8 print:py-0 px-4 print:px-0 max-w-[850px] mx-auto print:max-w-none print:mx-0 overflow-x-auto print:overflow-visible">
        <div className="shadow-lg print:shadow-none">
          <BukuIndukPrintSheet student={student} logoUrl={logo} principalName={principalName} ttdKepala={ttdKepala} qrDataUrl={qrDataUrl} />
        </div>
      </div>
    </div>
  );
}
