import type { Viewport } from "next";

/** TAMPILAN APLIKASI DIKUNCI (18 September 2026, permintaan user): di dalam portal, halaman tidak
 * bisa diperbesar/diperkecil dengan cubitan dua jari maupun ketuk ganda, supaya tata letaknya tidak
 * bergeser saat dipakai bergantian di HP sekolah. Situs publik tidak dikunci. */
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, minimumScale: 1, userScalable: false };

import { verifyRole } from "@/lib/dal";
import { getSettings } from "@/lib/site-settings";
import PortalShell from "@/components/ujian/PortalShell";
import { MENU_PUSAT_UJIAN } from "@/lib/menu-portal";
import { prisma } from "@/lib/prisma";
import { bolehAturUjian } from "@/lib/kegiatan-ujian-server";

export const dynamic = "force-dynamic";

/** PORTAL PETUGAS UJIAN — berdiri sendiri di luar /dashboard, supaya proktor/operator yang masuk
 * ke sini langsung berada di "ruang ujian" tanpa menu dashboard lain. Lihat PortalShell. */
export default async function PusatUjianLayout({ children }: { children: React.ReactNode }) {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  const [s, aktif] = await Promise.all([
    getSettings(["logo.full_white", "school.name"]),
    prisma.kegiatanUjian.findMany({ where: { aktif: true }, select: { singkatan: true }, orderBy: { tanggalMulai: "asc" } }).catch(() => []),
  ]);
  const kembali = session.role === "TEACHER" ? "/dashboard/teacher" : "/dashboard/admin";
  const pengatur = session.role === "TEACHER" && await bolehAturUjian(session).catch(() => false);
  const peran = pengatur ? "Wakil Kepala Kurikulum" : session.role === "TEACHER" ? "Guru" : session.role === "TAS" ? "Tata Usaha" : "Administrator";

  return (
    <PortalShell
      logoUrl={s["logo.full_white"]}
      judul="Pusat Ujian Online"
      subjudul={`${s["school.name"] || "SMK Al Munawwir IIBS"} · ${aktif.length ? `Kegiatan aktif: ${aktif.map(k => k.singkatan).join(" · ")}` : "Computer Based Test"}`}
      nama={session.name}
      peran={`${peran} · ${pengatur || session.role === "ADMIN" ? "Pengatur Ujian" : "Proktor"}`}
      kembaliHref={kembali}
      kembaliLabel="Dashboard"
      menu={MENU_PUSAT_UJIAN}
    >
      {children}
    </PortalShell>
  );
}
