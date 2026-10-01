export const dynamic = "force-dynamic";

import { CheckCircle2, XCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { statusIzinKeluar, LABEL_STATUS } from "@/lib/izin-keluar";

export const metadata = { title: "Verifikasi Surat Izin Keluar" };

/** Verifikasi publik surat izin keluar (pola CLAUDE.md #49). SENGAJA tidak menampilkan ALASAN
 *  keluar — alasan bisa menyangkut kesehatan atau urusan keluarga, sedangkan yang perlu diketahui
 *  petugas keamanan hanyalah: surat ini benar terbit, untuk siapa, jam berapa, sampai kapan. */
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [r, s] = await Promise.all([
    /^[A-Za-z0-9_-]{10,64}$/.test(token)
      ? prisma.izinKeluarSiswa.findUnique({
          where: { verifikasiToken: token },
          select: {
            keluarPada: true, kembaliPada: true, kembaliRencana: true, dicatatOleh: true,
            perluFoto: true, buktiFoto: true,
            student: { select: { nis: true, user: { select: { name: true } }, class: { select: { name: true } } } },
          },
        }).catch(() => null)
      : Promise.resolve(null),
    getSettings(["school.name"]),
  ]);
  const sekolah = s["school.name"] || "SMK Al-Munawwir IIBS";
  const waktu = (v: Date) => v.toLocaleString("id-ID", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta",
  });

  return (
    <main className="flex min-h-dvh items-center justify-center bg-cream px-4 py-10">
      <div className="panel w-full max-w-md overflow-hidden">
        {r ? (
          <>
            <div className="flex items-center gap-3 border-b border-emerald-100 bg-emerald-50 px-6 py-4">
              <CheckCircle2 size={24} className="shrink-0 text-emerald-600" />
              <div>
                <p className="font-heading font-semibold text-emerald-700">Surat izin keluar asli</p>
                <p className="text-xs text-emerald-700">Tercatat di basis data resmi {sekolah}</p>
              </div>
            </div>
            <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2 p-6 text-sm">
              <dt className="text-gray-500">Nama</dt><dd className="font-semibold text-primary-900">{r.student.user.name}</dd>
              <dt className="text-gray-500">Kelas</dt><dd>{r.student.class?.name ?? "—"}</dd>
              <dt className="text-gray-500">NIS</dt><dd className="angka">{r.student.nis}</dd>
              <dt className="text-gray-500">Keluar</dt><dd className="angka">{waktu(r.keluarPada)} WIB</dd>
              <dt className="text-gray-500">Rencana kembali</dt><dd className="angka">{r.kembaliRencana ? `${r.kembaliRencana} WIB` : "—"}</dd>
              <dt className="text-gray-500">Diizinkan oleh</dt><dd>{r.dicatatOleh} (Guru Piket)</dd>
              <dt className="text-gray-500">Status</dt>
              <dd className="font-medium text-primary-900">{LABEL_STATUS[statusIzinKeluar(r)]}</dd>
              {r.kembaliPada && (<><dt className="text-gray-500">Tercatat kembali</dt><dd className="angka">{waktu(r.kembaliPada)} WIB</dd></>)}
            </dl>
          </>
        ) : (
          <div className="flex items-center gap-3 bg-red-50 px-6 py-6">
            <XCircle size={24} className="shrink-0 text-red-600" />
            <div>
              <p className="font-heading font-semibold text-red-700">Surat tidak dikenali</p>
              <p className="text-xs text-red-700">Kode QR ini tidak terdaftar di {sekolah}.</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
