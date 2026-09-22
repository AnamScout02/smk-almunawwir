import Link from "next/link";

export const metadata = { title: "Presensi Kegiatan" };

/** Hasil pindai QR presensi kegiatan (tanpa data sensitif — hanya pesan dari /hadir/[id]). */
export default async function Page({ searchParams }: { searchParams: Promise<{ s?: string; p?: string; k?: string }> }) {
  const { s, p, k } = await searchParams;
  const ok = s === "ok";
  return (
    <main className="flex min-h-dvh items-center justify-center bg-cream px-4 py-10">
      <div className="panel w-full max-w-md p-6 text-center">
        <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full text-3xl font-bold text-white ${ok ? "bg-emerald-600" : "bg-red-600"}`} aria-hidden="true">{ok ? "✓" : "!"}</div>
        <h1 className="mt-4 font-heading text-xl font-bold text-primary-900">{ok ? "Presensi berhasil" : "Presensi belum tercatat"}</h1>
        {k && <p className="mt-1 text-sm font-semibold text-gray-700">{k.slice(0, 200)}</p>}
        <p className="mt-2 text-sm text-gray-600">{(p ?? "").slice(0, 300)}</p>
        <Link href="/login" className="btn-modal-cancel mt-6 inline-flex">Ke Dashboard</Link>
      </div>
    </main>
  );
}
