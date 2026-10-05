export const dynamic = "force-dynamic";

import { CheckCircle2, XCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { LABEL_STATUS } from "@/lib/spmb-status";

export const metadata = { title: "Verifikasi Formulir Pendaftaran" };

/** Verifikasi publik cetakan formulir SPMB (pola CLAUDE.md #49). Menampilkan IDENTITAS dokumen
 *  saja — bukan isinya: NIK, alamat, nomor WhatsApp, dan e-mail pendaftar TIDAK ditampilkan,
 *  karena siapa pun yang memegang lembarnya bisa memindai QR ini. Nama pun disamarkan sebagian. */
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [r, s] = await Promise.all([
    /^[A-Za-z0-9_-]{10,64}$/.test(token)
      ? prisma.admission.findUnique({
          where: { cetakToken: token },
          select: {
            nomor: true, fullName: true, chosenMajor: true, jalur: true, status: true, createdAt: true,
            gelombang: { select: { nama: true } },
          },
        }).catch(() => null)
      : Promise.resolve(null),
    getSettings(["school.name", "spmb.hasilDibuka"]),
  ]);
  const sekolah = s["school.name"] || "SMK Al-Munawwir IIBS";

  // Nama disamarkan seperti di Cek Status — pemegang lembar sudah tahu namanya, tetapi QR ini
  // juga bisa dipindai orang lain.
  const samar = (n: string) => n.trim().split(" ")
    .map((p, i) => (i === 0 ? p.slice(0, 2) + "*".repeat(Math.max(p.length - 2, 2)) : p[0] + "*".repeat(Math.max(p.length - 1, 1))))
    .join(" ");

  // Keputusan seleksi tidak dibocorkan lewat QR selama panitia belum membuka hasil (sama dengan
  // gerbang `spmb.hasilDibuka` di Cek Status).
  const keputusan = ["DITERIMA", "CADANGAN", "DITOLAK", "ACCEPTED", "REJECTED"].includes(r?.status ?? "");
  const status = r ? (keputusan && s["spmb.hasilDibuka"] !== "1" ? "VERIFIKASI" : r.status) : "";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-cream px-4 py-10">
      <div className="panel w-full max-w-md overflow-hidden">
        {r ? (
          <>
            <div className="flex items-center gap-3 border-b border-emerald-100 bg-emerald-50 px-6 py-4">
              <CheckCircle2 size={24} className="shrink-0 text-emerald-600" />
              <div>
                <p className="font-heading font-semibold text-emerald-700">Formulir pendaftaran asli</p>
                <p className="text-xs text-emerald-700">Tercatat di basis data SPMB {sekolah}</p>
              </div>
            </div>
            <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2 p-6 text-sm">
              <dt className="text-gray-500">Nomor</dt><dd className="angka font-semibold text-primary-900">{r.nomor ?? "—"}</dd>
              <dt className="text-gray-500">Nama</dt><dd className="font-medium text-gray-700">{samar(r.fullName)}</dd>
              <dt className="text-gray-500">Jurusan</dt><dd className="text-gray-700">{r.chosenMajor || "—"}</dd>
              <dt className="text-gray-500">Jalur</dt><dd className="text-gray-700">{(r.jalur || "—").replace(/_/g, " ")}</dd>
              <dt className="text-gray-500">Gelombang</dt><dd className="text-gray-700">{r.gelombang?.nama ?? "—"}</dd>
              <dt className="text-gray-500">Mendaftar</dt>
              <dd className="angka text-gray-700">
                {r.createdAt.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" })}
              </dd>
              <dt className="text-gray-500">Status</dt><dd className="font-medium text-gray-700">{LABEL_STATUS[status] ?? status}</dd>
            </dl>
          </>
        ) : (
          <div className="p-8 text-center">
            <XCircle size={40} className="mx-auto mb-3 text-red-500" />
            <p className="font-heading font-semibold text-navy">Formulir tidak dikenali</p>
            <p className="mt-1 text-sm text-gray-500">
              Kode pada lembar ini tidak ada di basis data {sekolah}. Pastikan QR terpindai utuh.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
