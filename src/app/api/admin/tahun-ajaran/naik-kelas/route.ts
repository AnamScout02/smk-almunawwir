import { NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

interface PlanEntry {
  studentId: string;
  name: string;
  action: "PROMOTE" | "GRADUATE" | "SKIP" | "ERROR";
  fromClass: string | null;
  toClassId?: string;
  toClassName?: string;
  reason?: string;
  pklWarning?: boolean;
}

/** Hitung RENCANA kenaikan kelas (siapa naik ke mana, siapa lulus, siapa gagal/dilewati) — TANPA
 * menulis apapun ke database. Dipakai BERSAMA oleh GET (pratinjau/dry-run, boleh dipanggil
 * berkali-kali dengan aman) dan POST (eksekusi sungguhan) supaya keduanya selalu konsisten satu
 * sumber logika, tidak ada risiko preview bilang A tapi eksekusi lakukan B. */
async function buildPlan() {
  const activeYear = await prisma.academicYear.findFirst({ where: { isActive: true } });
  if (!activeYear) return { activeYear: null, plan: [] as PlanEntry[] };

  const activeStudents = await prisma.student.findMany({
    where: { studentStatus: "AKTIF" },
    include: { class: { include: { major: true } }, user: { select: { name: true } } },
  });

  const approvedPklStudentIds = new Set(
    (await prisma.pklRegistration.findMany({ where: { status: "APPROVED" }, select: { studentId: true } }))
      .map(r => r.studentId)
  );

  const plan: PlanEntry[] = [];
  for (const student of activeStudents) {
    const base = { studentId: student.id, name: student.user.name, fromClass: student.class?.name ?? null };
    if (!student.class) { plan.push({ ...base, action: "SKIP", reason: "Siswa tidak punya kelas" }); continue; }

    const grade = student.class.grade;
    const majorId = student.class.majorId;

    if (grade === 12) {
      plan.push({ ...base, action: "GRADUATE" });
    } else if (grade === 11) {
      const nextClass = await prisma.class.findFirst({ where: { grade: 12, majorId } });
      if (nextClass) {
        plan.push({ ...base, action: "PROMOTE", toClassId: nextClass.id, toClassName: nextClass.name, pklWarning: !approvedPklStudentIds.has(student.id) });
      } else {
        plan.push({ ...base, action: "ERROR", reason: `Kelas grade 12 untuk jurusan ini tidak ditemukan` });
      }
    } else if (grade === 10) {
      const nextClass = await prisma.class.findFirst({ where: { grade: 11, majorId } });
      if (nextClass) {
        plan.push({ ...base, action: "PROMOTE", toClassId: nextClass.id, toClassName: nextClass.name });
      } else {
        plan.push({ ...base, action: "ERROR", reason: `Kelas grade 11 untuk jurusan ini tidak ditemukan` });
      }
    } else {
      plan.push({ ...base, action: "SKIP", reason: `Grade ${grade} tidak diproses` });
    }
  }

  return { activeYear, plan };
}

/** Pratinjau (dry-run) — hitung siapa akan naik/lulus/dilewati TANPA mengubah data apapun. Aman
 * dipanggil berkali-kali (mis. tiap kali admin buka modal konfirmasi), supaya admin bisa cek dulu
 * sebelum benar-benar menekan "Proses Sekarang". */
export async function GET() {
  await verifyRole(["ADMIN"]);
  const { activeYear, plan } = await buildPlan();
  if (!activeYear) {
    return NextResponse.json({ error: "Tidak ada tahun ajaran aktif. Aktifkan tahun ajaran terlebih dahulu." }, { status: 400 });
  }
  return NextResponse.json({
    dryRun: true,
    promoted: plan.filter(p => p.action === "PROMOTE"),
    graduated: plan.filter(p => p.action === "GRADUATE"),
    skipped: plan.filter(p => p.action === "SKIP"),
    errors: plan.filter(p => p.action === "ERROR").map(p => `${p.name}: ${p.reason}`),
    pklWarnings: plan.filter(p => p.action === "PROMOTE" && p.pklWarning).map(p => p.name),
  });
}

export async function POST() {
  await verifyRole(["ADMIN"]);

  const { activeYear, plan } = await buildPlan();
  if (!activeYear) {
    return NextResponse.json({ error: "Tidak ada tahun ajaran aktif. Aktifkan tahun ajaran terlebih dahulu." }, { status: 400 });
  }

  const promotedPlan = plan.filter(p => p.action === "PROMOTE");
  const graduatedPlan = plan.filter(p => p.action === "GRADUATE");
  const errors = plan.filter(p => p.action === "ERROR").map(p => `${p.name}: ${p.reason}`);
  const pklWarnings = promotedPlan.filter(p => p.pklWarning).map(p => p.name);

  // Snapshot SEMUA siswa aktif (termasuk yg di-skip/error) ke riwayat tahun ajaran aktif — perilaku
  // sama seperti sebelumnya, tidak berubah.
  const activeStudents = await prisma.student.findMany({
    where: { studentStatus: "AKTIF" },
    include: { class: { include: { major: true } } },
  });
  await prisma.$transaction(
    activeStudents.map(student =>
      prisma.studentClassHistory.upsert({
        where: { studentId_academicYearId: { studentId: student.id, academicYearId: activeYear.id } },
        update: {
          classId: student.classId, status: student.studentStatus ?? "AKTIF",
          grade: student.class?.grade ?? null, majorName: student.class?.major?.name ?? null, className: student.class?.name ?? null,
        },
        create: {
          studentId: student.id, classId: student.classId, academicYearId: activeYear.id, status: student.studentStatus ?? "AKTIF",
          grade: student.class?.grade ?? null, majorName: student.class?.major?.name ?? null, className: student.class?.name ?? null,
        },
      })
    )
  );

  // Eksekusi promosi/kelulusan sesuai rencana yang SUDAH divalidasi buildPlan() di atas — per
  // siswa dibungkus try/catch sendiri (bukan satu try besar) supaya SATU siswa gagal (mis. race
  // condition data) tidak menggagalkan proses siswa lain yang seharusnya tetap bisa naik/lulus.
  let promotedCount = 0, graduatedCount = 0;
  for (const p of graduatedPlan) {
    try {
      await prisma.student.update({ where: { id: p.studentId }, data: { studentStatus: "LULUS", exitDate: new Date() } });
      graduatedCount++;
    } catch (err) {
      lemparBilaPengalihan(err);
      errors.push(`Gagal meluluskan ${p.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  for (const p of promotedPlan) {
    try {
      await prisma.student.update({ where: { id: p.studentId }, data: { classId: p.toClassId } });
      promotedCount++;
    } catch (err) {
      lemparBilaPengalihan(err);
      errors.push(`Gagal menaikkan ${p.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json({
    promoted: promotedCount,
    graduated: graduatedCount,
    skipped: plan.filter(p => p.action === "SKIP").length,
    errors,
    pklWarnings,
  });
}
