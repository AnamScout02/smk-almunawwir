import React from "react";

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
  pindahDate?: string; transferTo?: string; alasanPindah?: string;
  fotoMasukUrl?: string; fotoKeluarUrl?: string;
}

export interface PrintStudent {
  id: string; nis: string; nisn?: string; noInduk?: string;
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

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex">
      <span className="w-52 shrink-0 text-xs font-bold uppercase text-gray-800">{label}</span>
      <span className="mr-2 text-xs text-gray-400">:</span>
      <span className="text-xs font-semibold text-blue-700 flex-1">{value || ""}</span>
    </div>
  );
}

function Section({ title, letter, children }: { title: string; letter: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 break-inside-avoid border-2 border-gray-800 rounded">
      <h3 className="px-4 pt-3 pb-2 text-sm font-bold text-primary-900 uppercase tracking-wide">
        {letter}.&nbsp;&nbsp;{title}
      </h3>
      <div className="px-4 pb-4 flex flex-col gap-1.5">
        {children}
      </div>
    </div>
  );
}

function buildAddr(dusun?: string, rt?: string, rw?: string, desa?: string, kecamatan?: string, kabupaten?: string, province?: string) {
  return [
    dusun,
    (rt || rw) ? `RT ${rt || "-"}/RW ${rw || "-"}` : "",
    desa, kecamatan, kabupaten, province,
  ].filter(Boolean).join(", ");
}

/** Kop A4 — lembar cetak satu siswa. Dipakai baik untuk cetak tunggal maupun cetak massal per kelas. */
export default function BukuIndukPrintSheet({ student, letterheadUrl }: { student: PrintStudent; letterheadUrl?: string }) {
  const b = (student.bukuIndukData ?? {}) as PrintBukuIndukData;
  const addr = buildAddr(b.dusun, b.rt, b.rw, b.desa, b.kecamatan, b.kabupaten, b.province);
  const fAddr = buildAddr(b.fatherDusun, b.fatherRt, b.fatherRw, b.fatherDesa, b.fatherKecamatan, b.fatherKabupaten, b.fatherProvince);
  const mAddr = buildAddr(b.motherDusun, b.motherRt, b.motherRw, b.motherDesa, b.motherKecamatan, b.motherKabupaten, b.motherProvince);
  const gAddr = buildAddr(b.guardianDusun, b.guardianRt, b.guardianRw, b.guardianDesa, b.guardianKecamatan, b.guardianKabupaten, b.guardianProvince);
  const birth = tglParts(student.birthDate);

  return (
    <div className="max-w-4xl mx-auto bg-white shadow-lg print:shadow-none print:max-w-full rounded-lg overflow-hidden print:overflow-visible break-after-page">
      {/* Kop */}
      {letterheadUrl ? (
        <div className="border-b-2 border-gray-700">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={letterheadUrl} alt="Kop Surat" className="w-full h-auto block" />
        </div>
      ) : (
        <div className="px-10 pt-8 pb-4 border-b-2 border-gray-700 text-center">
          <p className="font-bold text-base tracking-wide uppercase">Buku Induk Siswa</p>
          <p className="font-bold text-lg uppercase">SMK Al Munawwir IIBS</p>
          <p className="text-xs text-gray-500">Jl. KH. Abdul Munawwir, Krapyak Kulon, Panggungharjo, Sewon, Bantul, DIY</p>
        </div>
      )}

      <div className="px-10 py-6">
        {/* Identitas ringkas */}
        <div className="flex gap-4 mb-6 bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="w-20 h-28 shrink-0 border border-gray-300 bg-white rounded overflow-hidden flex items-center justify-center">
            {b.fotoMasukUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={b.fotoMasukUrl} alt="Foto Masuk" className="w-full h-full object-cover" />
            ) : (
              <p className="text-[9px] text-gray-300 text-center px-1">Foto 3x4</p>
            )}
          </div>
          <div className="grid grid-cols-3 gap-4 flex-1">
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-0.5">Nomor Induk</p>
              <p className="font-bold text-gray-800">{student.noInduk || "-"}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-0.5">NIS</p>
              <p className="font-bold text-gray-800">{student.nis}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-0.5">NISN</p>
              <p className="font-bold text-gray-800">{student.nisn || "-"}</p>
            </div>
            <div className="col-span-2">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-0.5">Nama Lengkap</p>
              <p className="font-bold text-gray-800 text-base">{student.user.name}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-0.5">Status</p>
              <p className="font-bold text-gray-800">{student.studentStatus || "AKTIF"}</p>
            </div>
          </div>
        </div>

        <Section letter="A" title="Keterangan Siswa">
          <Row label="Nama Lengkap" value={student.user.name} />
          <Row label="Nama Panggilan" value={b.nickname} />
          <Row label="NIK" value={b.nik} />
          <Row label="NIS" value={student.nis} />
          <Row label="NISN" value={student.nisn} />
          <Row label="Nomor Induk" value={student.noInduk} />
          <Row label="Jenis Kelamin" value={student.gender === "L" ? "Laki-laki" : student.gender === "P" ? "Perempuan" : "-"} />
          <Row label="Tempat Lahir" value={student.birthPlace} />
          <Row label="Tanggal Lahir" value={birth.day} />
          <Row label="Bulan Lahir" value={birth.month} />
          <Row label="Tahun Lahir" value={birth.year} />
          <Row label="Agama" value={student.religion} />
          <Row label="Kewarganegaraan" value={b.citizenship} />
          <Row label="Anak Ke" value={b.childOrder} />
          <Row label="Jml Saudara Kandung" value={b.siblingsCount} />
          <Row label="Jml Saudara Tiri" value={b.halfSiblings} />
          <Row label="Jml Saudara Angkat" value={b.adoptedSiblings} />
          <Row label="Status Yatim/Piatu" value={b.orphanStatus} />
          <Row label="Bahasa Sehari-hari" value={b.dailyLanguage} />
        </Section>

        <Section letter="B" title="Alamat & Kontak Siswa">
          <Row label="Alamat Lengkap" value={addr || student.address} />
          <Row label="No. HP/WA Siswa" value={b.studentPhone} />
          <Row label="Tinggal Bersama" value={b.livesWith} />
          <Row label="Jarak ke Sekolah" value={b.distanceToSchool ? `${b.distanceToSchool} km` : "-"} />
        </Section>

        <Section letter="C" title="Kesehatan">
          <Row label="Golongan Darah" value={b.bloodType} />
          <Row label="Tinggi Badan" value={b.height ? `${b.height} cm` : "-"} />
          <Row label="Berat Badan" value={b.weight ? `${b.weight} kg` : "-"} />
          <Row label="Penyakit/Kondisi" value={b.diseases} />
        </Section>

        <Section letter="D" title="Pendidikan Sebelumnya & Penerimaan">
          <Row label="Asal Sekolah" value={student.previousSchool} />
          <Row label="Alamat Sekolah Asal" value={b.prevSchoolAddress} />
          <Row label="Tgl Ijazah" value={tgl(b.ijazahDate)} />
          <Row label="No. Ijazah" value={b.ijazahNo} />
          <Row label="Tgl SKHUN" value={tgl(b.skhunDate)} />
          <Row label="Lama Belajar" value={b.lamaBelajar ? `${b.lamaBelajar} tahun` : "-"} />
          <Row label="Pindahan Dari" value={b.pindahanDari} />
          <Row label="Alasan Pindah Ke Sini" value={b.alasanPindahKe} />
          <Row label="Tingkat Masuk" value={b.tingkatMasuk} />
          <Row label="Rombel" value={b.rombel} />
          <Row label="Bidang Keahlian" value={b.bidangKeahlian} />
          <Row label="Program Keahlian" value={b.programKeahlian} />
          <Row label="Kompetensi Keahlian" value={b.kompetensiKeahlian || student.major.name} />
          <Row label="Tahun Masuk" value={student.enrollYear?.toString()} />
          <Row label="Tanggal Diterima" value={tgl(b.diterimaDate)} />
          <Row label="Kelas Sekarang" value={student.class?.name} />
        </Section>

        <Section letter="E" title="Data Orang Tua — Ayah">
          <Row label="Nama Ayah" value={b.fatherName || student.parentName} />
          <Row label="NIK Ayah" value={b.fatherNik} />
          <Row label="Tempat Lahir" value={b.fatherBirthPlace} />
          <Row label="Tanggal Lahir" value={tgl(b.fatherBirthDate)} />
          <Row label="Agama" value={b.fatherReligion} />
          <Row label="Kewarganegaraan" value={b.fatherCitizenship} />
          <Row label="Pendidikan Terakhir" value={b.fatherEducation} />
          <Row label="Pekerjaan" value={b.fatherJob || student.parentJob} />
          <Row label="Penghasilan/Bulan" value={b.fatherIncome} />
          <Row label="Alamat" value={fAddr} />
          <Row label="Kondisi" value={b.fatherAlive} />
        </Section>

        <Section letter="F" title="Data Orang Tua — Ibu">
          <Row label="Nama Ibu" value={b.motherName} />
          <Row label="NIK Ibu" value={b.motherNik} />
          <Row label="Tempat Lahir" value={b.motherBirthPlace} />
          <Row label="Tanggal Lahir" value={tgl(b.motherBirthDate)} />
          <Row label="Agama" value={b.motherReligion} />
          <Row label="Kewarganegaraan" value={b.motherCitizenship} />
          <Row label="Pendidikan Terakhir" value={b.motherEducation} />
          <Row label="Pekerjaan" value={b.motherJob} />
          <Row label="Penghasilan/Bulan" value={b.motherIncome} />
          <Row label="Alamat" value={mAddr} />
          <Row label="Kondisi" value={b.motherAlive} />
        </Section>

        <Section letter="G" title="Data Wali Murid">
          <Row label="Nama Wali" value={b.guardianName} />
          <Row label="NIK Wali" value={b.guardianNik} />
          <Row label="Tempat Lahir" value={b.guardianBirthPlace} />
          <Row label="Tanggal Lahir" value={tgl(b.guardianBirthDate)} />
          <Row label="Agama" value={b.guardianReligion} />
          <Row label="Kewarganegaraan" value={b.guardianCitizenship} />
          <Row label="Pendidikan Terakhir" value={b.guardianEducation} />
          <Row label="Pekerjaan" value={b.guardianJob} />
          <Row label="Penghasilan/Bulan" value={b.guardianIncome} />
          <Row label="No. HP/WA" value={b.guardianPhone || student.parentPhone} />
          <Row label="Alamat" value={gAddr} />
        </Section>

        <Section letter="H" title="Hobi & Kegemaran">
          <Row label="Seni" value={b.hobbyArt} />
          <Row label="Olahraga" value={b.hobbySport} />
          <Row label="Organisasi" value={b.hobbyOrg} />
          <Row label="Lainnya" value={b.hobbyOther} />
        </Section>

        <Section letter="I" title="Prestasi">
          {(!b.achievements || b.achievements.length === 0) ? (
            <p className="text-xs text-gray-400">-</p>
          ) : (
            <table className="w-full text-xs border border-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {["No","Nama Prestasi","Tanggal","Tingkat","Pemberi"].map(h => (
                    <th key={h} className="px-2 py-1.5 text-left font-semibold text-gray-600 border-b border-gray-200">{h}</th>
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
        </Section>

        <Section letter="J" title="Praktik Kerja Lapangan (PKL)">
          <Row label="Tempat PKL" value={b.pklPlace} />
          <Row label="Alamat" value={b.pklAddress} />
          <Row label="Tanggal Mulai" value={tgl(b.pklStartDate)} />
          <Row label="Tanggal Selesai" value={tgl(b.pklEndDate)} />
          <Row label="Pembimbing" value={b.pklSupervisor} />
          <Row label="Nilai PKL" value={b.pklScore} />
          {(b.pklLatitude || b.pklLongitude) && (
            <Row label="Koordinat" value={`${b.pklLatitude ?? ""}, ${b.pklLongitude ?? ""}`} />
          )}
        </Section>

        <Section letter="K" title="Kelulusan">
          <Row label="Tanggal Lulus" value={tgl(b.graduationDate)} />
          <Row label="No. Ijazah Kelulusan" value={b.graduationIjazahNo} />
          <Row label="No. SKHUN" value={b.skhunNo} />
          <Row label="Rata-rata Rapor" value={b.avgReport} />
          <Row label="Rata-rata Ujian" value={b.avgExam} />
          <Row label="Melanjutkan Ke" value={b.continueStudy} />
          <Row label="Rencana Kerja" value={b.workPlan} />
        </Section>

        <Section letter="L" title="Pindah / Keluar">
          <Row label="Tanggal Pindah/Keluar" value={tgl(b.pindahDate || student.exitDate)} />
          <Row label="Pindah/Keluar Ke" value={b.transferTo} />
          <Row label="Alasan" value={b.alasanPindah || student.studentNotes} />
          <div className="col-span-2 flex items-center gap-3 mt-1">
            <div className="w-16 h-20 shrink-0 border border-gray-300 bg-white rounded overflow-hidden flex items-center justify-center">
              {b.fotoKeluarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.fotoKeluarUrl} alt="Foto Keluar/Lulus" className="w-full h-full object-cover" />
              ) : (
                <p className="text-[8px] text-gray-300 text-center px-1">Foto 3x4</p>
              )}
            </div>
            <p className="text-[10px] text-gray-400">Foto saat keluar/lulus</p>
          </div>
        </Section>

        <Section letter="M" title="Akun & Login">
          <Row label="Email Login" value={student.user.email} />
        </Section>

        {/* Tanda tangan */}
        <div className="mt-10 grid grid-cols-3 gap-6 text-center text-xs">
          {["Orang Tua / Wali", "Kepala Sekolah", "Wali Kelas"].map(t => (
            <div key={t}>
              <p className="mb-16 text-gray-500">{t}</p>
              <div className="border-t border-gray-400 pt-1">
                <p className="text-gray-600">( __________________ )</p>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-[10px] text-gray-400">
          Dicetak pada {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>
    </div>
  );
}
