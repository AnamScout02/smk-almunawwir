import { getSettings } from "@/lib/site-settings";
import { prisma } from "@/lib/prisma";
import { bacaKontenSpmb } from "@/lib/spmb-konten";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = await getSettings([
    "form.require_nik",
    "form.require_nisn",
    "form.require_address",
    "form.require_guardian",
    "form.require_ijazah",
    "form.require_kk",
    "form.require_ktp_wali",
    "form.require_foto",
    "form.require_dokumen_lain",
    "spmb.jalur",
  ]);
  // Jalur pendaftaran dari pengaturan panitia — formulir TIDAK lagi memakai daftar yang
  // ditulis mati (1 Oktober 2026).
  const { jalur } = bacaKontenSpmb(config);
  // Dokumen syarat yang didaftarkan panitia di /pusat-spmb/pengaturan — TAMBAHAN di luar lima
  // slot baku di atas. Daftar kosong tidak menutup pendaftaran (pelajaran PKL, CLAUDE.md #91).
  const syarat = await prisma.dokumenSyaratSpmb.findMany({
    where: { aktif: true },
    orderBy: [{ urutan: "asc" }, { nama: "asc" }],
    select: { id: true, nama: true, keterangan: true, wajib: true },
  }).catch(() => []);
  return Response.json({ ...config, syarat, jalur });
}
