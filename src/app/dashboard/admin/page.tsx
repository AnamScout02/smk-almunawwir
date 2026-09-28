export const dynamic = "force-dynamic";

import { verifyRole } from "@/lib/dal";
import { getJabatanNames } from "@/lib/jabatan-guard";
import { isFullTasJabatan } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";
import {
  ClipboardList, Newspaper, MessageSquare, LayoutDashboard, TriangleAlert, ChartColumn, Inbox, FileText, SquarePen, Building2,
} from "lucide-react";
import Link from "next/link";
import { getWakilKepalaAgenda } from "@/lib/agenda";
import PageHeader from "@/components/admin/PageHeader";
import { MenuAdmin, MenuTas } from "@/components/shared/MenuPortal";
import { konteksMenuTas, menuFavoritAkun } from "@/lib/menu-konteks";
import StatTile from "@/components/admin/StatTile";
import AgendaCalendar from "@/components/shared/AgendaCalendar";
import Panel, { PanelKosong } from "@/components/shared/Panel";
import { BarDaftar, DonatBagian } from "@/components/shared/GrafikRingkas";

// Ikon lucide di halaman server ini hanya dirender di markup server (PageHeader, Panel) dan masing-masing SEKALI.
// JANGAN mengoper elemen ikon ke komponen klien (StatTile, Link): pakai NAMA ikon — lihat IkonNama.tsx & CLAUDE.md #35
// (15 Sep 2026 halaman ini 500 di produksi karena itu).
const WARNA_L = "#1B2B6B";
const WARNA_P = "#E8A020";

// PENTING: TETAP verifyRole(["ADMIN","TAS"]) di sini, BUKAN verifyTasAccess() — halaman ini
// landing page WAJIB semua akun TAS (lihat proxy.ts), non-TU TAS harus TETAP bisa masuk & lihat
// versi ringkas (bukan diredirect /login). Pengecualian sengaja dari pola file lain di bawah ini.
export default async function AdminDashboard() {
  const session = await verifyRole(["ADMIN", "TAS"]);
  const favoritAwal = await menuFavoritAkun(session);
  const jabatanMenu = session.role === "ADMIN" ? [] : (await konteksMenuTas(session)).jabatanNames;

  // PERBAIKAN KRITIS 2026-08-10 (temuan user): halaman ini adalah landing page OTOMATIS semua
  // akun role TAS setelah login (lihat proxy.ts roleRedirect) — dulu menampilkan statistik PENUH
  // (jumlah siswa, isi pesan masuk, data pendaftar) ke SIAPAPUN role TAS tanpa cek jabatan sama
  // sekali, termasuk Security/Kebersihan. Sekarang staf TAS non-TU cukup lihat halaman ringkas —
  // menu jabatan-scoped mereka tetap ada di sidebar (TasSidebar sudah discoped dgn benar).
  if (session.role === "TAS") {
    const jabatanNames = await getJabatanNames(session.email);
    if (!isFullTasJabatan(jabatanNames)) {
      return (
        <div className="flex min-h-[80dvh] items-center justify-center p-8 pt-16 lg:pt-8">
          <div className="panel masuk-halus max-w-sm p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
              <Building2 size={26} />
            </div>
            <h1 className="mb-1 font-heading text-lg font-bold text-primary-900">Selamat Datang, {session.name}</h1>
            <p className="text-sm text-gray-500">
              {jabatanNames.length > 0
                ? `Gunakan menu di sidebar sesuai tugas Anda (${jabatanNames.join(", ")}).`
                : "Belum ada jabatan yang ditetapkan untuk akun Anda — hubungi Admin."}
            </p>
          </div>
        </div>
      );
    }
  }

  const [
    userCount, studentCount, teacherCount, classCount,
    admissionPending, messageUnread, newsCount,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.student.count({ where: { studentStatus: "AKTIF" } }),
    prisma.teacher.count(),
    prisma.class.count(),
    prisma.admission.count({ where: { status: "PENDING" } }),
    prisma.contactMessage.count({ where: { isRead: false } }),
    prisma.news.count({ where: { published: true } }),
  ]);

  const [studentGenderRaw, teacherGenderRaw, majorsWithCount, studentsForGradeRecap] = await Promise.all([
    prisma.student.groupBy({ by: ["gender"], where: { studentStatus: "AKTIF" }, _count: { _all: true } }),
    prisma.teacher.groupBy({ by: ["gender"], _count: { _all: true } }),
    prisma.major.findMany({
      select: { code: true, name: true, themeColor: true, _count: { select: { students: { where: { studentStatus: "AKTIF" } } } } },
      orderBy: { students: { _count: "desc" } },
    }),
    prisma.student.findMany({ where: { studentStatus: "AKTIF" }, select: { gender: true, class: { select: { grade: true } } } }),
  ]);

  const GRADE_LABEL: Record<number, string> = { 10: "X", 11: "XI", 12: "XII" };
  const gradeRecap = [10, 11, 12].map(grade => {
    const rows = studentsForGradeRecap.filter(s => s.class?.grade === grade);
    const l = rows.filter(s => s.gender === "L").length;
    const p = rows.filter(s => s.gender === "P").length;
    return { grade, label: GRADE_LABEL[grade], l, p, jml: rows.length };
  });

  const genderCount = (rows: { gender: string | null; _count: { _all: number } }[]) => ({
    L: rows.find(r => r.gender === "L")?._count._all ?? 0,
    P: rows.find(r => r.gender === "P")?._count._all ?? 0,
  });
  const studentGender = genderCount(studentGenderRaw);
  const teacherGender = genderCount(teacherGenderRaw);
  const majorStats = majorsWithCount
    .filter(m => m._count.students > 0)
    .map(m => ({ kunci: m.code, label: m.code, sublabel: m.name, nilai: m._count.students, warna: m.themeColor || WARNA_L }));

  const now = new Date();

  const [noGenderStudents, noGenderTeachers, unclassedStudents, agenda] = await Promise.all([
    prisma.student.count({ where: { studentStatus: "AKTIF", gender: null } }),
    prisma.teacher.count({ where: { gender: null } }),
    prisma.student.count({ where: { studentStatus: "AKTIF", classId: null } }),
    getWakilKepalaAgenda(),
  ]);

  const dataGaps = [
    { label: "Siswa belum ada jenis kelamin", count: noGenderStudents, href: "/dashboard/admin/buku-induk/siswa" },
    { label: "Guru belum ada jenis kelamin", count: noGenderTeachers, href: "/dashboard/admin/buku-induk/guru" },
    { label: "Siswa belum punya kelas", count: unclassedStudents, href: "/dashboard/admin/buku-induk/siswa" },
  ].filter(g => g.count > 0);

  const [recentAdmissions, recentNews, recentMessages] = await Promise.all([
    prisma.admission.findMany({
      orderBy: { createdAt: "desc" }, take: 5,
      select: { id: true, fullName: true, chosenMajor: true, status: true, createdAt: true },
    }),
    prisma.news.findMany({
      where: { published: true }, orderBy: { createdAt: "desc" }, take: 4,
      select: { id: true, title: true, category: true, createdAt: true },
    }),
    prisma.contactMessage.findMany({
      orderBy: { createdAt: "desc" }, take: 5,
      select: { id: true, name: true, subject: true, isRead: true, createdAt: true },
    }),
  ]);

  const statusConfig: Record<string, { label: string; kelas: string; dot: string }> = {
    PENDING:   { label: "Menunggu",  kelas: "bg-amber-50 border-amber-200 text-amber-700",       dot: "bg-amber-500" },
    WAWANCARA: { label: "Wawancara", kelas: "bg-blue-50 border-blue-200 text-blue-700",          dot: "bg-blue-500" },
    ACCEPTED:  { label: "Diterima",  kelas: "bg-emerald-50 border-emerald-200 text-emerald-700", dot: "bg-emerald-500" },
    REJECTED:  { label: "Ditolak",   kelas: "bg-red-50 border-red-200 text-red-600",             dot: "bg-red-500" },
  };

  const dateStr = now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
  const tglPendek = (d: Date) => d.toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" });

  function timeAgo(date: Date) {
    const diff = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);
    if (diff < 60) return "baru saja";
    if (diff < 3600) return `${Math.floor(diff / 60)} mnt lalu`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
    return `${Math.floor(diff / 86400)} hari lalu`;
  }

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      {/* Header = PageHeader standar (keputusan user 2026-08-23, gotcha #16/#18): tanpa tombol/badge. */}
      <PageHeader
        icon={<LayoutDashboard size={22} />}
        title="Dashboard Administrator"
        description={<>Selamat datang, <span className="font-medium">{session.name}</span><span className="hidden sm:inline"> — {dateStr}</span></>}
      />

      <div className="space-y-6">
        {/* Kisi menu ala aplikasi bank (18 Sep 2026) — seluruh menu portal dikumpulkan di dashboard. */}
        {session.role === "ADMIN"
          ? <MenuAdmin ringkas={12} hrefSemua="/dashboard/admin/menu" judul="Menu Cepat" favoritAwal={favoritAwal} />
          : <MenuTas ringkas={12} hrefSemua="/dashboard/admin/menu" judul="Menu Cepat" favoritAwal={favoritAwal} jabatanNames={jabatanMenu} />}

        {/* Hanya muncul bila memang ada data yang perlu dilengkapi. */}
        {dataGaps.length > 0 && (
          <div role="status" className="masuk-halus flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center">
            <p className="flex shrink-0 items-center gap-2 text-sm font-semibold text-amber-800">
              <TriangleAlert size={16} className="text-amber-600" /> Data perlu dilengkapi
            </p>
            <div className="flex flex-wrap gap-2">
              {dataGaps.map(g => (
                <Link key={g.label} href={g.href}
                  className="sentuh inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-white/70 px-3 py-1 text-sm text-amber-800 transition-colors hover:bg-white">
                  {g.label} <span className="angka font-bold">{g.count}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Angka utama: warna chip mengikuti arti (amber/merah HANYA bila ada yang menunggu) ── */}
        <div className="kisi-kartu kisi-kartu-6">
          <StatTile tampilan="lembut" href="/dashboard/admin/students" ikon="siswa" label="Siswa Aktif" value={studentCount} color="blue" />
          <StatTile tampilan="lembut" href="/dashboard/admin/teachers" ikon="guru" label="Tenaga Pendidik" value={teacherCount} color="emerald" />
          <StatTile tampilan="lembut" href="/dashboard/admin/classes" ikon="kelas" label="Kelas" value={classCount} color="purple" />
          <StatTile tampilan="lembut" href="/dashboard/admin/users" ikon="akun" label="Akun Pengguna" value={userCount} color="primary" />
          <StatTile tampilan="lembut" href="/dashboard/admin/admissions" ikon="menunggu" label="Pendaftar Menunggu" value={admissionPending} color="amber" sorot={admissionPending > 0} />
          <StatTile tampilan="lembut" href="/dashboard/admin/messages" ikon="pesan" label="Pesan Belum Dibaca" value={messageUnread} color="red" sorot={messageUnread > 0} />
        </div>

        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
          <div className="kolom-dashboard min-w-0 space-y-6 xl:col-span-8">
            {/* ── Komposisi siswa: satu panel menggantikan 2 donat + grafik batang + rekap per tingkat ── */}
            <Panel judul="Komposisi Siswa Aktif" ikon={<ChartColumn />} className="@container"
              tautan={{ label: "Rekap lengkap", href: "/dashboard/admin/reports/rekap-siswa" }}>
              <div className="grid grid-cols-1 gap-6 @3xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] @3xl:gap-8">
                <div className="min-w-0 space-y-5">
                  {/* Donat L/P siswa & guru berdampingan (pilihan user 15 Sep 2026: "donat + batang berwarna"). */}
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <DonatBagian judul="Siswa aktif" satuan="siswa"
                      bagian={[{ label: "Laki-laki", nilai: studentGender.L, warna: WARNA_L }, { label: "Perempuan", nilai: studentGender.P, warna: WARNA_P }]} />
                    <DonatBagian judul="Tenaga pendidik" satuan="guru"
                      bagian={[{ label: "Laki-laki", nilai: teacherGender.L, warna: WARNA_L }, { label: "Perempuan", nilai: teacherGender.P, warna: WARNA_P }]} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {gradeRecap.map(g => (
                      <div key={g.grade} className="rounded-xl bg-primary-50/70 px-3 py-2.5">
                        <p className="text-xs font-semibold text-gray-500">Kelas {g.label}</p>
                        <p className="angka font-heading text-xl font-bold text-primary-900">{g.jml}</p>
                        <p className="angka text-xs text-gray-500">L {g.l} · P {g.p}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">{studentCount.toLocaleString("id-ID")} siswa aktif tersebar di {classCount} kelas.</p>
                </div>
                <div className="min-w-0">
                  <p className="label-kecil mb-3">Per konsentrasi keahlian</p>
                  {majorStats.length
                    ? <BarDaftar data={majorStats} satuan="siswa" />
                    : <p className="text-sm text-gray-400">Belum ada siswa aktif per jurusan.</p>}
                </div>
              </div>
            </Panel>

            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
              <Panel judul="Pendaftaran Terbaru" ikon={<ClipboardList />} isi={false}
                tautan={{ label: "Lihat semua", href: "/dashboard/admin/admissions" }}>
                {recentAdmissions.length ? (
                  <ul className="divide-y divide-gray-100">
                    {recentAdmissions.map(a => {
                      const cfg = statusConfig[a.status];
                      return (
                        <li key={a.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-sm font-bold text-primary-700" aria-hidden="true">
                            {a.fullName.charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-primary-900">{a.fullName}</p>
                            <p className="truncate text-xs text-gray-500">{a.chosenMajor} · {timeAgo(a.createdAt)}</p>
                          </div>
                          <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${cfg?.kelas ?? "border-gray-200 bg-gray-50 text-gray-600"}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${cfg?.dot ?? "bg-gray-400"}`} />
                            {cfg?.label ?? a.status}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : <PanelKosong ikon={<FileText />} teks="Belum ada pendaftaran masuk." />}
              </Panel>

              <Panel judul="Pesan Masuk" ikon={<MessageSquare />} isi={false}
                tautan={{ label: "Lihat semua", href: "/dashboard/admin/messages" }}>
                {recentMessages.length ? (
                  <ul className="divide-y divide-gray-100">
                    {recentMessages.map(msg => (
                      <li key={msg.id}>
                        <Link href="/dashboard/admin/messages" className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50 sm:px-5">
                          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${msg.isRead ? "bg-gray-100 text-gray-500" : "bg-primary-50 text-primary-700"}`} aria-hidden="true">
                            {msg.name.charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className={`truncate text-sm ${msg.isRead ? "text-gray-600" : "font-semibold text-primary-900"}`}>{msg.name}</p>
                            <p className="truncate text-xs text-gray-500">{msg.subject}</p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <span className="text-xs text-gray-400">{timeAgo(msg.createdAt)}</span>
                            {!msg.isRead && <span className="h-2 w-2 rounded-full bg-red-500"><span className="sr-only">Belum dibaca</span></span>}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : <PanelKosong ikon={<Inbox />} teks="Belum ada pesan masuk." />}
              </Panel>
            </div>
          </div>

          <div className="kolom-dashboard min-w-0 space-y-6 xl:col-span-4">
            <AgendaCalendar agenda={agenda} />

            <Panel judul="Berita Terbaru" ikon={<Newspaper />} isi={false} keterangan={`${newsCount} terbit`}>
              {recentNews.length ? (
                <ul className="divide-y divide-gray-100">
                  {recentNews.map(n => (
                    <li key={n.id}>
                      <Link href="/dashboard/admin/news" className="block px-4 py-3 transition-colors hover:bg-gray-50 sm:px-5">
                        <p className="line-clamp-2 text-sm font-medium text-primary-900">{n.title}</p>
                        <p className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                          {tglPendek(n.createdAt)}
                          <span className="rounded bg-primary-50 px-1.5 py-0.5 font-medium text-primary-700">{n.category}</span>
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : <PanelKosong ikon={<SquarePen />} teks="Belum ada berita yang terbit." />}
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
