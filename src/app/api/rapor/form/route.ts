import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { semesterRapor } from "@/lib/rapor-verifikasi";
import { getJabatanNames } from "@/lib/jabatan-guard";
import { teacherDariSesi, kelompokMapel, JABATAN_PEMANTAU_RAPOR } from "@/lib/rapor-form-server";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** DAFTAR FORM NILAI RAPOR (src/lib/rapor-form-server.ts). ?semester= (bawaan semester berjalan) & ?classId= (opsional).
 *  Guru: pasangan kelas×mapel yang ia ampu + kelas walinya. Admin/TAS/pemantau: semua (sebaiknya disaring classId). */
export async function GET(req: NextRequest) {
  const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
  const sp = new URL(req.url).searchParams;
  const semesters = semesterRapor();
  const semester = sp.get("semester") && semesters.includes(sp.get("semester")!) ? sp.get("semester")! : semesters[2];
  const classId = sp.get("classId") || undefined;

  let saringTugas: object = {};
  let kelasWali: string[] = [];
  let saya: string | null = null;
  let semua = session.role === "ADMIN" || session.role === "TAS";
  if (session.role === "TEACHER") {
    const t = await teacherDariSesi(session.email);
    if (!t) return Response.json({ error: "Data guru tidak ditemukan." }, { status: 403 });
    saya = t.id;
    const wali = await prisma.class.findMany({ where: { homeroomId: t.id }, select: { id: true } });
    kelasWali = wali.map(w => w.id);
    // Wakil Kepala Kurikulum & Kepala Sekolah memantau semua kelas.
    semua = (await getJabatanNames(session.email)).some(j => JABATAN_PEMANTAU_RAPOR.includes(j));
    if (!semua) saringTugas = { OR: [{ teacherId: t.id }, { classId: { in: kelasWali } }] };
  }
  const tugas = await prisma.teachingAssignment.findMany({
    where: { ...saringTugas, ...(classId ? { classId } : {}) },
    select: {
      classId: true, teacherId: true,
      class: { select: { name: true, grade: true, students: { where: { studentStatus: "AKTIF" }, select: { id: true } } } },
      subject: { select: { name: true, category: true, order: true } },
      teacher: { select: { user: { select: { name: true } } } },
    },
  });
  const form = await prisma.formNilaiRapor.findMany({
    where: { semester, classId: { in: [...new Set(tugas.map(t => t.classId))] } },
    select: { classId: true, subject: true, status: true, dikirimAt: true, updatedAt: true, catatanWali: true, katrol: true, riwayatWali: true },
  });
  const peta = new Map(form.map(f => [`${f.classId}|${f.subject}`, f]));
  const baris = tugas.map(t => {
    const f = peta.get(`${t.classId}|${t.subject.name}`);
    return {
      classId: t.classId, kelas: t.class.name, grade: t.class.grade, jumlahSiswa: t.class.students.length,
      mapel: t.subject.name, kelompok: kelompokMapel(t.subject.category), urut: t.subject.order,
      guru: t.teacher.user.name, milikSaya: !!saya && t.teacherId === saya, waliSaya: kelasWali.includes(t.classId),
      status: f?.status ?? "BELUM", dikirimAt: f?.dikirimAt ?? null, diubahAt: f?.updatedAt ?? null,
      dikembalikan: !!f?.catatanWali && f.status === "DRAF", katrol: f?.katrol ?? false,
      diubahWali: Array.isArray(f?.riwayatWali) && f.riwayatWali.length > 0,
    };
  }).sort((a, b) => a.grade - b.grade || a.kelas.localeCompare(b.kelas, "id", { numeric: true }) || a.urut - b.urut || a.mapel.localeCompare(b.mapel));
  return Response.json({ semester, semesters, baris, semua });
}
