export const dynamic = "force-dynamic";

import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { pengumumanUntuk } from "@/lib/pengumuman";
import { getCurrentWeekType } from "@/lib/schedule-week.server";
import { getWakilKepalaAgenda } from "@/lib/agenda";
import { groupConsecutiveSchedules } from "@/lib/schedule-grouping";
import { cekLibur } from "@/lib/hari-libur";
import AgendaCalendar from "@/components/shared/AgendaCalendar";
import { jamKosongKelas } from "@/lib/jam-kosong";
import JadwalHariIni from "@/components/shared/JadwalHariIni";
import JadwalMingguan from "@/components/shared/JadwalMingguan";
import Panel, { PanelKosong, DaftarPengumuman } from "@/components/shared/Panel";
import { BagianBar } from "@/components/shared/GrafikRingkas";
import StatTile from "@/components/admin/StatTile";
import {
  CalendarClock, CalendarRange, CalendarCheck, TrendingUp, Newspaper, Megaphone, Star, Building2, FileText, LayoutDashboard,
} from "lucide-react";
import { TautanIkon } from "@/components/shared/IkonNama";
import Link from "next/link";
import PageHeader from "@/components/admin/PageHeader";
import { MenuSiswa } from "@/components/shared/MenuPortal";
import { konteksMenuSiswa, menuFavoritAkun } from "@/lib/menu-konteks";

// Ikon lucide di halaman server ini hanya di markup server & masing-masing sekali; ke komponen klien kirim NAMA ikon (CLAUDE.md #35).
const STATUS_KELAS: Record<string, string> = {
  HADIR: "bg-emerald-50 text-emerald-700 border-emerald-200",
  IZIN:  "bg-blue-50 text-blue-700 border-blue-200",
  SAKIT: "bg-amber-50 text-amber-700 border-amber-200",
  ALPHA: "bg-red-50 text-red-600 border-red-200",
};
const STATUS_WARNA: Record<string, string> = { HADIR: "#10b981", IZIN: "#3b82f6", SAKIT: "#f59e0b", ALPHA: "#ef4444" };
const STATUS_LABEL: Record<string, string> = { HADIR: "Hadir", IZIN: "Izin", SAKIT: "Sakit", ALPHA: "Alpha" };
const DAYS = ["SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
const DAY_LABEL: Record<string, string> = { SENIN: "Senin", SELASA: "Selasa", RABU: "Rabu", KAMIS: "Kamis", JUMAT: "Jumat", SABTU: "Sabtu" };
const JENIS_NILAI = ["Tugas", "Ulangan Harian", "UTS", "UAS"];

export default async function StudentDashboard() {
  const session = await verifyRole(["STUDENT"]);
  const konteksMenu = await konteksMenuSiswa(session);
  const favoritAwal = await menuFavoritAkun(session);

  const now = new Date();
  // Hari, tanggal, dan bulan menurut WIB — server berjalan di UTC.
  const wib = new Date(now.getTime() + 7 * 3600_000);
  const tanggalWib = wib.toISOString().slice(0, 10);
  const hariIni = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"][wib.getUTCDay()];

  const student = await prisma.student.findFirst({
    where: { user: { email: session.email } },
    include: {
      grades: { orderBy: { createdAt: "desc" } },
      attendance: { orderBy: { date: "desc" } },
      internship: true,
      class: true,
      major: true,
    },
  });

  // Sapaan pakai Nama Panggilan dari Buku Induk kalau sudah diisi admin; kalau belum, NAMA LENGKAP
  // (keputusan user 18 Sep 2026 — nama tidak dipenggal di layar mana pun).
  const nicknameRaw = (student?.bukuIndukData as Record<string, unknown> | null)?.nickname;
  const greetingName = (typeof nicknameRaw === "string" && nicknameRaw.trim()) || session.name;

  const currentWeekType = await getCurrentWeekType();
  // Piket kelas hari ini (17 Sep 2026) — info jadwal dari wali kelas.
  const piketHariIni = student?.classId && hariIni !== "MINGGU"
    ? await prisma.piketKelas.findMany({ where: { classId: student.classId, hari: hariIni }, select: { studentId: true, student: { select: { user: { select: { name: true } } } } } }).catch(() => [])
    : [];
  const sayaPiket = piketHariIni.some(x => x.studentId === student?.id);

  const [latestNews, announcements, schedules, agenda, libur] = await Promise.all([
    prisma.news.findMany({
      where: { published: true },
      orderBy: { createdAt: "desc" },
      take: 4,
      select: { id: true, slug: true, title: true, category: true, createdAt: true },
    }),
    pengumumanUntuk(session, 5).catch(() => []),
    student?.classId
      ? prisma.schedule.findMany({
          where: { classId: student.classId, weekType: { in: ["SEMUA", currentWeekType] }, scheduleType: "BLOK" },
          include: { teacher: { include: { user: { select: { name: true } } } } },
          orderBy: [{ day: "asc" }, { startTime: "asc" }],
        })
      : Promise.resolve([]),
    getWakilKepalaAgenda(),
    cekLibur(tanggalWib).catch(() => null),
  ]);

  const grades = student?.grades ?? [];
  const attendance = student?.attendance ?? [];

  const avgScore = grades.length ? parseFloat((grades.reduce((a, g) => a + g.score, 0) / grades.length).toFixed(1)) : 0;
  const presentCount = attendance.filter(a => a.status === "HADIR").length;
  const attendancePct = attendance.length ? Math.round((presentCount / attendance.length) * 100) : 0;

  const gradesBySemester = [...new Set(grades.map(g => g.semester))].sort().map(sem => {
    const sg = grades.filter(g => g.semester === sem);
    const bySubject = [...new Set(sg.map(g => g.subject))].map(subject => {
      const rows = sg.filter(g => g.subject === subject);
      return { subject, rows, avg: rows.reduce((a, g) => a + g.score, 0) / rows.length };
    });
    return { sem, bySubject };
  });

  const bulanIni = tanggalWib.slice(0, 7);
  const thisMonthAtt = attendance.filter(a => new Date(new Date(a.date).getTime() + 7 * 3600_000).toISOString().slice(0, 7) === bulanIni);
  const thisMonthPresent = thisMonthAtt.filter(a => a.status === "HADIR").length;
  const thisMonthPct = thisMonthAtt.length ? Math.round((thisMonthPresent / thisMonthAtt.length) * 100) : 0;
  const recentAtt = attendance.slice(0, 5);

  const scoreColor = (s: number) => s >= 85 ? "text-emerald-700" : s >= 75 ? "text-blue-700" : "text-red-600";
  const scoreBg = (s: number) => s >= 85 ? "bg-emerald-50" : s >= 75 ? "bg-blue-50" : "bg-red-50";

  // Jam pelajaran berurutan dengan mapel & guru yang sama digabung jadi satu blok.
  const slotHari = (hari: string) => groupConsecutiveSchedules(schedules.filter(s => s.day === hari), s => `${s.subject}|${s.teacherId}`)
    .sort((a, b) => a.first.startTime.localeCompare(b.first.startTime))
    .map(b => ({ id: b.first.id, mulai: b.first.startTime, selesai: b.last.endTime, judul: b.first.subject, keterangan: b.first.teacher?.user.name ?? undefined }));
  const jadwalMinggu = DAYS.map(kode => ({ kode, label: DAY_LABEL[kode], slot: slotHari(kode).map(s => ({ ...s, keterangan: undefined })) })).filter(h => h.slot.length);
  const slotHariIni = hariIni === "MINGGU" || libur ? [] : slotHari(hariIni);
  // Jam kosong hari ini dari catatan guru piket (src/lib/jam-kosong.ts) — hanya "guru berhalangan" + tugas titipannya.
  const jamKosong = student?.classId && !libur ? await jamKosongKelas(student.classId, tanggalWib) : [];
  const kosongHariIni = libur ? `Hari ini libur — ${libur.nama}.`
    : hariIni === "MINGGU" ? "Hari Minggu, selamat beristirahat."
    : student?.classId ? "Tidak ada jadwal pelajaran hari ini." : "Kamu belum terdaftar di kelas mana pun.";

  const bulanLabel = now.toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
  const tglLabel = (d: Date) => new Date(d).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Jakarta" });

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      {/* Header = PageHeader standar (keputusan user 2026-08-23): identitas kelas/NIS di description. */}
      <PageHeader
        icon={<LayoutDashboard size={22} />}
        title="Dashboard Siswa"
        description={<>{session.name} — {student?.class?.name ?? "—"}{student?.major?.code ? ` · ${student.major.code}` : ""} · NIS: {student?.nis ?? "—"}</>}
      />

      <div className="space-y-6">
        {/* Sapaan — konten berbeda dari header (bukan duplikat), sesuai DESIGN_SYSTEM §3.3. */}
        <div className="masuk-halus flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="font-arabic text-xl text-primary-700" style={{ lineHeight: 2.2 }}>اَلسَّلَامُ عَلَيْكُمْ</p>
            <h2 className="judul-seimbang font-heading text-xl font-bold text-primary-900 sm:text-2xl">Halo, {greetingName}!</h2>
          </div>
          {avgScore >= 80 && (
            <p className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3.5 py-1.5 text-sm font-semibold text-gold-dark">
              <Star size={15} className="fill-gold text-gold" /> Prestasi baik · rata-rata {avgScore}
            </p>
          )}
        </div>

        {/* Kisi menu ala aplikasi bank (18 Sep 2026) — semua fitur terkumpul di dashboard, tidak
            lagi tersembunyi di laci bawah. "Lihat semua" membuka /dashboard/student/menu. */}
        <MenuSiswa ringkas={12} hrefSemua="/dashboard/student/menu" judul="Menu Cepat" favoritAwal={favoritAwal} {...konteksMenu} />

        <DaftarPengumuman ikon={<Megaphone />} pengumuman={announcements} />

        <div className="kisi-kartu kisi-kartu-4">
          <StatTile tampilan="lembut" href="/dashboard/student/rapor" ikon="prestasi" label="Rata-rata Nilai" value={avgScore || "—"} color="amber"
            sublabel={!grades.length ? "Belum ada nilai" : avgScore >= 80 ? "Di atas rata-rata" : avgScore >= 75 ? "Memenuhi KKM" : "Perlu ditingkatkan"} />
          <StatTile tampilan="lembut" ikon="hadir" label="Kehadiran" value={`${attendancePct}%`} color="emerald"
            sublabel={`${presentCount} dari ${attendance.length} hari`} />
          <StatTile tampilan="lembut" ikon="buku" label="Nilai Tercatat" value={grades.length} color="blue"
            sublabel={`${gradesBySemester.length} semester`} />
          <StatTile tampilan="lembut" ikon="pkl" label="Status PKL" size="md" color="purple"
            value={student?.internship ? (student.internship.status === "COMPLETED" ? "Selesai" : "Berlangsung") : "Belum"}
            sublabel={student?.internship?.company ?? "Belum ada data"} />
        </div>

        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
          <div className="kolom-dashboard min-w-0 space-y-6 xl:col-span-7">
            <Panel judul="Jadwal Hari Ini" ikon={<CalendarClock />} keterangan={DAY_LABEL[hariIni] ?? "Minggu"}>
              {jamKosong.length > 0 && (
                <ul className="mb-4 space-y-2">
                  {jamKosong.map(j => (
                    <li key={`${j.mulai}-${j.mapel}`} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      <strong className="angka">{j.mulai}–{j.selesai}</strong> · {j.mapel}: guru berhalangan hadir.
                      {j.tugas ? <span className="mt-0.5 block text-amber-900"><strong>Tugas:</strong> {j.tugas}</span> : <span className="mt-0.5 block">Belum ada tugas titipan — tetap di kelas dan tunggu arahan guru piket.</span>}
                    </li>
                  ))}
                </ul>
              )}
              <JadwalHariIni slot={slotHariIni} kosong={kosongHariIni} />
              {piketHariIni.length > 0 && !libur && (
                <p className={`mt-4 rounded-xl border px-3 py-2 text-sm ${sayaPiket ? "border-amber-200 bg-amber-50 text-amber-800" : "border-gray-100 bg-gray-50 text-gray-600"}`}>
                  <strong>{sayaPiket ? "Kamu piket kelas hari ini." : "Piket kelas hari ini:"}</strong>{" "}
                  {piketHariIni.map(x => x.student.user.name.split(" ").slice(0, 2).join(" ")).join(", ")}
                </p>
              )}
            </Panel>

            <Panel judul="Jadwal Pelajaran Minggu Ini" ikon={<CalendarRange />}>
              <JadwalMingguan hari={jadwalMinggu} hariIni={hariIni} kosong="Jadwal pelajaran belum tersedia." />
            </Panel>

            {gradesBySemester.length > 0 && (
              <Panel judul="Rekap Nilai per Semester" ikon={<TrendingUp />}>
                <div className="space-y-6">
                  {gradesBySemester.map(({ sem, bySubject }) => {
                    const semAvg = bySubject.reduce((a, s) => a + s.avg, 0) / bySubject.length;
                    return (
                      <div key={sem}>
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <span className="rounded-full bg-primary-50 px-3 py-1 text-sm font-semibold text-primary-900">{sem}</span>
                          <span className={`angka text-sm font-bold ${scoreColor(semAvg)}`}>Rata-rata {semAvg.toFixed(1)}</span>
                        </div>
                        <div className="scrollbar-visible overflow-x-auto rounded-xl border border-gray-100">
                          <table className="data-table min-w-[34rem]">
                            <thead>
                              <tr>
                                <th>Mata Pelajaran</th>
                                {JENIS_NILAI.map(t => <th key={t} className="whitespace-nowrap text-center">{t}</th>)}
                                <th className="text-center">Rata-rata</th>
                              </tr>
                            </thead>
                            <tbody>
                              {bySubject.map(({ subject, rows, avg }) => (
                                <tr key={subject}>
                                  <td className="font-medium text-primary-900">{subject}</td>
                                  {JENIS_NILAI.map(type => {
                                    const s = rows.find(g => g.type === type)?.score ?? null;
                                    return (
                                      <td key={type} className="text-center">
                                        {s !== null
                                          ? <span className={`angka inline-block w-11 rounded-lg py-0.5 font-bold ${scoreBg(s)} ${scoreColor(s)}`}>{s}</span>
                                          : <span className="text-gray-300">—</span>}
                                      </td>
                                    );
                                  })}
                                  <td className={`angka text-center font-bold ${scoreColor(avg)}`}>{avg.toFixed(1)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                  <TautanIkon href="/dashboard/student/rapor" ikon="cetak"
                    className="sentuh flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-primary-900 transition-colors hover:bg-gray-50">
                    Cetak Rapor Lengkap
                  </TautanIkon>
                </div>
              </Panel>
            )}
          </div>

          <div className="kolom-dashboard min-w-0 space-y-6 xl:col-span-5">
            <Panel judul={`Absensi ${bulanLabel}`} ikon={<CalendarCheck />}>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="angka font-heading text-4xl font-bold leading-none text-primary-900">{thisMonthPct}%</p>
                  <p className="mt-1.5 text-sm text-gray-500">hadir dari {thisMonthAtt.length} hari tercatat</p>
                </div>
              </div>
              <div className="mt-4">
                <BagianBar bagian={["HADIR", "IZIN", "SAKIT", "ALPHA"].map(s => ({ label: STATUS_LABEL[s], nilai: thisMonthAtt.filter(a => a.status === s).length, warna: STATUS_WARNA[s] }))} />
              </div>
              {recentAtt.length > 0 && (
                <div className="mt-5 border-t border-gray-100 pt-4">
                  <p className="label-kecil mb-2">Catatan terakhir</p>
                  <ul className="divide-y divide-gray-50">
                    {recentAtt.map(a => (
                      <li key={a.id} className="flex items-center justify-between py-2">
                        <span className="text-sm text-gray-600">{tglLabel(a.date)}</span>
                        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_KELAS[a.status] ?? "border-gray-200 bg-gray-50 text-gray-600"}`}>
                          {STATUS_LABEL[a.status] ?? a.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Panel>

            <AgendaCalendar agenda={agenda} />

            <Panel judul="Praktik Kerja Lapangan" ikon={<Building2 />} isi={!!student?.internship}>
              {student?.internship ? (
                <dl className="space-y-3">
                  {[
                    { label: "Perusahaan", value: student.internship.company },
                    { label: "Posisi", value: student.internship.position },
                    { label: "Pembimbing", value: student.internship.supervisor },
                    {
                      label: "Periode",
                      value: `${new Date(student.internship.startDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" })} — ${new Date(student.internship.endDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" })}`,
                    },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-start gap-3">
                      <dt className="w-24 shrink-0 text-sm text-gray-500">{label}</dt>
                      <dd className="min-w-0 text-sm font-semibold text-primary-900">{value}</dd>
                    </div>
                  ))}
                </dl>
              ) : <PanelKosong ikon={<FileText />} teks="Informasi PKL muncul setelah diisi wali kelas." />}
            </Panel>

            {latestNews.length > 0 && (
              <Panel judul="Berita & Pengumuman" ikon={<Newspaper />} isi={false} tautan={{ label: "Lihat semua", href: "/news" }}>
                <ul className="divide-y divide-gray-100">
                  {latestNews.map(n => (
                    <li key={n.id}>
                      <Link href={`/news/${n.slug}`} className="block px-4 py-3 transition-colors hover:bg-gray-50 sm:px-5">
                        <p className="line-clamp-2 text-sm font-medium text-primary-900">{n.title}</p>
                        <p className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                          {new Date(n.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" })}
                          <span className="rounded bg-primary-50 px-1.5 py-0.5 font-medium text-primary-700">{n.category}</span>
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
