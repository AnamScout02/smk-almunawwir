import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { ujianDalamCakupan } from "@/lib/ujian-server";
import { bacaExcelUjian } from "@/lib/soal-excel";
import { cocokMapel } from "@/lib/cocok-mapel";
import { terapkanKunci } from "@/lib/soal-kunci";
import { type Opsi, type Kunci } from "@/lib/soal";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** Terapkan berkas Excel pengaturan + kunci ke ujian yang SUDAH punya soal (dicocokkan lewat
 * urutan nomor 1..n). Mengubah kunci, skor, KD, posisi kunci, dan grouping (stimulus dummy
 * per grup) - serta pengaturan waktu/durasi/acak bila terisi. Ditolak kalau ujian sudah
 * dikerjakan siswa. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const { id } = await params;
    const exam = await ujianDalamCakupan(session, id, { ubah: true });
    if (!exam) return Response.json({ error: "Ujian tidak ditemukan" }, { status: 404 });
    if ((await prisma.examAttempt.count({ where: { examId: id } })) > 0) {
      return Response.json({ error: "Ujian sudah dikerjakan siswa - kunci tidak bisa diubah lagi." }, { status: 409 });
    }
    const form = await req.formData();
    const excel = form.get("excel") as File | null;
    if (!excel) return Response.json({ error: "Berkas Excel wajib diunggah." }, { status: 400 });
    const ex = bacaExcelUjian(Buffer.from(await excel.arrayBuffer()));
    if (!ex.kunci.length) return Response.json({ error: ex.catatan[0] ?? "Tabel kunci tidak ditemukan." }, { status: 400 });

    const soal = await prisma.examQuestion.findMany({ where: { examId: id }, orderBy: { order: "asc" } });
    const perNomor = new Map(ex.kunci.map(k => [k.nomor, k]));
    const laporan: string[] = [];

    // Kode Test WAJIB mata pelajaran ujian ini. Tanpa pemeriksaan ini, berkas kunci mapel lain
    // diterapkan begitu saja lewat nomor soal dan merusak semua kunci (celah nyata s.d. 14 Sep 2026).
    const kodeTest = ex.pengaturan.kodeTest;
    const mapelExcel = cocokMapel(kodeTest, exam.subject);
    if (mapelExcel === "BEDA") {
      return Response.json({ error: `Kode Test di Excel "${kodeTest}" bukan mata pelajaran ujian ini (${exam.subject}). Kunci TIDAK diterapkan — periksa apakah berkasnya tertukar.` }, { status: 400 });
    }
    if (mapelExcel === "MIRIP") laporan.push(`Kode Test tertulis "${kodeTest}" — diterima sebagai ${exam.subject}. Sebaiknya ditulis lengkap sama persis.`);
    if (mapelExcel === "KOSONG") laporan.push(`Kode Test kosong — isi "${exam.subject}" supaya berkas tidak tertukar dengan mapel lain.`);
    let cocok = 0;

    // Grouping ala Bimasoft -> satu ExamStimulus kosong per grup supaya pengacakan menjaga
    // rombongan itu tetap menempel (wacananya sendiri sudah ada di dalam teks soal pertama).
    const stimulusPerGrup = new Map<number, string>();

    await prisma.$transaction(async tx => {
      for (let i = 0; i < soal.length; i++) {
        const q = soal[i];
        const k = perNomor.get(i + 1);
        if (!k) { laporan.push(`Soal ${i + 1}: tidak ada baris kunci`); continue; }
        cocok += 1;
        const t = terapkanKunci({ tipe: q.tipe, opsi: (q.opsi as unknown as Opsi[]) ?? [], kunci: (q.kunci as unknown as Kunci | null) ?? null }, k.kunci, k.pedoman);
        if (t.peringatan.length) laporan.push(`Soal ${i + 1}: ${t.peringatan.join(", ")}`);
        let stimulusId = q.stimulusId;
        if (k.grouping) {
          if (!stimulusPerGrup.has(k.grouping)) {
            const st = await tx.examStimulus.create({ data: { teacherId: exam.teacherId, judul: `Grup soal ${k.grouping} - ${exam.title}`, konten: "" } });
            stimulusPerGrup.set(k.grouping, st.id);
          }
          stimulusId = stimulusPerGrup.get(k.grouping)!;
        }
        await tx.examQuestion.update({
          where: { id: q.id },
          data: {
            opsi: t.opsi as object, kunci: (t.kunci ?? undefined) as object | undefined,
            skor: k.skor, kd: k.kd, posisiKunci: k.lockN, stimulusId,
            ...(k.materi ? { materi: k.materi } : {}), ...(k.indikator ? { indikator: k.indikator } : {}), ...(k.levelKognitif ? { levelKognitif: k.levelKognitif } : {}),
          },
        });
      }
      const p = ex.pengaturan;
      const data: Record<string, unknown> = {};
      if (p.alokasiMenit) data.duration = p.alokasiMenit;
      if (p.acakSoal !== null) data.acakSoal = p.acakSoal;
      if (p.acakOpsi !== null) data.acakOpsi = p.acakOpsi;
      if (p.jumlahDikerjakan && p.jumlahSoal && p.jumlahDikerjakan < p.jumlahSoal) data.jumlahDikerjakan = p.jumlahDikerjakan;
      if (p.tanggal && p.jamMulai) {
        const mulai = new Date(`${p.tanggal}T${p.jamMulai}:00+07:00`);
        if (!isNaN(mulai.getTime())) {
          data.startTime = mulai;
          data.endTime = new Date(mulai.getTime() + Math.max(p.alokasiMenit ?? exam.duration, 30) * 60_000 + 30 * 60_000);
        }
      }
      if (p.namaTest && !exam.title) data.title = p.namaTest;
      if (Object.keys(data).length) await tx.exam.update({ where: { id }, data });
    });

    return Response.json({ cocok, total: soal.length, laporan, pengaturan: ex.pengaturan, lembar: ex.lembar });
  } catch (galat) {
    lemparBilaPengalihan(galat);
    return Response.json({ error: "Gagal menerapkan berkas Excel." }, { status: 500 });
  }
}
