export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import FormulirSpmbSheet from "@/components/spmb/FormulirSpmbSheet";
import PrintButton from "@/components/shared/PrintButton";
import { getSettings } from "@/lib/site-settings";
import { verifySpmbAccess } from "@/lib/spmb";
import { ambilFormulir } from "@/lib/spmb-formulir";

export const metadata = { title: "Cetak Formulir Pendaftar" };

/** Cetak formulir oleh PANITIA — lembar yang sama persis dengan yang dicetak pendaftar. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await verifySpmbAccess();
  const { id } = await params;
  const [d, s] = await Promise.all([
    ambilFormulir({ id }),
    getSettings(["school.name", "logo.full_white", "spmb.tahun"]),
  ]);
  if (!d) notFound();

  return (
    <div className="py-6 print:py-0">
      <div className="mx-auto mb-4 flex max-w-[21cm] flex-wrap justify-end gap-2 px-4 print:hidden">
        <Link href="/pusat-spmb/pendaftar" className="btn-modal-cancel"><ArrowLeft size={16} /> Kembali</Link>
        <PrintButton />
      </div>
      <FormulirSpmbSheet d={d} sekolah={s["school.name"] || "SMK Al-Munawwir IIBS"}
        logoUrl={s["logo.full_white"]} tahun={s["spmb.tahun"]} />
    </div>
  );
}
