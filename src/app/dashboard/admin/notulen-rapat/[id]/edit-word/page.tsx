export const dynamic = "force-dynamic";

import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { FileType2, Printer } from "lucide-react";
import OnlyofficeEditor from "@/components/shared/OnlyofficeEditor";
import TombolKembali from "@/components/shared/TombolKembali";

/** Editor Word notulen — kembaran /persuratan/[id]/edit-word. Dokumen awalnya dibangkitkan dari
 *  isian terstruktur notulen, jadi begitu dibuka sudah berisi keterangan rapat, daftar hadir,
 *  dan blok tanda tangan; notulis tinggal melanjutkan. */
export default async function EditWordNotulenPage({ params }: { params: Promise<{ id: string }> }) {
  await verifyTasAccess();
  const { id } = await params;

  const notulen = await prisma.meetingMinutes.findUnique({ where: { id }, select: { id: true, date: true, topic: true } });
  if (!notulen) notFound();

  const onlyofficeUrl = process.env.NEXT_PUBLIC_ONLYOFFICE_URL || "";
  if (!onlyofficeUrl) {
    return (
      <div className="p-8 text-center text-gray-400">
        Editor Word belum dikonfigurasi di server ini (NEXT_PUBLIC_ONLYOFFICE_URL kosong).
      </div>
    );
  }

  const tgl = notulen.date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center justify-between px-4 py-2.5 bg-primary-900 text-white shrink-0">
        <div className="flex items-center gap-3">
          <TombolKembali href={`/dashboard/admin/notulen-rapat/${id}`} className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition" />
          <span className="flex items-center gap-2 text-sm font-semibold">
            <FileType2 size={15} className="text-gold" /> Editor Word — Notulen {tgl}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Tab baru: sama alasannya dengan Editor Word surat — draf yang belum tersimpan di
              ONLYOFFICE tidak boleh hilang karena tab utama pindah halaman (CLAUDE.md #19). */}
          <a href={`/dashboard/admin/notulen-rapat/${id}/cetak`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-white/20 hover:bg-white/10 transition">
            <Printer size={13} /> Cetak
          </a>
          <span className="text-xs text-white/50 hidden sm:inline">Perubahan tersimpan otomatis</span>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <OnlyofficeEditor onlyofficeUrl={onlyofficeUrl} configUrl={`/api/onlyoffice/notulen/${id}`} />
      </div>
    </div>
  );
}
