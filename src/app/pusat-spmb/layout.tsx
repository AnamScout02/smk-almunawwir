import type { Viewport } from "next";

/** Tampilan dikunci di dalam portal (pola Pusat Ujian) supaya tata letak tidak bergeser saat HP
 *  sekolah dipakai bergantian. Situs publik tidak dikunci. */
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, minimumScale: 1, userScalable: false };

import { redirect } from "next/navigation";
import { verifyRole } from "@/lib/dal";
import { getSettings } from "@/lib/site-settings";
import PortalShell from "@/components/ujian/PortalShell";
import { MENU_PUSAT_SPMB } from "@/lib/menu-portal";
import { prisma } from "@/lib/prisma";
import { bolehSpmb, gelombangDibuka } from "@/lib/spmb";

export const dynamic = "force-dynamic";

/** PUSAT SPMB — portal panitia penerimaan murid baru, berdiri sendiri di luar /dashboard
 *  (permintaan user 1 Oktober 2026: "spmb khusus punya portal sendiri seperti ujian"). */
export default async function PusatSpmbLayout({ children }: { children: React.ReactNode }) {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  if (!(await bolehSpmb(session))) redirect(session.role === "TEACHER" ? "/dashboard/teacher" : "/dashboard/admin");

  const [s, gelombang, jumlah] = await Promise.all([
    getSettings(["logo.full_white", "school.name", "spmb.tahun"]),
    gelombangDibuka().catch(() => null),
    prisma.admission.count().catch(() => 0),
  ]);
  const kembali = session.role === "TEACHER" ? "/dashboard/teacher" : "/dashboard/admin";
  const keadaan = gelombang
    ? `Dibuka: ${gelombang.nama}`
    : jumlah > 0 ? "Pendaftaran sedang tutup" : "Belum ada gelombang dibuka";

  return (
    <PortalShell
      logoUrl={s["logo.full_white"]}
      judul="Pusat SPMB"
      subjudul={`${s["school.name"] || "SMK Al Munawwir IIBS"} · Tahun ${s["spmb.tahun"]} · ${keadaan}`}
      nama={session.name}
      peran={`${session.role === "TEACHER" ? "Panitia SPMB" : session.role === "TAS" ? "Tata Usaha" : "Administrator"}`}
      kembaliHref={kembali}
      kembaliLabel="Dashboard"
      menu={MENU_PUSAT_SPMB}
    >
      {children}
    </PortalShell>
  );
}
