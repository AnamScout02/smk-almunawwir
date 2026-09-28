export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";
import { getSettings, getPrincipalName } from "@/lib/site-settings";
import { getNominatifRoster } from "@/lib/nominatif-roster";
import PageHeader from "@/components/admin/PageHeader";
import PrintButton from "@/components/shared/PrintButton";
import PrintKop from "@/components/shared/PrintKop";

function tgl(d: Date | null): string {
  if (!d) return "";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}
function tempatTglLahir(tempat: string, d: Date | null): string {
  if (!tempat && !d) return "";
  return `${tempat}${tempat && d ? ", " : ""}${tgl(d)}`;
}

export default async function NominatifCetakPage({ params, searchParams }: {
  params: Promise<{ majorId: string }>; searchParams: Promise<{ academicYearId?: string }>;
}) {
  await verifyTasAccess();
  const { majorId } = await params;
  const { academicYearId } = await searchParams;

  const major = await prisma.major.findUnique({ where: { id: majorId } });
  if (!major) notFound();

  const [year, settings] = await Promise.all([
    academicYearId ? prisma.academicYear.findUnique({ where: { id: academicYearId } }) : prisma.academicYear.findFirst({ where: { isActive: true } }),
    getSettings([
      "logo.full_white", "school.structure", "contact.phone",
      "nominatif.nss", "nominatif.kecamatan", "nominatif.kabKota", "nominatif.kodePos",
      "nominatif.pengawasNama", "nominatif.pengawasNip",
      "nominatif.dinasNama", "nominatif.dinasNip", "nominatif.dinasPangkat", "nominatif.dinasWilayah",
    ]),
  ]);

  const rows = year ? await getNominatifRoster({ id: year.id, isActive: year.isActive }, majorId) : [];

  const principalName = getPrincipalName(settings["school.structure"]);
  const tahunPelajaran = year?.name ?? "—";

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0 min-h-dvh print:min-h-0 bg-white">
      <style>{"@page { size: A4 landscape; margin: 1cm; }"}</style>

      <PageHeader icon={<FileSpreadsheet size={22} />} title={`Nominatif — ${major.name}`}
        description={`Biodata Calon UKK/USP — Tahun Pelajaran ${tahunPelajaran}`} printHidden />

      <div className="flex items-center gap-2 mb-5 print:hidden">
        <Link href="/dashboard/admin/nominatif" className="btn-modal-cancel">
          <ArrowLeft size={18} /> Kembali
        </Link>
        <PrintButton />
      </div>

      <div className="print-doc bg-white">
        <PrintKop title="Biodata Calon Uji Kompetensi Keahlian (UKK)" subtitle={`Ujian Satuan Pendidikan (USP) — Tingkat Kelas XII Tahun Pelajaran ${tahunPelajaran}`} logoUrl={settings["logo.full_white"]} />

        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-[11px] mb-4 px-1">
          <div className="grid grid-cols-[9rem_1fr]"><span className="font-semibold">NAMA SEKOLAH</span><span>: SMK AL MUNAWWIR IIBS</span></div>
          <div className="grid grid-cols-[9rem_1fr]"><span className="font-semibold">NSS</span><span>: {settings["nominatif.nss"] || "—"}</span></div>
          <div className="grid grid-cols-[9rem_1fr]"><span className="font-semibold">NAMA KEPALA SEKOLAH</span><span>: {principalName || "—"}</span></div>
          <div className="grid grid-cols-[9rem_1fr]"><span className="font-semibold">BIDANG KEAHLIAN</span><span>: {major.bidangKeahlian || "—"}</span></div>
          <div className="grid grid-cols-[9rem_1fr]"><span className="font-semibold">TELEPON/FAX</span><span>: {settings["contact.phone"] || "—"}</span></div>
          <div className="grid grid-cols-[9rem_1fr]"><span className="font-semibold">PROGRAM KEAHLIAN</span><span>: {major.programKeahlian || "—"}</span></div>
          <div className="grid grid-cols-[9rem_1fr]"><span className="font-semibold">KECAMATAN</span><span>: {settings["nominatif.kecamatan"] || "—"}</span></div>
          <div className="grid grid-cols-[9rem_1fr]"><span className="font-semibold">PAKET KEAHLIAN</span><span>: {major.kompetensiKeahlian || major.name}</span></div>
          <div className="grid grid-cols-[9rem_1fr]"><span className="font-semibold">KAB/KOTA</span><span>: {settings["nominatif.kabKota"] || "—"}</span></div>
          <div className="grid grid-cols-[9rem_1fr]"><span className="font-semibold">STATUS AKREDITASI</span><span>: {major.akreditasi === "SUDAH" ? "TERAKREDITASI" : major.akreditasi === "BELUM" ? "BELUM TERAKREDITASI" : "—"}</span></div>
          <div className="grid grid-cols-[9rem_1fr]"><span className="font-semibold">KODE POS</span><span>: {settings["nominatif.kodePos"] || "—"}</span></div>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10 print:hidden">Tidak ada siswa Kelas XII aktif di jurusan ini untuk tahun ajaran terpilih.</p>
        ) : (
          // Tabel resmi bergaris penuh (bukan .data-table — itu cuma garis bawah tipis tanpa
          // garis vertikal, cocok utk tabel UI biasa TAPI garisnya nyaris tak kelihatan dicetak,
          // dan `background` di <tr> header ber-rowSpan bikin ada "lubang" warna di persimpangan
          // rowSpan/colSpan. Di sini tiap <th>/<td> dikasih border sendiri-sendiri — pola sama
          // Buku Mutasi (buku-mutasi/page.tsx) utk dokumen resmi bergaris.
          // `table-layout: fixed` + <colgroup> = lebar tiap kolom TETAP (tidak menyusut/melebar
          // ikut panjang teks), teks yang kepanjangan (mis. alamat) WRAP ke bawah (baris makin
          // tinggi), bukan dipepetkan jadi font super kecil dalam 1 baris — keputusan eksplisit
          // user 2026-09-11 ("teksnya saat print terlalu kecil").
          // Rata tengah di SEMUA sel (judul & data) KECUALI kolom Nama (rata kiri, lebih enak
          // dibaca utk daftar nama) — keputusan eksplisit user 2026-09-11.
          <table className="w-full border-collapse text-[13px] leading-snug" style={{ tableLayout: "fixed" }}>
            {/* NIS SENGAJA `whitespace-nowrap` — kode tanpa spasi ("873/001.6.2.2") kalau dipaksa
                wrap malah patah di tengah angka, jelek & bikin baris jadi tinggi sekali (root
                cause halaman berlipat-lipat sebelum perbaikan ini). Alamat & No Ijazah dikasih
                jatah lebar PALING BESAR di antara kolom lain — dua itu yang isinya paling
                panjang (alamat lengkap, kode ijazah Kemdikbud) jadi paling menentukan tinggi
                baris; kolom lain (nama/tempat lahir/nama ortu/asal sekolah) wrap alami di spasi,
                tidak perlu `break-words`. `leading-snug` merapatkan jarak antar baris teks yang
                wrap supaya baris tabel tidak makin tinggi dari seharusnya. */}
            {/* Kolom "Th" (tahun ijazah) sempat cuma 3% — "2024" (4 digit) kepotong tipis di tepi
                (temuan user 2026-09-12, sama persis kasus kolom Keterangan di Rekap Calon).
                Dilebarkan jadi 5%, diambil 2% dari Tanda Tangan (kosong, cukup dikurangi sedikit). */}
            <colgroup>
              <col style={{ width: "2%" }} /><col style={{ width: "11%" }} /><col style={{ width: "3%" }} /><col style={{ width: "10%" }} />
              <col style={{ width: "9%" }} /><col style={{ width: "21%" }} /><col style={{ width: "8%" }} />
              <col style={{ width: "9%" }} /><col style={{ width: "13%" }} /><col style={{ width: "5%" }} />
              <col style={{ width: "5%" }} /><col style={{ width: "4%" }} />
            </colgroup>
            <thead>
              <tr>
                {["No", "Nama", "L/P", "NIS", "Tempat, Tgl Lahir", "Alamat Siswa", "Nama Orangtua"].map(h => (
                  <th key={h} rowSpan={2} className="border border-gray-800 bg-primary-900 text-white px-2 py-1.5 text-center align-middle">{h}</th>
                ))}
                <th colSpan={3} className="border border-gray-800 bg-primary-900 text-white px-2 py-1.5 text-center">Ijazah Terakhir</th>
                <th rowSpan={2} className="border border-gray-800 bg-primary-900 text-white px-2 py-1.5 text-center align-middle">Tanda Tangan</th>
                <th rowSpan={2} className="border border-gray-800 bg-primary-900 text-white px-2 py-1.5 text-center align-middle">Ket</th>
              </tr>
              <tr>
                {["Asal Sekolah", "No Ijazah", "Th"].map(h => (
                  <th key={h} className="border border-gray-800 bg-primary-900 text-white px-2 py-1.5 text-center">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ breakInside: "avoid" }}>
                  <td className="border border-gray-800 px-2 py-1 text-center align-middle">{i + 1}</td>
                  <td className="border border-gray-800 px-2 py-1 text-left align-middle">{r.name}</td>
                  <td className="border border-gray-800 px-2 py-1 text-center align-middle">{r.gender}</td>
                  <td className="border border-gray-800 px-2 py-1 text-center align-middle whitespace-nowrap">{r.nis}</td>
                  <td className="border border-gray-800 px-2 py-1 text-center align-middle">{tempatTglLahir(r.birthPlace, r.birthDate)}</td>
                  <td className="border border-gray-800 px-2 py-1 text-center align-middle">{r.address}</td>
                  <td className="border border-gray-800 px-2 py-1 text-center align-middle">{r.parentName}</td>
                  <td className="border border-gray-800 px-2 py-1 text-center align-middle">{r.previousSchool}</td>
                  <td className="border border-gray-800 px-2 py-1 text-center align-middle break-words">{r.ijazahNo}</td>
                  <td className="border border-gray-800 px-2 py-1 text-center align-middle">{r.ijazahYear}</td>
                  <td className="border border-gray-800 px-2 py-1"></td>
                  <td className="border border-gray-800 px-2 py-1"></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Blok TTD SENGAJA dibatasi lebar (max-w) + di-tengahkan (mx-auto) — kalau grid-cols-3
            polos dibiarkan selebar halaman landscape, 3 kolom jadi kejauhan satu sama lain
            (banyak ruang kosong di tengah). Tiap kolom rata tengah teksnya sendiri, meniru
            konvensi blok tanda tangan dokumen resmi. Keputusan eksplisit user 2026-09-11. */}
        <div className="grid grid-cols-3 gap-6 mt-3 text-xs max-w-3xl mx-auto text-center" style={{ breakInside: "avoid" }}>
          <div>
            <p>Mengetahui dan menyetujui</p>
            <p className="font-semibold">Kepala Cabang Dinas Pendidikan</p>
            <p>{settings["nominatif.dinasWilayah"] || ""}</p>
            <div className="h-10" />
            <p className="font-semibold underline">{settings["nominatif.dinasNama"] || "( _____________ )"}</p>
            {settings["nominatif.dinasPangkat"] && <p>{settings["nominatif.dinasPangkat"]}</p>}
            <p>NIP. {settings["nominatif.dinasNip"] || "—"}</p>
          </div>
          <div>
            <p>Mengetahui</p>
            <p className="font-semibold">Pengawas SMK</p>
            <div className="h-10 mt-3" />
            <p className="font-semibold underline">{settings["nominatif.pengawasNama"] || "( _____________ )"}</p>
            <p>NIP. {settings["nominatif.pengawasNip"] || "—"}</p>
          </div>
          <div>
            <p>Banyuwangi, {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
            <p className="font-semibold">Kepala SMK Al Munawwir IIBS</p>
            <div className="h-10 mt-3" />
            <p className="font-semibold underline">{principalName || "( _____________ )"}</p>
            <p>NIP. —</p>
          </div>
        </div>
      </div>
    </div>
  );
}
