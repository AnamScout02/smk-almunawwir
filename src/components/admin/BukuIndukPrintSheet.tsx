import React from "react";
import PrintKop from "@/components/shared/PrintKop";

export interface PrintAchievement { name: string; date: string; level: string; givenBy: string; }

export interface PrintBukuIndukData {
  nik?: string; nickname?: string; citizenship?: string;
  childOrder?: string; siblingsCount?: string; halfSiblings?: string;
  adoptedSiblings?: string; orphanStatus?: string; dailyLanguage?: string;
  dusun?: string; rt?: string; rw?: string; desa?: string;
  kecamatan?: string; kabupaten?: string; province?: string; studentPhone?: string;
  livesWith?: string; distanceToSchool?: string;
  bloodType?: string; diseases?: string; height?: string; weight?: string;
  prevSchoolAddress?: string; ijazahDate?: string; ijazahNo?: string;
  skhunDate?: string; lamaBelajar?: string; pindahanDari?: string;
  alasanPindahKe?: string; tingkatMasuk?: string; rombel?: string;
  bidangKeahlian?: string; programKeahlian?: string; kompetensiKeahlian?: string;
  diterimaDate?: string;
  fatherName?: string; fatherNik?: string; fatherBirthPlace?: string;
  fatherBirthDate?: string; fatherReligion?: string; fatherCitizenship?: string;
  fatherEducation?: string; fatherJob?: string; fatherIncome?: string;
  fatherDusun?: string; fatherRt?: string; fatherRw?: string;
  fatherDesa?: string; fatherKecamatan?: string; fatherKabupaten?: string; fatherProvince?: string; fatherAlive?: string;
  motherName?: string; motherNik?: string; motherBirthPlace?: string;
  motherBirthDate?: string; motherReligion?: string; motherCitizenship?: string;
  motherEducation?: string; motherJob?: string; motherIncome?: string;
  motherDusun?: string; motherRt?: string; motherRw?: string;
  motherDesa?: string; motherKecamatan?: string; motherKabupaten?: string; motherProvince?: string; motherAlive?: string;
  guardianName?: string; guardianNik?: string; guardianBirthPlace?: string;
  guardianBirthDate?: string; guardianReligion?: string; guardianCitizenship?: string;
  guardianEducation?: string; guardianJob?: string; guardianIncome?: string;
  guardianDusun?: string; guardianRt?: string; guardianRw?: string;
  guardianDesa?: string; guardianKecamatan?: string; guardianKabupaten?: string; guardianProvince?: string; guardianPhone?: string;
  hobbyArt?: string; hobbySport?: string; hobbyOrg?: string; hobbyOther?: string;
  achievements?: PrintAchievement[];
  pklStartDate?: string; pklEndDate?: string; pklPlace?: string; pklAddress?: string;
  pklLatitude?: string; pklLongitude?: string; pklSupervisor?: string; pklScore?: string;
  graduationDate?: string; graduationIjazahNo?: string; skhunNo?: string;
  avgReport?: string; avgExam?: string; continueStudy?: string; workPlan?: string;
  pindahDate?: string; transferTo?: string; alasanPindah?: string; suratNo?: string;
  fotoMasukUrl?: string; fotoKeluarUrl?: string;
}

export interface PrintStudent {
  id: string; nis: string; nisn?: string;
  birthPlace?: string; birthDate?: string; gender?: string; religion?: string;
  address?: string; parentName?: string; parentPhone?: string; parentJob?: string;
  previousSchool?: string; enrollYear?: number; studentStatus?: string;
  exitDate?: string; studentNotes?: string; bukuIndukData?: PrintBukuIndukData;
  user: { name: string; email: string };
  class?: { name: string; grade: number };
  major: { name: string; code: string };
}

function tgl(d?: string) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
}

const BULAN_ID = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

function tglParts(d?: string): { day: string; month: string; year: string } {
  if (!d) return { day: "-", month: "-", year: "-" };
  const dt = new Date(d);
  return { day: String(dt.getDate()), month: BULAN_ID[dt.getMonth()], year: String(dt.getFullYear()) };
}

function Row({ label, value, labelWidth = "w-36", span2 }: { label: string; value?: string; labelWidth?: string; span2?: boolean }) {
  return (
    <div className={`flex min-w-0 ${span2 ? "col-span-2" : ""}`}>
      <span className={`${labelWidth} shrink-0 text-xs font-bold uppercase text-primary-900`}>{label}</span>
      <span className="mr-1 text-xs text-primary-700">:</span>
      <span className="text-xs font-normal text-primary-700 flex-1 min-w-0 break-words">{value || "-"}</span>
    </div>
  );
}

/** Kapitalisasi awal setiap kata — dipakai untuk nama tempat yang tersimpan dalam huruf kapital semua. */
function properCase(s?: string) {
  if (!s) return s;
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Nama kabupaten/kota tanpa kata "Kabupaten"/"Kota" — labelnya sudah menyebut "Kabupaten/Kota". */
function kabupatenName(s?: string) {
  const v = properCase(s);
  if (!v) return v;
  return v.replace(/^(Kabupaten|Kota)\s+/i, "");
}

/** Grid 2 kolom generik — kolom kiri terisi penuh dulu (baris 1..n), baru lanjut kolom kanan, tidak zigzag.
 * Item dengan prop span2 dikeluarkan dari pembagian kolom dan dirender penuh lebar di bawah.
 * `leftCount` opsional untuk menentukan sendiri berapa item masuk kolom kiri (default: dibagi rata). */
function FieldGrid({ children, leftCount }: { children: React.ReactNode; leftCount?: number }) {
  const items = React.Children.toArray(children) as React.ReactElement<{ span2?: boolean }>[];
  const full = items.filter((el) => el.props?.span2);
  const paired = items.filter((el) => !el.props?.span2);
  const half = leftCount ?? Math.ceil(paired.length / 2);
  const left = paired.slice(0, half);
  const right = paired.slice(half);
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[17rem_1fr] gap-x-8 gap-y-1.5">
        <div className="flex flex-col gap-2">{left}</div>
        <div className="flex flex-col gap-2">{right}</div>
      </div>
      {full}
    </div>
  );
}

/** Baris-baris alamat (Dusun, RT RW, Desa, Kecamatan, Kabupaten, Provinsi) sebagai ARRAY elemen —
 * dipanggil sebagai fungsi biasa `{addressRows({...})}` (bukan komponen `<AddressRows/>`) supaya
 * React.Children.toArray milik FieldGrid induk bisa membaca tiap Row secara individual dan
 * menyatukannya dalam satu urutan kolom kiri/kanan bersama field lain di section yang sama. */
function addressRows({ dusun, rt, rw, desa, kecamatan, kabupaten, province, fallback }: {
  dusun?: string; rt?: string; rw?: string; desa?: string; kecamatan?: string; kabupaten?: string; province?: string; fallback?: string;
}): React.ReactNode[] {
  const has = dusun || rt || rw || desa || kecamatan || kabupaten || province;
  const rtRw = [rt, rw].filter(Boolean).join(" ");
  const rows: React.ReactNode[] = [
    <Row key="dusun" label="Dusun/Lingkungan" value={properCase(dusun)} labelWidth="w-36" />,
    <Row key="rtrw" label="RT RW" value={rtRw} labelWidth="w-36" />,
    <Row key="desa" label="Desa/Kelurahan" value={properCase(desa)} labelWidth="w-36" />,
    <Row key="kecamatan" label="Kecamatan" value={properCase(kecamatan)} labelWidth="w-36" />,
    <Row key="kabupaten" label="Kabupaten/Kota" value={kabupatenName(kabupaten)} labelWidth="w-36" />,
    <Row key="provinsi" label="Provinsi" value={properCase(province)} labelWidth="w-36" />,
  ];
  if (!has && fallback) rows.push(<Row key="alamat" label="Alamat Lengkap" value={fallback} labelWidth="w-36" span2 />);
  return rows;
}

function Section({ title, letter, children, aside }: { title: string; letter: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-4 break-inside-avoid border-2 border-primary-900 rounded overflow-hidden">
      <h3 className="px-6 py-1 text-sm font-bold text-white uppercase tracking-wide"
        style={{ background: "linear-gradient(135deg, #0A1030 0%, #0F1A45 40%, #1B2B6B 100%)" }}>
        {letter}.&nbsp;&nbsp;{title}
      </h3>
      <div className="px-6 pt-1.5 pb-1.5 flex gap-4">
        <div className="flex-1 flex flex-col gap-2">{children}</div>
        {aside && <div className="shrink-0">{aside}</div>}
      </div>
    </div>
  );
}

/** Footer berulang tiap halaman — kiri judul, tengah identitas, kanan nomor halaman. */
function PageFooter({ nis, name, pageNum }: { nis: string; name: string; pageNum: number }) {
  return (
    <div className="relative flex items-center justify-between px-6 py-2 mt-auto overflow-hidden shrink-0"
      style={{ background: "linear-gradient(135deg, #0A1030 0%, #0F1A45 40%, #1B2B6B 100%)" }}>
      <div className="absolute inset-0 opacity-[0.08] pointer-events-none"
        style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "90px 90px", backgroundRepeat: "repeat", filter: "invert(1)" }}
      />
      <span className="relative text-[9px] font-bold uppercase tracking-wide text-white">Buku Induk Siswa</span>
      <span className="relative text-[9px] font-semibold text-white/80">{nis} — {name}</span>
      <span className="relative text-base font-bold text-gold">{pageNum}</span>
    </div>
  );
}

/** Satu halaman fisik A4 — konten mengalir di tengah, footer selalu di bawah. Halaman 2+ diberi jarak atas agar section pertama tidak mentok. */
function PrintPage({ pageNum, first, last, nis, name, children }: {
  pageNum: number; first?: boolean; last?: boolean; nis: string; name: string; children: React.ReactNode;
}) {
  return (
    <div data-print-page={pageNum} className={`print-doc relative w-full min-h-[297mm] flex flex-col bg-white overflow-hidden ${last ? "" : "break-after-page"}`}>
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "90px 90px", backgroundRepeat: "repeat" }}
      />
      <div className={`relative flex-1 pl-16 pr-8 ${first ? "pt-0" : "pt-6"} pb-2 [&>*:last-child]:mb-0`}>
        {children}
      </div>
      <PageFooter nis={nis} name={name} pageNum={pageNum} />
    </div>
  );
}

/** Lembar cetak Buku Induk Siswa — A4, tanpa margin browser, 4 halaman tetap dengan footer bernomor.
 * `isLastInSequence` (default true): set false saat dipakai dalam cetak massal dan bukan siswa terakhir,
 * supaya halaman ke-4 tetap diberi jeda halaman sebelum siswa berikutnya. */
export default function BukuIndukPrintSheet({ student, logoUrl, principalName, qrDataUrl, isLastInSequence = true }: { student: PrintStudent; letterheadUrl?: string; logoUrl?: string; principalName?: string; qrDataUrl?: string; isLastInSequence?: boolean }) {
  const b = (student.bukuIndukData ?? {}) as PrintBukuIndukData;
  const birth = tglParts(student.birthDate);
  const fatherBirth = tglParts(b.fatherBirthDate);
  const motherBirth = tglParts(b.motherBirthDate);
  const guardianBirth = tglParts(b.guardianBirthDate);
  const nis = student.nis;
  const name = student.user.name;

  return (
    <div className="w-full bg-white" style={{ fontFamily: "'Arial Narrow', Arial, sans-serif" }}>
      <style>{`* { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }`}</style>
      {/* ── Halaman 1 ── */}
      <PrintPage pageNum={1} first nis={nis} name={name}>
        <PrintKop title="Buku Induk Siswa" subtitle="SMK Al Munawwir IIBS" logoUrl={logoUrl} edgeClassName="-ml-16 -mr-8" />

        <Section
          letter="A"
          title="Keterangan Siswa"
          aside={
            <div className="w-24 mt-6 flex flex-col items-center gap-2">
              <div className="w-20 h-28 border border-gray-300 bg-white rounded overflow-hidden flex items-center justify-center">
                {b.fotoMasukUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.fotoMasukUrl} alt="Foto Masuk" className="w-full h-full object-cover" />
                ) : (
                  <p className="text-[9px] text-primary-300 text-center px-1">Foto 3x4</p>
                )}
              </div>
              <p className="text-[9px] text-primary-700 text-center">Foto saat masuk</p>
            </div>
          }
        >
          <FieldGrid leftCount={14}>
            <Row label="Nama Lengkap" value={student.user.name} labelWidth="w-36" />
            <Row label="Nama Panggilan" value={b.nickname} labelWidth="w-36" />
            <Row label="NIK" value={b.nik} labelWidth="w-36" />
            <Row label="NIS" value={student.nis} labelWidth="w-36" />
            <Row label="NISN" value={student.nisn} labelWidth="w-36" />
            <Row label="Jenis Kelamin" value={student.gender === "L" ? "Laki-laki" : student.gender === "P" ? "Perempuan" : "-"} labelWidth="w-36" />
            <Row label="Tempat Lahir" value={student.birthPlace} labelWidth="w-36" />
            <Row label="Tanggal Lahir" value={birth.day} labelWidth="w-36" />
            <Row label="Bulan Lahir" value={birth.month} labelWidth="w-36" />
            <Row label="Tahun Lahir" value={birth.year} labelWidth="w-36" />
            <Row label="Agama" value={student.religion} labelWidth="w-36" />
            <Row label="Kewarganegaraan" value={b.citizenship} labelWidth="w-36" />
            <Row label="Anak Ke" value={b.childOrder} labelWidth="w-36" />
            <Row label="Jml Saudara Kandung" value={b.siblingsCount} labelWidth="w-36" />
            <Row label="Jml Saudara Tiri" value={b.halfSiblings} labelWidth="w-36" />
            <Row label="Jml Saudara Angkat" value={b.adoptedSiblings} labelWidth="w-36" />
            <Row label="Status Yatim/Piatu" value={b.orphanStatus} labelWidth="w-36" />
            <Row label="Bahasa Sehari-hari" value={b.dailyLanguage} labelWidth="w-36" span2 />
          </FieldGrid>
        </Section>

        <Section letter="B" title="Alamat & Kontak Siswa">
          <FieldGrid>
            {addressRows({ dusun: b.dusun, rt: b.rt, rw: b.rw, desa: b.desa, kecamatan: b.kecamatan, kabupaten: b.kabupaten, province: b.province, fallback: student.address })}
            <Row label="No. HP/WA Siswa" value={b.studentPhone} labelWidth="w-36" />
            <Row label="Tinggal Bersama" value={b.livesWith} labelWidth="w-36" />
            <Row label="Jarak ke Sekolah" value={b.distanceToSchool} labelWidth="w-36" />
          </FieldGrid>
        </Section>

        <Section letter="C" title="Kesehatan">
          <FieldGrid>
            <Row label="Golongan Darah" value={b.bloodType} labelWidth="w-36" />
            <Row label="Tinggi Badan" value={b.height ? `${b.height} cm` : "-"} labelWidth="w-36" />
            <Row label="Berat Badan" value={b.weight ? `${b.weight} kg` : "-"} labelWidth="w-36" />
            <Row label="Penyakit/Kondisi" value={b.diseases} labelWidth="w-36" />
          </FieldGrid>
        </Section>

        <Section letter="D" title="Pendidikan Sebelumnya & Penerimaan">
          <div className="flex flex-col gap-2">
            <Row label="Asal Sekolah" value={student.previousSchool} labelWidth="w-36" />
            <Row label="Alamat Sekolah Asal" value={b.prevSchoolAddress} labelWidth="w-36" />
            <div className="grid grid-cols-[17rem_1fr] gap-x-8 gap-y-1.5">
              <div className="flex flex-col gap-2">
                <Row label="Tgl Ijazah" value={tgl(b.ijazahDate)} labelWidth="w-36" />
                <Row label="No. Ijazah" value={b.ijazahNo} labelWidth="w-36" />
                <Row label="Tgl SKHUN" value={tgl(b.skhunDate)} labelWidth="w-36" />
                <Row label="Lama Belajar" value={b.lamaBelajar} labelWidth="w-36" />
                <Row label="Pindahan Dari" value={b.pindahanDari} labelWidth="w-36" />
                <Row label="Alasan Pindah Ke Sini" value={b.alasanPindahKe} labelWidth="w-36" />
              </div>
              <div className="flex flex-col gap-2">
                <Row label="Tingkat Masuk" value={b.tingkatMasuk} labelWidth="w-36" />
                <Row label="Rombel" value={b.rombel} labelWidth="w-36" />
                <Row label="Bidang Keahlian" value={b.bidangKeahlian} labelWidth="w-36" />
                <Row label="Program Keahlian" value={b.programKeahlian} labelWidth="w-36" />
                <Row label="Konsentrasi Keahlian" value={b.kompetensiKeahlian || student.major.name} labelWidth="w-36" />
                <Row label="Tanggal Diterima" value={tgl(b.diterimaDate)} labelWidth="w-36" />
              </div>
            </div>
          </div>
        </Section>
      </PrintPage>

      {/* ── Halaman 2 ── */}
      <PrintPage pageNum={2} nis={nis} name={name}>
        <Section letter="E" title="Data Orang Tua — Ayah">
          <FieldGrid>
            <Row label="Nama Ayah" value={b.fatherName || student.parentName} labelWidth="w-36" />
            <Row label="NIK Ayah" value={b.fatherNik} labelWidth="w-36" />
            <Row label="Tempat Lahir" value={b.fatherBirthPlace} labelWidth="w-36" />
            <Row label="Tanggal Lahir" value={fatherBirth.day} labelWidth="w-36" />
            <Row label="Bulan Lahir" value={fatherBirth.month} labelWidth="w-36" />
            <Row label="Tahun Lahir" value={fatherBirth.year} labelWidth="w-36" />
            <Row label="Agama" value={b.fatherReligion} labelWidth="w-36" />
            <Row label="Kewarganegaraan" value={b.fatherCitizenship} labelWidth="w-36" />
            <Row label="Pendidikan Terakhir" value={b.fatherEducation} labelWidth="w-36" />
            <Row label="Pekerjaan" value={b.fatherJob || student.parentJob} labelWidth="w-36" />
            <Row label="Penghasilan/Bulan" value={b.fatherIncome} labelWidth="w-36" />
            {addressRows({ dusun: b.fatherDusun, rt: b.fatherRt, rw: b.fatherRw, desa: b.fatherDesa, kecamatan: b.fatherKecamatan, kabupaten: b.fatherKabupaten, province: b.fatherProvince })}
            <Row label="Kondisi" value={b.fatherAlive} labelWidth="w-36" />
          </FieldGrid>
        </Section>

        <Section letter="F" title="Data Orang Tua — Ibu">
          <FieldGrid>
            <Row label="Nama Ibu" value={b.motherName} labelWidth="w-36" />
            <Row label="NIK Ibu" value={b.motherNik} labelWidth="w-36" />
            <Row label="Tempat Lahir" value={b.motherBirthPlace} labelWidth="w-36" />
            <Row label="Tanggal Lahir" value={motherBirth.day} labelWidth="w-36" />
            <Row label="Bulan Lahir" value={motherBirth.month} labelWidth="w-36" />
            <Row label="Tahun Lahir" value={motherBirth.year} labelWidth="w-36" />
            <Row label="Agama" value={b.motherReligion} labelWidth="w-36" />
            <Row label="Kewarganegaraan" value={b.motherCitizenship} labelWidth="w-36" />
            <Row label="Pendidikan Terakhir" value={b.motherEducation} labelWidth="w-36" />
            <Row label="Pekerjaan" value={b.motherJob} labelWidth="w-36" />
            <Row label="Penghasilan/Bulan" value={b.motherIncome} labelWidth="w-36" />
            {addressRows({ dusun: b.motherDusun, rt: b.motherRt, rw: b.motherRw, desa: b.motherDesa, kecamatan: b.motherKecamatan, kabupaten: b.motherKabupaten, province: b.motherProvince })}
            <Row label="Kondisi" value={b.motherAlive} labelWidth="w-36" />
          </FieldGrid>
        </Section>
        <Section letter="G" title="Data Wali Murid">
          <FieldGrid>
            <Row label="Nama Wali" value={b.guardianName} labelWidth="w-36" />
            <Row label="NIK Wali" value={b.guardianNik} labelWidth="w-36" />
            <Row label="Tempat Lahir" value={b.guardianBirthPlace} labelWidth="w-36" />
            <Row label="Tanggal Lahir" value={guardianBirth.day} labelWidth="w-36" />
            <Row label="Bulan Lahir" value={guardianBirth.month} labelWidth="w-36" />
            <Row label="Tahun Lahir" value={guardianBirth.year} labelWidth="w-36" />
            <Row label="Agama" value={b.guardianReligion} labelWidth="w-36" />
            <Row label="Kewarganegaraan" value={b.guardianCitizenship} labelWidth="w-36" />
            <Row label="Pendidikan Terakhir" value={b.guardianEducation} labelWidth="w-36" />
            <Row label="Pekerjaan" value={b.guardianJob} labelWidth="w-36" />
            <Row label="Penghasilan/Bulan" value={b.guardianIncome} labelWidth="w-36" />
            <Row label="No. HP/WA" value={b.guardianPhone || student.parentPhone} labelWidth="w-36" />
            {addressRows({ dusun: b.guardianDusun, rt: b.guardianRt, rw: b.guardianRw, desa: b.guardianDesa, kecamatan: b.guardianKecamatan, kabupaten: b.guardianKabupaten, province: b.guardianProvince })}
          </FieldGrid>
        </Section>

        <Section letter="H" title="Praktik Kerja Lapangan (PKL)">
          <FieldGrid>
            <Row label="Tempat PKL" value={b.pklPlace} labelWidth="w-36" />
            <Row label="Alamat" value={b.pklAddress} labelWidth="w-36" />
            <Row label="Tanggal Mulai" value={tgl(b.pklStartDate)} labelWidth="w-36" />
            <Row label="Tanggal Selesai" value={tgl(b.pklEndDate)} labelWidth="w-36" />
            <Row label="Pembimbing" value={b.pklSupervisor} labelWidth="w-36" />
            <Row label="Nilai PKL" value={b.pklScore} labelWidth="w-36" />
            <Row label="Lintang Selatan (LS)" value={b.pklLatitude} labelWidth="w-36" />
            <Row label="Bujur Timur (BT)" value={b.pklLongitude} labelWidth="w-36" />
          </FieldGrid>
        </Section>
      </PrintPage>

      {/* ── Halaman 3 ── */}
      <PrintPage pageNum={3} last={isLastInSequence} nis={nis} name={name}>
        <Section letter="I" title="Hobi & Kegemaran">
          <FieldGrid>
            <Row label="Seni" value={b.hobbyArt} labelWidth="w-36" />
            <Row label="Olahraga" value={b.hobbySport} labelWidth="w-36" />
            <Row label="Organisasi" value={b.hobbyOrg} labelWidth="w-36" />
            <Row label="Lainnya" value={b.hobbyOther} labelWidth="w-36" />
          </FieldGrid>
        </Section>

        <div className="mb-4 break-inside-avoid border-2 border-primary-900 rounded overflow-hidden">
          <h3 className="px-6 py-1 text-sm font-bold text-white uppercase tracking-wide"
            style={{ background: "linear-gradient(135deg, #0A1030 0%, #0F1A45 40%, #1B2B6B 100%)" }}>J.&nbsp;&nbsp;Prestasi</h3>
          <div className="px-6 pt-1.5 pb-1.5">
            {(!b.achievements || b.achievements.length === 0) ? (
              <p className="text-xs text-primary-700">-</p>
            ) : (
              <table className="w-full text-xs border border-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {["No","Nama Prestasi","Tanggal","Tingkat","Pemberi"].map(h => (
                      <th key={h} className="px-2 py-1.5 text-left font-semibold text-primary-900 border-b border-gray-200">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {b.achievements.map((a, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="px-2 py-1">{i+1}</td>
                      <td className="px-2 py-1">{a.name}</td>
                      <td className="px-2 py-1">{tgl(a.date)}</td>
                      <td className="px-2 py-1">{a.level}</td>
                      <td className="px-2 py-1">{a.givenBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <Section
          letter="K"
          title="Kelulusan"
          aside={
            <div className="w-24 mt-3 flex flex-col items-center gap-2">
              <div className="w-20 h-28 border border-gray-300 bg-white rounded overflow-hidden flex items-center justify-center">
                {b.fotoKeluarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.fotoKeluarUrl} alt="Foto Keluar/Lulus" className="w-full h-full object-cover" />
                ) : (
                  <p className="text-[9px] text-primary-300 text-center px-1">Foto 3x4</p>
                )}
              </div>
              <p className="text-[9px] text-primary-700 text-center">Foto saat keluar/lulus</p>
            </div>
          }
        >
          <FieldGrid>
            <Row label="Tanggal Lulus" value={tgl(b.graduationDate)} labelWidth="w-36" />
            <Row label="No. Ijazah Kelulusan" value={b.graduationIjazahNo} labelWidth="w-36" />
            <Row label="No. SKHUN" value={b.skhunNo} labelWidth="w-36" />
            <Row label="Rata-rata Rapor" value={b.avgReport} labelWidth="w-36" />
            <Row label="Rata-rata Ujian" value={b.avgExam} labelWidth="w-36" />
            <Row label="Melanjutkan Ke" value={b.continueStudy} labelWidth="w-36" />
            <Row label="Rencana Kerja" value={b.workPlan} labelWidth="w-36" span2 />
          </FieldGrid>
        </Section>

        <Section letter="L" title="Pindah / Keluar">
          <FieldGrid>
            <Row label="Tgl Pindah/Keluar" value={tgl(b.pindahDate || student.exitDate)} labelWidth="w-36" />
            <Row label="Nomor Surat" value={b.suratNo} labelWidth="w-36" />
            <Row label="Pindah/Keluar Ke" value={b.transferTo} labelWidth="w-36" />
            <Row label="Alasan" value={b.alasanPindah || student.studentNotes} labelWidth="w-36" span2 />
          </FieldGrid>
        </Section>

        <Section letter="M" title="Akun & Login">
          <Row label="Email Login" value={student.user.email} />
        </Section>

        {/* QR verifikasi + Tanda tangan Kepala Sekolah */}
        <div className="mt-10 mr-16 flex items-end justify-between">
          {qrDataUrl && (
            <div className="text-center text-[8px] text-gray-400 w-24">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="QR verifikasi dokumen" className="w-20 h-20 mx-auto" />
              <p className="mt-1">Scan untuk verifikasi keaslian dokumen</p>
            </div>
          )}
          <div className="text-center text-xs w-56 ml-auto">
            <p className="mb-16 text-primary-700">Kepala SMK Al Munawwir IIBS</p>
            <div className="pt-1">
              <p className="font-bold underline text-primary-900">( {principalName || "__________________"} )</p>
            </div>
          </div>
        </div>
      </PrintPage>
    </div>
  );
}
