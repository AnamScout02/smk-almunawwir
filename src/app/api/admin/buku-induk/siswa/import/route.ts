import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
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

export async function POST(req: NextRequest) {
  await verifyRole(["ADMIN", "TAS"]);

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

    const enrollYearRaw = s(row["Tahun Masuk"]);
    const enrollYear = enrollYearRaw ? parseInt(enrollYearRaw) : null;

    const basicData = {
      noInduk:        s(row["No. Induk"]) || null,
      nisn:           s(row["NISN"]) || null,
      birthPlace:     s(row["Tempat Lahir"]) || null,
      birthDate:      parseDate(row["Tanggal Lahir (DD/MM/YYYY)"]),
      gender:         s(row["Jenis Kelamin (L/P)"]).toUpperCase() || null,
      religion:       s(row["Agama"]) || null,
      address:        s(row["Desa/Kelurahan"]) ? [s(row["Dusun/Lingkungan"]), s(row["Desa/Kelurahan"]), s(row["Kecamatan"]), s(row["Kabupaten/Kota"])].filter(Boolean).join(", ") : s(row["Asal Sekolah (SMP/MTs)"]) || null,
      parentName:     s(row["Nama Ayah"]) || null,
      parentPhone:    s(row["No. HP Orang Tua"]) || null,
      parentJob:      s(row["Pekerjaan Ayah"]) || null,
      previousSchool: s(row["Asal Sekolah (SMP/MTs)"]) || null,
      enrollYear:     enrollYear && !isNaN(enrollYear) ? enrollYear : null,
      studentStatus:  s(row["Status (AKTIF/LULUS/KELUAR/PINDAH)"]).toUpperCase() || "AKTIF",
      studentNotes:   s(row["Keterangan"]) || null,
    };

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
      dusun:            s(row["Dusun/Lingkungan"]) || null,
      rt:               s(row["RT"]) || null,
      rw:               s(row["RW"]) || null,
      desa:             s(row["Desa/Kelurahan"]) || null,
      kecamatan:        s(row["Kecamatan"]) || null,
      kabupaten:        s(row["Kabupaten/Kota"]) || null,
      studentPhone:     s(row["No. HP Siswa"]) || null,
      livesWith:        s(row["Tinggal Dengan"]) || null,
      distanceToSchool: s(row["Jarak ke Sekolah"]) || null,
      bloodType:        s(row["Golongan Darah (A/B/AB/O)"]) || null,
      diseases:         s(row["Penyakit yang Pernah Diderita"]) || null,
      height:           s(row["Tinggi Badan (cm)"]) || null,
      weight:           s(row["Berat Badan (kg)"]) || null,
      prevSchoolAddress: s(row["Alamat Asal Sekolah"]) || null,
      ijazahNo:         s(row["Nomor Ijazah"]) || null,
      enrollDate:       s(row["Tanggal Diterima (DD/MM/YYYY)"]) || null,
      fatherName:       s(row["Nama Ayah"]) || null,
      fatherNik:        s(row["NIK Ayah"]) || null,
      fatherBirthPlace: s(row["Tempat Lahir Ayah"]) || null,
      fatherBirthDate:  s(row["Tanggal Lahir Ayah (DD/MM/YYYY)"]) || null,
      fatherEducation:  s(row["Pendidikan Ayah"]) || null,
      fatherJob:        s(row["Pekerjaan Ayah"]) || null,
      motherName:       s(row["Nama Ibu"]) || null,
      motherNik:        s(row["NIK Ibu"]) || null,
      motherBirthPlace: s(row["Tempat Lahir Ibu"]) || null,
      motherBirthDate:  s(row["Tanggal Lahir Ibu (DD/MM/YYYY)"]) || null,
      motherEducation:  s(row["Pendidikan Ibu"]) || null,
      motherJob:        s(row["Pekerjaan Ibu"]) || null,
      guardianName:     s(row["Nama Wali"]) || null,
      guardianJob:      s(row["Pekerjaan Wali"]) || null,
    };

    try {
      const existing = await prisma.student.findUnique({ where: { nis } });
      if (existing) {
        await prisma.student.update({
          where: { nis },
          data: { ...basicData, majorId, bukuIndukData },
        });
        results.updated++;
      } else {
        const email = `${nis}@smkalmunawwir.sch.id`;
        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          const bcrypt = await import("bcryptjs");
          user = await prisma.user.create({
            data: {
              name: nama,
              email,
              password: await bcrypt.hash(nis, 10),
              role: "STUDENT",
            },
          });
        }
        await prisma.student.create({
          data: { nis, userId: user.id, majorId, ...basicData, bukuIndukData },
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
