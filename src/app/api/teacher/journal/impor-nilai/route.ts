import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { logActivity } from "@/lib/activity-log";
import { pesanNilaiTerkunci } from "@/lib/rapor-verifikasi";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

/** IMPOR NILAI DARI EXCEL ke Jurnal Mengajar (17 Sep 2026 — permintaan user: "baru 2 guru yang mengisi lewat layar").
 * GET  → templat .xlsx berisi daftar siswa aktif kelas itu (NIS & nama sudah terisi).
 * POST → multipart (file, classId, subject, date, semester, materi, simpan): `simpan` ≠ "1" hanya pratinjau.
 * Nilai masuk ke jurnal pertemuan tanggal itu: bila jurnalnya sudah ada, nilai & catatan siswa DIPERBARUI (kehadiran tidak
 * disentuh); bila belum, jurnal baru dibuat. Hanya guru pengampu mapel di kelas itu; ditolak bila nilai sudah dikunci wali kelas. */

const TIPE_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const KOLOM = ["No", "NIS", "Nama Siswa", "Nilai Pengetahuan", "Nilai Keterampilan", "Catatan"];

async function aksesGuru(email: string, classId: string, subject: string) {
  const teacher = await prisma.teacher.findFirst({ where: { user: { email } }, select: { id: true } });
  if (!teacher) return { galat: "Data guru tidak ditemukan.", status: 404 } as const;
  const tugas = await prisma.teachingAssignment.findFirst({ where: { teacherId: teacher.id, classId, subject: { name: subject } }, select: { id: true } });
  if (!tugas) return { galat: "Anda tidak mengajar kelas/mapel ini.", status: 403 } as const;
  return { teacherId: teacher.id } as const;
}

const siswaKelas = (classId: string) => prisma.student.findMany({
  where: { classId, studentStatus: "AKTIF" },
  select: { id: true, nis: true, user: { select: { name: true } } },
  orderBy: { user: { name: "asc" } },
});

const kunciNama = (v: string) => v.toLowerCase().replace(/[^a-z]+/g, " ").trim();
const namaBerkas = (v: string) => v.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

export async function GET(req: Request) {
  const session = await verifyRole(["TEACHER"]);
  const u = new URL(req.url);
  const classId = u.searchParams.get("classId") ?? "";
  const subject = u.searchParams.get("subject") ?? "";
  const akses = await aksesGuru(session.email, classId, subject);
  if ("galat" in akses) return Response.json({ error: akses.galat }, { status: akses.status });
  const [kelas, siswa] = await Promise.all([
    prisma.class.findUnique({ where: { id: classId }, select: { name: true } }),
    siswaKelas(classId),
  ]);

  const wb = XLSX.utils.book_new();
  const baris = siswa.map((s, i) => [i + 1, s.nis, s.user.name, null, null, null]);
  const ws = XLSX.utils.aoa_to_sheet([KOLOM, ...baris]);
  ws["!cols"] = [{ wch: 5 }, { wch: 18 }, { wch: 34 }, { wch: 18 }, { wch: 18 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws, "Nilai");
  const petunjuk = XLSX.utils.aoa_to_sheet([
    ["Petunjuk impor nilai"],
    [`Kelas: ${kelas?.name ?? "-"} · Mata pelajaran: ${subject}`],
    ["1. Isi Nilai Pengetahuan dan/atau Nilai Keterampilan dengan angka 0–100. Kosongkan bila tidak ada nilai."],
    ["2. Jangan mengubah kolom NIS — siswa dicocokkan lewat NIS (cadangan: nama persis)."],
    ["3. Tanggal pertemuan, semester, dan materi dipilih di layar Jurnal Mengajar saat mengunggah."],
    ["4. Bila jurnal tanggal itu sudah ada, nilai & catatan diperbarui; data kehadiran tidak berubah."],
  ]);
  petunjuk["!cols"] = [{ wch: 100 }];
  XLSX.utils.book_append_sheet(wb, petunjuk, "Petunjuk");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": TIPE_XLSX,
      "Content-Disposition": `attachment; filename="nilai-${namaBerkas(kelas?.name ?? "kelas")}-${namaBerkas(subject)}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}

interface BarisImpor { baris: number; studentId: string | null; nis: string; nama: string; p: number | null; k: number | null; catatan: string; galat: string | null }

function angkaNilai(v: unknown): { nilai: number | null; galat: string | null } {
  if (v === null || v === undefined || String(v).trim() === "") return { nilai: null, galat: null };
  const n = typeof v === "number" ? v : Number(String(v).trim().replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 100) return { nilai: null, galat: `nilai "${String(v).trim()}" bukan angka 0–100` };
  return { nilai: Math.round(n * 100) / 100, galat: null };
}

export async function POST(req: Request) {
  const session = await verifyRole(["TEACHER"]);
  const form = await req.formData().catch(() => null);
  if (!form) return Response.json({ error: "Berkas tidak terbaca." }, { status: 400 });
  const ambil = (k: string) => String(form.get(k) ?? "").trim();
  const classId = ambil("classId"), subject = ambil("subject"), semester = ambil("semester"), materi = ambil("materi");
  const tanggal = ambil("date");
  const simpan = ambil("simpan") === "1";
  const urutan = Math.min(20, Math.max(1, Math.round(Number(ambil("urutan")) || 1))); // materi ke-N hari itu
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return Response.json({ error: "Pilih berkas Excel hasil templat dulu." }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) return Response.json({ error: "Berkas terlalu besar (maks 5 MB)." }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal) || !semester) return Response.json({ error: "Tanggal pertemuan dan semester wajib diisi." }, { status: 400 });

  const akses = await aksesGuru(session.email, classId, subject);
  if ("galat" in akses) return Response.json({ error: akses.galat }, { status: akses.status });
  const date = new Date(tanggal);
  const nextDay = new Date(date.getTime() + 86400000);
  const jurnalLama = await prisma.teachingJournal.findFirst({
    where: { teacherId: akses.teacherId, classId, subject, date: { gte: date, lt: nextDay }, urutan },
    include: { entries: true },
  });
  if (!jurnalLama && urutan > 1) return Response.json({ error: "Simpan dulu materi itu di halaman Jurnal, baru impor nilainya." }, { status: 400 });
  const terkunci = await pesanNilaiTerkunci(classId, [semester, jurnalLama?.semester ?? ""]);
  if (terkunci) return Response.json({ error: terkunci }, { status: 409 });

  let rows: unknown[][] = [];
  try {
    const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: "buffer" });
    const sheet = wb.Sheets["Nilai"] ?? wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, blankrows: false });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Berkas bukan Excel yang valid. Pakai templat dari tombol Unduh Templat." }, { status: 400 });
  }
  const kepala = (rows[0] ?? []).map(v => String(v ?? "").trim().toLowerCase());
  const kol = (awal: string) => kepala.findIndex(h => h.startsWith(awal));
  const iNis = kol("nis"), iNama = kol("nama"), iP = kol("nilai pengetahuan"), iK = kol("nilai keterampilan"), iC = kol("catatan");
  if (iNis < 0 || iP < 0 || iK < 0) return Response.json({ error: "Kolom NIS, Nilai Pengetahuan, dan Nilai Keterampilan tidak ditemukan. Pakai templat terbaru." }, { status: 400 });

  const siswa = await siswaKelas(classId);
  const perNis = new Map(siswa.map(s => [s.nis.trim(), s]));
  const perNama = new Map<string, typeof siswa>();
  for (const s of siswa) { const k = kunciNama(s.user.name); perNama.set(k, [...(perNama.get(k) ?? []), s]); }

  const hasil: BarisImpor[] = [];
  const dipakai = new Set<string>();
  rows.slice(1).forEach((r, idx) => {
    const nis = String(r[iNis] ?? "").trim();
    const nama = iNama >= 0 ? String(r[iNama] ?? "").trim() : "";
    const p = angkaNilai(r[iP]), k = angkaNilai(r[iK]);
    const catatan = iC >= 0 ? String(r[iC] ?? "").trim().slice(0, 500) : "";
    if (!nis && !nama && p.nilai === null && k.nilai === null && !catatan) return;
    const calonNama = perNama.get(kunciNama(nama));
    const s = perNis.get(nis) ?? (calonNama?.length === 1 ? calonNama[0] : undefined);
    let galat = p.galat ?? k.galat;
    if (!s) galat = galat ?? "siswa tidak ditemukan di kelas ini (periksa NIS)";
    else if (dipakai.has(s.id)) galat = galat ?? "siswa ini muncul lebih dari sekali";
    if (s && !galat) dipakai.add(s.id);
    if (!galat && p.nilai === null && k.nilai === null && !catatan) return; // baris tanpa isian dilewati
    hasil.push({ baris: idx + 2, studentId: s?.id ?? null, nis: s?.nis ?? nis, nama: s?.user.name ?? nama, p: p.nilai, k: k.nilai, catatan, galat });
  });

  const sah = hasil.filter(h => !h.galat);
  const ringkas = { terbaca: hasil.length, siap: sah.length, galat: hasil.length - sah.length, jurnalAda: !!jurnalLama };
  if (!simpan) return Response.json({ ...ringkas, baris: hasil });
  if (ringkas.galat) return Response.json({ error: "Masih ada baris bermasalah — perbaiki berkasnya lalu unggah lagi.", ...ringkas, baris: hasil }, { status: 400 });
  if (!sah.length) return Response.json({ error: "Tidak ada nilai yang bisa disimpan." }, { status: 400 });
  if (!jurnalLama && !materi) return Response.json({ error: "Materi pertemuan wajib diisi untuk jurnal baru." }, { status: 400 });

  await prisma.$transaction(async tx => {
    if (jurnalLama) {
      if (materi && materi !== jurnalLama.materi) await tx.teachingJournal.update({ where: { id: jurnalLama.id }, data: { materi } });
      const ada = new Map(jurnalLama.entries.map(e => [e.studentId, e]));
      for (const h of sah) {
        const e = ada.get(h.studentId!);
        const data = { scorePengetahuan: h.p, scoreKeterampilan: h.k, ...(h.catatan ? { catatan: h.catatan } : {}) };
        if (e) await tx.journalEntry.update({ where: { id: e.id }, data });
        else await tx.journalEntry.create({ data: { journalId: jurnalLama.id, studentId: h.studentId!, attendanceStatus: null, ...data } });
      }
    } else {
      await tx.teachingJournal.create({
        data: {
          teacherId: akses.teacherId, classId, subject, date, semester, materi, urutan,
          entries: { create: sah.map(h => ({ studentId: h.studentId!, attendanceStatus: null, scorePengetahuan: h.p, scoreKeterampilan: h.k, catatan: h.catatan || null })) },
        },
      });
    }
  });
  const kelas = await prisma.class.findUnique({ where: { id: classId }, select: { name: true } });
  await logActivity(session, {
    action: "IMPOR_NILAI_JURNAL", entity: "TeachingJournal", entityId: classId,
    description: `Impor nilai Excel ${subject} ${kelas?.name ?? ""} tanggal ${tanggal}: ${sah.length} siswa${jurnalLama ? " (jurnal diperbarui)" : " (jurnal baru)"}`,
  }).catch(() => {});
  return Response.json({ ok: true, ...ringkas });
}
