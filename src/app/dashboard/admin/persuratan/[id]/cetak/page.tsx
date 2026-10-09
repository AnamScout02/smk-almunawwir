export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { buildPrintFilename } from "@/lib/print-filename";
import CetakSuratKeluar from "@/components/surat/CetakSuratKeluar";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const surat = await prisma.surat.findUnique({ where: { id }, select: { perihal: true, nomor: true } });
  return { title: { absolute: buildPrintFilename("Surat", surat?.perihal, surat?.nomor) } };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CetakSuratKeluar id={id} />;
}
