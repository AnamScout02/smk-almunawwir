import { NextRequest, NextResponse } from "next/server";
import { verifyBukuIndukFullAccess, assertBukuIndukSiswaScope } from "@/lib/buku-induk-access";
import { prisma } from "@/lib/prisma";
import { jsonBesar } from "@/lib/json-besar";
import bcrypt from "bcryptjs";
import { toProperCaseName, toProperCaseSchoolName, normalizeBukuIndukText } from "@/lib/text";
import { syncParentAccountForStudent } from "@/lib/parent-account";

export const dynamic = "force-dynamic";

/** GET dipakai ADMIN/TAS/Operator Sekolah (lihat semua) MAUPUN wali kelas (di-scope KETAT ke
 * kelas walinya sendiri — kalau ?classId= yang diminta bukan miliknya, diam-diam diabaikan &
 * tetap dikembalikan data kelas walinya, bukan error/kosong, supaya UI tetap tampil normal). */
export async function GET(req: NextRequest) {
  const scope = await assertBukuIndukSiswaScope();
  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");

  const where = scope.scope === "ALL"
    ? (classId ? { classId } : undefined)
    : { classId: classId && scope.classIds.includes(classId) ? classId : { in: scope.classIds } };

  const students = await prisma.student.findMany({
    where,
    include: {
      user: { select: { name: true, email: true } },
      class: { select: { id: true, name: true, grade: true } },
      major: { select: { id: true, name: true, code: true } },
    },
    orderBy: [{ enrollYear: "desc" }, { user: { name: "asc" } }],
  });
  return jsonBesar(students, req);
}

/** POST (buat siswa baru) TETAP full-access murni — wali kelas TIDAK boleh menambah siswa baru
 * ke kelas manapun (di luar cakupan "akses baca/edit kelas sendiri" yang diminta). */
export async function POST(req: NextRequest) {
  await verifyBukuIndukFullAccess();

  const body = await req.json();
  const {
    name, email, password, nis, nisn,
    majorId, classId, enrollYear,
    birthPlace, birthDate, gender, religion, address,
    parentName, parentPhone, parentJob, notifyEmail, notifyWhatsapp, previousSchool,
    studentStatus, studentNotes,
    bukuIndukData,
  } = body;

  if (!name || !email || !password || !nis || !majorId) {
    return NextResponse.json(
      { error: "Nama, email, password, NIS, dan jurusan wajib diisi" },
      { status: 400 }
    );
  }

  // Cek email sudah ada
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json({ error: "Email sudah digunakan" }, { status: 409 });
  }

  // Cek NIS sudah ada
  const existingNis = await prisma.student.findUnique({ where: { nis } });
  if (existingNis) {
    return NextResponse.json({ error: "NIS sudah digunakan" }, { status: 409 });
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      name: toProperCaseName(name),
      email,
      password: hashedPassword,
      role: "STUDENT",
    },
  });

  const student = await prisma.student.create({
    data: {
      userId: user.id,
      nis,
      nisn: nisn || null,
      majorId,
      classId: classId || null,
      enrollYear: enrollYear ? parseInt(String(enrollYear)) : null,
      birthPlace: birthPlace || null,
      birthDate: birthDate ? new Date(birthDate) : null,
      gender: gender || null,
      religion: religion || null,
      address: address || null,
      parentName: parentName ? toProperCaseName(parentName) : null,
      parentPhone: parentPhone || null,
      notifyEmail: typeof notifyEmail === "boolean" ? notifyEmail : true,
      notifyWhatsapp: typeof notifyWhatsapp === "boolean" ? notifyWhatsapp : true,
      parentJob: parentJob || null,
      previousSchool: previousSchool ? toProperCaseSchoolName(previousSchool) : null,
      studentStatus: studentStatus || "AKTIF",
      studentNotes: studentNotes || null,
      bukuIndukData: bukuIndukData ? normalizeBukuIndukText(bukuIndukData) : undefined,
    },
    include: {
      user: { select: { name: true, email: true } },
      class: { select: { id: true, name: true, grade: true } },
      major: { select: { id: true, name: true, code: true } },
    },
  });

  // Akun Orang Tua dibuat/dihubungkan otomatis dari No. HP — gagal-sync tidak boleh menggagalkan simpan siswa.
  await syncParentAccountForStudent(student.id, student.parentPhone, student.parentName).catch(() => {});

  return NextResponse.json(student, { status: 201 });
}
