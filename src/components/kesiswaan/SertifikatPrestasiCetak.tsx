import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { Medal } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { getJabatanNames } from "@/lib/jabatan-guard";
import { KESISWAAN_BK_JABATAN } from "@/lib/kesiswaan-guard";
import { getPrincipalName, getSettings } from "@/lib/site-settings";
import { generateQrDataUrl } from "@/lib/qrcode";
import { ALAMAT_APLIKASI } from "@/lib/alamat-aplikasi";
import PageHeader from "@/components/admin/PageHeader";
import PrintButton from "@/components/shared/PrintButton";
import { TautanIkon } from "@/components/shared/IkonNama";

/** SERTIFIKAT / PIAGAM PRESTASI (A4 lanskap) dari catatan poin prestasi, dengan QR keaslian → /verify/prestasi/<token>. */
export default async function SertifikatPrestasiCetak({ id, kembaliHref }: { id: string; kembaliHref: string }) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  if (session.role !== "ADMIN") {
    const j = await getJabatanNames(session.email);
    if (!j.some(x => KESISWAAN_BK_JABATAN.includes(x))) redirect("/login");
  }
  let r = await prisma.studentPointRecord.findFirst({
    where: { id, kind: "PRESTASI" },
    select: { id: true, note: true, date: true, sertifikatToken: true, achievementType: { select: { name: true } }, student: { select: { nis: true, user: { select: { name: true } }, class: { select: { name: true } } } } },
  });
  if (!r) redirect(kembaliHref);
  if (!r.sertifikatToken) {
    await prisma.studentPointRecord.update({ where: { id }, data: { sertifikatToken: randomBytes(18).toString("base64url") } });
    r = { ...r, sertifikatToken: (await prisma.studentPointRecord.findUnique({ where: { id }, select: { sertifikatToken: true } }))!.sertifikatToken };
  }
  const [s, qr] = await Promise.all([
    getSettings(["school.name", "school.structure", "logo.emblem", "contact.address"]),
    generateQrDataUrl(`${ALAMAT_APLIKASI}/verify/prestasi/${r.sertifikatToken}`),
  ]);
  const tgl = r.date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
  const sekolah = s["school.name"] || "SMK Al-Munawwir IIBS";
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0">
      <style>{`@page { size: A4 landscape; margin: 10mm; }`}</style>
      <PageHeader icon={<Medal size={22} />} title="Piagam Prestasi" description={r.student.user.name} printHidden />
      <div className="alat-aksi justify-end mb-5 print:hidden">
        <TautanIkon href={kembaliHref} ikon="kembali" className="btn-modal-cancel">Kembali</TautanIkon>
        <PrintButton />
      </div>
      <div className="print-doc bg-white mx-auto w-full max-w-[277mm] overflow-x-auto">
        <div className="relative min-w-[720px] border-[6px] border-double border-[#B87D0E] p-10 text-center text-black print:min-h-[188mm]">
          <div className="flex items-center justify-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {s["logo.emblem"] && <img src={s["logo.emblem"]} alt="" className="h-16 w-16 object-contain" />}
            <div><p className="text-xl font-bold uppercase tracking-wide">{sekolah}</p>{s["contact.address"] && <p className="text-xs">{s["contact.address"]}</p>}</div>
          </div>
          <p className="mt-8 font-heading text-4xl font-bold tracking-[0.2em] text-[#0F1A45]">PIAGAM PENGHARGAAN</p>
          <p className="mt-8 text-base">Diberikan kepada</p>
          <p className="mt-2 font-heading text-3xl font-bold">{r.student.user.name}</p>
          <p className="mt-1 text-sm">NIS {r.student.nis} · Kelas {r.student.class?.name ?? "-"}</p>
          <p className="mx-auto mt-6 max-w-3xl text-base leading-relaxed">
            atas prestasi <strong>{r.achievementType?.name ?? "Prestasi"}</strong>{r.note ? <> — {r.note}</> : null},
            {" "}tercatat pada {tgl}. Semoga menjadi teladan dan terus berprestasi.
          </p>
          <div className="mt-12 grid grid-cols-3 items-end gap-6 text-sm">
            <div />
            <div className="flex flex-col items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="QR keaslian" className="h-24 w-24" />
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
