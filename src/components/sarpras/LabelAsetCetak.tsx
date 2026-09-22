import { redirect } from "next/navigation";
import { QrCode } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { getSettings } from "@/lib/site-settings";
import { aksesSarpras, LAB_ASSET_FILTER } from "@/lib/sarpras-akses";
import { generateQrWithLogoDataUrl } from "@/lib/qrcode";
import { ALAMAT_APLIKASI } from "@/lib/alamat-aplikasi";
import PageHeader from "@/components/admin/PageHeader";
import PrintButton from "@/components/shared/PrintButton";
import { TautanIkon } from "@/components/shared/IkonNama";
import SaringLabel from "@/components/sarpras/SaringLabel";

/** CETAK LABEL QR ASET (server, 17 Sep 2026) — ditempel di barang; dipindai → detail aset, lapor kerusakan, pinjam. */
export default async function LabelAsetCetak({ searchParams, basePath, kembaliHref, lingkupLab = false }: {
  searchParams: Promise<{ kategori?: string; lokasi?: string }>; basePath: string; kembaliHref: string; lingkupLab?: boolean;
}) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  const a = await aksesSarpras(session);
  if (!a.kelola) redirect("/login");
  const { kategori = "", lokasi = "" } = await searchParams;
  const lab = lingkupLab || !a.penuh;
  const semua = await prisma.asset.findMany({ where: lab ? LAB_ASSET_FILTER : {}, select: { category: true, location: true } });
  const aset = await prisma.asset.findMany({
    where: { AND: [lab ? LAB_ASSET_FILTER : {}, kategori ? { category: kategori } : {}, lokasi ? { location: lokasi } : {}] },
    orderBy: [{ location: "asc" }, { name: "asc" }], take: 300,
    select: { id: true, name: true, category: true, location: true, kodeInventaris: true },
  });
  const [s, qr] = await Promise.all([
    getSettings(["school.name"]),
    Promise.all(aset.map(x => generateQrWithLogoDataUrl(`${ALAMAT_APLIKASI}/aset/${x.id}`))),
  ]);
  const daftarKategori = [...new Set(semua.map(x => x.category))].sort();
  const daftarLokasi = [...new Set(semua.map(x => x.location).filter((x): x is string => !!x))].sort();
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0">
      <style>{`@page { size: A4; margin: 8mm; }`}</style>
      <PageHeader icon={<QrCode size={22} />} title="Label QR Aset" description={`${aset.length} label${aset.length === 300 ? " (maks. 300 per cetak — saring per lokasi)" : ""} · pindai untuk melihat barang, lapor kerusakan, atau pinjam`} printHidden />
      <div className="baris-alat mb-5 print:hidden">
        <SaringLabel basePath={basePath} kategori={kategori} lokasi={lokasi} daftarKategori={daftarKategori} daftarLokasi={daftarLokasi} />
        <div className="alat-aksi">
          <TautanIkon href={kembaliHref} ikon="kembali" className="btn-modal-cancel">Kembali</TautanIkon>
          <PrintButton />
        </div>
      </div>
      {aset.length === 0 ? <p className="py-12 text-center text-sm text-gray-500 print:hidden">Belum ada aset pada saringan ini.</p> : (
        <div className="print-doc bg-white grid grid-cols-2 gap-2 sm:grid-cols-3 print:grid-cols-3 print:gap-[2mm]">
          {aset.map((x, i) => (
            <div key={x.id} className="flex items-center gap-2 rounded-lg border border-gray-300 p-2 [break-inside:avoid] print:h-[36mm] print:rounded-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr[i]} alt="" className="h-[26mm] w-[26mm] shrink-0" />
              <div className="min-w-0 text-[11px] leading-tight">
                <p className="font-bold uppercase tracking-wide text-gray-500">{s["school.name"] || "SMK Al-Munawwir IIBS"}</p>
                <p className="mt-1 line-clamp-2 text-[13px] font-bold text-black">{x.name}</p>
                {x.kodeInventaris && <p className="mt-0.5 font-mono text-black">{x.kodeInventaris}</p>}
                <p className="mt-0.5 line-clamp-2 text-gray-600">{x.location ?? x.category}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
