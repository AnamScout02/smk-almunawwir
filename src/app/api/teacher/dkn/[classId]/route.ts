import { NextRequest, NextResponse } from "next/server";
import { adalahKategoriDiniyah, kunciNamaMapel, namaMapelDiniyah } from "@/lib/mapel-diniyah";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { petaSingkatanMapel } from "@/lib/singkatan-mapel-server";
import { adalahNamaGrup, namaGabungan } from "@/lib/mapel-gabungan";
import { susunRaporKelas } from "@/lib/rapor-cetak";

export const dynamic = "force-dynamic";

/** DKN (Daftar Kumpulan Nilai) — HANYA Wali Kelas homeroom kelas tsb (atau ADMIN) yang boleh
 * akses, BUKAN guru mapel biasa (beda dari Nilai/Absensi biasa yang boleh diakses guru mapel
 * sesuai TeachingAssignment — DKN adalah rekap resmi lintas mapel, tanggung jawab wali kelas). */
async function assertHomeroomOwner(email: string, role: string, classId: string) {
  if (role === "ADMIN") return true;
  const teacher = await prisma.teacher.findFirst({
    where: { user: { email } },
    include: { homeroomOf: { select: { id: true } } },
  });
  return !!teacher?.homeroomOf.some(c => c.id === classId);
}

/** Roster siswa kelas TIDAK selalu boleh diambil live dari Student.classId — begitu Naik Kelas
 * berjalan, siswa lama pindah ke Class lain (mis. X TKJ 1 -> XI TKJ 1) dan classId ini bisa saja
 * sudah ditempati angkatan baru. Kalau tahun ajaran dari semester yang diminta SUDAH punya
 * snapshot di StudentClassHistory (dibuat otomatis tiap proses Naik Kelas, lihat
 * /api/admin/tahun-ajaran/naik-kelas), pakai roster snapshot itu supaya DKN semester lama tetap
 * menampilkan siswa yang BENAR ada di kelas ini saat itu — bukan roster kelas sekarang. Tahun
 * ajaran yang masih berjalan (belum pernah di-snapshot, karena snapshot baru dibuat pas Naik
 * Kelas ke tahun berikutnya) tetap pakai roster live seperti biasa. Dipakai bareng oleh GET
 * (tampilkan tabel) & PUT (validasi siswa yang nilainya sedang diubah). */
async function getClassRoster(classId: string, semester: string) {
  const tahunAjaran = semester.trim().split(/\s+/).pop() ?? "";
  const historyRows = tahunAjaran
    ? await prisma.studentClassHistory.findMany({
        where: { classId, academicYear: { name: tahunAjaran } },
        select: { studentId: true, student: { select: { nis: true, user: { select: { name: true } } } } },
      })
    : [];

  if (historyRows.length > 0) {
    return historyRows
      .map(h => ({ id: h.studentId, nis: h.student.nis, name: h.student.user.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  const live = await prisma.student.findMany({
    where: { classId, studentStatus: "AKTIF" },
    select: { id: true, nis: true, user: { select: { name: true } } },
    orderBy: { user: { name: "asc" } },
  });
  return live.map(s => ({ id: s.id, nis: s.nis, name: s.user.name }));
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ classId: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    const { classId } = await params;
    if (!(await assertHomeroomOwner(session.email, session.role, classId))) {
      return NextResponse.json({ error: "Khusus Wali Kelas kelas ini." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const semester = searchParams.get("semester");
    if (!semester) return NextResponse.json({ error: "Parameter semester wajib diisi" }, { status: 400 });

    const cls = await prisma.class.findUnique({ where: { id: classId }, select: { name: true, grade: true, major: { select: { name: true } } } });
    if (!cls) return NextResponse.json({ error: "Kelas tidak ditemukan" }, { status: 404 });

    const students = await getClassRoster(classId, semester);
    const studentIds = students.map(s => s.id);

    const [assignments, grades] = await Promise.all([
      prisma.teachingAssignment.findMany({ where: { classId }, select: { subject: { select: { name: true, order: true, category: true } } }, orderBy: { subject: { order: "asc" } } }),
      // Cuma nilai bertipe DKN — DKN murni input manual wali kelas, TIDAK dihitung/di-default
      // dari nilai komponen mapel (Tugas/UH/UTS/UAS) manapun. Kosong berarti memang belum diisi.
      prisma.grade.findMany({
        where: { semester, studentId: { in: studentIds }, type: "DKN" },
        select: { studentId: true, subject: true, score: true },
      }),
    ]);

    // Daftar mapel dari Penugasan Mengajar kelas ini (urut sesuai Kode Mata Pelajaran) — fallback ke
    // mapel yang punya nilai DKN tercatat kalau penugasan belum lengkap, supaya nilai lama tetap terlihat.
    // Mapel DINIYAH TIDAK tampil di DKN sama sekali — mapel tambahan (keputusan user 21 Sep 2026, src/lib/mapel-diniyah.ts).
    const diniyah = await namaMapelDiniyah();
    const bukanDiniyah = (nama: string) => !diniyah.has(kunciNamaMapel(nama));
    // Bagian DPK 1–4 / KK 1–4 menjadi SATU kolom gabungan (keputusan user 22 Sep 2026, src/lib/mapel-gabungan.ts).
    const subjectSet = new Set(assignments.filter(a => !adalahKategoriDiniyah(a.subject.category) && bukanDiniyah(a.subject.name)).map(a => namaGabungan(a.subject.name)));
    for (const g of grades) if (bukanDiniyah(g.subject)) subjectSet.add(namaGabungan(g.subject));
    const subjects = [...subjectSet];
    const gabungan = subjects.filter(adalahNamaGrup);

    // Kolom gabungan TERISI OTOMATIS dari nilai rapor gabungan (Form Nilai Rapor yang sudah dikirim) — keputusan user;
    // nilai yang diketik wali kelas (Grade DKN bernama grup) menimpanya, dan bila belum ada rapor dipakai rata-rata nilai
    // DKN lama per bagian. Kolom lain tetap murni input manual.
    const rapor = gabungan.length ? await susunRaporKelas(classId, semester).catch(() => null) : null;
    const nilaiRapor = new Map<string, number>();
    for (const r of rapor?.siswa ?? []) for (const b of r.kejuruan.concat(r.umum)) if (b.anggota && typeof b.hasil?.hpa === "number") nilaiRapor.set(`${r.id}|${b.mapel}`, b.hasil.hpa);

    const scores: Record<string, Record<string, number | null>> = {};
    const otomatis: Record<string, Record<string, "rapor" | "bagian">> = {};
    for (const s of students) { scores[s.id] = {}; otomatis[s.id] = {}; }

    for (const student of students) {
      for (const subject of subjects) {
        const manual = grades.find(g => g.studentId === student.id && g.subject === subject)?.score ?? null;
        if (manual !== null || !gabungan.includes(subject)) { scores[student.id][subject] = manual; continue; }
        const dariRapor = nilaiRapor.get(`${student.id}|${subject}`);
        if (dariRapor !== undefined) { scores[student.id][subject] = dariRapor; otomatis[student.id][subject] = "rapor"; continue; }
        const lama = grades.filter(g => g.studentId === student.id && g.subject !== subject && namaGabungan(g.subject) === subject).map(g => g.score);
        scores[student.id][subject] = lama.length ? Math.round((lama.reduce((a, b) => a + b, 0) / lama.length) * 100) / 100 : null;
        if (lama.length) otomatis[student.id][subject] = "bagian";
      }
    }

    return NextResponse.json({
      class: cls,
      students,
      subjects,
      singkatan: await petaSingkatanMapel(subjects), // kepala kolom (Data Mapel → Singkatan Mapel)
      gabungan, otomatis,
      scores,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

interface CellUpdate { studentId: string; subject: string; score: number }

/** Terima SATU update ({studentId, subject, semester, score}) ATAU banyak sekaligus
 * ({semester, updates: [...]}) — bentuk kedua dipakai fitur paste dari Excel (DknTable.tsx) supaya
 * satu blok sel yang ditempel tersimpan dalam SATU request/transaksi, bukan satu-satu. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ classId: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    const { classId } = await params;
    if (!(await assertHomeroomOwner(session.email, session.role, classId))) {
      return NextResponse.json({ error: "Khusus Wali Kelas kelas ini." }, { status: 403 });
    }

    const body = await req.json();
    const { semester } = body;
    const updates: CellUpdate[] = Array.isArray(body.updates)
      ? body.updates
      : [{ studentId: body.studentId, subject: body.subject, score: body.score }];

    if (!semester || updates.length === 0 || updates.length > 1000) {
      return NextResponse.json({ error: "Data tidak lengkap/valid" }, { status: 400 });
    }
    for (const u of updates) {
      if (!u.studentId || !u.subject || typeof u.score !== "number" || isNaN(u.score) || u.score < 0 || u.score > 100) {
        return NextResponse.json({ error: "Ada nilai yang tidak valid — pastikan semua angka 0-100." }, { status: 400 });
      }
    }

    // Validasi terhadap roster SEMESTER TERSEBUT (bukan cuma Student.classId sekarang) — supaya
    // wali kelas tetap bisa mengoreksi nilai DKN semester lama utk siswa yg sudah naik kelas.
    const roster = await getClassRoster(classId, semester);
    const rosterIds = new Set(roster.map(s => s.id));
    if (updates.some(u => !rosterIds.has(u.studentId))) {
      return NextResponse.json({ error: "Ada siswa yang tidak ditemukan di kelas ini untuk semester tersebut" }, { status: 404 });
    }

    // ADMIN tidak punya baris Teacher sendiri — kalau ADMIN yang menyimpan (mis. mewakili wali
    // kelas), atribusikan nilai ke wali kelas resmi kelas ini, bukan gagal karena tidak ketemu.
    const teacher = session.role === "ADMIN"
      ? await prisma.teacher.findFirst({ where: { homeroomOf: { some: { id: classId } } } })
      : await prisma.teacher.findFirst({ where: { user: { email: session.email } } });
    if (!teacher) return NextResponse.json({ error: "Data guru wali kelas tidak ditemukan" }, { status: 404 });

    // Delete-then-create (Grade tanpa unique constraint di DB — lihat CLAUDE.md) supaya tidak
    // dobel tiap kali wali kelas mengubah nilai DKN mapel yang sama.
    await prisma.$transaction(async tx => {
      for (const u of updates) {
        await tx.grade.deleteMany({ where: { studentId: u.studentId, subject: u.subject, type: "DKN", semester } });
        await tx.grade.create({ data: { studentId: u.studentId, teacherId: teacher.id, subject: u.subject, type: "DKN", semester, score: u.score } });
      }
    }, { timeout: 30000 });

    return NextResponse.json({ success: true, count: updates.length });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

/** Hapus nilai DKN yang diketik untuk kolom GABUNGAN (DPK/KK) — sel kembali terisi otomatis dari nilai rapor gabungan. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ classId: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    const { classId } = await params;
    if (!(await assertHomeroomOwner(session.email, session.role, classId))) {
      return NextResponse.json({ error: "Khusus Wali Kelas kelas ini." }, { status: 403 });
    }
    const b = await req.json().catch(() => ({})) as { studentId?: string; subject?: string; semester?: string };
    if (!b.studentId || !b.subject || !b.semester || !adalahNamaGrup(b.subject)) {
      return NextResponse.json({ error: "Hanya kolom gabungan yang bisa dikembalikan ke nilai otomatis." }, { status: 400 });
    }
    const roster = await getClassRoster(classId, b.semester);
    if (!roster.some(s => s.id === b.studentId)) return NextResponse.json({ error: "Siswa tidak ditemukan di kelas ini." }, { status: 404 });
    await prisma.grade.deleteMany({ where: { studentId: b.studentId, subject: b.subject, type: "DKN", semester: b.semester } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
