export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import KartuPesertaSpmbSheet from "@/components/spmb/KartuPesertaSpmbSheet";
import DokumenTakTerbuka from "@/components/spmb/DokumenTakTerbuka";
import PrintButton from "@/components/shared/PrintButton";
import { getSettings } from "@/lib/site-settings";
import { calonDariTanda } from "@/lib/spmb-tahapan-server";
import { ambilKartuPeserta } from "@/lib/spmb-dokumen";

export const metadata = { title: "Kartu Peserta Tes SPMB" };

/** Kartu peserta tes untuk CALON — tersedia setelah berkas diverifikasi panitia. */
export default async function Page({ searchParams }: { searchParams: Promise<{ nomor?: string; t?: string }> }) {
  const { nomor = "", t = "" } = await searchParams;
  const id = await calonDariTanda(nomor, t);
  const [d, s] = await Promise.all([
    id ? ambilKartuPeserta({ id }) : null,
    getSettings(["school.name", "logo.full_white", "spmb.tahun"]),
  ]);
  if (!d) return <DokumenTakTerbuka />;
  if (!d.terverifikasi) return <DokumenTakTerbuka judul="Kartu peserta belum tersedia" pesan="Kartu peserta tes bisa dicetak setelah berkas pendaftaran diverifikasi panitia. Pantau halaman Tahapan Pendaftaran." />;
  const kembali = `/spmb/tahapan?nomor=${encodeURIComponent(nomor)}&t=${encodeURIComponent(t)}`;
  return (
    <main className="min-h-dvh bg-[#f0f2f7] py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[21cm] flex-wrap justify-end gap-2 px-4 print:hidden">
        <Link href={kembali} className="btn-modal-cancel"><ArrowLeft size={16} /> Kembali</Link>
        <PrintButton />
      </div>
      <KartuPesertaSpmbSheet daftar={[d]} sekolah={s["school.name"] || "SMK Al-Munawwir IIBS"} logoUrl={s["logo.full_white"]} tahun={s["spmb.tahun"]} />
    </main>
  );
}
