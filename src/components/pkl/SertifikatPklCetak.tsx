import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { Award } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { getPrincipalName, getSettings } from "@/lib/site-settings";
import { aksesPkl, nomorSertifikatBerikutnya, predikatPkl } from "@/lib/pkl-humas";
import { generateQrDataUrl } from "@/lib/qrcode";
import { ALAMAT_APLIKASI } from "@/lib/alamat-aplikasi";
import PageHeader from "@/components/admin/PageHeader";
import PrintButton from "@/components/shared/PrintButton";
import { TautanIkon } from "@/components/shared/IkonNama";

const tgl = (d: Date) => d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });

/** SERTIFIKAT PKL (A4 lanskap) dengan QR keaslian → /verify/pkl/<token>. Nomor diterbitkan saat pertama dibuka. */
export default async function SertifikatPklCetak({ internshipId, kembaliHref }: { internshipId: string; kembaliHref: string }) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  let pkl = await aksesPkl(session, internshipId);
  if (!pkl) redirect("/login");
  if (!pkl.sertifikatNomor) {
    const tahun = new Date(pkl.endDate.getTime() + 7 * 3600_000).getUTCFullYear();
    for (let coba = 0; coba < 3 && !pkl.sertifikatNomor; coba++) {
      try {
        await prisma.internship.update({ where: { id: pkl.id }, data: { sertifikatNomor: await nomorSertifikatBerikutnya(tahun), sertifikatToken: randomBytes(18).toString("base64url"), sertifikatPada: new Date() } });
        pkl = (await aksesPkl(session, internshipId))!;
      } catch (e) { if ((e as { code?: string }).code !== "P2002") throw e; }
    }
  }
  const [s, nilaiSekolah] = await Promise.all([
    getSettings(["school.name", "school.structure", "logo.emblem", "contact.address"]),
    prisma.grade.findFirst({ where: { studentId: pkl.student.id, subject: "PKL", type: "Nilai PKL" }, orderBy: { createdAt: "desc" }, select: { score: true } }),
  ]);
  const qr = pkl.sertifikatToken ? await generateQrDataUrl(`${ALAMAT_APLIKASI}/verify/pkl/${pkl.sertifikatToken}`) : null;
  const nilai = [nilaiSekolah?.score, pkl.nilaiIndustriRata].filter((x): x is number => typeof x === "number");
  const akhir = nilai.length ? Math.round((nilai.reduce((a, b) => a + b, 0) / nilai.length) * 10) / 10 : null;
  const sekolah = s["school.name"] || "SMK Al-Munawwir IIBS";
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0">
      <style>{`@page { size: A4 landscape; margin: 10mm; }`}</style>
      <PageHeader icon={<Award size={22} />} title="Sertifikat PKL" description={`${pkl.student.user.name} · No. ${pkl.sertifikatNomor ?? "-"}`} printHidden />
      <div className="alat-aksi justify-end mb-5 print:hidden">
        <TautanIkon href={kembaliHref} ikon="kembali" className="btn-modal-cancel">Kembali</TautanIkon>
        <PrintButton />
      </div>
      <div className="print-doc bg-white mx-auto w-full max-w-[277mm] overflow-x-auto">
        <div className="relative min-w-[720px] border-[6px] border-double border-[#0F1A45] p-10 text-center text-black print:min-h-[188mm]">
          <div className="flex items-center justify-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {s["logo.emblem"] && <img src={s["logo.emblem"]} alt="" className="h-16 w-16 object-contain" />}
            <div>
              <p className="text-xl font-bold uppercase tracking-wide">{sekolah}</p>
              {s["contact.address"] && <p className="text-xs">{s["contact.address"]}</p>}
            </div>
          </div>
          <p className="mt-8 font-heading text-4xl font-bold tracking-[0.2em] text-[#0F1A45]">SERTIFIKAT</p>
          <p className="mt-1 text-lg font-semibold">Praktik Kerja Lapangan (PKL)</p>
          <p className="mt-1 text-sm">Nomor: {pkl.sertifikatNomor}</p>
          <p className="mt-8 text-base">Diberikan kepada</p>
          <p className="mt-2 font-heading text-3xl font-bold">{pkl.student.user.name}</p>
          <p className="mt-1 text-sm">NIS {pkl.student.nis} · {pkl.student.class?.name ?? ""} · {pkl.student.major?.name ?? ""}</p>
          <p className="mx-auto mt-6 max-w-3xl text-base leading-relaxed">
            telah melaksanakan Praktik Kerja Lapangan di <strong>{pkl.company}</strong> sebagai <strong>{pkl.position}</strong>
            {" "}pada {tgl(pkl.startDate)} sampai {tgl(pkl.endDate)}
            {akhir != null ? <> dengan nilai <strong>{akhir.toLocaleString("id-ID")}</strong> ({predikatPkl(akhir)})</> : null}.
          </p>
          <div className="mt-10 grid grid-cols-3 items-end gap-6 text-sm">
            <div className="text-center">
              <p>Pembimbing Industri</p>
              <p className="mt-16 font-semibold underline">{pkl.penilaiIndustri || pkl.supervisor}</p>
              <p>{pkl.company}</p>
            </div>
            <div className="flex flex-col items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {qr && <img src={qr} alt="QR keaslian" className="h-24 w-24" />}
              <p className="mt-1 text-[11px]">Pindai untuk memeriksa keaslian</p>
            </div>
            <div className="text-center">
              <p>Kepala Sekolah</p>
              <p className="mt-16 font-semibold underline">{getPrincipalName(s["school.structure"]) || "........................"}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
