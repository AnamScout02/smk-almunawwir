import type { Viewport } from "next";

/** TAMPILAN APLIKASI DIKUNCI (18 September 2026, permintaan user): di dalam portal, halaman tidak
 * bisa diperbesar/diperkecil dengan cubitan dua jari maupun ketuk ganda, supaya tata letaknya tidak
 * bergeser saat dipakai bergantian di HP sekolah. Situs publik tidak dikunci. */
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, minimumScale: 1, userScalable: false };

import { redirect } from "next/navigation";
import { verifyRole } from "@/lib/dal";
import { getSettings } from "@/lib/site-settings";
import { assertPerpustakaan } from "@/lib/perpustakaan-guard";
import PortalShell from "@/components/ujian/PortalShell";
import { MENU_PUSAT_PERPUSTAKAAN } from "@/lib/menu-portal";

export const dynamic = "force-dynamic";

/** PUSAT PERPUSTAKAAN — portal petugas yang berdiri sendiri di luar /dashboard (pola sama Pusat Ujian):
 * meja sirkulasi, kiosk kunjungan, katalog & data, laporan. Khusus Koordinator/Tim Perpustakaan & Admin. */
export default async function PusatPerpustakaanLayout({ children }: { children: React.ReactNode }) {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  let boleh = true;
  try { await assertPerpustakaan(session); } catch { boleh = false; }
  if (!boleh) redirect(session.role === "TEACHER" ? "/dashboard/teacher" : "/dashboard/admin");
  const s = await getSettings(["logo.full_white", "school.name"]);
  const peran = session.role === "ADMIN" ? "Administrator" : "Petugas Perpustakaan";
  return (
    <PortalShell
      logoUrl={s["logo.full_white"]}
      judul="Pusat Perpustakaan"
      subjudul={`${s["school.name"] || "SMK Al Munawwir IIBS"} · Layanan & Sirkulasi`}
      nama={session.name}
      peran={peran}
      kembaliHref={session.role === "TEACHER" ? "/dashboard/teacher" : "/dashboard/admin"}
      kembaliLabel="Dashboard"
      menu={MENU_PUSAT_PERPUSTAKAAN}
    >
      {children}
    </PortalShell>
  );
}
