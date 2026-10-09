export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import KartuPesertaSpmbSheet from "@/components/spmb/KartuPesertaSpmbSheet";
import PrintButton from "@/components/shared/PrintButton";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { verifySpmbAccess } from "@/lib/spmb";
import { ambilKartuPeserta, type DataKartuPeserta } from "@/lib/spmb-dokumen";

export const metadata = { title: "Cetak Kartu Peserta Tes (Massal)" };

const BATAS = 200;

/** Kartu peserta tes SEKALIGUS per sesi / per gelombang — hanya calon yang berkasnya terverifikasi dan tidak
 *  ditolak, berurut nomor. Dibatasi 200 kartu sekali cetak (tiap kartu memuat QR, pelajaran #110). */
export default async function Page({ searchParams }: { searchParams: Promise<{ gelombangId?: string; sesiId?: string }> }) {
  await verifySpmbAccess();
  const { gelombangId = "", sesiId = "" } = await searchParams;
  const where = {
    verifikasiStatus: "TERVERIFIKASI", status: { notIn: ["DITOLAK", "REJECTED"] }, studentId: null,
    ...(sesiId === "TANPA" ? { sesiId: null } : sesiId ? { sesiId } : {}),
    ...(gelombangId ? { gelombangId } : {}),
  };
  const [ids, jumlah, s] = await Promise.all([
    prisma.admission.findMany({ where, orderBy: { nomor: "asc" }, take: BATAS, select: { id: true } }),
    prisma.admission.count({ where }),
    getSettings(["school.name", "logo.full_white", "spmb.tahun"]),
  ]);
  const daftar: DataKartuPeserta[] = [];
  for (const { id } of ids) { const k = await ambilKartuPeserta({ id }); if (k) daftar.push(k); }

  return (
    <div className="py-6 print:py-0">
      <div className="mx-auto mb-4 flex max-w-[21cm] flex-wrap items-center justify-end gap-2 px-4 print:hidden">
        <p className="mr-auto text-sm text-gray-500">
          {daftar.length} kartu{jumlah > BATAS ? ` dari ${jumlah} — saring per sesi untuk mencetak sisanya` : ""} · 2 kartu per lembar A4
        </p>
        <Link href="/pusat-spmb/tahapan" className="btn-modal-cancel"><ArrowLeft size={16} /> Kembali</Link>
        <PrintButton />
      </div>
      {daftar.length === 0
        ? <p className="py-10 text-center text-sm text-gray-400">Belum ada calon terverifikasi pada saringan ini.</p>
        : <KartuPesertaSpmbSheet daftar={daftar} sekolah={s["school.name"] || "SMK Al-Munawwir IIBS"} logoUrl={s["logo.full_white"]} tahun={s["spmb.tahun"]} />}
    </div>
  );
}
