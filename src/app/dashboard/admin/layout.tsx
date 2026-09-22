import React from "react";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { getJabatanNames } from "@/lib/jabatan-guard";
import { verifyAdminLayoutAccess, isFullTasJabatan } from "@/lib/tas-access-guard";
import { getOverdueLoanCount } from "@/lib/perpustakaan-notif";
import { getClassesMissingAttendance } from "@/lib/attendance-gaps";
import { getImpersonatorSession } from "@/lib/session";
import AdminSidebar from "@/components/admin/AdminSidebar";
import PusatNotifikasiPortal from "@/components/shared/PusatNotifikasiPortal";
import TasSidebar from "@/components/admin/TasSidebar";
import ImpersonationBanner from "@/components/shared/ImpersonationBanner";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // verifyAdminLayoutAccess: ADMIN & SEMUA staf TAS boleh masuk layout (menu discoped via
  // TasSidebar jabatanNames), guru (TEACHER) cuma kalau merangkap jabatan TU — lihat
  // tas-access-guard.ts. BEDA dgn verifyTasAccess() yg dipakai modul/endpoint TU spesifik.
  const session = await verifyAdminLayoutAccess();
  const impersonator = await getImpersonatorSession();

  const [settings] = await Promise.all([
    getSettings(["logo.emblem", "logo.full_white"]),
  ]);

  const logoEmblem = settings["logo.emblem"];
  const logoFullWhite = settings["logo.full_white"];

  if (session.role === "TAS" || session.role === "TEACHER") {
    const [pendingProfileEdits, jabatanNames, overdueBooks] = await Promise.all([
      prisma.profileEditRequest.count({ where: { status: "PENDING" } }),
      getJabatanNames(session.email),
      getOverdueLoanCount(session.userId),
    ]);
    return (
      <div className="dashboard-shell">
        {impersonator && <ImpersonationBanner adminName={impersonator.name} />}
        <div className="flex min-h-screen">
          <TasSidebar logoEmblem={logoEmblem} logoFullWhite={logoFullWhite} pendingProfileEdits={pendingProfileEdits} overdueBooks={overdueBooks} jabatanNames={jabatanNames} isFullTas={isFullTasJabatan(jabatanNames)} impersonating={!!impersonator} />
          {/* pb-[...]: ruang utk bottom nav bar mobile (fixed, MobileBottomNav di TasSidebar) —
              calc(4rem + safe-area-inset-bottom), BUKAN pb-16 polos, supaya di device ber-notch
              konten paling bawah tidak ketutup strip aman nav (fix responsif 2026-08-23). */}
          <main className="flex-1 min-w-0 min-h-screen lg:pt-0 pt-14 pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-24 print:pt-0 print:pb-0">
            {/* Satu pintu notifikasi (dulu lonceng AdminTopBar terpisah dari tombol notifikasi melayang). */}
            <PusatNotifikasiPortal tindakan={[
              { label: "Perubahan data menunggu verifikasi", count: pendingProfileEdits, href: "/dashboard/admin/verifikasi-data" },
              { label: "Buku terlambat dikembalikan", count: overdueBooks, href: "/dashboard/admin/buku-saya" },
            ]} />
            {children}
          </main>
        </div>
      </div>
    );
  }

  // Role ADMIN: load badge counts and show full AdminSidebar
  const now = new Date();
  const todayMidnightUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const [unreadMessages, pendingAdmissions, pendingProfileEdits, overdueBooks, missingAttendance,
         suratDiajukan, legalisirDiajukan, suratMasukIds, suratSudahDisposisi] = await Promise.all([
    prisma.contactMessage.count({ where: { isRead: false } }),
    prisma.admission.count({ where: { status: "PENDING" } }),
    prisma.profileEditRequest.count({ where: { status: "PENDING" } }),
    getOverdueLoanCount(session.userId),
    getClassesMissingAttendance(todayMidnightUTC),
    prisma.suratKeterangan.count({ where: { requestStatus: "DIAJUKAN" } }),
    prisma.legalisirRequest.count({ where: { requestStatus: "DIAJUKAN" } }),
    prisma.surat.findMany({ where: { tipe: "MASUK" }, select: { id: true } }),
    prisma.disposisi.findMany({ select: { suratId: true }, distinct: ["suratId"] }),
  ]);
  // "Belum didisposisi" dihitung sebagai selisih, bukan kolom status di tabel Surat — supaya
  // tidak ada dua sumber kebenaran yang bisa melenceng saat disposisi dihapus/ditambah.
  const sudah = new Set(suratSudahDisposisi.map(d => d.suratId));
  const belumDisposisi = suratMasukIds.filter(s => !sudah.has(s.id)).length;

  return (
    <div className="dashboard-shell">
      {impersonator && <ImpersonationBanner adminName={impersonator.name} />}
      <div className="flex min-h-screen">
        <AdminSidebar
          unreadMessages={unreadMessages}
          pendingAdmissions={pendingAdmissions}
          pendingProfileEdits={pendingProfileEdits}
          overdueBooks={overdueBooks}
          missingAttendanceClasses={missingAttendance.length}
          permintaanSurat={suratDiajukan + legalisirDiajukan}
          belumDisposisi={belumDisposisi}
          logoEmblem={logoEmblem}
          logoFullWhite={logoFullWhite}
          impersonating={!!impersonator}
        />
        {/* TIDAK pakai pt-14 di sini (beda dari cabang TAS/TEACHER di bawah) — SEMUA 30 halaman
            admin (termasuk dashboard) SUDAH mengkompensasi topbar mobile sendiri lewat wrapper
            baku `pt-16 lg:pt-8` (§3.1 DESIGN_SYSTEM.md) atau varian sejenis di halaman hero.
            SEMPAT ditambah pt-14 di sini (2026-08-22, dikira celah) — TERNYATA bikin DOBEL
            padding (main pt-14 + halaman pt-16 = 120px, harusnya ~59px) — muncul sbg jarak abu2
            kosong di bawah topbar (temuan user via screenshot, 2026-08-23). Dikembalikan ke
            semula: TIDAK ADA pt-* di sini, biarkan tiap halaman yang urus sendiri. pb-[...]
            TETAP ada (ruang bottom nav bar — genuinely baru, tidak ada halaman yg sudah
            kompensasi) — pakai calc(4rem + safe-area-inset-bottom) bukan pb-16 polos, supaya di
            device ber-notch/home-indicator konten tidak ketutup (fix responsif 2026-08-23). */}
        <main className="flex-1 min-w-0 min-h-screen pt-14 lg:pt-0 pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-24 print:pt-0 print:pb-0">
          <PusatNotifikasiPortal tindakan={[
            { label: "Pesan masuk belum dibaca", count: unreadMessages, href: "/dashboard/admin/messages" },
            { label: "Pendaftaran PPDB baru", count: pendingAdmissions, href: "/dashboard/admin/admissions" },
            { label: "Perubahan data menunggu verifikasi", count: pendingProfileEdits, href: "/dashboard/admin/verifikasi-data" },
            { label: "Buku terlambat dikembalikan", count: overdueBooks, href: "/dashboard/admin/buku-saya" },
            { label: "Kelas belum absen hari ini", count: missingAttendance.length, href: "/dashboard/admin/absensi-siswa" },
            { label: "Permintaan surat menunggu diproses", count: suratDiajukan + legalisirDiajukan, href: "/dashboard/admin/permintaan-surat" },
            { label: "Surat masuk belum didisposisi", count: belumDisposisi, href: "/dashboard/admin/disposisi" },
          ]} />
          {children}
        </main>
      </div>
    </div>
  );
}
