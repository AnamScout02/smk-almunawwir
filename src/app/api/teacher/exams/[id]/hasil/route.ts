import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { ujianDalamCakupan, kelasPeserta } from "@/lib/ujian-server";
import { balasanExcelBanyakSheet } from "@/lib/ekspor-excel";
import { ikutDinilai, hitungBelumDikoreksi, type Jawaban } from "@/lib/soal";
import { kunciKeTeks } from "@/lib/soal-kunci";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** Hasil ujian + analisis butir. `?format=xlsx` mengunduh Excel (Rekap, Per Butir, Analisis). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const { id } = await params;
    const exam = await ujianDalamCakupan(session, id);
    if (!exam) return Response.json({ error: "Ujian tidak ditemukan" }, { status: 404 });
    const format = new URL(req.url).searchParams.get("format");

    const [soal, attempts, kelas] = await Promise.all([
      prisma.examQuestion.findMany({ where: { examId: id }, orderBy: { order: "asc" } }),
      prisma.examAttempt.findMany({
        where: { examId: id },
        include: { student: { select: { id: true, nis: true, user: { select: { name: true } }, class: { select: { name: true } } } } },
        orderBy: [{ student: { class: { name: "asc" } } }, { student: { user: { name: "asc" } } }],
      }),
      prisma.class.findMany({ where: { id: { in: kelasPeserta(exam) } }, select: { name: true }, orderBy: { name: "asc" } }),
    ]);

    const rekap = attempts.map(a => ({
      student: a.student, score: a.score, submittedAt: a.submittedAt, startedAt: a.startedAt,
      pelanggaran: Array.isArray(a.pelanggaran) ? (a.pelanggaran as unknown[]).length : 0,
      skorButir: (a.skorButir as Record<string, number | null>) ?? {},
      jawaban: (a.answers as Record<string, Jawaban>) ?? {},
      urutan: ((a.urutan as { urutanSoal?: string[] })?.urutanSoal ?? []),
      waktuSoal: (a.waktuSoal as Record<string, number>) ?? {},
      ubahJawaban: (a.ubahJawaban as Record<string, number>) ?? {},
    }));
    const selesai = rekap.filter(r => r.submittedAt);

    // Soal JELEK ditandai otomatis (17 Sep 2026) — hanya bila peserta cukup (≥10) supaya tidak menuduh soal dari sampel kecil.
    const tandaiKualitas = (x: { peserta: number; p: number | null; d: number | null; pengecohMati: number }) => {
      const alasan: string[] = [];
      if (x.peserta >= 10) {
        if (x.d !== null && x.d < 0) alasan.push("daya beda terbalik (siswa pintar lebih banyak salah) — periksa kunci");
        else if (x.d !== null && x.d < 0.2) alasan.push("daya beda lemah — tidak membedakan siswa paham & belum");
        if (x.p !== null && x.p < 0.1) alasan.push("terlalu sukar (< 10% benar)");
        if (x.p !== null && x.p > 0.95) alasan.push("terlalu mudah (> 95% benar)");
        if (x.pengecohMati >= 2) alasan.push(`${x.pengecohMati} pengecoh tidak dipilih siapa pun`);
      }
      return { perluRevisi: alasan.length > 0, alasanRevisi: alasan };
    };

    // Analisis butir: tingkat kesukaran (p) dan daya beda (kelompok atas vs bawah 27%).
    const bernilai = selesai.filter(r => r.score !== null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const nAtas = Math.max(1, Math.round(bernilai.length * 0.27));
    const atas = bernilai.slice(0, nAtas), bawah = bernilai.slice(-nAtas);
    const analisis = soal.filter(q => ikutDinilai(q.tipe)).map(q => {
      const peserta = selesai.filter(r => !r.urutan.length || r.urutan.includes(q.id));
      const rasio = (grup: typeof rekap) => {
        const g = grup.filter(r => !r.urutan.length || r.urutan.includes(q.id));
        if (!g.length) return null;
        return g.reduce((s, r) => s + ((r.skorButir[q.id] ?? 0) / (q.skor || 1)), 0) / g.length;
      };
      const p = rasio(peserta);
      const pa = rasio(atas), pb = rasio(bawah);
      const d = pa !== null && pb !== null ? pa - pb : null;
      const jawab = (r: typeof rekap[number]) => (r.skorButir[q.id] ?? 0) >= q.skor ? 1 : 0;
      const benar = peserta.reduce((s, r) => s + jawab(r), 0);

      // Analisis PENGECOH (distraktor) untuk soal pilihan: berapa peserta memilih tiap opsi.
      // Pengecoh dianggap BERFUNGSI kalau dipilih minimal 5% peserta — opsi salah yang nyaris tak
      // pernah dipilih tidak mengecoh siapa pun dan sebaiknya diganti.
      const opsiSoal = (Array.isArray(q.opsi) ? q.opsi : []) as { kode: string; teks: string; benar?: boolean }[];
      const pakaiSebaran = q.tipe === "PG" || q.tipe === "PG_KOMPLEKS";
      const sebaran = pakaiSebaran ? opsiSoal.map(o => {
        const dipilih = peserta.filter(r => {
          const j = r.jawaban[q.id];
          return Array.isArray(j) ? j.includes(o.kode) : j === o.kode;
        }).length;
        const persen = peserta.length ? Math.round((dipilih / peserta.length) * 1000) / 10 : 0;
        return {
          kode: o.kode, teks: o.teks.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 80),
          benar: !!o.benar, dipilih, persen,
          berfungsi: o.benar ? null : peserta.length ? dipilih / peserta.length >= 0.05 : null,
        };
      }) : [];
      const kosong = pakaiSebaran ? peserta.filter(r => {
        const j = r.jawaban[q.id];
        return j === undefined || j === null || j === "" || (Array.isArray(j) && !j.length);
      }).length : 0;
      const pengecohMati = sebaran.filter(o => o.berfungsi === false).length;

      // WAKTU & KERAGUAN per soal: rata-rata detik yang dihabiskan (hanya peserta yang tercatat
      // waktunya) dan rata-rata berapa kali jawabannya diganti.
      const berwaktu = peserta.filter(r => (r.waktuSoal[q.id] ?? 0) > 0);
      const rataWaktu = berwaktu.length ? Math.round(berwaktu.reduce((s, r) => s + r.waktuSoal[q.id], 0) / berwaktu.length) : null;
      const rataUbah = peserta.length ? Math.round((peserta.reduce((s, r) => s + (r.ubahJawaban[q.id] ?? 0), 0) / peserta.length) * 10) / 10 : null;
      return {
        questionId: q.id, nomor: q.order + 1, tipe: q.tipe, kd: q.kd, skor: q.skor,
        kunci: kunciKeTeks({ tipe: q.tipe, opsi: (q.opsi as { kode: string; teks: string; benar?: boolean }[]) ?? [], kunci: (q.kunci as never) ?? null }),
        peserta: peserta.length, benar,
        kesukaran: p, kategoriKesukaran: p === null ? "-" : p >= 0.7 ? "Mudah" : p >= 0.3 ? "Sedang" : "Sukar",
        dayaBeda: d, kategoriDayaBeda: d === null ? "-" : d >= 0.4 ? "Baik" : d >= 0.2 ? "Cukup" : d >= 0 ? "Lemah" : "Terbalik",
        sebaran, kosong, pengecohMati, rataWaktu, rataUbah,
        ...tandaiKualitas({ peserta: peserta.length, p, d, pengecohMati }),
      };
    });
    const nilaiSah = selesai.map(r => r.score).filter((s): s is number => s !== null);
    const statistik = {
      peserta: attempts.length, selesai: selesai.length,
      rerata: nilaiSah.length ? Math.round(nilaiSah.reduce((a, b) => a + b, 0) / nilaiSah.length * 100) / 100 : null,
      tertinggi: nilaiSah.length ? Math.max(...nilaiSah) : null,
      terendah: nilaiSah.length ? Math.min(...nilaiSah) : null,
      menungguKoreksi: selesai.filter(r => hitungBelumDikoreksi(r.skorButir) > 0).length,
    };

    if (format !== "xlsx") {
      return Response.json({
        exam: { id: exam.id, title: exam.title, subject: exam.subject, kelas: kelas.map(k => k.name).join(", "), tampilkanNilai: exam.tampilkanNilai },
        statistik, analisis,
        rekap: rekap.map(r => ({ student: r.student, score: r.score, submittedAt: r.submittedAt, pelanggaran: r.pelanggaran, menunggu: r.submittedAt ? hitungBelumDikoreksi(r.skorButir) : 0 })),
      });
    }

    const rekapRows = rekap.map((r, i) => [i + 1, r.student.nis, r.student.user.name, r.student.class?.name ?? "",
      r.submittedAt ? (hitungBelumDikoreksi(r.skorButir) > 0 ? "Selesai (nilai sementara)" : "Selesai") : "Belum", r.score ?? "", r.pelanggaran,
      r.submittedAt ? new Date(r.submittedAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) : ""]);
    const butirRows = rekap.filter(r => r.submittedAt).map((r, i) => [
      i + 1, r.student.nis, r.student.user.name, r.student.class?.name ?? "",
      ...soal.map(q => (r.urutan.length && !r.urutan.includes(q.id)) ? "-" : (r.skorButir[q.id] ?? 0)),
      r.score ?? "",
    ]);
    const analisisRows = analisis.map(a => [a.nomor, a.tipe, a.kd ?? "", a.skor, a.kunci, a.peserta, a.benar,
      a.kesukaran === null ? "" : Math.round(a.kesukaran * 100) / 100, a.kategoriKesukaran,
      a.dayaBeda === null ? "" : Math.round(a.dayaBeda * 100) / 100, a.kategoriDayaBeda, a.rataWaktu ?? "", a.rataUbah ?? ""]);
    const waktuRows = rekap.filter(r => r.submittedAt).map((r, i) => [
      i + 1, r.student.nis, r.student.user.name, r.student.class?.name ?? "",
      ...soal.map(q => (r.urutan.length && !r.urutan.includes(q.id)) ? "-" : (r.waktuSoal[q.id] ?? "")),
      Object.values(r.waktuSoal).reduce((n, d) => n + d, 0),
    ]);
    const pengecohRows = analisis.flatMap(a => a.sebaran.map(o => [
      a.nomor, o.kode, o.teks, o.benar ? "KUNCI" : "", o.dipilih, o.persen,
      o.berfungsi === null ? "" : o.berfungsi ? "Berfungsi" : "Tidak berfungsi", a.kosong,
    ]));
    return balasanExcelBanyakSheet(`hasil-${exam.title.replace(/[^\w]+/g, "-").toLowerCase()}`, [
      { nama: "Rekap Nilai", headers: ["No", "NIS", "Nama", "Kelas", "Status", "Nilai", "Pelanggaran", "Dikumpulkan"], rows: rekapRows },
      { nama: "Skor per Butir", headers: ["No", "NIS", "Nama", "Kelas", ...soal.map(q => `S${q.order + 1}`), "Nilai"], rows: butirRows },
      { nama: "Analisis Butir", headers: ["No", "Tipe", "KD", "Skor", "Kunci", "Peserta", "Benar", "Kesukaran", "Kategori", "Daya Beda", "Kategori", "Rata Waktu (detik)", "Rata Ganti Jawaban"], rows: analisisRows },
      { nama: "Analisis Pengecoh", headers: ["No Soal", "Opsi", "Teks Opsi", "Kunci", "Dipilih", "Persen", "Pengecoh", "Tidak Menjawab"], rows: pengecohRows },
      { nama: "Waktu per Soal", headers: ["No", "NIS", "Nama", "Kelas", ...soal.map(q => `S${q.order + 1} (dtk)`), "Total (dtk)"], rows: waktuRows },
    ]);
  } catch {
    return Response.json({ error: "Gagal memuat hasil." }, { status: 500 });
  }
}
