import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertPiketOrKesiswaanBk } from "@/lib/kesiswaan-guard";
import { bagianWib } from "@/lib/waktu-wib";
import { logActivity } from "@/lib/activity-log";
import { getJabatanNames } from "@/lib/jabatan-guard";
import { isOnDutyToday } from "@/lib/kedisiplinan-guard";
import { kirimNotifikasi, kirimLatar } from "@/lib/push-server";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

/** DASHBOARD PIKET HARIAN (17 Sep 2026): guru tidak hadir, siswa terlambat, izin keluar lingkungan, tamu, catatan laporan piket.
 * Petugas piket hari ini, Kesiswaan/BK, dan Admin.
 * GET = ringkasan hari ini · POST {aksi:"keluar", studentId, alasan, kembaliRencana} · POST {aksi:"kembali", kode (NIS/ID)}
 * · POST {aksi:"laporan", catatan}. */
async function penjaga() {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  await assertPiketOrKesiswaanBk(session);
  return session;
}

export async function GET() {
  try {
    const session = await penjaga();
    const w = bagianWib();
    const awal = new Date(`${w.iso}T00:00:00Z`), akhir = new Date(awal.getTime() + 86400000);
    const awalWib = new Date(awal.getTime() - 7 * 3600_000), akhirWib = new Date(akhir.getTime() - 7 * 3600_000);
    // Tautan cepat di halaman mengikuti hak akun: halaman kehadiran guru & jadwal piket khusus petugas piket hari ini / Penjamin Mutu.
    const jabatan = session.role === "ADMIN" ? [] : await getJabatanNames(session.email);
    const piketHariIni = session.role === "ADMIN" || (await isOnDutyToday(session.email).catch(() => false));
    const penjaminMutu = session.role === "ADMIN" || jabatan.some(j => j === "Wakil Kepala Bidang Penjamin Mutu" || j === "Wakil Kepala Kurikulum");
    // Jadwal Piket (roster) mengikuti assertDutyRosterAccess: jabatan, bukan giliran piket hari ini.
    const jadwalPiket = penjaminMutu || jabatan.includes("Guru Piket");
    const [guru, terlambat, izin, tamu, laporan] = await Promise.all([
      prisma.teacherScheduleAttendance.findMany({
        where: { date: { gte: awal, lt: akhir }, status: { not: "HADIR" } },
        select: { status: true, hasTugas: true, notes: true, schedule: { select: { startTime: true, endTime: true, subject: true, class: { select: { name: true } }, teacher: { select: { user: { select: { name: true } } } } } } },
        orderBy: { schedule: { startTime: "asc" } },
      }),
      prisma.studentPointRecord.findMany({
        where: { kind: "PELANGGARAN", date: { gte: awalWib, lt: akhirWib }, violationType: { name: { contains: "Terlambat", mode: "insensitive" } } },
        select: { points: true, date: true, student: { select: { nis: true, user: { select: { name: true } }, class: { select: { name: true } } } } },
        orderBy: { date: "asc" },
      }),
      prisma.izinKeluarSiswa.findMany({
        where: { keluarPada: { gte: awalWib, lt: akhirWib } },
        select: { id: true, alasan: true, keluarPada: true, kembaliRencana: true, kembaliPada: true, dicatatOleh: true, perluFoto: true, buktiFoto: true, buktiPada: true, student: { select: { nis: true, user: { select: { name: true } }, class: { select: { name: true } } } } },
        orderBy: { keluarPada: "desc" },
      }),
      prisma.guestBookEntry.count({ where: { visitDate: { gte: awal, lt: akhir } } }),
      prisma.laporanPiket.findUnique({ where: { tanggal: w.iso } }),
    ]);
    return Response.json({
      tanggal: w.iso, petugas: session.name, hak: { piketHariIni, penjaminMutu, jadwalPiket },
      guruTidakHadir: guru.map(g => ({
        guru: g.schedule.teacher?.user.name ?? "-", kelas: g.schedule.class.name, mapel: g.schedule.subject,
        jam: `${g.schedule.startTime}–${g.schedule.endTime}`, status: g.status, tugas: g.hasTugas, catatan: g.notes,
      })),
      terlambat: terlambat.map(t => ({ nama: t.student.user.name, nis: t.student.nis, kelas: t.student.class?.name ?? "-", poin: t.points, waktu: t.date })),
      izinKeluar: izin.map(i => ({ id: i.id, nama: i.student.user.name, nis: i.student.nis, kelas: i.student.class?.name ?? "-", alasan: i.alasan, keluar: i.keluarPada, rencana: i.kembaliRencana, kembali: i.kembaliPada, oleh: i.dicatatOleh, perluFoto: i.perluFoto, adaBukti: !!i.buktiFoto, buktiPada: i.buktiPada })),
      tamu, laporan: laporan?.catatan ?? "",
    });
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Khusus petugas piket hari ini, Kesiswaan/BK, dan Admin." }, { status: 403 });
    return Response.json({ error: "Gagal memuat." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await penjaga();
    const b = await req.json().catch(() => ({})) as Record<string, string | boolean>;
    if (b.aksi === "keluar") {
      const alasan = String(b.alasan ?? "").trim().slice(0, 300);
      const studentId = String(b.studentId ?? "");
      const rencana = String(b.kembaliRencana ?? "");
      if (!studentId || alasan.length < 3) return Response.json({ error: "Pilih siswa dan tulis alasan keluar." }, { status: 400 });
      const siswa = await prisma.student.findFirst({ where: { id: studentId, studentStatus: "AKTIF" }, select: { id: true, user: { select: { id: true, name: true } } } });
      if (!siswa) return Response.json({ error: "Siswa tidak ditemukan." }, { status: 404 });
      const masih = await prisma.izinKeluarSiswa.findFirst({ where: { studentId: siswa.id, kembaliPada: null, keluarPada: { gte: new Date(Date.now() - 12 * 3600_000) } } });
      if (masih) return Response.json({ error: `${siswa.user.name} masih tercatat di luar sekolah.` }, { status: 409 });
      // Perlu bukti foto dari tempat tujuan? Keputusan guru piket, DIPILIH SEBELUM dicatat keluar
      // (30 Sep 2026) — kalau tidak, di portal siswa izin ini cuma jadi surat izin keluar untuk
      // ditunjukkan ke petugas keamanan. WAJIB eksplisit: tanpa ini nilai kosong diam-diam menjadi
      // "tidak perlu bukti", persoalan default-diam-diam yang sama seperti dropdown kehadiran.
      const pilihanFoto = b.perluFoto;
      if (pilihanFoto !== true && pilihanFoto !== false && pilihanFoto !== "true" && pilihanFoto !== "false") {
        return Response.json({ error: "Pilih dulu perlu bukti foto dari tempat tujuan atau tidak." }, { status: 400 });
      }
      const perluFoto = pilihanFoto === true || pilihanFoto === "true";
      const baris = await prisma.izinKeluarSiswa.create({
        data: {
          studentId: siswa.id, alasan, perluFoto,
          kembaliRencana: /^\d{2}:\d{2}$/.test(rencana) ? rencana : null,
          dicatatOleh: session.name, dicatatId: session.userId,
        },
        select: { id: true },
      });
      await logActivity(session, { action: "IZIN_KELUAR_SISWA", entity: "IzinKeluarSiswa", entityId: siswa.id, description: `Izin keluar ${siswa.user.name}: ${alasan}${perluFoto ? " (wajib bukti foto)" : ""}` }).catch(() => {});
      // Siswa perlu tahu suratnya sudah bisa ditunjukkan — push tidak boleh memperlambat simpan.
      kirimLatar(() => kirimNotifikasi({
        kunci: `izin-keluar:${baris.id}`,
        jenis: "IZIN_KELUAR",
        judul: perluFoto ? "Surat izin keluar terbit — wajib unggah bukti foto" : "Surat izin keluar terbit",
        isi: perluFoto
          ? `${alasan}. Tunjukkan suratnya di portal, dan unggah bukti foto dari tempat tujuan.`
          : `${alasan}. Tunjukkan surat izin keluar di portal ke petugas keamanan atau tempat tujuan.`,
        url: "/dashboard/student/izin-keluar",
        userIds: [siswa.user.id],
      }));
      return Response.json({ ok: true });
    }
    if (b.aksi === "kembali") {
      const kode = String(b.kode ?? "").trim();
      if (!kode) return Response.json({ error: "Pindai kartu atau ketik NIS." }, { status: 400 });
      const izin = await prisma.izinKeluarSiswa.findFirst({
        where: { kembaliPada: null, keluarPada: { gte: new Date(Date.now() - 12 * 3600_000) }, OR: [{ id: kode }, { student: { nis: kode } }, { studentId: kode }] },
        select: { id: true, student: { select: { user: { select: { name: true } } } } }, orderBy: { keluarPada: "desc" },
      });
      if (!izin) return Response.json({ error: "Tidak ada izin keluar aktif untuk kartu/NIS ini." }, { status: 404 });
      await prisma.izinKeluarSiswa.update({ where: { id: izin.id }, data: { kembaliPada: new Date() } });
      return Response.json({ ok: true, nama: izin.student.user.name });
    }
    if (b.aksi === "laporan") {
      const catatan = String(b.catatan ?? "").trim().slice(0, 5000);
      const tanggal = bagianWib().iso;
      await prisma.laporanPiket.upsert({ where: { tanggal }, create: { tanggal, catatan, petugas: session.name }, update: { catatan, petugas: session.name } });
      return Response.json({ ok: true });
    }
    return Response.json({ error: "Aksi tidak dikenal." }, { status: 400 });
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Khusus petugas piket hari ini, Kesiswaan/BK, dan Admin." }, { status: 403 });
    return Response.json({ error: "Gagal menyimpan." }, { status: 500 });
  }
}
