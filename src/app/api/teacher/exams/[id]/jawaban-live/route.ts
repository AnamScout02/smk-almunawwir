import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { ujianDalamCakupan } from "@/lib/ujian-server";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** JAWABAN SEMENTARA satu siswa — terlihat pengawas SEBELUM dikumpulkan (permintaan user 23 September 2026:
 * "bisa nggak kita tambahin fitur melihat live jawaban walaupun belum dikumpulkan").
 *
 * Murni BACA: tidak menyentuh pengerjaan siswa sama sekali (tidak menandai, tidak mengunci, tidak menilai),
 * jadi tidak bisa mengganggu ujian yang sedang berlangsung. Isinya jawaban yang sudah tersimpan di server —
 * ketikan yang masih tertahan di antrean perangkat siswa (belum terkirim) memang belum terlihat di sini.
 * Kunci jawaban SENGAJA tidak ikut: layar ini untuk memantau pengerjaan, bukan mengoreksi. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const { id } = await params;
    const exam = await ujianDalamCakupan(session, id);
    if (!exam) return Response.json({ error: "Ujian tidak ditemukan" }, { status: 404 });
    const studentId = new URL(req.url).searchParams.get("studentId") ?? "";

    const [a, soal] = await Promise.all([
      prisma.examAttempt.findUnique({
        where: { examId_studentId: { examId: id, studentId } },
        select: {
          answers: true, submittedAt: true, lastSeenAt: true, terkunci: true, startedAt: true,
          student: { select: { nis: true, user: { select: { name: true } } } },
        },
      }),
      prisma.examQuestion.findMany({
        where: { examId: id },
        orderBy: { order: "asc" },
        select: { id: true, order: true, tipe: true, pertanyaan: true, opsi: true },
      }),
    ]);
    if (!a) return Response.json({ error: "Siswa ini belum pernah membuka ujian." }, { status: 404 });

    const jawaban = (a.answers ?? {}) as Record<string, unknown>;
    const butir = soal.map((q, i) => ({
      nomor: i + 1,
      tipe: q.tipe,
      pertanyaan: ringkasTeks(q.pertanyaan, 120),
      isi: bacaJawaban(q.tipe, q.opsi, jawaban[q.id]),
      terisi: terisi(jawaban[q.id]),
    }));

    return Response.json({
      siswa: a.student.user.name, nis: a.student.nis,
      mulai: a.startedAt, terakhirAktif: a.lastSeenAt, submitted: a.submittedAt, terkunci: a.terkunci,
      jumlahSoal: butir.length, terjawab: butir.filter(b => b.terisi).length,
      butir,
    });
  } catch (galat) {
    lemparBilaPengalihan(galat);
    return Response.json({ error: "Gagal memuat jawaban." }, { status: 500 });
  }
}

const terisi = (v: unknown) =>
  v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && !v.length) &&
  !(typeof v === "object" && !Array.isArray(v) && !Object.keys(v as object).length);

/** Buang tag HTML & rapikan spasi — layar pantau hanya butuh teks pendek. */
function ringkasTeks(html: string, maks: number) {
  const t = String(html ?? "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  return t.length > maks ? `${t.slice(0, maks)}…` : t;
}

/** Ubah jawaban tersimpan menjadi teks yang bisa dibaca pengawas, sesuai jenis soalnya. */
function bacaJawaban(tipe: string, opsi: unknown, j: unknown): string {
  if (!terisi(j)) return "";
  const daftar = Array.isArray(opsi) ? (opsi as { kode?: string; teks?: string }[]) : [];
  const teksOpsi = (kode: string) => {
    const o = daftar.find(x => x.kode === kode);
    return o?.teks ? `${kode}. ${ringkasTeks(o.teks, 60)}` : kode;
  };
  switch (tipe) {
    case "PG":
    case "BENAR_SALAH":
      return typeof j === "string" ? teksOpsi(j) : String(j);
    case "PG_KOMPLEKS":
      return Array.isArray(j) ? j.map(k => teksOpsi(String(k))).join(" · ") : String(j);
    case "MENJODOHKAN":
      return typeof j === "object" ? Object.entries(j as Record<string, string>).map(([k, v]) => `${k}→${v}`).join(" · ") : String(j);
    case "ISIAN_SINGKAT":
    case "URAIAN":
      return String(j);
    case "LISAN":
      return "🎤 Rekaman suara terkirim";
    case "UNGGAH":
      return "📎 Berkas terunggah";
    case "URUTKAN":
      return Array.isArray(j) ? j.map(String).join(" → ") : String(j);
    case "TITIK_GAMBAR":
    case "SERET_LEPAS":
      return Array.isArray(j) ? `${j.length} titik/label ditempatkan` : "Sudah dijawab";
    default:
      return typeof j === "string" ? j : JSON.stringify(j);
  }
}
