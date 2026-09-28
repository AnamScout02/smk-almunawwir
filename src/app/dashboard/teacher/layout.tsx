import { verifyRole } from "@/lib/dal";
import { getSettings } from "@/lib/site-settings";
import { prisma } from "@/lib/prisma";
import { getWeekTypeForDate } from "@/lib/schedule-week.server";
import { getOverdueLoanCount } from "@/lib/perpustakaan-notif";
import { getImpersonatorSession } from "@/lib/session";
import TeacherSidebar from "@/components/teacher/TeacherSidebar";
import PusatNotifikasiPortal from "@/components/shared/PusatNotifikasiPortal";
import ImpersonationBanner from "@/components/shared/ImpersonationBanner";
import { bagianWib } from "@/lib/waktu-wib";
import { antreanGuru } from "@/lib/antrean-kerja";

const DAYS = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const session = await verifyRole(["TEACHER", "ADMIN"]);
  const impersonator = await getImpersonatorSession();
  const [s, teacher, overdueBooks] = await Promise.all([
    getSettings(["logo.emblem", "logo.full_white"]),
    prisma.teacher.findFirst({
      where: { user: { email: session.email } },
      select: {
        id: true, userId: true,
        homeroomOf: { select: { id: true } },
        jabatan: { select: { jabatan: { select: { name: true } } } },
        _count: { select: { internshipsSupervised: true, homeroomOf: true, teachingLoad: true } },
      },
    }),
    getOverdueLoanCount(session.userId),
  ]);
  const jabatanNames = teacher?.jabatan.map(j => j.jabatan.name) ?? [];
  const hasInternshipBimbingan = (teacher?._count.internshipsSupervised ?? 0) > 0;
  const hasHomeroom = (teacher?._count.homeroomOf ?? 0) > 0;
  const hasTeaching = (teacher?._count.teachingLoad ?? 0) > 0;

  // Menu Kedisiplinan Guru cuma muncul pas HARI INI guru ini memang terjadwal piket di Jadwal
  // Piket (DutyRoster) — TIDAK perlu jabatan formal "Guru Piket" (piket di sini dijalankan
  // bergiliran oleh banyak guru sesuai jadwal, bukan dipegang tetap oleh jabatan tertentu).
  // Wakasek Kurikulum/Penjamin Mutu tidak perlu cek ini (selalu boleh, lihat kedisiplinan-guard.ts).
  let isGuruPiketOnDutyToday = false;
  if (teacher) {
    // Hari di WIB, bukan jam server (UTC) — pukul 00.00–07.00 WIB server masih di hari kemarin (CLAUDE.md #42).
    const today = new Date();
    const day = DAYS[bagianWib(today).hariKe];
    const weekType = await getWeekTypeForDate(today);
    const duty = await prisma.dutyRoster.findFirst({
      where: { userId: teacher.userId, day, OR: [{ weekType: "SEMUA" }, { weekType }] },
    });
    isGuruPiketOnDutyToday = !!duty;
  }

  // Antrean "Perlu tindakan" per jabatan — tampil di kotak notifikasi (satu pintu, CLAUDE.md #31).
  const tindakan = await antreanGuru({
    userId: session.userId, teacherId: teacher?.id ?? null, jabatan: jabatanNames,
    waliKelasIds: teacher?.homeroomOf.map(c => c.id) ?? [],
  });

  return (
    <div className="dashboard-shell">
      {impersonator && <ImpersonationBanner adminName={impersonator.name} />}
      <div className="flex min-h-dvh">
        <TeacherSidebar
          logoEmblem={s["logo.emblem"]}
          logoFullWhite={s["logo.full_white"]}
          jabatanNames={jabatanNames}
          hasInternshipBimbingan={hasInternshipBimbingan}
          isGuruPiketOnDutyToday={isGuruPiketOnDutyToday}
          overdueBooks={overdueBooks}
          hasHomeroom={hasHomeroom}
          impersonating={!!impersonator}
          tindakan={tindakan}
          hasTeaching={hasTeaching}
        />
        {/* pb-[...]: ruang utk bottom nav bar mobile — calc(4rem + safe-area-inset-bottom), lihat
            komentar sama di dashboard/student/layout.tsx (fix device ber-notch 2026-08-23). */}
        <main className="flex-1 min-w-0 pt-14 lg:pt-0 pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-24 print:pt-0 print:pb-0 min-h-dvh">
          <PusatNotifikasiPortal tindakan={tindakan} />
          {children}
        </main>
      </div>
    </div>
  );
}
