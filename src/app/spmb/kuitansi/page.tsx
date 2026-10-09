export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import KuitansiSpmbSheet from "@/components/spmb/KuitansiSpmbSheet";
import DokumenTakTerbuka from "@/components/spmb/DokumenTakTerbuka";
import PrintButton from "@/components/shared/PrintButton";
import { getSettings } from "@/lib/site-settings";
import { calonDariTanda } from "@/lib/spmb-tahapan-server";
import { ambilKuitansi } from "@/lib/spmb-dokumen";

export const metadata = { title: "Kuitansi Pembayaran SPMB" };

/** Kuitansi cicilan untuk CALON — hanya pembayaran SAH milik calon itu sendiri (admissionId dari tanda). */
export default async function Page({ searchParams }: { searchParams: Promise<{ nomor?: string; t?: string; p?: string }> }) {
  const { nomor = "", t = "", p = "" } = await searchParams;
  const id = await calonDariTanda(nomor, t);
  const [d, s] = await Promise.all([
    id && p ? ambilKuitansi(p, id) : null,
    getSettings(["school.name", "logo.full_white", "spmb.tahun"]),
  ]);
  if (!d) return <DokumenTakTerbuka judul="Kuitansi tidak bisa dibuka" pesan="Kuitansi hanya tersedia untuk pembayaran yang sudah disahkan panitia. Buka lagi dari kartu Pembayaran di halaman Tahapan Pendaftaran." />;
  const kembali = `/spmb/tahapan?nomor=${encodeURIComponent(nomor)}&t=${encodeURIComponent(t)}`;
  return (
    <main className="min-h-dvh bg-[#f0f2f7] py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[21cm] flex-wrap justify-end gap-2 px-4 print:hidden">
        <Link href={kembali} className="btn-modal-cancel"><ArrowLeft size={16} /> Kembali</Link>
        <PrintButton />
      </div>
      <KuitansiSpmbSheet d={d} sekolah={s["school.name"] || "SMK Al-Munawwir IIBS"} logoUrl={s["logo.full_white"]} tahun={s["spmb.tahun"]} />
    </main>
  );
}
