export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { Award } from "lucide-react";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { aksesPusatPkl } from "@/lib/pkl-humas";
import { siapkanSertifikat } from "@/lib/pkl-sertifikat";
import PageHeader from "@/components/admin/PageHeader";
import PrintButton from "@/components/shared/PrintButton";
import { BarisKembali } from "@/components/shared/TombolKembali";
import LembarSertifikatPkl from "@/components/pkl/LembarSertifikatPkl";

export const metadata = { title: "Sertifikat PKL" };
const BATAS = 60;

/** SERTIFIKAT PKL MASSAL (9 Okt 2026) — satu kelas atau satu DUDI dicetak sekali jalan, satu lembar per siswa.
 *  Bawaannya hanya siswa yang PKL-nya berstatus SELESAI; `?semua=1` menyertakan yang masih berjalan. Dibatasi 60 lembar
 *  sekali cetak (tiap lembar memuat QR sebagai data URL). */
export default async function Page({ searchParams }: { searchParams: Promise<{ kelas?: string; dudi?: string; semua?: string }> }) {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  if (!(await aksesPusatPkl(session))) redirect(session.role === "TEACHER" ? "/dashboard/teacher" : "/dashboard/admin");
  const { kelas, dudi, semua } = await searchParams;
  const saring = kelas || dudi;
  const cocok = saring ? await prisma.internship.findMany({
    where: {
      mitraId: dudi ? dudi : { not: null }, status: semua === "1" ? { in: ["ONGOING", "COMPLETED"] } : "COMPLETED",
      ...(kelas ? { student: { class: { name: kelas } } } : {}),
    },
    select: { id: true }, orderBy: { student: { user: { name: "asc" } } },
  }) : [];
  const { kop, lembar } = await siapkanSertifikat(cocok.slice(0, BATAS).map(x => x.id));
  const ket = [kelas ? `Kelas ${kelas}` : null, dudi ? lembar[0]?.tempat ?? "DUDI terpilih" : null].filter(Boolean).join(" · ");
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0">
      <style>{`@page { size: A4 landscape; margin: 10mm; }`}</style>
      <PageHeader icon={<Award size={22} />} title="Sertifikat PKL Massal" description={`${ket || "Pilih kelas atau DUDI di Penempatan"} · ${lembar.length} lembar`} printHidden />
      <BarisKembali href="/pusat-pkl/penempatan" />
      <div className="mb-5 flex flex-wrap items-center gap-3 print:hidden">
        <p className="min-w-0 flex-1 text-sm text-gray-500">
          {!saring ? "Buka halaman ini dari Penempatan Siswa setelah memilih kelas atau DUDI."
            : lembar.length === 0 ? `Belum ada siswa ${semua === "1" ? "" : "berstatus Selesai "}pada pilihan ini. Ubah status PKL-nya menjadi Selesai di Penempatan, atau sertakan yang masih berjalan.`
            : `${lembar.length} sertifikat${cocok.length > BATAS ? ` dari ${cocok.length} (dibatasi ${BATAS} sekali cetak — persempit per kelas)` : ""}. Nomor & QR keaslian diterbitkan saat pertama dicetak.`}
        </p>
        {lembar.length > 0 && <PrintButton />}
      </div>
      <div className="print-doc bg-white mx-auto w-full max-w-[277mm] space-y-6 overflow-x-auto print:space-y-0">
        {lembar.map((d, i) => (
          <div key={d.id} style={i < lembar.length - 1 ? { breakAfter: "page" } : undefined}><LembarSertifikatPkl d={d} kop={kop} /></div>
        ))}
      </div>
    </div>
  );
}
