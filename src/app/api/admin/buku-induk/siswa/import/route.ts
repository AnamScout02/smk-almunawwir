import { NextRequest, NextResponse } from "next/server";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";
import { KEAHLIAN_MAP } from "@/lib/keahlian-map";
import { toProperCase, toProperCaseName, normalizeBukuIndukText } from "@/lib/text";
import * as XLSX from "xlsx";

function parseDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  const str = String(val).trim();
  if (!str) return null;
  const dmyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    if (!isNaN(date.getTime())) return date;
  }
  const num = Number(val);
  if (!isNaN(num) && num > 1000) {
    const parsed = XLSX.SSF.parse_date_code(num);
    if (parsed) return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function s(val: unknown): string {
  return String(val ?? "").trim();
}

/** Format tanggal dari Excel jadi string "YYYY-MM-DD" untuk disimpan di bukuIndukData (JSON) — konsisten dengan format input type="date" di form admin. */
function dateStr(val: unknown): string | null {
  const d = parseDate(val);
  return d ? d.toISOString().slice(0, 10) : null;
}

export async function POST(req: NextRequest) {
  await verifyTasAccess();

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "File tidak ditemukan" }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

  if (rows.length === 0) return NextResponse.json({ error: "Tidak ada data di file" }, { status: 400 });

  const results = { created: 0, updated: 0, errors: [] as string[] };

  const majors = await prisma.major.findMany({ select: { id: true, code: true } });
  const majorMap = Object.fromEntries(majors.map(m => [m.code.toUpperCase(), m.id]));

  const classesAll = await prisma.class.findMany({ select: { id: true, name: true, majorId: true } });
  const classMap = Object.fromEntries(classesAll.map(c => [`${c.majorId}::${c.name.toUpperCase()}`, c.id]));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    const nis = s(row["NIS"]);
    const nama = s(row["Nama Lengkap"]);
    if (!nis || !nama) {
      results.errors.push(`Baris ${rowNum}: NIS dan Nama Lengkap wajib diisi`);
      continue;
    }

    const kodeJurusan = s(row["Kode Jurusan (TKJ/AK/ATU/DKV/DPIB)"]).toUpperCase();
    const majorId = majorMap[kodeJurusan];
    if (!majorId) {
      results.errors.push(`Baris ${rowNum}: Kode jurusan "${kodeJurusan}" tidak ditemukan`);
      continue;
    }

    const kelasNama = s(row["Nama Kelas (contoh: X DPIB 1)"]);
    let classId: string | undefined;
    // "Rombel" = angka terakhir nama kelas (cth "XII DPIB 1" → "1") — sama persis dengan logic
    // auto-isi di form manual BukuIndukSiswaModal (baris `cls.name.match(/(\d+)\s*$/)`). Dulu jalur
    // import ini TIDAK mengisi rombel sama sekali (beda dari form manual) — sekarang disamakan,
    // supaya siswa yang datanya masuk lewat import tetap konsisten saat dicetak Buku Induk.
    let rombel: string | undefined;
    if (kelasNama) {
      classId = classMap[`${majorId}::${kelasNama.toUpperCase()}`];
      if (!classId) {
        results.errors.push(`Baris ${rowNum}: Kelas "${kelasNama}" tidak ditemukan untuk jurusan ${kodeJurusan} — siswa tetap disimpan tanpa kelas`);
      }
      rombel = kelasNama.match(/(\d+)\s*$/)?.[1] ?? "1";
    }

    const enrollYearRaw = s(row["Tahun Masuk"]);
    const enrollYear = enrollYearRaw ? parseInt(enrollYearRaw) : null;

    const basicData = {
      nisn:           s(row["NISN"]) || null,
      birthPlace:     s(row["Tempat Lahir"]) || null,
      birthDate:      parseDate(row["Tanggal Lahir (DD/MM/YYYY)"]),
      gender:         s(row["Jenis Kelamin (L/P)"]).toUpperCase() || null,
      religion:       s(row["Agama"]) || null,
      address:        s(row["Desa/Kelurahan"])
        ? [s(row["Dusun/Lingkungan"]), s(row["Desa/Kelurahan"]), s(row["Kecamatan"]), s(row["Kabupaten/Kota"]), s(row["Provinsi"])].filter(Boolean).join(", ")
        : s(row["Asal Sekolah (SMP/MTs)"]) || null,
      parentName:     s(row["Nama Ayah"]) ? toProperCaseName(s(row["Nama Ayah"])) : null,
      parentPhone:    s(row["No. HP Orang Tua"]) || null,
      parentJob:      s(row["Pekerjaan Ayah"]) || null,
      previousSchool: s(row["Asal Sekolah (SMP/MTs)"]) ? toProperCase(s(row["Asal Sekolah (SMP/MTs)"])) : null,
      enrollYear:     enrollYear && !isNaN(enrollYear) ? enrollYear : null,
      studentStatus:  s(row["Status (AKTIF/LULUS/KELUAR/PINDAH)"]).toUpperCase() || "AKTIF",
      studentNotes:   s(row["Keterangan"]) || null,
    };

    const dusun = s(row["Dusun/Lingkungan"]) || null;
    const rt = s(row["RT"]) || null;
    const rw = s(row["RW"]) || null;
    const desa = s(row["Desa/Kelurahan"]) || null;
    const kecamatan = s(row["Kecamatan"]) || null;
    const kabupaten = s(row["Kabupaten/Kota"]) || null;
    const province = s(row["Provinsi"]) || null;
    const keahlian = KEAHLIAN_MAP[kodeJurusan];

    const bukuIndukData = {
      nik:              s(row["NIK"]) || null,
      nickname:         s(row["Nama Panggilan"]) || null,
      citizenship:      s(row["Kewarganegaraan"]) || "Indonesia",
      childOrder:       s(row["Anak Ke"]) || null,
      siblingsCount:    s(row["Jumlah Saudara Kandung"]) || null,
      halfSiblings:     s(row["Jumlah Saudara Tiri"]) || null,
      adoptedSiblings:  s(row["Jumlah Saudara Angkat"]) || null,
      orphanStatus:     s(row["Yatim/Piatu (Tidak/Yatim/Piatu/Yatim Piatu)"]) || null,
      dailyLanguage:    s(row["Bahasa Sehari-hari"]) || null,
      dusun, rt, rw, desa, kecamatan, kabupaten, province,
      studentPhone:     s(row["No. HP Siswa"]) || null,
      livesWith:        s(row["Tinggal Dengan"]) || null,
      distanceToSchool: s(row["Jarak ke Sekolah"]) || null,
      bloodType:        s(row["Golongan Darah (A/B/AB/O)"]) || null,
      diseases:         s(row["Penyakit yang Pernah Diderita"]) || null,
      height:           s(row["Tinggi Badan (cm)"]) || null,
      weight:           s(row["Berat Badan (kg)"]) || null,
      prevSchoolAddress: s(row["Alamat Asal Sekolah"]) || null,
      ijazahDate:       dateStr(row["Tanggal Ijazah SMP (DD/MM/YYYY)"]),
      ijazahNo:         s(row["Nomor Ijazah SMP"]) || null,
      skhunDate:        dateStr(row["Tanggal SKHUN SMP (DD/MM/YYYY)"]),
      lamaBelajar:      s(row["Lama Belajar (tahun)"]) || null,
      pindahanDari:     s(row["Pindahan Dari"]) || null,
      alasanPindahKe:   s(row["Alasan Pindah ke Sekolah Ini"]) || null,
      tingkatMasuk:     s(row["Diterima di Tingkat"]) || null,
      rombel:           rombel ?? null,
      bidangKeahlian:   keahlian?.bidang ?? null,
      programKeahlian:  keahlian?.program ?? null,
      kompetensiKeahlian: keahlian?.kompetensi ?? null,
      diterimaDate:     dateStr(row["Tanggal Diterima (DD/MM/YYYY)"]),
      fatherName:       s(row["Nama Ayah"]) || null,
      fatherNik:        s(row["NIK Ayah"]) || null,
      fatherBirthPlace: s(row["Tempat Lahir Ayah"]) || null,
      fatherBirthDate:  dateStr(row["Tanggal Lahir Ayah (DD/MM/YYYY)"]),
      fatherReligion:   s(row["Agama Ayah"]) || null,
      fatherCitizenship: s(row["Kewarganegaraan Ayah"]) || null,
      fatherEducation:  s(row["Pendidikan Ayah"]) || null,
      fatherJob:        s(row["Pekerjaan Ayah"]) || null,
      fatherIncome:     s(row["Penghasilan Ayah"]) || null,
      fatherAlive:      s(row["Kondisi Ayah (Masih Hidup/Telah Meninggal)"]) || null,
      // Alamat ayah/ibu disamakan dengan alamat siswa (konsisten dgn setAddrField di form manual)
      fatherDusun: dusun, fatherRt: rt, fatherRw: rw, fatherDesa: desa, fatherKecamatan: kecamatan, fatherKabupaten: kabupaten, fatherProvince: province,
      motherDusun: dusun, motherRt: rt, motherRw: rw, motherDesa: desa, motherKecamatan: kecamatan, motherKabupaten: kabupaten, motherProvince: province,
      motherName:       s(row["Nama Ibu"]) || null,
      motherNik:        s(row["NIK Ibu"]) || null,
      motherBirthPlace: s(row["Tempat Lahir Ibu"]) || null,
      motherBirthDate:  dateStr(row["Tanggal Lahir Ibu (DD/MM/YYYY)"]),
      motherReligion:   s(row["Agama Ibu"]) || null,
      motherCitizenship: s(row["Kewarganegaraan Ibu"]) || null,
      motherEducation:  s(row["Pendidikan Ibu"]) || null,
      motherJob:        s(row["Pekerjaan Ibu"]) || null,
      motherIncome:     s(row["Penghasilan Ibu"]) || null,
      motherAlive:      s(row["Kondisi Ibu (Masih Hidup/Telah Meninggal)"]) || null,
      guardianName:     s(row["Nama Wali"]) || null,
      guardianNik:      s(row["NIK Wali"]) || null,
      guardianBirthPlace: s(row["Tempat Lahir Wali"]) || null,
      guardianBirthDate: dateStr(row["Tanggal Lahir Wali (DD/MM/YYYY)"]),
      guardianReligion: s(row["Agama Wali"]) || null,
      guardianCitizenship: s(row["Kewarganegaraan Wali"]) || null,
      guardianEducation: s(row["Pendidikan Wali"]) || null,
      guardianJob:      s(row["Pekerjaan Wali"]) || null,
      guardianIncome:   s(row["Penghasilan Wali"]) || null,
      guardianPhone:    s(row["No. HP Wali"]) || null,
      hobbyArt:         s(row["Kesenian"]) || null,
      hobbySport:       s(row["Olahraga"]) || null,
      hobbyOrg:         s(row["Organisasi"]) || null,
      hobbyOther:       s(row["Hobi Lainnya"]) || null,
      pklPlace:         s(row["Tempat PKL"]) || null,
      pklAddress:       s(row["Alamat PKL"]) || null,
      pklStartDate:     dateStr(row["Tanggal Mulai PKL (DD/MM/YYYY)"]),
      pklEndDate:       dateStr(row["Tanggal Selesai PKL (DD/MM/YYYY)"]),
      pklSupervisor:    s(row["Pembimbing PKL"]) || null,
      pklScore:         s(row["Nilai PKL"]) || null,
      graduationDate:   dateStr(row["Tanggal Lulus (DD/MM/YYYY)"]),
      graduationIjazahNo: s(row["Nomor Ijazah Kelulusan"]) || null,
      skhunNo:          s(row["Nomor SKHUN Kelulusan"]) || null,
      avgReport:        s(row["Rata-rata Nilai Rapor"]) || null,
      avgExam:          s(row["Rata-rata Nilai Ujian"]) || null,
      continueStudy:    s(row["Melanjutkan Ke"]) || null,
      workPlan:         s(row["Rencana Kerja"]) || null,
      pindahDate:       dateStr(row["Tanggal Pindah/Keluar (DD/MM/YYYY)"]),
      transferTo:       s(row["Pindah/Keluar Ke"]) || null,
      alasanPindah:     s(row["Alasan Pindah/Keluar"]) || null,
    };

    const bukuIndukDataNorm = normalizeBukuIndukText(bukuIndukData);
    try {
      const existing = await prisma.student.findUnique({ where: { nis } });
      if (existing) {
        await prisma.student.update({
          where: { nis },
          data: { ...basicData, majorId, bukuIndukData: bukuIndukDataNorm, ...(classId ? { classId } : {}) },
        });
        results.updated++;
      } else {
        // NIS di sekolah ini sering mengandung "/" dan "." (nomor buku induk), tidak valid untuk email —
        // pakai NISN (selalu digit) kalau ada, fallback ke NIS yang disaring dari simbol.
        const emailLocal = s(row["NISN"]) || nis.replace(/[^a-zA-Z0-9]/g, "");
        const email = `${emailLocal}@smkalmunawwir.sch.id`;
        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          const bcrypt = await import("bcryptjs");
          user = await prisma.user.create({
            data: {
              name: toProperCaseName(nama),
              email,
              password: await bcrypt.hash(nis, 10),
              role: "STUDENT",
            },
          });
        }
        await prisma.student.create({
          data: { nis, userId: user.id, majorId, ...basicData, bukuIndukData: bukuIndukDataNorm, ...(classId ? { classId } : {}) },
        });
        results.created++;
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      results.errors.push(`Baris ${rowNum} (${nis}): ${msg}`);
    }
  }

  return NextResponse.json(results);
}
