export const metadata = { title: "Ujian Selesai — SMK Al Munawwir IIBS" };

/** `quitURL` berkas .seb: begitu SEB membuka alamat ini, SEB menutup sendiri tanpa meminta sandi.
 *  Di browser biasa halaman ini hanya pemberitahuan. */
export default function Page() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-cream p-4">
      <div className="panel w-full max-w-sm p-6 text-center">
        <h1 className="font-heading text-lg font-semibold text-primary-900">Ujian selesai</h1>
        <p className="mt-2 text-sm text-gray-500">Safe Exam Browser akan tertutup. Terima kasih.</p>
      </div>
    </main>
  );
}
