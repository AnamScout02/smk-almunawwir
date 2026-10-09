export const dynamic = "force-dynamic";
import { notFound, redirect } from "next/navigation";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { aksesPusatPkl } from "@/lib/pkl-humas";
import CetakSuratKeluar from "@/components/surat/CetakSuratKeluar";
import CetakSuratTugas from "@/components/surat/CetakSuratTugas";

/** Cetak surat PKL dari Pusat PKL — lembar yang SAMA dengan Persuratan / Surat Tugas TU. Yang bisa dibuka lewat
 *  pintu ini hanya surat yang tercatat di `SuratPkl`; surat TU lain tetap hanya lewat halaman Tata Usaha. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  if (!(await aksesPusatPkl(session))) redirect(session.role === "TEACHER" ? "/dashboard/teacher" : "/dashboard/admin");
  const { id } = await params;
  const t = await prisma.suratPkl.findUnique({ where: { id }, select: { suratId: true, suratTugasId: true } });
  if (!t) notFound();
  if (t.suratTugasId) return <CetakSuratTugas id={t.suratTugasId} kembaliHref="/pusat-pkl/surat" />;
  if (t.suratId) return <CetakSuratKeluar id={t.suratId} kembaliHref="/pusat-pkl/surat" tanpaWord />;
  notFound();
}
