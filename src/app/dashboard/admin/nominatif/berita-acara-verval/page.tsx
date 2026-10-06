export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft, FileCheck2 } from "lucide-react";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";
import { getSettings, getPrincipalName } from "@/lib/site-settings";
import { getNominatifRoster } from "@/lib/nominatif-roster";
import { terbilang } from "@/lib/administrasi-ujian";
import PageHeader from "@/components/admin/PageHeader";
import Alert from "@/components/admin/Alert";
import PrintButton from "@/components/shared/PrintButton";
import PrintKop from "@/components/shared/PrintKop";
import GambarTtd from "@/components/shared/GambarTtd";
import { ttdDariNama } from "@/lib/ttd";

const ZONA = "Asia/Jakarta";
const jk = (g: string) => (/^l/i.test(g.trim()) ? "L" : /^p/i.test(g.trim()) ? "P" : "");

/** BERITA ACARA VERIFIKASI & VALIDASI (VERVAL) DATA NOMINATIF calon peserta UKK/USP — satu lembar untuk seluruh
 * kompetensi keahlian. Jumlah L/P dan data yang belum lengkap dihitung dari roster Nominatif yang sama dengan
 * cetak Nominatif per jurusan, jadi angkanya tidak pernah berbeda dengan lampirannya. `?tanggal=YYYY-MM-DD` untuk
 * mencetak dengan tanggal pelaksanaan verval (bawaan: hari ini). */
export default async function BeritaAcaraVervalPage({ searchParams }: { searchParams: Promise<{ academicYearId?: string; tanggal?: string }> }) {
  await verifyTasAccess();
  const { academicYearId, tanggal } = await searchParams;

  const [year, majors, settings] = await Promise.all([
    academicYearId ? prisma.academicYear.findUnique({ where: { id: academicYearId } }) : prisma.academicYear.findFirst({ where: { isActive: true } }),
    prisma.major.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, kompetensiKeahlian: true } }),
    getSettings([
      "logo.full_white", "school.structure", "school.name",
      "nominatif.npsn", "nominatif.nss", "nominatif.kabKota",
      "nominatif.pengawasNama", "nominatif.pengawasNip",
    ]),
  ]);
  const roster = year ? await getNominatifRoster({ id: year.id, isActive: year.isActive }) : [];

  const tgl = tanggal && /^\d{4}-\d{2}-\d{2}$/.test(tanggal) ? new Date(`${tanggal}T12:00:00+07:00`) : new Date();
  const bagian = (o: Intl.DateTimeFormatOptions) => tgl.toLocaleDateString("id-ID", { ...o, timeZone: ZONA });
  const tahunPelajaran = year?.name ?? "—";
  const sekolah = settings["school.name"] || "SMK Al Munawwir IIBS";
  const kota = settings["nominatif.kabKota"] || "Banyuwangi";
  const kepala = getPrincipalName(settings["school.structure"]);
  const ttdKepala = await ttdDariNama(kepala);

  // Satu baris per kompetensi keahlian (urutan & nama dari tabel Major; jurusan tanpa calon tetap tampil 0).
  const baris = majors.map(m => {
    const siswa = roster.filter(r => r.majorName === m.name);
    const belumLengkap = siswa.filter(r => !r.ijazahNo || !r.birthPlace || !r.birthDate || !r.address || !r.parentName || !jk(r.gender)).length;
    return {
      nama: m.kompetensiKeahlian || m.name,
      l: siswa.filter(r => jk(r.gender) === "L").length,
      p: siswa.filter(r => jk(r.gender) === "P").length,
      jumlah: siswa.length, belumLengkap,
    };
  });
  const total = baris.reduce((a, b) => ({ l: a.l + b.l, p: a.p + b.p, jumlah: a.jumlah + b.jumlah, belumLengkap: a.belumLengkap + b.belumLengkap }), { l: 0, p: 0, jumlah: 0, belumLengkap: 0 });

  const th = "border border-gray-800 bg-primary-900 text-white px-2 py-1.5 text-center align-middle";
  const td = "border border-gray-800 px-2 py-1 align-middle";
  const kotak = <span className="inline-block w-3.5 h-3.5 border border-gray-800 align-middle mr-1.5" />;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0 bg-white">
      <style>{"@page { size: A4 portrait; margin: 1.5cm; }"}</style>
      <PageHeader icon={<FileCheck2 size={22} />} title="Berita Acara Verval Nominatif" description={`Calon peserta UKK/USP — Tahun Pelajaran ${tahunPelajaran}`} printHidden />
      <div className="flex flex-wrap items-center gap-2 mb-5 print:hidden">
        <Link href="/dashboard/admin/nominatif" className="btn-modal-cancel">
          <ArrowLeft size={18} /> Kembali
        </Link>
        <PrintButton />
        <span className="text-xs text-gray-400">Tanggal pelaksanaan bisa diganti lewat alamat: ?tanggal=2026-10-01</span>
      </div>
      {total.belumLengkap > 0 && (
        <div className="max-w-[180mm] mx-auto mb-5 print:hidden">
          <Alert variant="warning" title={`${total.belumLengkap} calon peserta datanya belum lengkap`}>
            No. ijazah, tempat/tanggal lahir, alamat, jenis kelamin, atau nama orang tua masih kosong. Lengkapi lewat Buku Induk atau
            {" "}<Link href="/dashboard/admin/pemeriksa-data" className="font-semibold underline">Pemeriksa Data</Link> sebelum berita acara ditandatangani.
          </Alert>
        </div>
      )}

      <div className="print-doc bg-white max-w-[180mm] mx-auto text-[12.5px] leading-relaxed">
        <PrintKop title="Berita Acara Verifikasi dan Validasi" subtitle={`Data Nominatif Calon Peserta UKK & USP Tahun Pelajaran ${tahunPelajaran}`} logoUrl={settings["logo.full_white"]} />

        <p className="text-justify mb-3">
          Pada hari ini <strong>{bagian({ weekday: "long" })}</strong>, tanggal <strong>{terbilang(Number(bagian({ day: "numeric" })))}</strong>,
          bulan <strong>{bagian({ month: "long" })}</strong>, tahun <strong>{terbilang(Number(bagian({ year: "numeric" })))}</strong>, bertempat di {sekolah},
          telah dilaksanakan verifikasi dan validasi data nominatif calon peserta Uji Kompetensi Keahlian (UKK) dan Ujian Satuan
          Pendidikan (USP) Tahun Pelajaran {tahunPelajaran} dengan hasil sebagai berikut:
        </p>

        <table className="mb-3">
          <tbody>
            {[["Nama Sekolah", sekolah], ["NPSN", settings["nominatif.npsn"] || "—"], ["NSS", settings["nominatif.nss"] || "—"]].map(([a, b]) => (
              <tr key={a}><td className="pr-3 py-0.5 w-40">{a}</td><td className="py-0.5">: {b}</td></tr>
            ))}
          </tbody>
        </table>

        <table className="w-full border-collapse text-[12px] mb-3" style={{ tableLayout: "fixed" }}>
          <colgroup><col style={{ width: "7%" }} /><col /><col style={{ width: "8%" }} /><col style={{ width: "8%" }} /><col style={{ width: "10%" }} /><col style={{ width: "16%" }} /><col style={{ width: "17%" }} /></colgroup>
          <thead>
            <tr>
              <th className={th} rowSpan={2}>No</th><th className={th} rowSpan={2}>Kompetensi Keahlian</th>
              <th className={th} colSpan={3}>Jumlah Calon Peserta</th>
              <th className={th} rowSpan={2}>Data Belum Lengkap</th><th className={th} rowSpan={2}>Keterangan</th>
            </tr>
            <tr><th className={th}>L</th><th className={th}>P</th><th className={th}>Jumlah</th></tr>
          </thead>
          <tbody>
            {baris.map((b, i) => (
              <tr key={b.nama}>
                <td className={`${td} text-center`}>{i + 1}</td>
                <td className={td}>{b.nama}</td>
                <td className={`${td} text-center`}>{b.l}</td>
                <td className={`${td} text-center`}>{b.p}</td>
                <td className={`${td} text-center font-semibold`}>{b.jumlah}</td>
                <td className={`${td} text-center`}>{b.belumLengkap || "—"}</td>
                <td className={td} />
              </tr>
            ))}
            <tr>
              <td className={`${td} text-right font-bold`} colSpan={2}>Jumlah</td>
              <td className={`${td} text-center font-bold`}>{total.l}</td>
              <td className={`${td} text-center font-bold`}>{total.p}</td>
              <td className={`${td} text-center font-bold`}>{total.jumlah}</td>
              <td className={`${td} text-center font-bold`}>{total.belumLengkap || "—"}</td>
              <td className={td} />
            </tr>
          </tbody>
        </table>

        <p className="text-justify mb-2">
          Data tersebut telah dicocokkan dengan dokumen pendukung (ijazah SMP/MTs, akta kelahiran, kartu keluarga, dan buku induk
          peserta didik) dan dinyatakan:
        </p>
        <p className="mb-3 pl-4">{kotak} Sesuai &nbsp;&nbsp;&nbsp;&nbsp; {kotak} Perlu perbaikan sebagaimana catatan berikut</p>
        <p className="font-semibold mb-1">Catatan:</p>
        <div className="space-y-4 mb-5">
          {[0, 1, 2].map(i => <div key={i} className="border-b border-dotted border-gray-500 h-5" />)}
        </div>
        <p className="mb-6">Demikian berita acara ini dibuat dengan sebenar-benarnya untuk dipergunakan sebagaimana mestinya.</p>

        <div className="grid grid-cols-3 gap-4 text-center text-[12px]" style={{ breakInside: "avoid" }}>
          <div>
            <p>&nbsp;</p>
            <p>Operator Sekolah</p>
            <div className="h-16" />
            <p>( .................................... )</p>
          </div>
          <div>
            <p>Verifikator,</p>
            <p>Pengawas SMK</p>
            <div className="h-16" />
            <p className="font-semibold underline">{settings["nominatif.pengawasNama"] || "( .................................... )"}</p>
            <p>NIP. {settings["nominatif.pengawasNip"] || "—"}</p>
          </div>
          <div>
            <p>{kota}, {bagian({ day: "numeric", month: "long", year: "numeric" })}</p>
            <p>Kepala {sekolah}</p>
            <GambarTtd src={ttdKepala} tinggi={64} />
            <p className="font-semibold underline">{kepala || "( .................................... )"}</p>
            <p>NIP. —</p>
          </div>
        </div>
      </div>
    </div>
  );
}
