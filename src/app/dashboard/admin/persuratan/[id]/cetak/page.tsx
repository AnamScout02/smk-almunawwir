export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { uploadUrlToDiskPath } from "@/lib/onlyoffice-docx";
import { randomBytes } from "crypto";
import LembarSurat from "@/components/shared/LembarSurat";
import { generateQrDataUrl } from "@/lib/qrcode";
import { ALAMAT_APLIKASI } from "@/lib/alamat-aplikasi";
import PrintButton from "@/components/shared/PrintButton";
import Link from "next/link";
import { ArrowLeft, FileDown } from "lucide-react";
import { notFound } from "next/navigation";
import { readFile } from "fs/promises";
import mammoth from "mammoth";
import { buildPrintFilename } from "@/lib/print-filename";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const surat = await prisma.surat.findUnique({ where: { id }, select: { perihal: true, nomor: true } });
  return { title: { absolute: buildPrintFilename("Surat", surat?.perihal, surat?.nomor) } };
}

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

export default async function CetakSuratKeluarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
  const penandaTangan = surat.penandaTangan || "Kepala SMK Al Munawwir IIBS";
  const isKepalaSekolah = penandaTangan.trim() === "Kepala SMK Al Munawwir IIBS";
  const principalName = isKepalaSekolah ? getPrincipalName(s["school.structure"]) : "";

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
          <Link href="/dashboard/admin/persuratan" className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary-700 font-semibold">
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
        <Link href="/dashboard/admin/persuratan" className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary-700 font-semibold">
          <ArrowLeft size={16} /> Kembali
        </Link>
        <div className="flex items-center gap-2">
          <a href={`/api/admin/surat/${id}/export-word`}
            className="btn-modal-cancel">
            <FileDown size={15} /> Unduh Word
          </a>
          <PrintButton />
        </div>
      </div>

      <div className="overflow-x-auto print:overflow-visible">
        <LembarSurat kopAtas={s["letterhead.bukuInduk"]} kopBawah={s["letterhead.kopBawah"]} terakhir>
            <table className="text-sm mb-4">
              <tbody>
                <tr><td className="pr-2 align-top">Nomor</td><td className="pr-2 align-top">:</td><td className="align-top font-semibold">{surat.nomor}</td></tr>
                <tr><td className="pr-2 align-top">Perihal</td><td className="pr-2 align-top">:</td><td className="align-top font-semibold">{surat.perihal}</td></tr>
              </tbody>
            </table>

            {/* Surat Keterangan / Pernyataan / SK memang tidak punya alamat tujuan — blok ini
                disembunyikan kalau kolom "Kepada" dikosongkan, bukan dicetak sebagai
                "Kepada Yth." yang menggantung tanpa nama. */}
            {surat.pihak?.trim() ? (
              <>
                <p className="text-sm mb-1">Kepada Yth.</p>
                <p className="text-sm font-semibold mb-6">{surat.pihak}</p>
              </>
            ) : null}

            {surat.content ? (
              <div className="prose-surat-print text-sm text-justify mb-10" dangerouslySetInnerHTML={{ __html: surat.content }} />
            ) : (
              <p className="text-sm text-gray-400 italic mb-10">Isi surat belum ditulis.</p>
            )}

            <div className="flex items-end justify-between gap-4">
              {qrSurat ? (
                <div className="text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrSurat} alt="QR keaslian surat" className="h-[22mm] w-[22mm]" />
                  <p className="mt-1 max-w-[30mm] text-[9px] leading-tight text-gray-600">Pindai untuk memeriksa keaslian surat</p>
                </div>
              ) : <span />}
              <div className="text-sm text-center min-w-[220px]">
                <p className="mb-1">Singojuruh, {fmtLong(surat.tanggal)}</p>
                <p className={isKepalaSekolah && s["letterhead.ttdKepalaSekolah"] ? "mb-2" : "mb-16"}>{penandaTangan}</p>
                {isKepalaSekolah && s["letterhead.ttdKepalaSekolah"] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s["letterhead.ttdKepalaSekolah"]} alt="Tanda Tangan" className="h-16 mx-auto object-contain mb-2" />
                )}
                <p className="font-bold underline">{principalName ? `( ${principalName} )` : " "}</p>
              </div>
            </div>
          </LembarSurat>
      </div>
    </div>
  );
}
