export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PaktaSpmbSheet from "@/components/spmb/PaktaSpmbSheet";
import DokumenTakTerbuka from "@/components/spmb/DokumenTakTerbuka";
import PrintButton from "@/components/shared/PrintButton";
import { getSettings } from "@/lib/site-settings";
import { calonDariTanda } from "@/lib/spmb-tahapan-server";
import { ambilPakta } from "@/lib/spmb-dokumen";

export const metadata = { title: "Cetak Surat Pernyataan SPMB" };

/** Cetak surat pernyataan oleh CALON (tanpa akun) — kunci nomor + tanda, sama dengan halaman tahapan. */
export default async function Page({ searchParams }: { searchParams: Promise<{ nomor?: string; t?: string }> }) {
  const { nomor = "", t = "" } = await searchParams;
  const id = await calonDariTanda(nomor, t);
  const [d, s] = await Promise.all([
    id ? ambilPakta({ id }) : null,
    getSettings(["school.name", "logo.full_white", "spmb.tahun"]),
  ]);
  if (!d) return <DokumenTakTerbuka />;
  const kembali = `/spmb/tahapan?nomor=${encodeURIComponent(nomor)}&t=${encodeURIComponent(t)}`;
  return (
    <main className="min-h-dvh bg-[#f0f2f7] py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[21cm] flex-wrap justify-end gap-2 px-4 print:hidden">
        <Link href={kembali} className="btn-modal-cancel"><ArrowLeft size={16} /> Kembali</Link>
        <PrintButton />
      </div>
      <PaktaSpmbSheet d={d} sekolah={s["school.name"] || "SMK Al-Munawwir IIBS"} logoUrl={s["logo.full_white"]} tahun={s["spmb.tahun"]} />
    </main>
  );
}
