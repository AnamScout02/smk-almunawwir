import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { prisma } from "@/lib/prisma";
import { alasanDitahan, pesanDitahan } from "@/lib/peserta-ditahan";
import { jendelaKelas } from "@/lib/jadwal-ujian-kelas";
import { verifyRole } from "@/lib/dal";
import { siswaDariSesi, tenggat, TOLERANSI_MS, TENGGANG_TOKEN_MS, jagaAttempt, tambahJejak, HEADER_PERANGKAT, pesertaBoleh } from "@/lib/ujian-server";
import { periksaSeb } from "@/lib/seb";
import { NextRequest } from "next/server";
import { tolakTanpaAplikasi } from "@/lib/aplikasi-ujian";

export const dynamic = "force-dynamic";

/** Masuk ujian dengan token. Kalau ujian memakai examkey, kunci itu WAJIB ikut dikirim - halaman
 * ujian membacanya dari URL yang dibuka lewat browser ujian sekolah (?examkey=...).
 *
 * - Token berjangka: token SEBELUMNYA masih diterima 2 menit setelah berganti.
 * - Perangkat yang pertama masuk langsung memegang pengerjaan (kunci perangkat).
 * - Siswa yang sudah pernah mulai boleh masuk lagi walau jam tutup lewat, selama tenggat
 *   pribadinya (termasuk tambahan waktu dari pengawas) belum habis. */
/** BATAS PERCOBAAN TOKEN per siswa (audit 24 September 2026). Token 6 huruf memang sulit ditebak dan join
 *  masih disaring kelas peserta, tetapi tanpa pembatas seorang siswa bisa menembaki ribuan tebakan diam-diam.
 *  Hitungan di memori satu proses — cukup untuk menahan tebakan beruntun, dan hilang saat aplikasi dimuat ulang. */
const BATAS_TEBAK = 15, JENDELA_TEBAK_MS = 5 * 60_000;
const tebakan = new Map<string, { n: number; sejak: number }>();
function tebakanBerlebih(studentId: string) {
  const t = tebakan.get(studentId);
  return !!t && Date.now() - t.sejak < JENDELA_TEBAK_MS && t.n >= BATAS_TEBAK;
}
function catatTebakanSalah(studentId: string) {
  const t = tebakan.get(studentId), kini = Date.now();
  tebakan.set(studentId, t && kini - t.sejak < JENDELA_TEBAK_MS ? { n: t.n + 1, sejak: t.sejak } : { n: 1, sejak: kini });
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["STUDENT"]);
    const student = await siswaDariSesi(session);
    if (!student?.classId) return Response.json({ error: "Akun Anda belum terhubung ke kelas." }, { status: 401 });

    const { token, examkey, examId } = await req.json();
    const petunjukUjian = typeof examId === "string" ? examId : null;
    if (!token?.trim()) return Response.json({ error: "Masukkan token ujian." }, { status: 400 });
    const t = String(token).trim().toUpperCase();
    if (tebakanBerlebih(student.id)) {
      return Response.json({ error: "Terlalu banyak percobaan token. Tunggu beberapa menit atau minta token terbaru dari pengawas." }, { status: 429 });
    }
    const perangkat = req.headers.get(HEADER_PERANGKAT);

    let exam = await prisma.exam.findUnique({ where: { token: t } });
    if (!exam) {
      const lama = await prisma.exam.findFirst({ where: { tokenLama: t } });
      if (lama && Date.now() - lama.tokenDiperbarui.getTime() <= TENGGANG_TOKEN_MS) exam = lama;
      else if (lama) return Response.json({ error: "Token sudah berganti. Minta token terbaru dari pengawas." }, { status: 400 });
    }

    // TOKEN BERSAMA SATU KEGIATAN (20 September 2026): bukan token satu ujian, melainkan token
    // satu kegiatan (STS/SAS/PSAJ). Server yang memilihkan ujian mana dalam kegiatan itu yang
    // sedang dibuka untuk siswa ini — siswa tidak perlu token berbeda tiap mata pelajaran.
    if (!exam) {
      let keg = await prisma.kegiatanUjian.findUnique({ where: { token: t } });
      if (!keg) {
        const kl = await prisma.kegiatanUjian.findFirst({ where: { tokenLama: t } });
        if (kl && Date.now() - kl.tokenDiperbarui.getTime() <= TENGGANG_TOKEN_MS) keg = kl;
        else if (kl) return Response.json({ error: "Token sudah berganti. Minta token terbaru dari pengawas." }, { status: 400 });
      }
      if (keg) {
        if (!keg.aktif) return Response.json({ error: "Kegiatan ujian ini sudah tidak aktif." }, { status: 400 });
        const now = new Date();
        const calon = await prisma.exam.findMany({
          where: { kegiatanId: keg.id, isPublished: true, startTime: { lte: now }, endTime: { gte: now } },
          orderBy: { startTime: "asc" },
        });
        // Hanya ujian yang memang untuk siswa ini (kelas peserta & daftar peserta susulan/remedial) dan sedang dibuka
        // untuk KELASNYA — pada kegiatan per kelas, ujian yang sama dibuka bergiliran per kelas (jadwalKelas).
        const milikSaya = calon.filter(e => {
          if (!pesertaBoleh(e, student)) return false;
          const j = jendelaKelas(e, student.classId);
          return j.startTime <= now && j.endTime >= now;
        });
        if (milikSaya.length === 0) {
          return Response.json({ error: `Token ${keg.singkatan} benar, tetapi belum ada ujian yang dibuka untuk Anda saat ini.` }, { status: 404 });
        }
        // Siswa mengetik token dari HALAMAN SATU UJIAN — kalau ujian itu memang bagian kegiatan ini
        // dan sedang dibuka untuknya, itulah yang dimaksud. Tanpa ini token kegiatan akan terbaca
        // sebagai "milik ujian lain" di halaman tersebut.
        const diminta = petunjukUjian ? milikSaya.find(e => e.id === petunjukUjian) : null;
        if (diminta) exam = diminta;

        // Sudah pernah mulai & belum dikumpulkan → lanjutkan yang itu, bukan memulai yang lain.
        const berjalan = exam ? null : await prisma.examAttempt.findFirst({
          where: { studentId: student.id, submittedAt: null, examId: { in: milikSaya.map(e => e.id) } },
          select: { examId: true },
        });
        if (berjalan) exam = milikSaya.find(e => e.id === berjalan.examId) ?? null;
        if (!exam) {
          const sudah = await prisma.examAttempt.findMany({
            where: { studentId: student.id, examId: { in: milikSaya.map(e => e.id) }, submittedAt: { not: null } },
            select: { examId: true },
          });
          const selesai = new Set(sudah.map(a => a.examId));
          const belum = milikSaya.filter(e => !selesai.has(e.id));
          if (belum.length === 0) {
            return Response.json({ error: `Semua ujian ${keg.singkatan} yang dibuka untuk Anda sudah dikumpulkan.` }, { status: 400 });
          }
          // Lebih dari satu yang terbuka bersamaan → biar siswa yang memilih, jangan ditebak.
          if (belum.length > 1) {
            return Response.json({
              pilih: belum.map(e => ({ id: e.id, judul: e.title, mapel: e.subject })),
              kegiatan: keg.nama,
            });
          }
          exam = belum[0];
        }
      }
    }
    if (!exam || !pesertaBoleh(exam, student) || !exam.isPublished) {
      catatTebakanSalah(student.id);
      return Response.json({ error: "Token tidak ditemukan atau ujian ini bukan untuk kelas Anda." }, { status: 404 });
    }
    tebakan.delete(student.id); // token benar — hitungan direset
    if (exam.examkey && exam.examkey !== String(examkey ?? "").trim()) {
      return Response.json({ error: "Ujian ini hanya bisa dibuka lewat browser ujian sekolah." }, { status: 403 });
    }
    // Safe Exam Browser: satu-satunya kunci layar yang sungguhan (lihat src/lib/seb.ts).
    if (exam.wajibSeb) {
      const seb = await periksaSeb(req);
      if (!seb.ok) return Response.json({ error: seb.alasan }, { status: 403 });
    }
    // HP Android wajib lewat Aplikasi Ujian SMK (src/lib/aplikasi-ujian.ts) — komputer & iPhone tidak terpengaruh.
    if (exam.wajibAplikasi) {
      const tolak = tolakTanpaAplikasi(req.headers.get("user-agent"));
      if (tolak) return Response.json({ error: tolak, perluAplikasi: true }, { status: 403 });
    }

    const attempt = await prisma.examAttempt.findUnique({ where: { examId_studentId: { examId: exam.id, studentId: student.id } } });
    if (attempt?.submittedAt) return Response.json({ error: "Anda sudah mengumpulkan ujian ini.", examId: exam.id, selesai: true }, { status: 400 });

    if (attempt) {
      const jaga = await jagaAttempt(attempt, perangkat);
      if (jaga.tolak) return jaga.tolak;
      const batas = tenggat(attempt.startedAt, exam.duration, jendelaKelas(exam, student.classId).endTime, attempt.tambahanMenit).getTime();
      if (Date.now() > batas + TOLERANSI_MS) return Response.json({ error: "Waktu pengerjaan Anda sudah habis. Hubungi pengawas." }, { status: 400 });
      await prisma.examAttempt.update({ where: { id: attempt.id }, data: { lastSeenAt: new Date(), jejak: tambahJejak(jaga.jejak, { jenis: "MASUK_LAGI" }) as object } });
      return Response.json({ examId: exam.id });
    }

    // Peserta DITAHAN panitia (mis. belum menyelesaikan administrasi ujian) — src/lib/peserta-ditahan.ts.
    const ditahan = await alasanDitahan(exam.kegiatanId, student.id);
    if (ditahan) return Response.json({ error: pesanDitahan(ditahan), ditahan: true }, { status: 403 });

    const now = new Date();
    const jendela = jendelaKelas(exam, student.classId);
    const jam = (d: Date) => d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
    if (now < jendela.startTime) return Response.json({ error: `Ujian belum dibuka untuk kelas Anda — dibuka pukul ${jam(jendela.startTime)}.` }, { status: 400 });
    if (now > jendela.endTime) return Response.json({ error: "Waktu ujian untuk kelas Anda sudah berakhir." }, { status: 400 });

    const p = (perangkat ?? "").trim().slice(0, 64);
    await prisma.examAttempt.create({
      data: {
        examId: exam.id, studentId: student.id, perangkatId: p || null,
        jejak: tambahJejak([], { jenis: "MULAI", ket: exam.token !== t ? "memakai token sebelumnya" : undefined }, ...(p ? [{ jenis: "PERANGKAT_TERDAFTAR" }] : [])) as object,
      },
    });
    return Response.json({ examId: exam.id });
  } catch (galat) {
    lemparBilaPengalihan(galat);
    return Response.json({ error: "Gagal masuk ujian." }, { status: 500 });
  }
}
