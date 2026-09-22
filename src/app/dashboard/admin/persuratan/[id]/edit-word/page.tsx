export const dynamic = "force-dynamic";

import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileType2, Printer } from "lucide-react";
import OnlyofficeEditor from "@/components/shared/OnlyofficeEditor";

export default async function EditWordSuratPage({ params }: { params: Promise<{ id: string }> }) {
  await verifyTasAccess();
  const { id } = await params;

  const surat = await prisma.surat.findUnique({ where: { id }, select: { id: true, nomor: true, tipe: true, content: true } });
  if (!surat || surat.tipe !== "KELUAR") notFound();
  // Surat baru (alur langsung-ke-ONLYOFFICE, tidak pernah punya `content`) tidak perlu mampir ke
  // editor lama — cukup kembali ke daftar. Surat lama (kalau ada, masih pakai `content`) tetap
  // bisa balik ke editor klasik karena metadatanya memang di sana.
  const backHref = surat.content
    ? `/dashboard/admin/persuratan/${id}/edit`
    : "/dashboard/admin/persuratan";

  const onlyofficeUrl = process.env.NEXT_PUBLIC_ONLYOFFICE_URL || "";
  if (!onlyofficeUrl) {
    return (
      <div className="p-8 text-center text-gray-400">
        Editor Word belum dikonfigurasi di server ini (NEXT_PUBLIC_ONLYOFFICE_URL kosong).
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center justify-between px-4 py-2.5 bg-primary-900 text-white shrink-0">
        <div className="flex items-center gap-3">
          <Link href={backHref} className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition">
            <ArrowLeft size={16} /> Kembali
          </Link>
          <span className="flex items-center gap-2 text-sm font-semibold">
            <FileType2 size={15} className="text-gold" /> Editor Word — {surat.nomor}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Ctrl+P DI DALAM editor ini selalu ditangkap ONLYOFFICE sendiri (font hasil substitusi
              server, bukan Arial Narrow asli) — link ini buka halaman Cetak terpisah yang dirender
              browser lokal (font asli PC pengguna kalau terpasang), di tab baru supaya draft di
              editor tidak hilang. */}
          <a href={`/dashboard/admin/persuratan/${id}/cetak`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-white/20 hover:bg-white/10 transition">
            <Printer size={13} /> Cetak
          </a>
          <span className="text-xs text-white/50 hidden sm:inline">Perubahan tersimpan otomatis</span>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <OnlyofficeEditor onlyofficeUrl={onlyofficeUrl} configUrl={`/api/onlyoffice/surat/${id}`} />
      </div>
    </div>
  );
}
