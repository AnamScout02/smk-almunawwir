export const dynamic = "force-dynamic";

import { verifyRole } from "@/lib/dal";
import { menuFavoritAkun } from "@/lib/menu-konteks";
import { prisma } from "@/lib/prisma";
import { pengumumanUntuk } from "@/lib/pengumuman";
import { getParentChildrenOrRedirect, resolveSelectedChild } from "@/lib/parent-guard";
import { computeAttendancePct } from "@/lib/attendance-summary";
import { getJournalGradeAggregates } from "@/lib/journal-grades";
import { getCurrentWeekType } from "@/lib/schedule-week.server";
import { groupConsecutiveSchedules } from "@/lib/schedule-grouping";
import { cekLibur } from "@/lib/hari-libur";
import PageHeader from "@/components/admin/PageHeader";
import { MenuOrtu } from "@/components/shared/MenuPortal";
import StatTile from "@/components/admin/StatTile";
import Panel, { DaftarPengumuman } from "@/components/shared/Panel";
import JadwalHariIni from "@/components/shared/JadwalHariIni";
import Link from "next/link";
import { Megaphone, CalendarClock, CalendarCheck, UsersRound } from "lucide-react";
import { TautanIkon } from "@/components/shared/IkonNama";

// Ikon lucide di halaman server ini hanya di markup server & masing-masing sekali; ke komponen klien kirim NAMA ikon (CLAUDE.md #35).
const STATUS_KELAS: Record<string, string> = {
  HADIR: "bg-emerald-50 text-emerald-700 border-emerald-200",
  IZIN: "bg-blue-50 text-blue-700 border-blue-200",
  SAKIT: "bg-amber-50 text-amber-700 border-amber-200",
  ALPHA: "bg-red-50 text-red-600 border-red-200",
};
const STATUS_LABEL: Record<string, string> = { HADIR: "Hadir", IZIN: "Izin", SAKIT: "Sakit", ALPHA: "Alpha" };
const DAY_LABEL: Record<string, string> = { MINGGU: "Minggu", SENIN: "Senin", SELASA: "Selasa", RABU: "Rabu", KAMIS: "Kamis", JUMAT: "Jumat", SABTU: "Sabtu" };

export default async function ParentDashboard({ searchParams }: { searchParams: Promise<{ studentId?: string }> }) {
  const session = await verifyRole(["PARENT"]);
  const favoritAwal = await menuFavoritAkun(session);
  const { studentId } = await searchParams;
  const children = await getParentChildrenOrRedirect(session);
  const child = resolveSelectedChild(children, studentId);

  const now = new Date();
  // Hari & tanggal menurut WIB — server berjalan di UTC.
  const wib = new Date(now.getTime() + 7 * 3600_000);
  const tanggalWib = wib.toISOString().slice(0, 10);
  const hariIni = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"][wib.getUTCDay()];
  const currentWeekType = await getCurrentWeekType();

  const [attendance, aggregates, netPointsSummary, announcements, schedules, libur] = await Promise.all([
    prisma.attendance.findMany({ where: { studentId: child.id }, orderBy: { date: "desc" } }),
    getJournalGradeAggregates({ studentIds: [child.id] }),
    prisma.studentPointRecord.findMany({ where: { studentId: child.id } }).then(records => {
      const pel = records.filter(r => r.kind === "PELANGGARAN").reduce((a, r) => a + r.points, 0);
      const pre = records.filter(r => r.kind === "PRESTASI").reduce((a, r) => a + r.points, 0);
      const rem = records.filter(r => r.kind === "REMISI").reduce((a, r) => a + r.points, 0);
      return Math.max(0, pel - pre - rem);
    }),
    pengumumanUntuk(session, 5).catch(() => []),
    child.classId && hariIni !== "MINGGU"
      ? prisma.schedule.findMany({
          where: { classId: child.classId, day: hariIni, weekType: { in: ["SEMUA", currentWeekType] }, scheduleType: "BLOK" },
          orderBy: [{ startTime: "asc" }],
        })
      : Promise.resolve([]),
    cekLibur(tanggalWib).catch(() => null),
  ]);

  const attendancePct = computeAttendancePct(attendance);
  const validAvgs = aggregates.filter(g => g.avg !== null).map(g => g.avg as number);
  const avgScore = validAvgs.length ? parseFloat((validAvgs.reduce((a, v) => a + v, 0) / validAvgs.length).toFixed(1)) : 0;
  const recentAtt = attendance.slice(0, 6);

  const slotHariIni = libur ? [] : groupConsecutiveSchedules(schedules, s => s.subject)
    .sort((a, b) => a.first.startTime.localeCompare(b.first.startTime))
    .map(b => ({ id: b.first.id, mulai: b.first.startTime, selesai: b.last.endTime, judul: b.first.subject }));
  const kosongHariIni = libur ? `Hari ini libur — ${libur.nama}.`
    : hariIni === "MINGGU" ? "Hari Minggu, tidak ada jadwal pelajaran." : "Tidak ada jadwal pelajaran hari ini.";

  const namaPanggil = child.user.name;
  const dateStr = now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      {/* Header = PageHeader standar seperti dashboard portal lain (DESIGN_SYSTEM §3.3) — dulu header custom sendiri. */}
      <PageHeader
        icon={<UsersRound size={22} />}
        title="Dashboard Orang Tua"
        description={<><span className="font-medium">{child.user.name}</span> — {child.class?.name ?? "—"} · {child.major.code} · NIS {child.nis}</>}
      />

      <div className="space-y-6">
        <MenuOrtu ringkas={8} hrefSemua="/dashboard/parent/menu" judul="Menu Cepat" favoritAwal={favoritAwal} />

        <div className="masuk-halus flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="judul-seimbang font-heading text-xl font-bold text-primary-900 sm:text-2xl">Perkembangan {namaPanggil}</h2>
            <p className="mt-0.5 text-sm text-gray-500">{dateStr}</p>
          </div>
          {children.length > 1 && (
            <nav aria-label="Pilih anak" className="flex flex-wrap gap-2">
              {children.map(c => {
                const dipilih = c.id === child.id;
                return (
                  <Link key={c.id} href={`/dashboard/parent?studentId=${c.id}`} aria-current={dipilih ? "page" : undefined}
                    className={`sentuh inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${dipilih ? "bg-primary-900 text-white" : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}>
                    {c.user.name}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>

        <DaftarPengumuman ikon={<Megaphone />} pengumuman={announcements} />

        <div className="kisi-kartu kisi-kartu-3">
          <StatTile tampilan="lembut" href="/dashboard/parent/rapor" ikon="prestasi" label="Rata-rata Nilai" value={avgScore || "—"} color="amber"
            sublabel={avgScore >= 80 ? "Di atas rata-rata" : avgScore >= 75 ? "Memenuhi KKM" : avgScore ? "Perlu ditingkatkan" : "Belum ada data"} />
          <StatTile tampilan="lembut" href="/dashboard/parent/absensi" ikon="hadir" label="Kehadiran" value={`${attendancePct}%`} color="emerald"
            sublabel={`${attendance.length} hari tercatat`} />
          <StatTile tampilan="lembut" ikon="perisai" label="Poin Kedisiplinan" value={`${netPointsSummary}/100`}
            color={netPointsSummary >= 50 ? "red" : "primary"} sorot={netPointsSummary >= 25}
            sublabel={netPointsSummary < 25 ? "Aman" : "Perlu perhatian"} />
        </div>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <Panel judul="Jadwal Hari Ini" ikon={<CalendarClock />} keterangan={DAY_LABEL[hariIni]} className="lg:col-span-7"
            tautan={{ label: "Seminggu", href: "/dashboard/parent/jadwal" }}>
            <JadwalHariIni slot={slotHariIni} kosong={kosongHariIni} />
          </Panel>

          <div className="kolom-dashboard min-w-0 space-y-6 lg:col-span-5">
            <Panel judul="Catatan Absensi Terakhir" ikon={<CalendarCheck />} isi={false}
              tautan={{ label: "Rekap", href: "/dashboard/parent/absensi" }}>
              {recentAtt.length > 0 ? (
                <ul className="divide-y divide-gray-100">
                  {recentAtt.map(a => (
                    <li key={a.id} className="flex items-center justify-between px-4 py-2.5 sm:px-5">
                      <span className="text-sm text-gray-600">
                        {new Date(a.date).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Jakarta" })}
                      </span>
                      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_KELAS[a.status] ?? "border-gray-200 bg-gray-50 text-gray-600"}`}>
                        {STATUS_LABEL[a.status] ?? a.status}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : <p className="px-5 py-10 text-center text-sm text-gray-400">Belum ada catatan absensi.</p>}
            </Panel>

            <TautanIkon href="/dashboard/parent/rapor" ikon="cetak" ukuran={16} ikonClassName="text-primary-700"
              className="panel panel-interaktif masuk-halus sentuh flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-semibold text-primary-900">
              Lihat Rapor Lengkap
            </TautanIkon>
          </div>
        </div>
      </div>
    </div>
  );
}
