export const dynamic = "force-dynamic";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { Medal } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { getOwnedExtracurricularNames } from "@/lib/ekstrakurikuler-guard";
import { getPrincipalName, getSettings } from "@/lib/site-settings";
import { PREDIKAT_EKSTRA } from "@/lib/ekstra-nilai";
import { generateQrDataUrl } from "@/lib/qrcode";
import { ALAMAT_APLIKASI } from "@/lib/alamat-aplikasi";
import PageHeader from "@/components/admin/PageHeader";
import PrintButton from "@/components/shared/PrintButton";
import { TautanIkon } from "@/components/shared/IkonNama";

export const metadata = { title: "Sertifikat Ekstrakurikuler" };

/** SERTIFIKAT EKSTRAKURIKULER (A4 lanskap) — nilai semester terbaru + QR keaslian → /verify/ekstra/<token>. */
export default async function Page({ params }: { params: Promise<{ memberId: string }> }) {
  const [{ memberId }, session] = await Promise.all([params, verifyRole(["ADMIN", "TEACHER", "TAS"])]);
  const kembali = "/dashboard/teacher/ekstrakurikuler/nilai";
  let anggota = await prisma.extracurricularMember.findUnique({
    where: { id: memberId },
    select: { id: true, role: true, joinedAt: true, sertifikatToken: true, extracurricularId: true, extracurricular: { select: { name: true } }, student: { select: { id: true, nis: true, user: { select: { name: true } }, class: { select: { name: true } } } } },
  });
  if (!anggota) redirect(kembali);
  if (session.role !== "ADMIN") {
    const milik = await getOwnedExtracurricularNames(session.email);
    if (!milik.includes(anggota.extracurricular.name)) redirect(kembali);
  }
  if (!anggota.sertifikatToken) {
    await prisma.extracurricularMember.update({ where: { id: memberId }, data: { sertifikatToken: randomBytes(18).toString("base64url") } });
    anggota = { ...anggota, sertifikatToken: (await prisma.extracurricularMember.findUnique({ where: { id: memberId }, select: { sertifikatToken: true } }))!.sertifikatToken };
  }
  const [s, nilai, qr] = await Promise.all([
    getSettings(["school.name", "school.structure", "logo.emblem", "contact.address"]),
    prisma.nilaiEkstra.findFirst({ where: { extracurricularId: anggota.extracurricularId, studentId: anggota.student.id }, orderBy: { semester: "desc" } }),
    generateQrDataUrl(`${ALAMAT_APLIKASI}/verify/ekstra/${anggota.sertifikatToken}`),
  ]);
  const sekolah = s["school.name"] || "SMK Al-Munawwir IIBS";
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0">
      <style>{`@page { size: A4 landscape; margin: 10mm; }`}</style>
      <PageHeader icon={<Medal size={22} />} title="Sertifikat Ekstrakurikuler" description={`${anggota.student.user.name} · ${anggota.extracurricular.name}`} printHidden />
      <div className="alat-aksi justify-end mb-5 print:hidden">
        <TautanIkon href={kembali} ikon="kembali" className="btn-modal-cancel">Kembali</TautanIkon>
        <PrintButton />
      </div>
      <div className="print-doc bg-white mx-auto w-full max-w-[277mm] overflow-x-auto">
        <div className="relative min-w-[720px] border-[6px] border-double border-[#1B2B6B] p-10 text-center text-black print:min-h-[188mm]">
          <div className="flex items-center justify-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {s["logo.emblem"] && <img src={s["logo.emblem"]} alt="" className="h-16 w-16 object-contain" />}
            <div><p className="text-xl font-bold uppercase tracking-wide">{sekolah}</p>{s["contact.address"] && <p className="text-xs">{s["contact.address"]}</p>}</div>
          </div>
          <p className="mt-8 font-heading text-4xl font-bold tracking-[0.2em] text-[#0F1A45]">SERTIFIKAT</p>
          <p className="mt-1 text-lg font-semibold">Kegiatan Ekstrakurikuler</p>
          <p className="mt-8 text-base">Diberikan kepada</p>
          <p className="mt-2 font-heading text-3xl font-bold">{anggota.student.user.name}</p>
          <p className="mt-1 text-sm">NIS {anggota.student.nis} · Kelas {anggota.student.class?.name ?? "-"}</p>
          <p className="mx-auto mt-6 max-w-3xl text-base leading-relaxed">
            atas keikutsertaannya dalam ekstrakurikuler <strong>{anggota.extracurricular.name}</strong>
            {anggota.role ? <> sebagai <strong>{anggota.role}</strong></> : null}
            {nilai ? <> dengan predikat <strong>{nilai.predikat} ({PREDIKAT_EKSTRA[nilai.predikat] ?? ""})</strong> pada {nilai.semester}</> : null}
            {nilai?.keterangan ? <> — {nilai.keterangan}</> : null}.
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
