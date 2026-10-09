import { prisma } from "@/lib/prisma";
import { ASPEK_PKL, hashToken } from "@/lib/pkl-humas";
import { checkRateLimit, getClientIpFromHeaders } from "@/lib/rate-limit";
import { getSettings } from "@/lib/site-settings";
import { kirimLatar, kirimNotifikasi } from "@/lib/push-server";
import { penerimaLaporan } from "@/lib/pkl-server";
import { JENIS_LAPORAN } from "@/lib/pkl-label";

export const dynamic = "force-dynamic";

/** PORTAL INDUSTRI (9 Okt 2026) — satu tautan rahasia per DUDI, tanpa akun: siswa yang ditempatkan di sana,
 *  presensi harian, paraf jurnal, nilai akhir, dan lapor masalah ke sekolah. Yang terlihat HANYA siswa yang sedang /
 *  pernah selesai PKL di DUDI itu, dan hanya data yang memang perlu pembimbing industri (tanpa NIS, alamat, atau kontak siswa). */
async function dudiDari(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  return prisma.industryPartner.findFirst({ where: { tokenPortalHash: hashToken(token), aktif: true }, select: { id: true, name: true } });
}
const hariWib = () => new Date(new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10) + "T00:00:00Z");
const nama = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 120) : "");

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!checkRateLimit(`portal-dudi-get:${getClientIpFromHeaders(req.headers)}`, 120, 600_000)) return Response.json({ error: "Terlalu banyak permintaan." }, { status: 429 });
  const { token } = await params;
  const dudi = await dudiDari(token);
  if (!dudi) return Response.json({ error: "Tautan portal tidak berlaku. Minta tautan baru ke Humas sekolah." }, { status: 404 });
  const hari = hariWib(), tigaPuluh = new Date(hari.getTime() - 30 * 86_400_000);
  const [pkl, s] = await Promise.all([
    prisma.internship.findMany({
      where: { mitraId: dudi.id, status: { in: ["ONGOING", "COMPLETED"] } },
      orderBy: { student: { user: { name: "asc" } } },
      select: {
        id: true, position: true, startDate: true, endDate: true, status: true, nilaiIndustri: true, nilaiIndustriRata: true, catatanIndustri: true, penilaiIndustri: true,
        student: { select: { user: { select: { name: true } }, class: { select: { name: true } }, major: { select: { name: true } } } },
        teacher: { select: { user: { select: { name: true } } } },
        presensi: { where: { tanggal: { gte: tigaPuluh } }, select: { tanggal: true, status: true } },
        journal: { where: { parafIndustriAt: null }, orderBy: { date: "desc" }, take: 31, select: { id: true, date: true, activity: true, photoUrl: true, fotoTerverifikasi: true, kompetensi: true } },
      },
    }),
    getSettings(["school.name"]),
  ]);
  return Response.json({
    dudi: dudi.name, sekolah: s["school.name"] || "SMK Al-Munawwir IIBS", hariIni: hari.toISOString().slice(0, 10), aspek: ASPEK_PKL, jenisLaporan: JENIS_LAPORAN,
    siswa: pkl.map(p => ({
      id: p.id, nama: p.student.user.name, kelas: p.student.class?.name ?? "", jurusan: p.student.major?.name ?? "", posisi: p.position === "—" ? "" : p.position,
      mulai: p.startDate, selesai: p.endDate, status: p.status, guru: p.teacher?.user.name ?? null,
      presensiHariIni: p.presensi.find(x => x.tanggal.getTime() === hari.getTime())?.status ?? "",
      rekap: Object.fromEntries(["HADIR", "IZIN", "SAKIT", "ALPHA"].map(k => [k, p.presensi.filter(x => x.status === k).length])),
      jurnal: p.journal, nilai: p.nilaiIndustri, rata: p.nilaiIndustriRata, catatan: p.catatanIndustri, penilai: p.penilaiIndustri,
    })),
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!checkRateLimit(`portal-dudi-post:${getClientIpFromHeaders(req.headers)}`, 120, 600_000)) return Response.json({ error: "Terlalu banyak percobaan." }, { status: 429 });
  const { token } = await params;
  const dudi = await dudiDari(token);
  if (!dudi) return Response.json({ error: "Tautan portal tidak berlaku." }, { status: 404 });
  const b = await req.json().catch(() => ({})) as Record<string, unknown>;
  const oleh = nama(b.nama);
  if (oleh.length < 3) return Response.json({ error: "Tulis nama Anda dulu (minimal 3 huruf)." }, { status: 400 });
  // Setiap tindakan hanya boleh menyentuh siswa yang MEMANG ditempatkan di DUDI pemilik tautan ini.
  const milik = async (id: unknown) => typeof id === "string"
    ? prisma.internship.findFirst({ where: { id, mitraId: dudi.id, status: { in: ["ONGOING", "COMPLETED"] } }, select: { id: true, company: true, teacher: { select: { userId: true } }, student: { select: { user: { select: { name: true } } } } } })
    : null;

  if (b.aksi === "presensi") {
    const p = await milik(b.internshipId);
    const status = ["HADIR", "IZIN", "SAKIT", "ALPHA"].includes(b.status as string) ? (b.status as string) : "";
    if (!p || !status) return Response.json({ error: "Siswa atau status tidak sah." }, { status: 400 });
    const tanggal = hariWib(); // hanya HARI INI — presensi hari lampau dikoreksi sekolah, bukan lewat tautan
    await prisma.presensiPkl.upsert({
      where: { internshipId_tanggal: { internshipId: p.id, tanggal } },
      create: { internshipId: p.id, tanggal, status, metode: "INDUSTRI", keterangan: `oleh ${oleh}`, jamMasuk: status === "HADIR" ? new Date() : null },
      update: { status, metode: "INDUSTRI", keterangan: `oleh ${oleh}` },
    });
    return Response.json({ ok: true });
  }

  if (b.aksi === "paraf") {
    const ids = Array.isArray(b.jurnalIds) ? b.jurnalIds.filter((x): x is string => typeof x === "string").slice(0, 100) : [];
    if (!ids.length) return Response.json({ error: "Tidak ada jurnal yang dipilih." }, { status: 400 });
    const r = await prisma.internshipJournal.updateMany({
      where: { id: { in: ids }, parafIndustriAt: null, internship: { mitraId: dudi.id } },
      data: { parafIndustriAt: new Date(), parafIndustriNama: oleh },
    });
    return Response.json({ ok: true, diparaf: r.count });
  }

  if (b.aksi === "nilai") {
    const p = await milik(b.internshipId);
    if (!p) return Response.json({ error: "Siswa tidak ditemukan." }, { status: 400 });
    const masuk = (b.nilai ?? {}) as Record<string, unknown>, nilai: Record<string, number> = {};
    for (const a of ASPEK_PKL) {
      const n = Math.round(Number(masuk[a.kunci]));
      if (!(n >= 0 && n <= 100) || masuk[a.kunci] === "" || masuk[a.kunci] == null) return Response.json({ error: `Nilai "${a.label}" harus 0–100.` }, { status: 400 });
      nilai[a.kunci] = n;
    }
    const rata = Math.round((Object.values(nilai).reduce((x, y) => x + y, 0) / ASPEK_PKL.length) * 10) / 10;
    await prisma.internship.update({
      where: { id: p.id },
      data: { nilaiIndustri: nilai, nilaiIndustriRata: rata, penilaiIndustri: oleh, catatanIndustri: (typeof b.catatan === "string" ? b.catatan.trim().slice(0, 2000) : "") || null, nilaiIndustriPada: new Date() },
    });
    return Response.json({ ok: true, rata });
  }

  if (b.aksi === "lapor") {
    const p = await milik(b.internshipId);
    const jenis = typeof b.jenis === "string" && JENIS_LAPORAN[b.jenis] ? b.jenis : "";
    const isi = typeof b.isi === "string" ? b.isi.trim().slice(0, 2000) : "";
    if (!p || !jenis || isi.length < 10) return Response.json({ error: "Pilih siswa dan jenis masalah, lalu jelaskan minimal 10 huruf." }, { status: 400 });
    if (!checkRateLimit(`portal-dudi-lapor:${dudi.id}`, 20, 86_400_000)) return Response.json({ error: "Terlalu banyak laporan hari ini. Hubungi sekolah langsung." }, { status: 429 });
    const l = await prisma.laporanPkl.create({ data: { internshipId: p.id, pelapor: "INDUSTRI", pelaporNama: `${oleh} (${dudi.name})`, jenis, isi } });
    kirimLatar(async () => kirimNotifikasi({
      userIds: await penerimaLaporan(p.teacher?.userId), jenis: "PKL", kunci: `pkl-laporan:${l.id}`,
      judul: `Laporan dari DUDI: ${JENIS_LAPORAN[jenis]}`, isi: `${p.student.user.name} (${dudi.name}) — ${isi.slice(0, 120)}`, url: "/pkl/laporan",
    }));
    return Response.json({ ok: true });
  }
  return Response.json({ error: "Aksi tidak dikenal." }, { status: 400 });
}
