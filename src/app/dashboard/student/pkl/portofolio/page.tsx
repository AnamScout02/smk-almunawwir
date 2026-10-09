export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { IdCard } from "lucide-react";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import PageHeader from "@/components/admin/PageHeader";
import PrintButton from "@/components/shared/PrintButton";
import { BarisKembali } from "@/components/shared/TombolKembali";
import { predikatPkl } from "@/lib/pkl-label";

export const metadata = { title: "Portofolio PKL" };
const tgl = (d: Date) => d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** PORTOFOLIO PKL SISWA (9 Okt 2026) — satu lembar A4 yang disusun dari data PKL-nya sendiri: tempat, masa, kompetensi yang
 *  dipraktikkan (dari tanda di jurnal), ringkasan kegiatan, nilai, dan foto kegiatan terverifikasi. Untuk dilampirkan ke
 *  lamaran kerja / CV. Tidak ada yang diketik ulang: jurnal yang rajin = portofolio yang kaya. */
export default async function Page() {
  const session = await verifyRole(["STUDENT"]);
  const st = await prisma.student.findFirst({
    where: { user: { email: session.email } },
    select: {
      nis: true, user: { select: { name: true } }, class: { select: { name: true } }, major: { select: { name: true } },
      internship: { select: {
        company: true, position: true, startDate: true, endDate: true, status: true, mitraId: true, nilaiIndustriRata: true, nilaiAkhirRata: true, sertifikatNomor: true,
        mitra: { select: { industryField: true, address: true, kecamatan: true } },
        journal: { orderBy: { date: "desc" }, select: { id: true, date: true, activity: true, photoUrl: true, fotoTerverifikasi: true, kompetensi: true, parafIndustriAt: true } },
        _count: { select: { presensi: { where: { status: "HADIR" } } } },
      } },
    },
  });
  const p = st?.internship;
  if (!st || !p || !p.mitraId) redirect("/dashboard/student/pkl");
  const s = await getSettings(["school.name", "logo.emblem"]);
  const hitung = new Map<string, number>(); for (const j of p.journal) for (const k of j.kompetensi) hitung.set(k, (hitung.get(k) ?? 0) + 1);
  const kompetensi = [...hitung].sort((a, b) => b[1] - a[1]);
  const foto = p.journal.filter(j => j.photoUrl && j.fotoTerverifikasi).slice(0, 6);
  // Kegiatan pilihan: jurnal terpanjang (paling bercerita), diparaf industri didahulukan.
  const pilihan = [...p.journal].sort((a, b) => Number(!!b.parafIndustriAt) - Number(!!a.parafIndustriAt) || b.activity.length - a.activity.length).slice(0, 6).sort((a, b) => a.date.getTime() - b.date.getTime());
  const nilai = p.nilaiAkhirRata ?? p.nilaiIndustriRata;
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0 print:pt-0">
      <style>{`@page { size: A4 portrait; margin: 14mm; }`}</style>
      <PageHeader icon={<IdCard size={22} />} title="Portofolio PKL" description="Ringkasan pengalaman PKL-mu, siap dicetak atau disimpan sebagai PDF" printHidden />
      <BarisKembali href="/dashboard/student/pkl" />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="min-w-0 flex-1 text-sm text-gray-500">Isinya diambil dari jurnal dan penilaianmu. Makin rajin menulis jurnal dan menandai kompetensi, makin lengkap lembar ini.</p>
        <PrintButton />
      </div>
      <div className="print-doc bg-white mx-auto w-full max-w-[210mm] px-8 py-6 text-[12px] print:px-2 print:py-0">
        <div className="flex items-center gap-4 border-b-2 border-[#0F1A45] pb-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {s["logo.emblem"] && <img src={s["logo.emblem"]} alt="" className="h-14 w-14 object-contain" />}
          <div className="min-w-0"><p className="text-[10px] uppercase tracking-widest text-gray-500">Portofolio Praktik Kerja Lapangan</p><p className="text-xl font-bold text-[#0F1A45]">{st.user.name}</p><p>{st.major?.name ?? ""} · {s["school.name"] || "SMK Al-Munawwir IIBS"} · NIS {st.nis}</p></div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1">
          <p><span className="text-gray-500">Tempat PKL:</span> <span className="font-semibold">{p.company}</span></p>
          <p><span className="text-gray-500">Bidang usaha:</span> {p.mitra?.industryField || "—"}</p>
          <p><span className="text-gray-500">Masa:</span> {tgl(p.startDate)} – {tgl(p.endDate)}</p>
          <p><span className="text-gray-500">Posisi:</span> {p.position && p.position !== "—" ? p.position : "Siswa PKL"}</p>
          <p><span className="text-gray-500">Kegiatan tercatat:</span> {p.journal.length} jurnal harian · {p._count.presensi} hari hadir</p>
          <p><span className="text-gray-500">Penilaian:</span> {nilai != null ? `${nilai} (${predikatPkl(nilai)})` : "belum dinilai"}{p.sertifikatNomor ? ` · Sertifikat ${p.sertifikatNomor}` : ""}</p>
        </div>
        <p className="mb-1 mt-5 font-semibold text-[#0F1A45]">Kompetensi yang dipraktikkan</p>
        {kompetensi.length === 0 ? <p className="text-gray-500">Belum ada kompetensi yang ditandai di jurnal.</p> : (
          <ul className="grid grid-cols-2 gap-x-6 gap-y-0.5">{kompetensi.slice(0, 14).map(([k, n]) => <li key={k} className="flex justify-between gap-3 border-b border-dotted border-gray-300"><span>{k}</span><span className="text-gray-500">{n} hari</span></li>)}</ul>
        )}
        <p className="mb-1 mt-5 font-semibold text-[#0F1A45]">Kegiatan pilihan</p>
        {pilihan.length === 0 ? <p className="text-gray-500">Belum ada jurnal.</p> : (
          <ul className="space-y-1.5">{pilihan.map(j => <li key={j.id} style={{ breakInside: "avoid" }}><span className="font-medium">{j.date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}</span>{j.parafIndustriAt ? " (diparaf pembimbing industri)" : ""} — {j.activity.length > 320 ? `${j.activity.slice(0, 320)}…` : j.activity}</li>)}</ul>
        )}
        {foto.length > 0 && (
          <div style={{ breakInside: "avoid" }}>
            <p className="mb-1 mt-5 font-semibold text-[#0F1A45]">Dokumentasi</p>
            <div className="grid grid-cols-3 gap-2">{foto.map(j => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={j.id} src={j.photoUrl as string} alt="" className="h-32 w-full border border-gray-300 object-cover" />
            ))}</div>
            <p className="mt-1 text-[10px] text-gray-500">Foto diambil dari kamera di aplikasi sekolah dan waktunya dicatat server.</p>
          </div>
        )}
      </div>
    </div>
  );
}
