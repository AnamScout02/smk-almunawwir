import { verifyRole } from "@/lib/dal";
import { getSettings } from "@/lib/site-settings";
import { prisma } from "@/lib/prisma";
import { getWeekTypeForDate } from "@/lib/schedule-week.server";
import { getOverdueLoanCount } from "@/lib/perpustakaan-notif";
import { getImpersonatorSession } from "@/lib/session";
import TeacherSidebar from "@/components/teacher/TeacherSidebar";
import ImpersonationBanner from "@/components/shared/ImpersonationBanner";

const DAYS = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const session = await verifyRole(["TEACHER", "ADMIN"]);
  const impersonator = await getImpersonatorSession();
  const [s, teacher, overdueBooks] = await Promise.all([
    getSettings(["logo.emblem", "logo.full_white"]),
    prisma.teacher.findFirst({
      where: { user: { email: session.email } },
      select: {
        userId: true,
        jabatan: { select: { jabatan: { select: { name: true } } } },
        _count: { select: { internshipsSupervised: true, homeroomOf: true } },
      },
    }),
    getOverdueLoanCount(session.userId),
  ]);
  const jabatanNames = teacher?.jabatan.map(j => j.jabatan.name) ?? [];
  const hasInternshipBimbingan = (teacher?._count.internshipsSupervised ?? 0) > 0;
  const hasHomeroom = (teacher?._count.homeroomOf ?? 0) > 0;

  // Menu Kedisiplinan Guru cuma muncul pas HARI INI guru ini memang terjadwal piket di Jadwal
  // Piket (DutyRoster) — TIDAK perlu jabatan formal "Guru Piket" (piket di sini dijalankan
  // bergiliran oleh banyak guru sesuai jadwal, bukan dipegang tetap oleh jabatan tertentu).
  // Wakasek Kurikulum/Penjamin Mutu tidak perlu cek ini (selalu boleh, lihat kedisiplinan-guard.ts).
  let isGuruPiketOnDutyToday = false;
  if (teacher) {
    const today = new Date();
    const day = DAYS[today.getDay()];
    const weekType = await getWeekTypeForDate(today);
    const duty = await prisma.dutyRoster.findFirst({
      where: { userId: teacher.userId, day, OR: [{ weekType: "SEMUA" }, { weekType }] },
    });
    isGuruPiketOnDutyToday = !!duty;
  }

  return (
    <div style={{ backgroundColor: "#f0f2f7" }}>
      {impersonator && <ImpersonationBanner adminName={impersonator.name} />}
      <div className="flex min-h-screen">
        <TeacherSidebar
          logoEmblem={s["logo.emblem"]}
          logoFullWhite={s["logo.full_white"]}
          jabatanNames={jabatanNames}
          hasInternshipBimbingan={hasInternshipBimbingan}
          isGuruPiketOnDutyToday={isGuruPiketOnDutyToday}
          overdueBooks={overdueBooks}
          hasHomeroom={hasHomeroom}
        />
        <main className="flex-1 min-w-0 lg:ml-56 pt-14 lg:pt-0 min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
}
