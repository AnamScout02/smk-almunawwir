import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { bacaAgendaPkl } from "@/lib/pkl-agenda";
import { ASPEK_UMPAN, RADIUS_DI_LOKASI, hariPkl, jarakMeter, umpanTerbuka } from "@/lib/pkl-harian";

export const dynamic = "force-dynamic";

async function pklSaya(email: string) {
  const s = await prisma.student.findFirst({
    where: { user: { email } },
    select: { internship: { select: {
      id: true, status: true, startDate: true, endDate: true, mitraId: true,
      laporanAkhirUrl: true, laporanAkhirStatus: true, laporanAkhirCatatan: true, laporanAkhirPada: true, umpanBalik: true, umpanBalikPada: true,
      mitra: { select: { lat: true, lng: true } },
      teacher: { select: { phone: true, user: { select: { name: true } } } },
    } } },
  });
  return s?.internship ?? null;
}
const sedangPkl = (p: { status: string; startDate: Date; endDate: Date; mitraId: string | null }, hari: Date) =>
  p.status === "ONGOING" && !!p.mitraId && p.startDate <= hari && p.endDate >= hari;

/** Keadaan harian PKL siswa: presensi hari ini, rekap 30 hari, laporan akhir, dan umpan balik tentang tempat PKL. */
export async function GET() {
  try {
    const session = await verifyRole(["STUDENT"]);
    const p = await pklSaya(session.email);
    if (!p) return Response.json({ pkl: null });
    const hari = hariPkl();
    const presensi = await prisma.presensiPkl.findMany({
      where: { internshipId: p.id, tanggal: { gte: new Date(hari.getTime() - 29 * 86_400_000) } }, orderBy: { tanggal: "desc" },
      select: { tanggal: true, status: true, jamMasuk: true, jamPulang: true, jarakMeter: true, metode: true },
    });
    const hariTeks = hari.toISOString().slice(0, 10);
    const agenda = (await bacaAgendaPkl()).filter(a => a.untuk === "SEMUA" && a.tanggal >= hariTeks).slice(0, 6).map(({ tanggal, judul, ket }) => ({ tanggal, judul, ket }));
    return Response.json({
      agenda, guru: p.teacher ? { nama: p.teacher.user.name, telp: p.teacher.phone } : null,
      pkl: { sedang: sedangPkl(p, hari), punyaTitik: p.mitra?.lat != null && p.mitra?.lng != null, status: p.status },
      hariIni: presensi.find(x => x.tanggal.getTime() === hari.getTime()) ?? null,
      rekap: Object.fromEntries(["HADIR", "IZIN", "SAKIT", "ALPHA"].map(k => [k, presensi.filter(x => x.status === k).length])),
      riwayat: presensi.slice(0, 7),
      laporan: { url: p.laporanAkhirUrl, status: p.laporanAkhirStatus, catatan: p.laporanAkhirCatatan, pada: p.laporanAkhirPada },
      umpan: { terbuka: umpanTerbuka(p), isi: p.umpanBalik, pada: p.umpanBalikPada, aspek: ASPEK_UMPAN },
    });
  } catch (e) { lemparBilaPengalihan(e); return Response.json({ error: "Gagal memuat data PKL." }, { status: 500 }); }
}

export async function POST(req: Request) {
  try {
    const session = await verifyRole(["STUDENT"]);
    const p = await pklSaya(session.email);
    if (!p) return Response.json({ error: "Anda belum terdaftar sebagai peserta PKL." }, { status: 404 });
    const b = await req.json().catch(() => ({})) as Record<string, unknown>;
    const hari = hariPkl(), kini = new Date();

    // ── PRESENSI: masuk / pulang (dengan lokasi HP) atau izin / sakit ──────────────────────────────────────────
    if (b.aksi === "masuk" || b.aksi === "pulang" || b.aksi === "izin" || b.aksi === "sakit") {
      if (!sedangPkl(p, hari)) return Response.json({ error: "Presensi hanya dibuka selama masa PKL di tempat yang sudah ditetapkan." }, { status: 409 });
      const ada = await prisma.presensiPkl.findUnique({ where: { internshipId_tanggal: { internshipId: p.id, tanggal: hari } } });
      // Yang sudah dicatat pembimbing industri / guru TIDAK ditimpa siswa (aturan sama dengan absensi sekolah, CLAUDE.md #33).
      if (ada && ada.metode !== "LOKASI" && ada.metode !== "SISWA" && ada.status !== "HADIR") {
        return Response.json({ error: `Hari ini sudah dicatat ${ada.status.toLowerCase()} oleh ${ada.metode === "INDUSTRI" ? "pembimbing industri" : "sekolah"}. Hubungi guru pembimbing bila keliru.` }, { status: 409 });
      }
      if (b.aksi === "izin" || b.aksi === "sakit") {
        const ket = typeof b.keterangan === "string" ? b.keterangan.trim().slice(0, 300) : "";
        if (ket.length < 5) return Response.json({ error: "Tulis keterangannya (minimal 5 huruf)." }, { status: 400 });
        if (ada?.jamMasuk) return Response.json({ error: "Hari ini kamu sudah presensi masuk." }, { status: 409 });
        const status = b.aksi === "izin" ? "IZIN" : "SAKIT";
        await prisma.presensiPkl.upsert({
          where: { internshipId_tanggal: { internshipId: p.id, tanggal: hari } },
          create: { internshipId: p.id, tanggal: hari, status, metode: "SISWA", keterangan: ket },
          update: { status, metode: "SISWA", keterangan: ket },
        });
        return Response.json({ ok: true });
      }
      const sah = typeof b.lat === "number" && typeof b.lng === "number" && Math.abs(b.lat) <= 90 && Math.abs(b.lng) <= 180;
      const lat = sah ? (b.lat as number) : null, lng = sah ? (b.lng as number) : null;
      const jarak = lat != null && lng != null && p.mitra?.lat != null && p.mitra.lng != null ? jarakMeter(lat, lng, p.mitra.lat, p.mitra.lng) : null;
      if (b.aksi === "masuk") {
        if (ada?.jamMasuk && ada.metode === "LOKASI") return Response.json({ error: "Presensi masuk hari ini sudah tercatat." }, { status: 409 });
        await prisma.presensiPkl.upsert({
          where: { internshipId_tanggal: { internshipId: p.id, tanggal: hari } },
          create: { internshipId: p.id, tanggal: hari, status: "HADIR", metode: "LOKASI", jamMasuk: kini, lat, lng, jarakMeter: jarak },
          // Sudah dihadirkan pembimbing industri → metode-nya dibiarkan, siswa hanya menambah jam & lokasi.
          update: { status: "HADIR", jamMasuk: ada?.jamMasuk ?? kini, lat, lng, jarakMeter: jarak, ...(ada?.metode === "SISWA" ? { metode: "LOKASI", keterangan: null } : {}) },
        });
      } else {
        if (!ada?.jamMasuk) return Response.json({ error: "Presensi masuk dulu sebelum presensi pulang." }, { status: 409 });
        if (kini.getTime() - ada.jamMasuk.getTime() < 60 * 60_000) return Response.json({ error: "Presensi pulang baru bisa minimal 1 jam setelah masuk." }, { status: 409 });
        await prisma.presensiPkl.update({ where: { id: ada.id }, data: { jamPulang: kini } });
      }
      return Response.json({ ok: true, jarak, diLokasi: jarak != null ? jarak <= RADIUS_DI_LOKASI : null });
    }

    // ── LAPORAN AKHIR ─────────────────────────────────────────────────────────────────────────────────────────
    if (b.aksi === "laporan") {
      const url = typeof b.url === "string" && b.url.startsWith("/api/uploads/pkl-jurnal/") ? b.url : "";
      if (!url) return Response.json({ error: "Unggah berkas laporannya dulu." }, { status: 400 });
      if (p.status === "CANCELLED" || !p.mitraId) return Response.json({ error: "Laporan akhir dikirim setelah kamu ditempatkan di tempat PKL." }, { status: 409 });
      if (p.laporanAkhirStatus === "DISETUJUI") return Response.json({ error: "Laporan akhirmu sudah disetujui." }, { status: 409 });
      await prisma.internship.update({ where: { id: p.id }, data: { laporanAkhirUrl: url, laporanAkhirStatus: "DIKIRIM", laporanAkhirPada: kini } });
      return Response.json({ ok: true });
    }

    // ── UMPAN BALIK tentang tempat PKL ───────────────────────────────────────────────────────────────────────
    if (b.aksi === "umpan") {
      if (!umpanTerbuka(p)) return Response.json({ error: "Umpan balik dibuka menjelang PKL selesai." }, { status: 409 });
      const angka = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5 ? v : 0);
      const aspekMasuk = (b.aspek ?? {}) as Record<string, unknown>;
      const aspek = Object.fromEntries(ASPEK_UMPAN.map(a => [a.kunci, angka(aspekMasuk[a.kunci])]));
      const bintang = angka(b.bintang);
      if (!bintang || Object.values(aspek).some(v => !v)) return Response.json({ error: "Beri bintang untuk semua pertanyaan." }, { status: 400 });
      const saran = typeof b.saran === "string" ? b.saran.trim().slice(0, 1000) : "";
      await prisma.internship.update({ where: { id: p.id }, data: { umpanBalik: { bintang, aspek, saran, rekomendasi: b.rekomendasi === true }, umpanBalikPada: kini } });
      return Response.json({ ok: true });
    }
    return Response.json({ error: "Aksi tidak dikenali." }, { status: 400 });
  } catch (e) { lemparBilaPengalihan(e); return Response.json({ error: "Gagal menyimpan." }, { status: 500 }); }
}
