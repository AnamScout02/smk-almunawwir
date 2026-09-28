export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getSettings, getPrincipalName } from "@/lib/site-settings";
import { aksesPanggilan } from "@/lib/panggilan-akses";
import LembarSurat from "@/components/shared/LembarSurat";
import PrintButton from "@/components/shared/PrintButton";
import TombolKembali from "@/components/shared/TombolKembali";

const tglPanjang = (d: Date) => d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });

/** Cetak surat panggilan orang tua dari portal guru (Kesiswaan/BK & wali kelas) — isi = Surat KELUAR yang diterbitkan. */
export default async function CetakPanggilanPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await verifyRole(["TEACHER", "ADMIN"]);
  const akses = await aksesPanggilan(session);
  if (!akses) redirect("/dashboard/teacher");
  const { id } = await params;
  const p = await prisma.panggilanOrangTua.findUnique({ where: { id }, select: { suratId: true, student: { select: { classId: true } } } });
  if (!p?.suratId || (akses.kelas && !akses.kelas.includes(p.student.classId ?? ""))) notFound();
  const [surat, s] = await Promise.all([
    prisma.surat.findUnique({ where: { id: p.suratId } }),
    getSettings(["letterhead.bukuInduk", "letterhead.kopBawah", "letterhead.ttdKepalaSekolah", "school.structure"]),
  ]);
  if (!surat) notFound();
  const kepala = getPrincipalName(s["school.structure"] ?? "");
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0 print:pt-0 bg-gray-100 print:bg-white">
      <div className="print:hidden sticky top-0 z-10 bg-white border border-gray-200 rounded-2xl px-6 py-3 flex items-center justify-between shadow-sm mb-6 max-w-[210mm] mx-auto">
        <TombolKembali href={"/dashboard/teacher/kesiswaan/panggilan"} />
        <PrintButton />
      </div>
      <div className="overflow-x-auto print:overflow-visible">
        <LembarSurat kopAtas={s["letterhead.bukuInduk"]} kopBawah={s["letterhead.kopBawah"]} terakhir>
          <table className="text-sm mb-4">
            <tbody>
              <tr><td className="pr-2 align-top">Nomor</td><td className="pr-2 align-top">:</td><td className="align-top font-semibold">{surat.nomor}</td></tr>
              <tr><td className="pr-2 align-top">Perihal</td><td className="pr-2 align-top">:</td><td className="align-top font-semibold">{surat.perihal}</td></tr>
            </tbody>
          </table>
          {surat.pihak?.trim() ? (<><p className="text-sm mb-1">Kepada Yth.</p><p className="text-sm font-semibold mb-6">{surat.pihak}</p></>) : null}
          <div className="prose-surat-print text-sm text-justify mb-10" dangerouslySetInnerHTML={{ __html: surat.content ?? "" }} />
          <div className="alat-aksi justify-end">
            <div className="text-sm text-center min-w-[220px]">
              <p className="mb-1">Singojuruh, {tglPanjang(surat.tanggal)}</p>
              <p className={s["letterhead.ttdKepalaSekolah"] ? "mb-2" : "mb-16"}>{surat.penandaTangan ?? "Kepala SMK Al Munawwir IIBS"}</p>
              {s["letterhead.ttdKepalaSekolah"] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s["letterhead.ttdKepalaSekolah"]} alt="Tanda Tangan" className="h-16 mx-auto object-contain mb-2" />
              )}
              <p className="font-bold underline">{kepala ? `( ${kepala} )` : " "}</p>
            </div>
          </div>
        </LembarSurat>
      </div>
    </div>
  );
}
