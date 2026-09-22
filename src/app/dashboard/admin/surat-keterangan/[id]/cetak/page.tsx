export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";
import { getSettings, getPrincipalName } from "@/lib/site-settings";
import { suratMeta } from "@/lib/tu-konstanta";
import PageHeader from "@/components/admin/PageHeader";
import PrintButton from "@/components/shared/PrintButton";
import LembarSurat from "@/components/shared/LembarSurat";

const fmtLong = (d: Date) => new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

/** Kalimat inti surat dibuat per jenis — beda jenis surat beda pernyataan yang diterangkan.
 * Sengaja jadi fungsi terpisah supaya menambah jenis surat baru cukup di sini + tu-konstanta.ts. */
function isiSurat(jenis: string, nama: string, tujuan: string | null): string {
  switch (jenis) {
    case "AKTIF":
      return `adalah benar peserta didik SMK Al-Munawwir IIBS yang masih AKTIF mengikuti kegiatan belajar mengajar pada tahun pelajaran berjalan.`;
    case "KELAKUAN_BAIK":
      return `adalah benar peserta didik SMK Al-Munawwir IIBS yang selama menempuh pendidikan di sekolah ini BERKELAKUAN BAIK dan tidak pernah terlibat pelanggaran tata tertib berat maupun tindak pidana.`;
    case "PINDAH":
      return `adalah benar peserta didik SMK Al-Munawwir IIBS yang mengajukan PINDAH SEKOLAH${tujuan ? ` ke ${tujuan}` : ""}. Yang bersangkutan tidak memiliki tanggungan apa pun di sekolah ini.`;
    case "LULUS":
      return `adalah benar peserta didik SMK Al-Munawwir IIBS yang telah dinyatakan LULUS dari satuan pendidikan ini. Surat keterangan ini berlaku sementara sampai ijazah yang bersangkutan diterbitkan.`;
    default:
      return `adalah benar peserta didik SMK Al-Munawwir IIBS.`;
  }
}

export default async function CetakSuratKeteranganPage({ params }: { params: Promise<{ id: string }> }) {
  await verifyTasAccess();
  const { id } = await params;

  const [surat, s] = await Promise.all([
    prisma.suratKeterangan.findUnique({
      where: { id },
      include: { student: { select: { nis: true, birthPlace: true, birthDate: true, address: true, user: { select: { name: true } }, class: { select: { name: true } }, major: { select: { name: true } } } } },
    }),
    getSettings(["letterhead.bukuInduk", "letterhead.kopBawah", "letterhead.ttdKepalaSekolah", "school.structure"]),
  ]);
  if (!surat) notFound();

  const principalName = getPrincipalName(s["school.structure"]);
  const meta = suratMeta(surat.jenis);
  const st = surat.student;
  const ttl = st?.birthPlace && st?.birthDate ? `${st.birthPlace}, ${fmtLong(st.birthDate)}` : "—";

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0 bg-white">
      {/* Halaman cetak surat mengikuti pola .a4-page yang sama dgn modul Persuratan.
          CATATAN: pola ini memang menghasilkan 1 lembar berisi + 1 lembar KOSONG di akhir pada
          ekspor PDF headless — sudah diverifikasi 2026-09-12 bahwa halaman Persuratan lama pun
          begitu, jadi ini perilaku bawaan pola tsb, bukan bug halaman ini. Sempat dicoba dikunci
          tinggi/lebarnya (296mm/210mm) — TIDAK menolong sama sekali (270mm pun tetap 2 halaman)
          dan malah berisiko memotong isi surat yang panjang, jadi override itu dibuang. */}
      <style>{"@page { size: A4 portrait; margin: 0; }"}</style>

      <PageHeader icon={<FileText size={22} />} title="Cetak Surat Keterangan" description={surat.nomorSurat} printHidden />

      <div className="flex items-center gap-2 mb-5 print:hidden">
        <Link href="/dashboard/admin/surat-keterangan" className="btn-modal-cancel">
          <ArrowLeft size={18} /> Kembali
        </Link>
        <PrintButton />
      </div>

      <div className="overflow-x-auto print:overflow-visible">
        <LembarSurat kopAtas={s["letterhead.bukuInduk"]} kopBawah={s["letterhead.kopBawah"]} terakhir>
            <div className="text-center mb-6">
              <h1 className="text-base font-bold underline tracking-wide">{meta.judul}</h1>
              <p className="text-sm mt-1">Nomor: {surat.nomorSurat}</p>
            </div>

            <p className="text-sm mb-4 text-justify">
              Yang bertanda tangan di bawah ini Kepala SMK Al-Munawwir IIBS Kecamatan Singojuruh
              Kabupaten Banyuwangi, dengan ini menerangkan bahwa:
            </p>

            <table className="text-sm mb-4 ml-6">
              <tbody>
                {[
                  ["Nama", surat.namaSiswa],
                  ["NIS", surat.nisSiswa || st?.nis || "—"],
                  ["Tempat, Tanggal Lahir", ttl],
                  ["Kelas", surat.kelasSiswa || st?.class?.name || "—"],
                  ["Kompetensi Keahlian", st?.major?.name || "—"],
                  ["Alamat", st?.address || "—"],
                ].map(([label, val]) => (
                  <tr key={label}>
                    <td className="pr-3 align-top py-0.5 whitespace-nowrap">{label}</td>
                    <td className="pr-3 align-top py-0.5">:</td>
                    <td className="align-top py-0.5 font-semibold">{val}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="text-sm mb-4 text-justify">
              Nama tersebut di atas {isiSurat(surat.jenis, surat.namaSiswa, surat.tujuan)}
            </p>

            <p className="text-sm mb-2 text-justify">
              Surat keterangan ini dibuat untuk keperluan <span className="font-semibold">{surat.keperluan}</span>.
            </p>
            {surat.catatan && <p className="text-sm mb-2 text-justify">{surat.catatan}</p>}
            <p className="text-sm mb-10 text-justify">
              Demikian surat keterangan ini dibuat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya.
            </p>

            <div className="alat-aksi justify-end">
              <div className="text-sm text-center min-w-[240px]">
                <p className="mb-1">Singojuruh, {fmtLong(surat.tanggal)}</p>
                <p className={s["letterhead.ttdKepalaSekolah"] ? "mb-2" : "mb-16"}>Kepala Sekolah</p>
                {s["letterhead.ttdKepalaSekolah"] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s["letterhead.ttdKepalaSekolah"]} alt="Tanda Tangan" className="h-16 mx-auto object-contain mb-2" />
                )}
                <p className="font-bold underline">{surat.signedBy || principalName || " "}</p>
              </div>
            </div>
          </LembarSurat>
      </div>
    </div>
  );
}
