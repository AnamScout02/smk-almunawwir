import type { Viewport } from "next";
import { redirect } from "next/navigation";
import { verifyRole } from "@/lib/dal";
import { getSettings } from "@/lib/site-settings";
import PortalShell from "@/components/ujian/PortalShell";
import { MENU_PUSAT_EKSTRA } from "@/lib/menu-portal";
import { aksesEkstra } from "@/lib/ekstra-server";

export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, minimumScale: 1, userScalable: false };
export const dynamic = "force-dynamic";

/** PUSAT EKSTRAKURIKULER (10 Oktober 2026) — portal koordinator & pembina, di luar /dashboard (pola Pusat PKL).
 *  Menu "Pembina & Tautan" hanya untuk yang berhak mengelola (koordinator, Admin, TU penuh). */
export default async function PusatEkstraLayout({ children }: { children: React.ReactNode }) {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  const kembali = session.role === "TEACHER" ? "/dashboard/teacher" : "/dashboard/admin";
  const a = await aksesEkstra(session);
  if (!a.masuk) redirect(kembali);
  const s = await getSettings(["logo.full_white", "school.name"]);
  return (
    <PortalShell
      logoUrl={s["logo.full_white"]}
      judul="Pusat Ekstrakurikuler"
      subjudul={`${s["school.name"] || "SMK Al Munawwir IIBS"} · Ekstrakurikuler & organisasi siswa`}
      nama={session.name}
      peran={a.kelola ? (session.role === "ADMIN" ? "Administrator" : "Koordinator") : "Pembina"}
      kembaliHref={kembali}
      kembaliLabel="Dashboard"
      menu={a.kelola ? MENU_PUSAT_EKSTRA : MENU_PUSAT_EKSTRA.filter(m => m.href !== "/pusat-ekstra/pembina")}
    >
      {children}
    </PortalShell>
  );
}
