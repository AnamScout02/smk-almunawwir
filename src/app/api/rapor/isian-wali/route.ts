import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { semesterRapor } from "@/lib/rapor-verifikasi";
import { teacherDariSesi } from "@/lib/rapor-form-server";
import { BATAS_PILIHAN, NILAI_SIKAP_DINIYAH, PREDIKAT_SIKAP, type PilihanSikap } from "@/lib/rapor-sikap";
import { NextRequest } from "next/server";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

/** ISIAN RAPOR OLEH WALI KELAS (22 September 2026, format makro rapor sekolah): predikat & pilihan perilaku sikap spiritual/sosial,
 * sikap Diniyah (Akhlak/Kerajinan/Kerapian), dan keputusan naik/tinggal kelas (semester genap). Disimpan di CatatanWaliKelas
 * (baris yang sama dengan catatan wali; teks catatan TIDAK disentuh di sini). Wali kelas untuk kelas walinya; Admin/TAS semua. */
async function bolehKelas(session: { role: string; email: string }, classId: string) {
  if (session.role === "ADMIN" || session.role === "TAS") return true;
  const t = await teacherDariSesi(session.email);
  if (!t) return false;
  return !!(await prisma.class.findFirst({ where: { id: classId, homeroomId: t.id }, select: { id: true } }));
}

export async function GET(req: NextRequest) {
  const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
  const sp = new URL(req.url).searchParams;
  const classId = sp.get("classId") ?? "", semester = sp.get("semester") ?? "";
  if (!semesterRapor().includes(semester)) return Response.json({ error: "Semester tidak dikenal." }, { status: 400 });
  if (!(await bolehKelas(session, classId))) return Response.json({ error: "Hanya wali kelas ini yang bisa mengisi." }, { status: 403 });
  const [kelas, siswa, isian, sah] = await Promise.all([
    prisma.class.findUnique({ where: { id: classId }, select: { name: true, grade: true } }),
    prisma.student.findMany({ where: { classId, studentStatus: "AKTIF" }, select: { id: true, nis: true, user: { select: { name: true } } }, orderBy: { user: { name: "asc" } } }),
    prisma.catatanWaliKelas.findMany({ where: { semester, student: { classId } } }),
    prisma.raporApproval.findUnique({ where: { classId_semester: { classId, semester } }, select: { id: true } }),
  ]);
  const peta = new Map(isian.map(i => [i.studentId, i]));
  return Response.json({
    kelas: kelas?.name ?? "", grade: kelas?.grade ?? 0, kelasXII: (kelas?.grade ?? 0) >= 12, genap: semester.startsWith("Genap"), disahkan: !!sah,
    siswa: siswa.map(s => {
      const i = peta.get(s.id);
      return {
        id: s.id, nis: s.nis, nama: s.user.name,
        sikapSpiritual: i?.sikapSpiritual ?? "", sikapSosial: i?.sikapSosial ?? "",
        akhlak: i?.akhlak ?? "", kerajinan: i?.kerajinan ?? "", kerapian: i?.kerapian ?? "",
        keputusan: i?.keputusan ?? "", pilihan: (i?.sikapPilihan ?? {}) as PilihanSikap,
      };
    }),
  });
}

const PREDIKAT = new Set<string>(PREDIKAT_SIKAP.map(p => p.value));
const DINIYAH = new Set<string>(NILAI_SIKAP_DINIYAH);
const KEPUTUSAN = new Set(["NAIK", "TINGGAL", "LULUS", "TIDAK_LULUS"]);
const nomor = (x: unknown, maks: number) => (Array.isArray(x) ? [...new Set(x.map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= 10))].slice(0, maks) : []);

export async function PUT(req: NextRequest) {
  const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
  const b = await req.json().catch(() => ({})) as { classId?: string; semester?: string; siswa?: Record<string, unknown>[] };
  const classId = String(b.classId ?? ""), semester = String(b.semester ?? "");
  if (!semesterRapor().includes(semester)) return Response.json({ error: "Semester tidak dikenal." }, { status: 400 });
  if (!(await bolehKelas(session, classId))) return Response.json({ error: "Hanya wali kelas ini yang bisa mengisi." }, { status: 403 });
  if (await prisma.raporApproval.findUnique({ where: { classId_semester: { classId, semester } }, select: { id: true } })) {
    return Response.json({ error: "Rapor semester ini sudah disahkan — isian rapor tidak bisa diubah." }, { status: 409 });
  }
  const siswaKelas = new Set((await prisma.student.findMany({ where: { classId, studentStatus: "AKTIF" }, select: { id: true } })).map(s => s.id));
  const pilih = (x: unknown, set: Set<string>) => (typeof x === "string" && set.has(x) ? x : null);
  let n = 0;
  await prisma.$transaction(async tx => {
    for (const r of Array.isArray(b.siswa) ? b.siswa : []) {
      const studentId = String(r.id ?? "");
      if (!siswaKelas.has(studentId)) continue;
      const p = (r.pilihan ?? {}) as PilihanSikap;
      const pilihan: PilihanSikap = {
        spiritual: { selalu: nomor(p.spiritual?.selalu, BATAS_PILIHAN.selalu), mulai: nomor(p.spiritual?.mulai, BATAS_PILIHAN.mulai) },
        sosial: {
          sangatBaik: nomor(p.sosial?.sangatBaik, BATAS_PILIHAN.sangatBaik), baik: nomor(p.sosial?.baik, BATAS_PILIHAN.baik),
          kurang: nomor(p.sosial?.kurang, BATAS_PILIHAN.kurang), mulai: nomor(p.sosial?.mulai, BATAS_PILIHAN.mulaiSosial),
          catatan: String(p.sosial?.catatan ?? "").trim().slice(0, 300),
        },
      };
      const data = {
        sikapSpiritual: pilih(r.sikapSpiritual, PREDIKAT), sikapSosial: pilih(r.sikapSosial, PREDIKAT),
        akhlak: pilih(r.akhlak, DINIYAH), kerajinan: pilih(r.kerajinan, DINIYAH), kerapian: pilih(r.kerapian, DINIYAH),
        keputusan: pilih(r.keputusan, KEPUTUSAN), sikapPilihan: pilihan as object,
      };
      await tx.catatanWaliKelas.upsert({
        where: { studentId_semester: { studentId, semester } },
        create: { studentId, semester, catatan: "", dibuatOleh: session.name, ...data },
        update: data,
      });
      n++;
    }
  });
  const kelas = await prisma.class.findUnique({ where: { id: classId }, select: { name: true } });
  await logActivity(session, { action: "ISIAN_RAPOR_WALI", entity: "CatatanWaliKelas", entityId: classId, description: `Menyimpan isian rapor (sikap/keputusan) ${kelas?.name ?? ""} ${semester}: ${n} siswa` }).catch(() => {});
  return Response.json({ ok: true, jumlah: n });
}
