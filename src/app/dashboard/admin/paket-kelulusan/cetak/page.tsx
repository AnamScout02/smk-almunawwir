export const dynamic = "force-dynamic";
import { randomBytes } from "crypto";
import { ScrollText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { getSettings } from "@/lib/site-settings";
import { generateQrDataUrl } from "@/lib/qrcode";
import { ALAMAT_APLIKASI } from "@/lib/alamat-aplikasi";
import PageHeader from "@/components/admin/PageHeader";
import PrintButton from "@/components/shared/PrintButton";
import { BarisKembali } from "@/components/shared/TombolKembali";
import IsiSuratKeluar from "@/components/surat/IsiSuratKeluar";
import { muatPaketKelulusan } from "@/lib/paket-kelulusan";

export const metadata = { title: "Cetak SKL" };

/** CETAK SKL MASSAL — satu kelas / satu tahun lulus sekali jalan, lembarnya sama persis dengan cetak surat keluar satuan
 *  (`IsiSuratKeluar`), masing-masing ber-QR keaslian (#49). Maksimal 60 lembar. */
export default async function Page({ searchParams }: { searchParams: Promise<{ kelas?: string; lulus?: string }> }) {
  await verifyTasAccess();
  const f = await searchParams;
  const baris = (await muatPaketKelulusan(f)).filter(b => b.skl).slice(0, 60);
  const [surat, s] = await Promise.all([
    prisma.surat.findMany({ where: { id: { in: baris.map(b => b.skl!.id) } } }),
    getSettings(["letterhead.bukuInduk", "letterhead.kopBawah", "letterhead.ttdKepalaSekolah", "school.structure"]),
  ]);
  const urut = baris.map(b => surat.find(x => x.id === b.skl!.id)).filter((x): x is (typeof surat)[number] => !!x);
  const lembar = await Promise.all(urut.map(async x => {
    let token = x.verifikasiToken;
    if (!token) { token = randomBytes(18).toString("base64url"); await prisma.surat.updateMany({ where: { id: x.id, verifikasiToken: null }, data: { verifikasiToken: token } }); token = (await prisma.surat.findUnique({ where: { id: x.id }, select: { verifikasiToken: true } }))?.verifikasiToken ?? token; }
    return { surat: x, qr: await generateQrDataUrl(`${ALAMAT_APLIKASI}/verify/surat/${token}`) };
  }));
  const kembali = `/dashboard/admin/paket-kelulusan?${new URLSearchParams(f.kelas ? { kelas: f.kelas } : f.lulus ? { lulus: f.lulus } : {})}`;
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0 print:pt-0 bg-gray-100 print:bg-white">
      <PageHeader icon={<ScrollText size={22} />} title="Cetak Surat Keterangan Lulus" description={`${lembar.length} lembar`} printHidden />
      <BarisKembali href={kembali} />
      <div className="mb-5 flex justify-end print:hidden"><PrintButton /></div>
      {lembar.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">Belum ada SKL pada pilihan ini. Buat dulu dari Paket Kelulusan.</p> : (
        <div className="overflow-x-auto print:overflow-visible">
          {lembar.map((l, i) => <IsiSuratKeluar key={l.surat.id} surat={l.surat} setelan={s} qrSurat={l.qr} terakhir={i === lembar.length - 1} />)}
        </div>
      )}
    </div>
  );
}
