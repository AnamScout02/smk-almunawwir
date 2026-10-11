export const dynamic = "force-dynamic";

import { Fragment } from "react";

import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { pengumumanUntuk } from "@/lib/pengumuman";
import { getCurrentWeekType } from "@/lib/schedule-week.server";
import { getWakilKepalaAgenda } from "@/lib/agenda";
import { groupConsecutiveSchedules } from "@/lib/schedule-grouping";
import { cekLibur } from "@/lib/hari-libur";
import AgendaCalendar from "@/components/shared/AgendaCalendar";
import JadwalHariIni from "@/components/shared/JadwalHariIni";
import JurnalCepat from "@/components/shared/JurnalCepat";
import JadwalMingguan from "@/components/shared/JadwalMingguan";
import Panel, { PanelKosong, DaftarPengumuman } from "@/components/shared/Panel";
import StatTile from "@/components/admin/StatTile";
import {
  CalendarClock, CalendarRange, GraduationCap, History, Megaphone, UsersRound, NotebookText, LayoutDashboard,
} from "lucide-react";
import Link from "next/link";
import PageHeader from "@/components/admin/PageHeader";
import { MenuGuru } from "@/components/shared/MenuPortal";
import { konteksMenuGuru, menuFavoritAkun } from "@/lib/menu-konteks";

// Ikon lucide di halaman server ini hanya di markup server & masing-masing sekali; ke komponen klien kirim NAMA ikon (CLAUDE.md #35).
const DAYS = ["SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
const DAY_LABEL: Record<string, string> = { SENIN: "Senin", SELASA: "Selasa", RABU: "Rabu", KAMIS: "Kamis", JUMAT: "Jumat", SABTU: "Sabtu" };

export default async function TeacherDashboard() {
  const session = await verifyRole(["TEACHER", "ADMIN"]);
  const konteksMenu = await konteksMenuGuru(session);
  const favoritAwal = await menuFavoritAkun(session);

  const now = new Date();
  // Hari & tanggal menurut WIB — server berjalan di UTC (dulu pukul 00.00–07.00 WIB masih menampilkan hari kemarin).
  const wib = new Date(now.getTime() + 7 * 3600_000);
  const tanggalWib = wib.toISOString().slice(0, 10);
  const hariIni = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"][wib.getUTCDay()];
  const since7d = new Date(now.getTime() - 7 * 86400_000);
  const currentWeekType = await getCurrentWeekType();

  const [teacher, announcements, teachingSchedules, agenda, libur] = await Promise.all([
    prisma.teacher.findFirst({
      where: { user: { email: session.email } },
      include: {
        _count: { select: { teachingLoad: true } },
        jabatan: { select: { jabatan: { select: { name: true } } } },
        homeroomOf: {
          include: {
            students: { where: { studentStatus: "AKTIF" }, select: { id: true } },
            major: { select: { name: true } },
          },
        },
      },
    }),
    pengumumanUntuk(session, 5).catch(() => []),
    // Widget jadwal di dashboard sengaja TIDAK menampilkan kelas XII (keputusan eksplisit user) — jadwal kelas XII
    // belum ikut proses verifikasi/reimport yang sama dgn X/XI.
    prisma.schedule.findMany({
      where: { teacher: { user: { email: session.email } }, weekType: { in: ["SEMUA", currentWeekType] }, scheduleType: "BLOK", class: { grade: { not: 12 } } },
      include: { class: { select: { name: true } } },
      orderBy: [{ day: "asc" }, { startTime: "asc" }],
    }),
    getWakilKepalaAgenda(),
    cekLibur(tanggalWib).catch(() => null),
  ]);

  // Nilai diisi lewat Jurnal Mengajar (src/lib/journal-grades.ts) — statistik di sini = aktivitas Jurnal guru ini.
  const [journalCount7d, recentJournals] = teacher ? await Promise.all([
    prisma.teachingJournal.count({ where: { teacherId: teacher.id, date: { gte: since7d } } }),
    prisma.teachingJournal.findMany({
      where: { teacherId: teacher.id },
      orderBy: { date: "desc" },
      take: 5,
      include: { class: { select: { name: true } } },
    }),
  ]) : [0, []];

  const kelasWali = teacher?.homeroomOf ?? [];
  // Tampilkan hanya yang relevan (permintaan user 17 Sep 2026): jadwal & jurnal untuk yang MENGAJAR, kelas wali untuk WALI KELAS.
  const mengajar = (teacher?._count.teachingLoad ?? 0) > 0 || teachingSchedules.length > 0;
  const wali = kelasWali.length > 0;
  const jabatan = teacher?.jabatan.map(j => j.jabatan.name) ?? [];
  const totalStudents = kelasWali.reduce((acc, c) => acc + c.students.length, 0);

  // JP berurutan pada kelas & mapel yang sama digabung jadi satu blok.
  const slotHari = (hari: string) => groupConsecutiveSchedules(teachingSchedules.filter(s => s.day === hari), s => `${s.subject}|${s.classId}`)
    .sort((a, b) => a.first.startTime.localeCompare(b.first.startTime))
    .map(b => ({ id: b.first.id, mulai: b.first.startTime, selesai: b.last.endTime, judul: b.first.subject, keterangan: b.first.class.name }));
  const jadwalMinggu = DAYS.map(kode => ({ kode, label: DAY_LABEL[kode], slot: slotHari(kode) })).filter(h => h.slot.length);
  const slotHariIni = hariIni === "MINGGU" || libur ? [] : slotHari(hariIni);

  const dateStr = now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
  const kosongHariIni = libur ? `Hari ini libur — ${libur.nama}.`
    : hariIni === "MINGGU" ? "Hari Minggu, tidak ada jadwal mengajar."
    : "Tidak ada jadwal mengajar hari ini.";

  const kartu: { key: string; node: React.ReactNode }[] = [
    ...(wali ? [
      { key: "siswa", node: <StatTile tampilan="lembut" ikon="siswa-wali" label="Siswa Wali Kelas" value={totalStudents} color="blue" /> },
      { key: "kelas", node: <StatTile tampilan="lembut" ikon="buku" label="Kelas Wali" value={kelasWali.length} color="purple" /> },
    ] : []),
    ...(mengajar ? [
      { key: "jurnal", node: <StatTile tampilan="lembut" href="/dashboard/teacher/journal" ikon="tren" label="Jurnal 7 Hari Terakhir" value={journalCount7d} color="emerald" /> },
      { key: "sesi", node: <StatTile tampilan="lembut" href="/dashboard/teacher/schedule" ikon="jam" label="Sesi Mengajar Hari Ini" value={slotHariIni.length} color="amber" /> },
    ] : []),
    ...(!wali && !mengajar ? [
      { key: "jabatan", node: <StatTile tampilan="lembut" ikon="daftar-centang" label="Jabatan yang dipegang" value={jabatan.length} color="primary" /> },
      { key: "pengumuman", node: <StatTile tampilan="lembut" ikon="pesan" label="Pengumuman aktif" value={announcements.length} color="blue" /> },
    ] : []),
  ];

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      {/* Header = PageHeader standar (keputusan user 2026-08-23): salam & nama di description, bukan title. */}
      <PageHeader
        icon={<LayoutDashboard size={22} />}
        title="Dashboard Guru"
        description={<><span className="font-arabic" style={{ lineHeight: 2.2 }}>اَلسَّلَامُ عَلَيْكُمْ</span> — <span className="font-medium">{session.name}</span><span className="hidden sm:inline"> · {dateStr}</span></>}
      />

      <div className="space-y-6">
        {/* Kisi menu ala aplikasi bank (18 Sep 2026) — seluruh menu portal guru terkumpul di sini. */}
        <MenuGuru ringkas={12} hrefSemua="/dashboard/teacher/menu" judul="Menu Cepat" favoritAwal={favoritAwal} {...konteksMenu} />

        <DaftarPengumuman ikon={<Megaphone />} pengumuman={announcements} />

        {/* Pengingat absensi/jurnal yang belum diisi cukup di kotak notifikasi (lonceng) — tidak diulang di sini (gotcha #31). */}
        <div className={`kisi-kartu ${kartu.length >= 4 ? "kisi-kartu-4" : ""}`}>
          {kartu.map(k => <Fragment key={k.key}>{k.node}</Fragment>)}
        </div>

        {/* Jurnal sekali ketuk (10 Okt 2026) — alat isi, bukan pengingat: materi sudah terisi dari Prota/Promes. Tidak tampil tanpa jadwal hari ini. */}
        {mengajar && session.role === "TEACHER" && <JurnalCepat />}

        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
          <div className="kolom-dashboard min-w-0 space-y-6 xl:col-span-7">
            {mengajar ? (
              <>
                <Panel judul="Jadwal Hari Ini" ikon={<CalendarClock />} keterangan={DAY_LABEL[hariIni] ?? "Minggu"}>
                  <JadwalHariIni slot={slotHariIni} kosong={kosongHariIni} />
                </Panel>

                <Panel judul="Jadwal Mengajar Minggu Ini" ikon={<CalendarRange />}
                  tautan={{ label: "Jadwal lengkap", href: "/dashboard/teacher/schedule" }}>
                  <JadwalMingguan hari={jadwalMinggu} hariIni={hariIni} kosong="Belum ada jadwal mengajar." />
                </Panel>
              </>
            ) : (
              <AgendaCalendar agenda={agenda} />
            )}
          </div>

          <div className="kolom-dashboard min-w-0 space-y-6 xl:col-span-5">
            {wali && <Panel judul="Kelas Wali Saya" ikon={<GraduationCap />} isi={false}>
              {kelasWali.length ? (
                <ul className="divide-y divide-gray-100">
                  {kelasWali.map(cls => (
                    <li key={cls.id} className="px-4 py-4 sm:px-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-heading font-bold text-primary-900">{cls.name}</p>
                          <p className="truncate text-sm text-gray-500">{cls.major.name}</p>
                        </div>
                        <span className="angka shrink-0 rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700">{cls.students.length} siswa</span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <Link href={`/dashboard/teacher/attendance/${cls.id}`}
                          className="btn-modal-save justify-center">
                          Isi Absensi
                        </Link>
                        <Link href={`/dashboard/teacher/dkn/${cls.id}`}
                          className="sentuh flex items-center justify-center rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-semibold text-primary-900 transition-colors hover:bg-gray-50">
                          DKN Kelas
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : <PanelKosong ikon={<UsersRound />} teks="Belum menjadi wali kelas mana pun." />}
            </Panel>}

            {/* Panel "Akses Cepat" DIHAPUS 18 Sep 2026 — isinya sudah tercakup kisi "Menu Cepat"
                di atas (keputusan user: jangan ada dua daftar pintasan di satu dashboard). */}

            {mengajar && <Panel judul="Jurnal Terakhir Diisi" ikon={<History />} isi={false}
              tautan={{ label: "Lihat semua", href: "/dashboard/teacher/journal" }}>
              {recentJournals.length > 0 ? (
                <ul className="divide-y divide-gray-100">
                  {recentJournals.map(j => (
                    <li key={j.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-primary-900">{j.subject}</p>
                        <p className="truncate text-xs text-gray-500">{j.class.name} · {j.semester}</p>
                      </div>
                      <span className="shrink-0 text-xs font-medium text-gray-500">
                        {j.date.toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" })}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <PanelKosong ikon={<NotebookText />} teks="Belum ada jurnal yang diisi.">
                  <Link href="/dashboard/teacher/journal" className="panel-tautan mt-1">Isi jurnal sekarang</Link>
                </PanelKosong>
              )}
            </Panel>}

            {mengajar && <AgendaCalendar agenda={agenda} />}
          </div>
        </div>
      </div>
    </div>
  );
}
