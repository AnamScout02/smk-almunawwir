export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import KuitansiSpmbSheet from "@/components/spmb/KuitansiSpmbSheet";
import PrintButton from "@/components/shared/PrintButton";
import { getSettings } from "@/lib/site-settings";
import { verifySpmbAccess } from "@/lib/spmb";
import { ambilKuitansi } from "@/lib/spmb-dokumen";

export const metadata = { title: "Cetak Kuitansi SPMB" };

export default async function Page({ params }: { params: Promise<{ pid: string }> }) {
  await verifySpmbAccess();
  const { pid } = await params;
  const [d, s] = await Promise.all([ambilKuitansi(pid), getSettings(["school.name", "logo.full_white", "spmb.tahun"])]);
  if (!d) notFound();
  return (
    <div className="py-6 print:py-0">
      <div className="mx-auto mb-4 flex max-w-[21cm] flex-wrap justify-end gap-2 px-4 print:hidden">
        <Link href="/pusat-spmb/tahapan" className="btn-modal-cancel"><ArrowLeft size={16} /> Kembali</Link>
        <PrintButton />
      </div>
      <KuitansiSpmbSheet d={d} sekolah={s["school.name"] || "SMK Al-Munawwir IIBS"} logoUrl={s["logo.full_white"]} tahun={s["spmb.tahun"]} />
    </div>
  );
}
