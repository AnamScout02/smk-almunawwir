import type { Viewport } from "next";

/** TAMPILAN APLIKASI DIKUNCI (18 September 2026, permintaan user): di dalam portal, halaman tidak
 * bisa diperbesar/diperkecil dengan cubitan dua jari maupun ketuk ganda, supaya tata letaknya tidak
 * bergeser saat dipakai bergantian di HP sekolah. Situs publik tidak dikunci. */
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, minimumScale: 1, userScalable: false };

import { verifyRole } from "@/lib/dal";
import { getSettings } from "@/lib/site-settings";
import { getJabatanNames } from "@/lib/jabatan-guard";
import PortalShell from "@/components/ujian/PortalShell";
import { menuPerpustakaanAnggota } from "@/lib/menu-portal";

export const dynamic = "force-dynamic";

const DASHBOARD: Record<string, string> = { ADMIN: "/dashboard/admin", TAS: "/dashboard/admin", TEACHER: "/dashboard/teacher", STUDENT: "/dashboard/student" };

/** PERPUSTAKAAN DIGITAL — portal anggota (siswa, guru, pegawai): katalog & pesan buku, pinjaman saya, kartu
 * anggota digital (QR untuk dipindai petugas), dan peringkat. Petugas mendapat tab tambahan ke Pusat Perpustakaan. */
export default async function PerpustakaanAnggotaLayout({ children }: { children: React.ReactNode }) {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER", "STUDENT"]);
  const [s, jabatan] = await Promise.all([
    getSettings(["logo.full_white", "school.name"]),
    session.role === "STUDENT" ? Promise.resolve([] as string[]) : getJabatanNames(session.email).catch(() => [] as string[]),
  ]);
  const petugas = session.role === "ADMIN" || jabatan.some(j => j === "Koordinator Perpustakaan" || j === "Tim Perpustakaan");
  const peran = { ADMIN: "Administrator", TAS: "Pegawai", TEACHER: "Guru", STUDENT: "Siswa" }[session.role as "ADMIN"] ?? "Anggota";
  return (
    <PortalShell
      logoUrl={s["logo.full_white"]}
      judul="Perpustakaan Digital"
      subjudul={`${s["school.name"] || "SMK Al Munawwir IIBS"} · Katalog & Layanan Anggota`}
      nama={session.name}
      peran={`${peran} · Anggota Perpustakaan`}
      kembaliHref={DASHBOARD[session.role] ?? "/login"}
      kembaliLabel="Dashboard"
      menu={menuPerpustakaanAnggota(petugas)}
    >
      {children}
    </PortalShell>
  );
}
