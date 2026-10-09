import type { Viewport } from "next";
import { redirect } from "next/navigation";
import { verifyRole } from "@/lib/dal";
import { getSettings } from "@/lib/site-settings";
import PortalShell from "@/components/ujian/PortalShell";
import { MENU_PUSAT_PKL } from "@/lib/menu-portal";
import { aksesPusatPkl } from "@/lib/pkl-humas";

export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, minimumScale: 1, userScalable: false };
export const dynamic = "force-dynamic";

/** PUSAT PKL (9 Oktober 2026) — portal Humas untuk seluruh urusan Praktik Kerja Lapangan, berdiri sendiri di luar
 *  /dashboard (pola Pusat SPMB). Dulu penempatan hanya ada di /dashboard/admin/internships, yang TIDAK bisa dibuka
 *  Wakil Kepala Humas karena layout Admin hanya menerima jabatan Tata Usaha (CLAUDE.md #45). */
export default async function PusatPklLayout({ children }: { children: React.ReactNode }) {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  const kembali = session.role === "TEACHER" ? "/dashboard/teacher" : "/dashboard/admin";
  if (!(await aksesPusatPkl(session))) redirect(kembali);
  const s = await getSettings(["logo.full_white", "school.name"]);
  return (
    <PortalShell
      logoUrl={s["logo.full_white"]}
      judul="Pusat PKL"
      subjudul={`${s["school.name"] || "SMK Al Munawwir IIBS"} · Praktik Kerja Lapangan`}
      nama={session.name}
      peran={session.role === "TEACHER" ? "Humas" : session.role === "TAS" ? "Tata Usaha" : "Administrator"}
      kembaliHref={kembali}
      kembaliLabel="Dashboard"
      menu={MENU_PUSAT_PKL}
    >
      {children}
    </PortalShell>
  );
}
