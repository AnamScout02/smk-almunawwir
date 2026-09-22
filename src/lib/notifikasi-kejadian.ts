import "server-only";
import { prisma } from "@/lib/prisma";
import { kirimNotifikasi, orangTuaDari } from "@/lib/push-server";
import { alphaBeruntun, userKesiswaanBk } from "@/lib/peringatan-dini";

/** Notifikasi yang dipicu KEJADIAN (bukan jadwal). Dipanggil dari route API lewat `kirimLatar(...)` setelah
 * data tersimpan. Semua berkunci, jadi simpan ulang data yang sama tidak mengirim notifikasi dobel. */

// Tanggal absensi disimpan sebagai tengah malam UTC dari "YYYY-MM-DD" → format dengan zona UTC.
const tanggalAbsensi = (d: Date) =>
  d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** Orang tua diberi tahu saat anaknya ditandai ALPHA (tanpa keterangan). IZIN/SAKIT tidak dikirim. */
export async function beritahuOrangTuaAlpha(records: { studentId: string; date: string | Date; status: string }[]) {
  const alpha = records.filter(r => r.status === "ALPHA");
  if (!alpha.length) return;
  const ids = alpha.map(a => a.studentId);
  const [siswa, ortu] = await Promise.all([
    prisma.student.findMany({ where: { id: { in: ids } }, select: { id: true, user: { select: { name: true } }, class: { select: { name: true } } } }),
    orangTuaDari(ids),
  ]);
  const data = new Map(siswa.map(s => [s.id, s]));
  for (const a of alpha) {
    const penerima = ortu.get(a.studentId);
    if (!penerima?.length) continue;
    const s = data.get(a.studentId);
    const tgl = new Date(a.date);
    await kirimNotifikasi({
      userIds: penerima,
      jenis: "ANAK_ALPHA",
      kunci: `anak-alpha:${a.studentId}:${tgl.toISOString().slice(0, 10)}`,
      judul: "Ananda tidak hadir tanpa keterangan",
      isi: `${s?.user.name ?? "Ananda"} (${s?.class?.name ?? "-"}) tercatat ALPHA pada ${tanggalAbsensi(tgl)}. Hubungi wali kelas bila ada keterangan.`,
      url: "/dashboard/parent/absensi",
      tag: `alpha-${a.studentId}`,
    });
  }
}

/** Orang tua diberi tahu saat anaknya mendapat poin pelanggaran atau prestasi (remisi tidak). */
export async function beritahuPoin(recordId: string) {
  const r = await prisma.studentPointRecord.findUnique({
    where: { id: recordId },
    select: {
      id: true, kind: true, points: true, studentId: true,
      student: { select: { user: { select: { name: true } } } },
      violationType: { select: { name: true } },
      achievementType: { select: { name: true } },
    },
  });
  if (!r || (r.kind !== "PELANGGARAN" && r.kind !== "PRESTASI")) return;
  const penerima = (await orangTuaDari([r.studentId])).get(r.studentId) ?? [];
  if (!penerima.length) return;
  const nama = r.student.user.name;
  const pelanggaran = r.kind === "PELANGGARAN";
  await kirimNotifikasi({
    userIds: penerima,
    jenis: pelanggaran ? "POIN_PELANGGARAN" : "POIN_PRESTASI",
    kunci: `poin:${r.id}`,
    judul: pelanggaran ? "Catatan kedisiplinan Ananda" : "Prestasi Ananda",
    isi: pelanggaran
      ? `${nama} mendapat ${r.points} poin pelanggaran: ${r.violationType?.name ?? "-"}.`
      : `${nama} mendapat ${r.points} poin prestasi: ${r.achievementType?.name ?? "-"}.`,
    url: "/dashboard/parent/poin",
  });
}

/** Siswa aktif di kelas tujuan diberi tahu saat guru membuat tugas baru. */
export async function beritahuTugasBaru(assignmentId: string) {
  const t = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: { id: true, title: true, subject: true, dueDate: true, classId: true },
  });
  if (!t) return;
  const siswa = await prisma.student.findMany({ where: { classId: t.classId, studentStatus: "AKTIF" }, select: { userId: true } });
  const batas = t.dueDate
    ? ` · batas ${t.dueDate.toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })}`
    : "";
  await kirimNotifikasi({
    userIds: siswa.map(s => s.userId),
    jenis: "TUGAS_BARU",
    kunci: `tugas:${t.id}`,
    judul: `Tugas baru: ${t.subject}`,
    isi: `${t.title}${batas}`,
    url: "/dashboard/student/materials",
    tag: `tugas-${t.id}`,
  });
}

/** Wali kelas & Guru BK/Wakasek Kesiswaan diberi tahu saat siswa ALPHA 3 hari tercatat berturut-turut atau lebih
 * (SEKALI per siswa per HARI KIRIM). Dipicu dari simpan absensi, bersama notifikasi orang tua. */
export async function beritahuAlphaBeruntun(records: { studentId: string; date: string | Date; status: string }[]) {
  // Dulu kunci memakai TANGGAL ABSENSI: wali kelas yang menyimpan beberapa hari ke belakang sekaligus memicu "alpha 10, 11,
  // … 19 hari berturut-turut" ke penerima yang sama (temuan user 15 Sep 2026: "masih double notifikasi"). Sekarang satu
  // siswa satu kiriman per hari, berapa pun tanggal yang disimpan.
  const alpha = [...new Map(records.filter(r => r.status === "ALPHA").map(r => [r.studentId, r])).values()];
  if (!alpha.length) return;
  const beruntun = await alphaBeruntun(alpha.map(a => a.studentId));
  const sasaran = alpha.filter(a => (beruntun.get(a.studentId) ?? 0) >= 3);
  if (!sasaran.length) return;
  const [siswa, bk] = await Promise.all([
    prisma.student.findMany({
      where: { id: { in: sasaran.map(a => a.studentId) } },
      select: { id: true, user: { select: { name: true } }, class: { select: { name: true, homeroom: { select: { userId: true } } } } },
    }),
    userKesiswaanBk(),
  ]);
  const data = new Map(siswa.map(s => [s.id, s]));
  const hariIniWib = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  for (const a of sasaran) {
    const s = data.get(a.studentId);
    const n = beruntun.get(a.studentId) ?? 3;
    const penerima = [s?.class?.homeroom?.userId, ...bk].filter((x): x is string => !!x);
    await kirimNotifikasi({
      userIds: penerima,
      jenis: "ALPHA_BERUNTUN",
      kunci: `alpha-beruntun:${a.studentId}:${hariIniWib}`,
      judul: `Peringatan dini: alpha ${n} hari berturut-turut`,
      isi: `${s?.user.name ?? "Seorang siswa"} (${s?.class?.name ?? "-"}) tidak hadir tanpa keterangan ${n} hari tercatat berturut-turut. Mohon segera ditindaklanjuti.`,
      url: "/dashboard/teacher/peringatan-dini",
      tag: `alpha-beruntun-${a.studentId}`,
    });
  }
}
