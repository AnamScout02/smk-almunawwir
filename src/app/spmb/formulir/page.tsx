export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft, FileX2, House } from "lucide-react";
import FormulirSpmbSheet from "@/components/spmb/FormulirSpmbSheet";
import PrintButton from "@/components/shared/PrintButton";
import { getSettings } from "@/lib/site-settings";
import { ambilFormulir, lahirIso, tandaCocok } from "@/lib/spmb-formulir";

export const metadata = { title: "Cetak Formulir Pendaftaran SPMB" };

/** Cetak formulir oleh PENDAFTAR sendiri — tanpa akun. Kuncinya nomor pendaftaran + `t`, yaitu
 *  tanda ringkas dari nomor + tanggal lahir yang diterbitkan halaman Cek Status setelah keduanya
 *  benar. Tanggal lahir SENGAJA tidak ikut di alamat supaya tidak tertinggal di riwayat peramban
 *  komputer yang dipakai bergantian. */
export default async function Page({ searchParams }: { searchParams: Promise<{ nomor?: string; t?: string }> }) {
  const { nomor = "", t = "" } = await searchParams;
  const s = await getSettings(["school.name", "logo.full_white", "spmb.tahun"]);
  const sekolah = s["school.name"] || "SMK Al-Munawwir IIBS";

  const d = nomor && t ? await ambilFormulir({ nomor: nomor.toUpperCase() }) : null;
  const sah = !!d && tandaCocok(d.nomor ?? "", lahirIso(d.birthDate), t);

  if (!d || !sah) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-cream px-4 py-10">
        <div className="panel w-full max-w-md p-8 text-center">
          <FileX2 size={40} className="mx-auto mb-4 text-gray-300" />
          <h1 className="font-heading mb-2 text-lg font-semibold text-navy">Formulir tidak bisa dibuka</h1>
          <p className="text-sm leading-relaxed text-gray-500">
            Tautan cetak sudah tidak berlaku atau tidak lengkap. Buka halaman SPMB, pilih
            <span className="font-medium"> Cek Status</span>, masukkan nomor pendaftaran dan tanggal lahir,
            lalu tekan tombol cetak di sana.
          </p>
          <Link href="/admissions" className="btn-modal-cancel mt-5 inline-flex"><House size={16} /> Halaman SPMB</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[#f0f2f7] py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[21cm] flex-wrap justify-end gap-2 px-4 print:hidden">
        <Link href="/admissions" className="btn-modal-cancel"><ArrowLeft size={16} /> Kembali</Link>
        <PrintButton />
      </div>
      <FormulirSpmbSheet d={d} sekolah={sekolah} logoUrl={s["logo.full_white"]} tahun={s["spmb.tahun"]} />
    </main>
  );
}
