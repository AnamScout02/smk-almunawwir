import Link from "next/link";
import { FileX2, House } from "lucide-react";

/** Tampilan saat dokumen calon tidak bisa dibuka (tautan kedaluwarsa/salah, atau dokumen belum tersedia). */
export default function DokumenTakTerbuka({ judul = "Dokumen tidak bisa dibuka", pesan }: { judul?: string; pesan?: string }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-cream px-4 py-10">
      <div className="panel w-full max-w-md p-8 text-center">
        <FileX2 size={40} className="mx-auto mb-4 text-gray-300" />
        <h1 className="font-heading mb-2 text-lg font-semibold text-navy">{judul}</h1>
        <p className="text-sm leading-relaxed text-gray-500">
          {pesan ?? "Tautan sudah tidak berlaku atau tidak lengkap. Buka lagi halaman Tahapan Pendaftaran dengan nomor pendaftaran dan tanggal lahir, lalu tekan tombol cetak di sana."}
        </p>
        <Link href="/spmb/tahapan" className="btn-modal-cancel mt-5 inline-flex"><House size={16} /> Tahapan Pendaftaran</Link>
      </div>
    </main>
  );
}
