import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

/** Kolom `tanggal` bertipe DATE (tanpa jam). Server berjalan pada zona UTC sedangkan sekolah di
 * WIB, jadi tanggal SELALU dibentuk eksplisit di tengah malam UTC dari string "YYYY-MM-DD" yang
 * dikirim klien — JANGAN pakai `new Date()` di server untuk menentukan "hari ini", karena antara
 * pukul 00.00–07.00 WIB itu masih tanggal kemarin menurut UTC. */
const tanggalUtc = (s: string) => new Date(`${s}T00:00:00.000Z`);
const isTanggal = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Daftar pegawai = semua akun berperan TEACHER/TAS yang masih aktif. Sengaja berbasis `User`,
 * bukan `Teacher`: staf non-guru (security, kebersihan, pustakawan) tidak punya baris Teacher
 * tapi tetap wajib presensi. */
async function daftarPegawai() {
  const users = await prisma.user.findMany({
    where: { role: { in: ["TEACHER", "TAS"] } },
    select: {
      id: true, name: true, role: true,
      teacher: { select: { nip: true, position: true, teacherStatus: true } },
      staffJabatan: { select: { jabatan: { select: { name: true } } } },
    },
    orderBy: { name: "asc" },
  });
  return users
    .filter(u => u.teacher?.teacherStatus !== "KELUAR" && u.teacher?.teacherStatus !== "PENSIUN")
    .map(u => ({
      userId: u.id,
      nama: u.name,
      role: u.role,
      nip: u.teacher?.nip ?? null,
      position: u.teacher?.position ?? null,
      jabatan: u.staffJabatan.map(j => j.jabatan.name),
    }));
}

export async function GET(req: Request) {
  try {
    await verifyTasAccess();
    const q = new URL(req.url).searchParams;
    const date = q.get("date");
    const month = q.get("month");

    // Mode rekap bulanan: satu baris per pegawai + hitungan tiap status.
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split("-").map(Number);
      const [pegawai, rows] = await Promise.all([
        daftarPegawai(),
        prisma.staffAttendance.findMany({
          where: {
            tanggal: { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) },
          },
          orderBy: { tanggal: "asc" },
        }),
      ]);
      return Response.json({ mode: "rekap", pegawai, rows });
    }

    // Mode harian: daftar pegawai + presensi yang sudah tercatat pada tanggal itu.
    if (!isTanggal(date)) return Response.json({ error: "Tanggal tidak valid." }, { status: 400 });
    const hari = tanggalUtc(date);
    const besok = new Date(hari.getTime() + 86400000);
    const [pegawai, rows, blok] = await Promise.all([
      daftarPegawai(),
      prisma.staffAttendance.findMany({ where: { tanggal: hari } }),
      // Catatan guru piket per jam pelajaran pada tanggal yang sama — dipakai menyusun USULAN
      // (lihat di bawah). Tidak pernah ditulis otomatis ke StaffAttendance.
      prisma.teacherScheduleAttendance.findMany({
        where: { date: { gte: hari, lt: besok } },
        select: { status: true, schedule: { select: { teacher: { select: { userId: true } } } } },
      }).catch(() => []),
    ]);

    // USULAN DARI BUKU PIKET (rancangan 18 Sep 2026): guru yang SELURUH jam mengajarnya hari itu
    // dicatat ALPHA oleh piket, sementara TU belum mencatat apa pun. Mesin hanya mengusulkan —
    // TU yang memutuskan dengan satu klik, sama seperti aturan pindaian kartu (CLAUDE.md #33).
    const sudahDicatat = new Set(rows.map(r => r.userId));
    const perGuru = new Map<string, { total: number; alpha: number }>();
    for (const b2 of blok) {
      const uid = b2.schedule.teacher?.userId;
      if (!uid) continue;
      const a = perGuru.get(uid) ?? { total: 0, alpha: 0 };
      a.total += 1;
      if (b2.status === "ALPHA") a.alpha += 1;
      perGuru.set(uid, a);
    }
    const usulan = [...perGuru.entries()]
      .filter(([uid, a]) => !sudahDicatat.has(uid) && a.total > 0 && a.alpha === a.total)
      .map(([userId, a]) => ({ userId, status: "ALPHA", jam: a.total, alasan: `Guru piket mencatat ALPHA di seluruh ${a.total} jam mengajarnya` }));

    return Response.json({ mode: "harian", tanggal: date, pegawai, rows, usulan });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal memuat presensi pegawai" }, { status: 500 });
  }
}

/** Simpan presensi satu hari sekaligus. Baris yang statusnya dikosongkan akan DIHAPUS, bukan
 * disimpan sebagai string kosong — aturan tetap aplikasi ini: status kehadiran tidak boleh punya
 * nilai default tersembunyi (lihat CLAUDE.md gotcha #10). */
export async function POST(req: Request) {
  try {
    const session = await verifyTasAccess();
    const b = await req.json();
    if (!isTanggal(b.tanggal)) return Response.json({ error: "Tanggal tidak valid." }, { status: 400 });
    const tanggal = tanggalUtc(b.tanggal);
    const entries: { userId: string; status?: string; jamMasuk?: string; jamPulang?: string; keterangan?: string }[] =
      Array.isArray(b.entries) ? b.entries : [];

    const isi = entries.filter(e => e.userId && e.status);
    const kosong = entries.filter(e => e.userId && !e.status).map(e => e.userId);

    // ASAL catatan (src/lib/presensi-turunan.ts): layar TU mengirim SELURUH baris hari itu, termasuk yang berasal dari
    // pindaian/turunan dan tidak disentuh. Baris yang isinya tidak berubah mempertahankan asalnya; yang diubah TU menjadi "TU".
    const lama = new Map((await prisma.staffAttendance.findMany({ where: { tanggal, userId: { in: isi.map(e => e.userId) } } })).map(r => [r.userId, r]));
    const tetap = (e: (typeof isi)[number]) => {
      const l = lama.get(e.userId);
      return !!l && l.status === e.status && (l.jamMasuk ?? "") === (e.jamMasuk || "") && (l.jamPulang ?? "") === (e.jamPulang || "") && (l.keterangan ?? "") === (e.keterangan?.trim() || "");
    };

    await prisma.$transaction([
      ...(kosong.length
        ? [prisma.staffAttendance.deleteMany({ where: { tanggal, userId: { in: kosong } } })]
        : []),
      ...isi.map(e =>
        prisma.staffAttendance.upsert({
          where: { userId_tanggal: { userId: e.userId, tanggal } },
          create: {
            userId: e.userId, tanggal, status: e.status!,
            jamMasuk: e.jamMasuk || null, jamPulang: e.jamPulang || null,
            keterangan: e.keterangan?.trim() || null, recordedById: session.userId, sumber: "TU",
          },
          update: tetap(e) ? {} : {
            status: e.status!,
            jamMasuk: e.jamMasuk || null, jamPulang: e.jamPulang || null,
            keterangan: e.keterangan?.trim() || null, recordedById: session.userId,
            sumber: "TU", pulangPerkiraan: (lama.get(e.userId)?.pulangPerkiraan ?? false) && (lama.get(e.userId)?.jamPulang ?? "") === (e.jamPulang || ""),
          },
        }),
      ),
    ]);

    const rows = await prisma.staffAttendance.findMany({ where: { tanggal } });
    return Response.json({ ok: true, tersimpan: isi.length, dihapus: kosong.length, rows });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal menyimpan presensi pegawai." }, { status: 500 });
  }
}
