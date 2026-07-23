"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Printer, ArrowLeft } from "lucide-react";
import BukuIndukPrintSheet, { PrintStudent } from "@/components/admin/BukuIndukPrintSheet";

export default function CetakBukuIndukPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [student, setStudent] = useState<PrintStudent | null>(null);
  const [logo, setLogo] = useState("");
  const [principalName, setPrincipalName] = useState("");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/buku-induk/siswa/${id}`)
      .then(r => { if (!r.ok) { setNotFound(true); return null; } return r.json(); })
      .then(d => { if (d) setStudent(d); setLoading(false); });
    fetch("/api/settings/logos").then(r => r.json()).then(d => setLogo(d.fullWhite ?? "")).catch(() => {});
    fetch("/api/settings/school-info").then(r => r.json()).then(d => setPrincipalName(d.principalName ?? "")).catch(() => {});
  }, [id]);

  if (loading) return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-100 text-gray-400">Memuat data...</div>;
  if (notFound || !student) return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-gray-100 text-gray-400">
      <p>Data tidak ditemukan</p>
      <button onClick={() => router.back()} className="text-primary-600 hover:underline text-sm">Kembali</button>
    </div>
  );

  return (
    <div className="fixed print:static inset-0 print:inset-auto z-[60] bg-gray-100 print:bg-white overflow-y-auto print:overflow-visible print:h-auto">
      <style>{`@page { size: A4; margin: 0; }`}</style>

      {/* Print controls — hidden on print */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800">
          <ArrowLeft size={16} /> Kembali
        </button>
        <h1 className="text-sm font-semibold text-gray-700">Cetak Buku Induk Siswa</h1>
        <button onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-primary-700 text-white rounded-lg text-sm hover:bg-primary-800">
          <Printer size={15} /> Cetak / Simpan PDF
        </button>
      </div>

      {/* Print container */}
      <div className="py-8 print:py-0 px-4 print:px-0 max-w-[850px] mx-auto print:max-w-none print:mx-0">
        <div className="shadow-lg print:shadow-none">
          <BukuIndukPrintSheet student={student} logoUrl={logo} principalName={principalName} />
        </div>
      </div>
    </div>
  );
}
