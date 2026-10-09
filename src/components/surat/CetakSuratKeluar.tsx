import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { uploadUrlToDiskPath } from "@/lib/onlyoffice-docx";
import { randomBytes } from "crypto";
import LembarSurat from "@/components/shared/LembarSurat";
import IsiSuratKeluar from "@/components/surat/IsiSuratKeluar";
import { generateQrDataUrl } from "@/lib/qrcode";
import { ALAMAT_APLIKASI } from "@/lib/alamat-aplikasi";
import PrintButton from "@/components/shared/PrintButton";
import Link from "next/link";
import { ArrowLeft, FileDown } from "lucide-react";
import { notFound } from "next/navigation";
import { readFile } from "fs/promises";
import mammoth from "mammoth";
import { buildPrintFilename } from "@/lib/print-filename";

interface StructureRow { role: string; name: string; highlight?: boolean }

function fmtLong(d: Date) {
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

function getPrincipalName(structureJson: string): string {
  try {
    const parsed = JSON.parse(structureJson || "[]") as StructureRow[];
    return parsed.find(r => r.highlight)?.name ?? parsed[0]?.name ?? "";
  } catch {
    return "";
  }
}

/** Lembar cetak surat keluar — dipakai Persuratan TU dan Pusat PKL (9 Okt 2026). Penjagaan akses dilakukan PEMANGGIL:
 *  layout Admin untuk Persuratan, `sesiPkl` + kepemilikan surat untuk Pusat PKL. `tanpaWord` menyembunyikan unduhan
 *  Word yang rutenya khusus Tata Usaha. */
export default async function CetakSuratKeluar({ id, kembaliHref = "/dashboard/admin/persuratan", tanpaWord = false }: { id: string; kembaliHref?: string; tanpaWord?: boolean }) {
  const [surat, s] = await Promise.all([
    prisma.surat.findUnique({ where: { id } }),
    getSettings(["letterhead.bukuInduk", "letterhead.kopBawah", "letterhead.ttdKepalaSekolah", "school.structure"]),
  ]);
  if (!surat || surat.tipe !== "KELUAR") notFound();
  // QR keaslian surat (17 Sep 2026): token dibuat sekali saat surat pertama kali dicetak.
  let token = surat.verifikasiToken;
  if (!token) {
    token = randomBytes(18).toString("base64url");
    await prisma.surat.update({ where: { id }, data: { verifikasiToken: token } }).catch(() => { token = surat.verifikasiToken; });
  }
  const qrSurat = token ? await generateQrDataUrl(`${ALAMAT_APLIKASI}/verify/surat/${token}`) : null;

  // Surat yang dibuat lewat alur "langsung ke Editor Word" (docxUrl ada, `content` HTML lama
  // kosong) — file .docx ITU SENDIRI satu-satunya sumber isi surat. KHUSUS untuk cetak, isi
  // dikonversi ke HTML (mammoth) lalu dirender ulang lewat template .a4-page yang sama seperti
  // surat editor klasik — supaya font "Arial Narrow" dirender oleh BROWSER user sendiri (kalau
  // font itu memang terpasang di PC-nya), bukan oleh server ONLYOFFICE yang cuma punya font
  // pengganti (Liberation Sans Narrow via alias fontconfig, lihat docker-compose.yml). Editor
  // ONLYOFFICE sendiri (mode edit/lihat) tidak diubah — ini murni tampilan cetak saja.
  if (surat.docxUrl && !surat.content) {
    let bodyHtml = "";
    try {
      const buffer = await readFile(uploadUrlToDiskPath(surat.docxUrl));
      const result = await mammoth.convertToHtml({ buffer });
      bodyHtml = result.value;
    } catch (e) {
      console.error("[cetak surat] gagal konversi docx→html", e);
    }
    return (
      <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0 print:pt-0 bg-gray-100 print:bg-white">
        <div className="print:hidden sticky top-0 z-10 bg-white border border-gray-200 rounded-2xl px-6 py-3 flex items-center justify-between shadow-sm mb-6 max-w-[210mm] mx-auto">
          <Link href={kembaliHref} className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary-700 font-semibold">
            <ArrowLeft size={16} /> Kembali
          </Link>
          <div className="flex items-center gap-2">
            <a href={surat.docxUrl} download
              className="btn-modal-cancel">
              <FileDown size={15} /> Unduh Word
            </a>
            <PrintButton />
          </div>
        </div>

        <div className="overflow-x-auto print:overflow-visible">
          <LembarSurat kopAtas={s["letterhead.bukuInduk"]} kopBawah={s["letterhead.kopBawah"]} terakhir>
              {bodyHtml ? (
                <div className="docx-print-body text-sm" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
              ) : (
                <p className="text-sm text-gray-400 italic">Gagal memuat isi surat.</p>
              )}
            </LembarSurat>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0 print:pt-0 bg-gray-100 print:bg-white">
      <div className="print:hidden sticky top-0 z-10 bg-white border border-gray-200 rounded-2xl px-6 py-3 flex items-center justify-between shadow-sm mb-6 max-w-[210mm] mx-auto">
        <Link href={kembaliHref} className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary-700 font-semibold">
          <ArrowLeft size={16} /> Kembali
        </Link>
        <div className="flex items-center gap-2">
          {!tanpaWord && (
            <a href={`/api/admin/surat/${id}/export-word`}
              className="btn-modal-cancel">
              <FileDown size={15} /> Unduh Word
            </a>
          )}
          <PrintButton />
        </div>
      </div>

      <div className="overflow-x-auto print:overflow-visible">
        <IsiSuratKeluar surat={surat} setelan={s} qrSurat={qrSurat} terakhir />
      </div>
    </div>
  );
}
