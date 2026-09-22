import { prisma } from "@/lib/prisma";
import { kirimSinyal } from "@/lib/sinyal-ujian";
import { verifyRole } from "@/lib/dal";
import { bolehAturUjian } from "@/lib/kegiatan-ujian-server";
import { kirimLatar, kirimNotifikasi } from "@/lib/push-server";
import { kelasPeserta } from "@/lib/ujian-server";
import { bacaJadwalKelas, jendelaKelas, rapikanJadwalKelas, type JadwalKelas } from "@/lib/jadwal-ujian-kelas";
import { susunPengawasKelas } from "@/lib/pengawas-kelas";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";

/** PEMBAGIAN PENGAWAS UJIAN (18 Sep 2026) — per kegiatan: tanggal × sesi × ruang, dibagi otomatis merata lalu bisa diubah. */
export async function GET(req: Request) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  if (!(await bolehAturUjian(session))) return Response.json({ error: "Khusus Wakil Kepala Kurikulum & Admin." }, { status: 403 });
  const kegiatanId = new URL(req.url).searchParams.get("kegiatanId") ?? "";
  const [kegiatan, guru] = await Promise.all([
    prisma.kegiatanUjian.findMany({
      where: { aktif: true }, orderBy: { createdAt: "desc" },
      select: { id: true, nama: true, singkatan: true, tanggalMulai: true, tanggalSelesai: true, mekanisme: true, _count: { select: { exams: true } } },
    }),
    prisma.teacher.findMany({ where: { teacherStatus: "AKTIF" }, select: { id: true, user: { select: { name: true } } }, orderBy: { user: { name: "asc" } } }),
  ]);
  // Pilihan bawaan: kegiatan yang SUDAH punya ujian, lalu yang tanggalnya paling dekat hari ini — bukan sekadar yang
  // terakhir dibuat (temuan user 21 Sep 2026: SAS kosong terpilih, halaman tampak "tidak muncul apa-apa").
  const hariIni = Date.now();
  const jarak = (k: (typeof kegiatan)[number]) => {
    if (!k.tanggalMulai) return Number.MAX_SAFE_INTEGER;
    const a = k.tanggalMulai.getTime(), b = (k.tanggalSelesai ?? k.tanggalMulai).getTime() + 86_400_000;
    return hariIni >= a && hariIni <= b ? 0 : Math.min(Math.abs(hariIni - a), Math.abs(hariIni - b));
  };
  const bawaan = [...kegiatan].sort((x, y) => Number(y._count.exams > 0) - Number(x._count.exams > 0) || jarak(x) - jarak(y))[0];
  const id = kegiatan.find(k => k.id === kegiatanId)?.id ?? bawaan?.id ?? "";
  if (!id) return Response.json({ kegiatan, guru: [], kegiatanId: "", ruang: [], sesi: [], jadwal: [], mekanisme: "RUANG", perKelas: [] });
  // Kegiatan PER KELAS (21 September 2026): jadwal ujian × kelas, pengawas otomatis guru mapel — lihat pengawas-kelas.ts.
  const mekanisme = kegiatan.find(k => k.id === id)?.mekanisme === "KELAS" ? "KELAS" : "RUANG";
  if (mekanisme === "KELAS") {
    return Response.json({ kegiatan, kegiatanId: id, guru: guru.map(g => ({ id: g.id, nama: g.user.name })), ruang: [], sesi: [], jadwal: [], mekanisme, perKelas: await susunPengawasKelas(id) });
  }
  const [penempatan, jadwal] = await Promise.all([
    prisma.penempatanRuangUjian.findMany({ where: { kegiatanId: id }, select: { ruangId: true, sesi: true, ruang: { select: { nama: true } } } }),
    prisma.pengawasUjian.findMany({ where: { kegiatanId: id }, orderBy: [{ tanggal: "asc" }, { sesi: "asc" }] }),
  ]);
  const ruang = [...new Map(penempatan.map(p => [p.ruangId, { id: p.ruangId, nama: p.ruang.nama }])).values()].sort((a, b) => a.nama.localeCompare(b.nama, "id", { numeric: true }));
  const sesi = [...new Set(penempatan.map(p => p.sesi))].sort((a, b) => a - b);
  return Response.json({
    kegiatan, kegiatanId: id, guru: guru.map(g => ({ id: g.id, nama: g.user.name })), ruang, sesi, mekanisme, perKelas: [],
    jadwal: jadwal.map(j => ({ id: j.id, ruangId: j.ruangId, tanggal: j.tanggal.toISOString().slice(0, 10), sesi: j.sesi, teacherId: j.teacherId, catatan: j.catatan })),
  });
}

/** Simpan pembagian: {kegiatanId, baris:[{tanggal, sesi, ruangId, teacherId}]} — teacherId kosong berarti hapus. */
export async function POST(req: Request) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  if (!(await bolehAturUjian(session))) return Response.json({ error: "Khusus Wakil Kepala Kurikulum & Admin." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const kegiatan = await prisma.kegiatanUjian.findUnique({ where: { id: String(b.kegiatanId ?? "") }, select: { id: true, nama: true } });
  if (!kegiatan) return Response.json({ error: "Kegiatan ujian tidak ditemukan." }, { status: 404 });
  if (b.mekanisme === "KELAS" || b.mekanisme === "RUANG") {
    await prisma.kegiatanUjian.update({ where: { id: kegiatan.id }, data: { mekanisme: b.mekanisme } });
    return Response.json({ ok: true });
  }
  if (Array.isArray(b.perKelas)) return simpanPerKelas(kegiatan, b.perKelas, !!b.kabari);
  const baris = (Array.isArray(b.baris) ? b.baris : []).slice(0, 2000)
    .map((x: Record<string, unknown>) => ({ tanggal: String(x.tanggal ?? ""), sesi: Math.max(1, Math.round(Number(x.sesi) || 1)), ruangId: String(x.ruangId ?? ""), teacherId: String(x.teacherId ?? "") }))
    .filter((x: { tanggal: string; ruangId: string }) => /^\d{4}-\d{2}-\d{2}$/.test(x.tanggal) && x.ruangId);
  const baru: string[] = [];
  await prisma.$transaction(async tx => {
    for (const x of baris) {
      const kunci = { kegiatanId_ruangId_tanggal_sesi: { kegiatanId: kegiatan.id, ruangId: x.ruangId, tanggal: new Date(`${x.tanggal}T00:00:00Z`), sesi: x.sesi } };
      if (!x.teacherId) { await tx.pengawasUjian.deleteMany({ where: { kegiatanId: kegiatan.id, ruangId: x.ruangId, tanggal: new Date(`${x.tanggal}T00:00:00Z`), sesi: x.sesi } }); continue; }
      const ada = await tx.pengawasUjian.findUnique({ where: kunci, select: { teacherId: true } });
      if (ada?.teacherId === x.teacherId) continue;
      await tx.pengawasUjian.upsert({
        where: kunci,
        create: { kegiatanId: kegiatan.id, ruangId: x.ruangId, tanggal: new Date(`${x.tanggal}T00:00:00Z`), sesi: x.sesi, teacherId: x.teacherId },
        update: { teacherId: x.teacherId },
      });
      baru.push(x.teacherId);
    }
  });
  if (b.kabari && baru.length) {
    kirimLatar(async () => {
      const guru = await prisma.teacher.findMany({ where: { id: { in: [...new Set(baru)] } }, select: { id: true, userId: true } });
      for (const g of guru) {
        const tugas = await prisma.pengawasUjian.findMany({ where: { kegiatanId: kegiatan.id, teacherId: g.id }, orderBy: [{ tanggal: "asc" }, { sesi: "asc" }], include: { ruang: { select: { nama: true } } } });
        await kirimNotifikasi({
          userIds: [g.userId], jenis: "UJIAN_MULAI", kunci: `pengawas:${kegiatan.id}:${g.id}:${tugas.length}`,
          judul: `Jadwal pengawas ${kegiatan.nama}`,
          isi: tugas.slice(0, 4).map(t => `${t.tanggal.toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "UTC" })} sesi ${t.sesi} · ${t.ruang.nama}`).join("\n"),
          url: "/dashboard/teacher/pengawas-ujian", tag: `pengawas-${kegiatan.id}`,
        });
      }
    });
  }
  return Response.json({ ok: true, jumlah: baris.length });
}

type IsianPerKelas = { examId?: unknown; classId?: unknown; teacherId?: unknown; mulai?: unknown; selesai?: unknown };

/** Simpan jadwal kegiatan PER KELAS: pengawas pengganti (teacherId kosong = kembali ke guru pengampu) dan jam tiap
 * kelas (disimpan ke `Exam.jadwalKelas`, sama dengan isian di penyusun ujian). */
async function simpanPerKelas(kegiatan: { id: string; nama: string }, isian: IsianPerKelas[], kabari: boolean) {
  const baris = isian.slice(0, 2000).map(x => ({
    examId: String(x.examId ?? ""), classId: String(x.classId ?? ""), teacherId: String(x.teacherId ?? ""),
    mulai: typeof x.mulai === "string" ? x.mulai : "", selesai: typeof x.selesai === "string" ? x.selesai : "",
  })).filter(x => x.examId && x.classId);
  const exams = await prisma.exam.findMany({
    where: { id: { in: [...new Set(baris.map(x => x.examId))] }, kegiatanId: kegiatan.id },
    select: { id: true, classId: true, kelasIds: true, startTime: true, endTime: true, jadwalKelas: true },
  });
  const perUjian = new Map(exams.map(e => [e.id, e]));
  const guruSah = new Set((await prisma.teacher.findMany({ where: { id: { in: baris.map(x => x.teacherId).filter(Boolean) } }, select: { id: true } })).map(t => t.id));

  // Jam per kelas: jadwal DILENGKAPI untuk semua kelas peserta ujian itu, supaya kelas yang tidak diubah tetap di
  // jamnya sendiri (kelas tanpa jam khusus memakai jam umum = amplop, yang ikut bergeser bila tidak dilengkapi).
  const jadwalBaru = new Map<string, JadwalKelas>();
  for (const x of baris) {
    const e = perUjian.get(x.examId);
    if (!e || !kelasPeserta(e).includes(x.classId) || !x.mulai || !x.selesai) continue;
    const kini = jendelaKelas(e, x.classId);
    if (new Date(x.mulai).getTime() === kini.startTime.getTime() && new Date(x.selesai).getTime() === kini.endTime.getTime()) continue;
    if (!jadwalBaru.has(e.id)) {
      const lengkap: JadwalKelas = { ...bacaJadwalKelas(e.jadwalKelas) };
      for (const k of kelasPeserta(e)) if (!lengkap[k]) { const j = jendelaKelas(e, k); lengkap[k] = { mulai: j.startTime.toISOString(), selesai: j.endTime.toISOString() }; }
      jadwalBaru.set(e.id, lengkap);
    }
    jadwalBaru.get(e.id)![x.classId] = { mulai: x.mulai, selesai: x.selesai };
  }
  const pembaruanJam: { id: string; jadwal: JadwalKelas; startTime: Date; endTime: Date }[] = [];
  for (const [id, jadwal] of jadwalBaru) {
    const e = perUjian.get(id)!;
    const r = rapikanJadwalKelas(jadwal, kelasPeserta(e), { startTime: e.startTime, endTime: e.endTime });
    if (r.galat) return Response.json({ error: r.galat }, { status: 400 });
    pembaruanJam.push({ id, jadwal: r.jadwal, startTime: r.startTime, endTime: r.endTime });
  }

  await prisma.$transaction(async tx => {
    for (const u of pembaruanJam) await tx.exam.update({ where: { id: u.id }, data: { jadwalKelas: u.jadwal, startTime: u.startTime, endTime: u.endTime } });
    for (const x of baris) {
      const e = perUjian.get(x.examId);
      if (!e || !kelasPeserta(e).includes(x.classId)) continue;
      if (!x.teacherId || !guruSah.has(x.teacherId)) { await tx.pengawasKelasUjian.deleteMany({ where: { examId: x.examId, classId: x.classId } }); continue; }
      await tx.pengawasKelasUjian.upsert({
        where: { examId_classId: { examId: x.examId, classId: x.classId } },
        create: { examId: x.examId, classId: x.classId, teacherId: x.teacherId },
        update: { teacherId: x.teacherId },
      });
    }
  });

  if (kabari) {
    kirimLatar(async () => {
      const jadwal = await susunPengawasKelas(kegiatan.id);
      const perGuru = new Map<string, typeof jadwal>();
      for (const j of jadwal) if (j.pengawas && j.terbit) perGuru.set(j.pengawas.id, [...(perGuru.get(j.pengawas.id) ?? []), j]);
      const guru = await prisma.teacher.findMany({ where: { id: { in: [...perGuru.keys()] } }, select: { id: true, userId: true } });
      const jam = (s: string) => new Date(s).toLocaleString("id-ID", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
      for (const g of guru) {
        const tugas = perGuru.get(g.id) ?? [];
        // Kunci ikut isi jadwal: kabar ulang hanya terkirim ke guru yang jadwalnya berubah.
        const sidik = createHash("sha256").update(tugas.map(t => `${t.examId}|${t.classId}|${t.mulai}|${t.selesai}`).join(",")).digest("hex").slice(0, 16);
        await kirimNotifikasi({
          userIds: [g.userId], jenis: "UJIAN_MULAI", kunci: `pengawas-kelas:${kegiatan.id}:${g.id}:${sidik}`,
          judul: `Jadwal mengawas ${kegiatan.nama}`,
          isi: tugas.slice(0, 4).map(t => `${jam(t.mulai)} · ${t.kelas} · ${t.mapel}`).join("\n") + (tugas.length > 4 ? `\n+${tugas.length - 4} lagi` : ""),
          url: "/dashboard/teacher/pengawas-ujian", tag: `pengawas-${kegiatan.id}`,
        });
      }
    });
  }
  for (const u of pembaruanJam) kirimSinyal(u.id); // jam kelas berubah → tenggat peserta langsung diperbarui
  return Response.json({ ok: true, jamDiubah: pembaruanJam.length });
}
