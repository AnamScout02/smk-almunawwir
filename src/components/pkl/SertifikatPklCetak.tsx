import { redirect } from "next/navigation";
import { Award } from "lucide-react";
import { verifyRole } from "@/lib/dal";
import { aksesPkl } from "@/lib/pkl-humas";
import { siapkanSertifikat } from "@/lib/pkl-sertifikat";
import PageHeader from "@/components/admin/PageHeader";
import PrintButton from "@/components/shared/PrintButton";
import { TautanIkon } from "@/components/shared/IkonNama";
import LembarSertifikatPkl from "@/components/pkl/LembarSertifikatPkl";

/** SERTIFIKAT PKL satu siswa (A4 lanskap) dengan QR keaslian → /verify/pkl/<token>. Nomor diterbitkan saat pertama dibuka.
 *  Lembarnya satu sumber dengan cetak massal (`LembarSertifikatPkl` + `siapkanSertifikat`). */
export default async function SertifikatPklCetak({ internshipId, kembaliHref }: { internshipId: string; kembaliHref: string }) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  if (!(await aksesPkl(session, internshipId))) redirect("/login");
  const { kop, lembar } = await siapkanSertifikat([internshipId]);
  const d = lembar[0];
  if (!d) redirect(kembaliHref);
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0">
      <style>{`@page { size: A4 landscape; margin: 10mm; }`}</style>
      <PageHeader icon={<Award size={22} />} title="Sertifikat PKL" description={`${d.nama} · No. ${d.nomor ?? "-"}`} printHidden />
      <div className="alat-aksi justify-end mb-5 print:hidden">
        <TautanIkon href={kembaliHref} ikon="kembali" className="btn-modal-cancel">Kembali</TautanIkon>
        <PrintButton />
      </div>
      <div className="print-doc bg-white mx-auto w-full max-w-[277mm] overflow-x-auto">
        <LembarSertifikatPkl d={d} kop={kop} />
      </div>
    </div>
  );
}
