import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertJabatan } from "@/lib/jabatan-guard";
import { hitungRisikoSiswa } from "@/lib/peringatan-dini";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

const ALPHA_WATCH_THRESHOLD = 3;

export async function GET() {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    await assertJabatan(session, ["Wakil Kepala Kesiswaan"]);

    const since = new Date();
    since.setDate(since.getDate() - 30);

    const students = await prisma.student.findMany({
      where: { studentStatus: "AKTIF" },
      select: {
        id: true, nis: true,
        user: { select: { name: true } },
        class: { select: { name: true } },
        attendance: { where: { date: { gte: since } }, select: { status: true, date: true } },
      },
    });

    const statusCount = { HADIR: 0, IZIN: 0, SAKIT: 0, ALPHA: 0 };
    for (const s of students) {
      for (const a of s.attendance) {
        if (a.status in statusCount) statusCount[a.status as keyof typeof statusCount]++;
      }
    }
    const totalRecords = statusCount.HADIR + statusCount.IZIN + statusCount.SAKIT + statusCount.ALPHA;
    const attendanceRate = totalRecords > 0 ? Math.round((statusCount.HADIR / totalRecords) * 100) : null;

    const byClass = new Map<string, { hadir: number; total: number }>();
    for (const s of students) {
      const className = s.class?.name ?? "Tanpa Kelas";
      const entry = byClass.get(className) ?? { hadir: 0, total: 0 };
      entry.total += s.attendance.length;
      entry.hadir += s.attendance.filter(a => a.status === "HADIR").length;
      byClass.set(className, entry);
    }
    const classRanking = Array.from(byClass.entries())
      .filter(([, v]) => v.total > 0)
      .map(([className, v]) => ({ className, rate: Math.round((v.hadir / v.total) * 100) }))
      .sort((a, b) => a.rate - b.rate);

    const watchList = students
      .map(s => ({
        studentId: s.id, nis: s.nis, name: s.user.name, className: s.class?.name ?? "—",
        alphaCount: s.attendance.filter(a => a.status === "ALPHA").length,
      }))
      .filter(s => s.alphaCount >= ALPHA_WATCH_THRESHOLD)
      .sort((a, b) => b.alphaCount - a.alphaCount);

    // ── Tambahan 18 Sep 2026 (temuan user: "dashboard kesiswaan cuma sedikit isinya") ──────────
    // Poin & prestasi 30 hari, izin/sakit yang menunggu keputusan, peringatan dini, tren alpha 14 hari,
    // dan kegiatan kesiswaan terdekat — semuanya dari data yang sudah ada.
    const [poin, izinMenunggu, konselingBaru, risiko, kegiatan] = await Promise.all([
      prisma.studentPointRecord.findMany({
        where: { date: { gte: since } },
        select: { kind: true, points: true, violationType: { select: { name: true } }, achievementType: { select: { name: true } } },
      }).catch(() => []),
      prisma.izinSiswa.count({ where: { status: "MENUNGGU" } }).catch(() => 0),
      prisma.janjiKonseling.count({ where: { status: "MENUNGGU" } }).catch(() => 0),
      hitungRisikoSiswa().catch(() => null),
      prisma.kegiatan.findMany({
        where: { mulai: { gte: new Date() } }, orderBy: { mulai: "asc" }, take: 5,
        select: { id: true, judul: true, jenis: true, mulai: true, tempat: true },
      }).catch(() => []),
    ]);

    const pelanggaran = poin.filter(p => p.kind === "PELANGGARAN");
    const prestasi = poin.filter(p => p.kind === "PRESTASI");
    const hitungJenis = new Map<string, number>();
    for (const p of pelanggaran) {
      const nama = p.violationType?.name ?? "Lainnya";
      hitungJenis.set(nama, (hitungJenis.get(nama) ?? 0) + 1);
    }
    const topPelanggaran = Array.from(hitungJenis.entries()).map(([nama, jumlah]) => ({ nama, jumlah })).sort((a, b) => b.jumlah - a.jumlah).slice(0, 6);

    // Tren alpha 14 hari terakhir (dihitung dari absensi yang sudah dimuat di atas).
    const alphaHarian = new Map<string, number>();
    for (const s of students) {
      for (const a of s.attendance) {
        if (a.status !== "ALPHA") continue;
        const kunci = a.date.toISOString().slice(0, 10);
        alphaHarian.set(kunci, (alphaHarian.get(kunci) ?? 0) + 1);
      }
    }
    const trenAlpha = Array.from(alphaHarian.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(-14)
      .map(([tanggal, jumlah]) => ({ tanggal, jumlah }));

    return Response.json({
      attendanceRate, totalAlpha: statusCount.ALPHA, watchListCount: watchList.length,
      statusCount, classRanking, watchList,
      pelanggaran30: pelanggaran.length, prestasi30: prestasi.length, topPelanggaran, trenAlpha,
      izinMenunggu, konselingBaru,
      risiko: risiko ? risiko.ringkas : null,
      kegiatan: kegiatan.map(k => ({ ...k, mulai: k.mulai.toISOString() })),
    });
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return Response.json({ error: "Khusus Wakil Kepala Kesiswaan." }, { status: 403 });
    }
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
