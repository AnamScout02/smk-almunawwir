import { CheckCircle2, XCircle } from "lucide-react";

/** Kerangka halaman verifikasi publik dokumen SPMB (pola #49): hanya identitas dokumen, bukan isinya. */
export default function KartuVerifikasi({ sah, judulSah, sekolah, baris, judulGagal }: {
  sah: boolean; judulSah: string; judulGagal: string; sekolah: string; baris: [string, string][];
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-cream px-4 py-10">
      <div className="panel w-full max-w-md overflow-hidden">
        {sah ? (
          <>
            <div className="flex items-center gap-3 border-b border-emerald-100 bg-emerald-50 px-6 py-4">
              <CheckCircle2 size={24} className="shrink-0 text-emerald-600" />
              <div>
                <p className="font-heading font-semibold text-emerald-700">{judulSah}</p>
                <p className="text-xs text-emerald-700">Tercatat di basis data SPMB {sekolah}</p>
              </div>
            </div>
            <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2 p-6 text-sm">
              {baris.map(([k, v]) => (
                <div key={k} className="contents"><dt className="text-gray-500">{k}</dt><dd className="font-medium text-gray-700">{v}</dd></div>
              ))}
            </dl>
          </>
        ) : (
          <div className="p-8 text-center">
            <XCircle size={40} className="mx-auto mb-3 text-red-500" />
            <p className="font-heading font-semibold text-navy">{judulGagal}</p>
            <p className="mt-1 text-sm text-gray-500">Kode pada lembar ini tidak ada di basis data {sekolah}. Pastikan QR terpindai utuh.</p>
          </div>
        )}
      </div>
    </main>
  );
}

/** Nama disamarkan sebagian — QR bisa dipindai siapa pun yang memegang lembarnya. */
export const samarNama = (n: string) => n.trim().split(/\s+/)
  .map((p, i) => (i === 0 ? p.slice(0, 2) + "*".repeat(Math.max(p.length - 2, 2)) : p[0] + "*".repeat(Math.max(p.length - 1, 1))))
  .join(" ");
