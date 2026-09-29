import { NextRequest, NextResponse } from "next/server";
import { cabutSemuaSesiPengguna } from "@/lib/sesi-server";
import { assertBukuIndukSiswaScope } from "@/lib/buku-induk-access";
import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { diffBukuIndukRaw, DIFF_SELECT } from "@/lib/buku-induk-diff";
import bcrypt from "bcryptjs";
import { toProperCaseName, toProperCaseSchoolName, normalizeBukuIndukText } from "@/lib/text";
import { keUks } from "@/lib/tinggi-berat";
import { syncParentAccountForStudent } from "@/lib/parent-account";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

/** Tentukan nilai kolom exitDate saat menyimpan: pakai isian eksplisit kalau ada, kalau tidak
 * ambil dari bukuIndukData (pindahDate utk mutasi, graduationDate utk lulus). */
function syncExitDate(exitDate: unknown, bukuIndukData: unknown): Date | null {
  if (exitDate) {
    const d = new Date(String(exitDate));
    if (!isNaN(d.getTime())) return d;
  }
  const b = (bukuIndukData && typeof bukuIndukData === "object" ? bukuIndukData : {}) as Record<string, unknown>;
  for (const k of ["pindahDate", "graduationDate"]) {
    const v = b[k];
    if (typeof v === "string" && v.trim()) {
      const d = new Date(v);
      if (!isNaN(d.getTime())) return d;
    }
  }
  return null;
}

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const scope = await assertBukuIndukSiswaScope();
  const { id } = await params;
  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true } },
      class: { select: { id: true, name: true, grade: true } },
      major: { select: { name: true, code: true } },
    },
  });
  if (!student) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  // Wali kelas cuma boleh lihat siswa di kelas walinya sendiri — perlakukan siswa kelas lain
  // sebagai "tidak ditemukan" (bukan 403) supaya tidak bocor konfirmasi bahwa ID itu valid.
  if (scope.scope === "CLASS" && !scope.classIds.includes(student.classId ?? "")) {
    return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  }
  return NextResponse.json(student);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const scope = await assertBukuIndukSiswaScope();
  // Wali kelas hanya melihat & mengunduh Buku Induk kelasnya (permintaan user 17 Sep 2026) — perubahan oleh TU/Operator Sekolah.
  if (scope.scope === "CLASS") {
    return NextResponse.json({ error: "Wali kelas hanya dapat melihat dan mengunduh Buku Induk. Perubahan data dilakukan TU atau Operator Sekolah." }, { status: 403 });
  }
  const session = await verifySession();
  const { id } = await params;

  // Snapshot LENGKAP sebelum perubahan — dipakai dua hal: cek hak akses wali kelas (classId) dan
  // membandingkan 139 kolom Buku Induk untuk riwayat perubahan (lihat akhir fungsi ini).
  const existing = await prisma.student.findUnique({
    where: { id },
    select: { classId: true, ...DIFF_SELECT },
  });
  if (!existing) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });

  const body = await req.json();
  const {
    name, nisn, birthPlace, birthDate, gender, religion, address,
    parentName, parentPhone, parentJob, notifyEmail, notifyWhatsapp, previousSchool, enrollYear,
    studentStatus, exitDate, studentNotes,
    bukuIndukData, password,
  } = body;
  // Wali kelas boleh edit BIODATA (Buku Induk) siswa kelasnya, TAPI TIDAK boleh reset password
  // atau ganti nama akun login — itu tetap murni tindakan ADMIN/TAS/Operator Sekolah.
  const canManageAccount = scope.scope === "ALL";

  try {
    // Jika ada password dan/atau nama baru, update data user terkait
    if (canManageAccount && ((password && typeof password === "string" && password.trim().length >= 1) || (name && typeof name === "string" && name.trim().length >= 1))) {
      const studentRef = await prisma.student.findUnique({ where: { id }, select: { userId: true, user: { select: { name: true, email: true } } } });
      if (studentRef) {
        const userData: { password?: string; name?: string } = {};
        if (password && typeof password === "string" && password.trim().length >= 1) {
          userData.password = await bcrypt.hash(password, 12);
        }
        if (name && typeof name === "string" && name.trim().length >= 1) {
          userData.name = toProperCaseName(name);
        }
        await prisma.user.update({ where: { id: studentRef.userId }, data: userData });

        if (userData.password) {
          // Password direset → semua sesi siswa ini dicabut, harus login ulang dengan password baru.
          await cabutSemuaSesiPengguna(studentRef.userId, "GANTI_PASSWORD");
          await logActivity(session, {
            action: "RESET_PASSWORD", entity: "Student", entityId: id,
            description: `${session.name} mereset password siswa "${studentRef.user.name}" (${studentRef.user.email})`,
          });
        }
        if (userData.name && userData.name !== studentRef.user.name) {
          await logActivity(session, {
            action: "UPDATE_STUDENT_NAME", entity: "Student", entityId: id,
            description: `${session.name} mengubah nama siswa dari "${studentRef.user.name}" menjadi "${userData.name}"`,
            metadata: { before: studentRef.user.name, after: userData.name },
          });
        }
      }
    }

    const student = await prisma.student.update({
      where: { id },
      data: {
        nisn:           nisn || null,
        birthPlace:     birthPlace || null,
        birthDate:      birthDate ? new Date(birthDate) : null,
        gender:         gender || null,
        religion:       religion || null,
        address:        address || null,
        parentName:     parentName ? toProperCaseName(parentName) : null,
        parentPhone:    parentPhone || null,
        notifyEmail:    typeof notifyEmail === "boolean" ? notifyEmail : true,
        notifyWhatsapp: typeof notifyWhatsapp === "boolean" ? notifyWhatsapp : true,
        parentJob:      parentJob || null,
        previousSchool: previousSchool ? toProperCaseSchoolName(previousSchool) : null,
        enrollYear:     enrollYear ? parseInt(enrollYear) : null,
        studentStatus:  studentStatus || "AKTIF",
        // exitDate DISINKRONKAN dari bukuIndukData: form Buku Induk menulis tanggal keluar ke
        // JSON (pindahDate / graduationDate), sedangkan Buku Mutasi & laporan lain membaca kolom
        // ini. Dulu keduanya tidak pernah disambungkan sehingga kolom ini SELALU kosong dan Buku
        // Mutasi menampilkan 0 siswa selamanya (audit 2026-09-12). Jangan dilepas lagi.
        exitDate:       syncExitDate(exitDate, bukuIndukData),
        studentNotes:   studentNotes || null,
        bukuIndukData:  bukuIndukData ? normalizeBukuIndukText(bukuIndukData) : undefined,
      },
      include: {
        user: { select: { name: true, email: true } },
        class: { select: { name: true } },
        major: { select: { name: true, code: true } },
      },
    });
    // Tinggi & berat badan = SATU angka dengan pemeriksaan UKS (src/lib/tinggi-berat.ts, keputusan
    // user 29 September 2026). Sengaja dibungkus try/catch: gagal menyinkronkan tidak boleh
    // menggagalkan penyimpanan Buku Induk itu sendiri.
    if (bukuIndukData) {
      try { await keUks(id, bukuIndukData as Record<string, unknown>, session.name); }
      catch (e) { lemparBilaPengalihan(e); console.error("[buku-induk sinkron TB/BB]", e); }
    }
    // Riwayat perubahan data: catat KOLOM MANA saja yang berubah beserta nilai lama & barunya.
    // Tanpa ini, kalau suatu saat ada data yang "tiba-tiba salah", tidak ada cara tahu siapa yang
    // mengubah dan apa isinya sebelum diubah — padahal Buku Induk adalah dokumen resmi sekolah.
    // Sengaja dibungkus try/catch: gagal mencatat riwayat tidak boleh menggagalkan penyimpanan.
    try {
      const sesudah = await prisma.student.findUnique({ where: { id }, select: DIFF_SELECT });
      const perubahan = sesudah ? diffBukuIndukRaw(existing, sesudah) : [];
      if (perubahan.length > 0) {
        await logActivity(session, {
          action: "UPDATE_BUKU_INDUK", entity: "Student", entityId: id,
          description: `${session.name} mengubah ${perubahan.length} data Buku Induk milik "${student.user.name}" (${student.nis}): ${perubahan.slice(0, 5).map(p => p.label).join(", ")}${perubahan.length > 5 ? ", dll" : ""}`,
          metadata: { nis: student.nis, nama: student.user.name, perubahan },
        });
      }
    } catch (e) { lemparBilaPengalihan(e); console.error("[buku-induk siswa PUT] gagal catat riwayat", e); }

    // Akun Orang Tua dibuat/dihubungkan otomatis dari No. HP — gagal-sync tidak boleh menggagalkan simpan siswa.
    await syncParentAccountForStudent(student.id, student.parentPhone, student.parentName).catch(() => {});
    return NextResponse.json(student);
  } catch (err) {
    lemparBilaPengalihan(err);
    console.error("[buku-induk siswa PUT]", err);
    return NextResponse.json({ error: "Gagal menyimpan perubahan siswa" }, { status: 500 });
  }
}
