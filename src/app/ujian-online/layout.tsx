import type { Viewport } from "next";

/** TAMPILAN APLIKASI DIKUNCI (18 September 2026, permintaan user): di dalam portal, halaman tidak
 * bisa diperbesar/diperkecil dengan cubitan dua jari maupun ketuk ganda, supaya tata letaknya tidak
 * bergeser saat dipakai bergantian di HP sekolah. Situs publik tidak dikunci. */
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, minimumScale: 1, userScalable: false };

import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import PortalPesertaShell from "@/components/ujian/PortalPesertaShell";
import { kegiatanUntukTingkat } from "@/lib/kegiatan-ujian-server";
import { keteranganKegiatan } from "@/lib/kegiatan-ujian";

export const dynamic = "force-dynamic";

/** PORTAL PESERTA UJIAN — terpisah penuh dari portal siswa (/dashboard/student): tidak ada
 * sidebar, tidak ada menu lain, supaya peserta tidak terdistraksi saat mengerjakan. Tampilannya
 * mengikuti gaya bersih halaman Buku Tamu publik (lihat PortalPesertaShell). */
export default async function UjianOnlineLayout({ children }: { children: React.ReactNode }) {
  const session = await verifyRole(["STUDENT"]);
  const [s, siswa] = await Promise.all([
    getSettings(["logo.full_white", "school.name"]).catch(() => ({} as Record<string, string>)),
    prisma.student.findFirst({
      where: { user: { email: session.email } },
      select: { nis: true, class: { select: { name: true, grade: true } } },
    }).catch(() => null),
  ]);
  const kegiatan = await kegiatanUntukTingkat(siswa?.class?.grade).catch(() => null);

  return (
    <PortalPesertaShell
      logoUrl={s["logo.full_white"]}
      namaSekolah={s["school.name"] || "SMK Al Munawwir IIBS"}
      nama={session.name}
      keterangan={[siswa?.class?.name, siswa?.nis ? `NIS ${siswa.nis}` : ""].filter(Boolean).join(" · ")}
      kegiatan={kegiatan ? { nama: kegiatan.nama, keterangan: keteranganKegiatan(kegiatan) } : null}
    >
      {children}
    </PortalPesertaShell>
  );
}
