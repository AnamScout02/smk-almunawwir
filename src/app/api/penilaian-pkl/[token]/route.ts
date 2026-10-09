import { prisma } from "@/lib/prisma";
import { sinkronLatar, siswaDiDudi } from "@/lib/pkl-server";
import { ASPEK_PKL, hashToken } from "@/lib/pkl-humas";
import { checkRateLimit, getClientIpFromHeaders } from "@/lib/rate-limit";
import { getSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

/** PENILAIAN PEMBIMBING INDUSTRI (publik, tanpa akun) — hanya lewat token rahasia yang masih berlaku. */
async function ambil(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const pkl = await prisma.internship.findUnique({
    where: { tokenPenilaianHash: hashToken(token) },
    select: {
      id: true, company: true, position: true, supervisor: true, startDate: true, endDate: true, tokenPenilaianSampai: true,
      nilaiIndustri: true, catatanIndustri: true, penilaiIndustri: true, nilaiIndustriPada: true,
      student: { select: { user: { select: { name: true } }, class: { select: { name: true } }, major: { select: { name: true } } } },
    },
  });
  if (!pkl || !pkl.tokenPenilaianSampai || pkl.tokenPenilaianSampai < new Date()) return null;
  return pkl;
}

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!checkRateLimit(`penilaian-pkl-get:${getClientIpFromHeaders(req.headers)}`, 60, 600_000)) return Response.json({ error: "Terlalu banyak permintaan." }, { status: 429 });
  const { token } = await params;
  const pkl = await ambil(token);
  if (!pkl) return Response.json({ error: "Tautan penilaian tidak berlaku atau sudah kedaluwarsa. Hubungi guru pembimbing." }, { status: 404 });
  const s = await getSettings(["school.name"]);
  return Response.json({
    sekolah: s["school.name"] || "SMK Al-Munawwir IIBS",
    siswa: pkl.student.user.name, kelas: pkl.student.class?.name ?? "", jurusan: pkl.student.major?.name ?? "",
    perusahaan: pkl.company, posisi: pkl.position, pembimbing: pkl.supervisor, mulai: pkl.startDate, selesai: pkl.endDate,
    berlakuSampai: pkl.tokenPenilaianSampai, aspek: ASPEK_PKL,
    nilai: pkl.nilaiIndustri, catatan: pkl.catatanIndustri, penilai: pkl.penilaiIndustri, diisiPada: pkl.nilaiIndustriPada,
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!checkRateLimit(`penilaian-pkl-post:${getClientIpFromHeaders(req.headers)}`, 20, 600_000)) return Response.json({ error: "Terlalu banyak percobaan." }, { status: 429 });
  const { token } = await params;
  const pkl = await ambil(token);
  if (!pkl) return Response.json({ error: "Tautan penilaian tidak berlaku atau sudah kedaluwarsa." }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  const nilai: Record<string, number> = {};
  for (const a of ASPEK_PKL) {
    const n = Math.round(Number(b.nilai?.[a.kunci]));
    if (!(n >= 0 && n <= 100)) return Response.json({ error: `Nilai "${a.label}" harus 0–100.` }, { status: 400 });
    nilai[a.kunci] = n;
  }
  const penilai = String(b.penilai ?? "").trim().slice(0, 120);
  if (penilai.length < 3) return Response.json({ error: "Tulis nama penilai." }, { status: 400 });
  const rata = Math.round((Object.values(nilai).reduce((x, y) => x + y, 0) / ASPEK_PKL.length) * 10) / 10;
  await prisma.internship.update({
    where: { id: pkl.id },
    data: { nilaiIndustri: nilai, nilaiIndustriRata: rata, penilaiIndustri: penilai, catatanIndustri: String(b.catatan ?? "").trim().slice(0, 2000) || null, nilaiIndustriPada: new Date() },
  });
  sinkronLatar(() => prisma.internship.findUnique({ where: { id: pkl.id }, select: { studentId: true } }).then(x => (x ? [x.studentId] : [])));
  return Response.json({ ok: true, rata });
}
