export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { FileBarChart } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getPrincipalName, getSettings } from "@/lib/site-settings";
import { ttdDariNama } from "@/lib/ttd";
import PageHeader from "@/components/admin/PageHeader";
import PrintKop from "@/components/shared/PrintKop";
import PrintButton from "@/components/shared/PrintButton";
import GambarTtd from "@/components/shared/GambarTtd";
import { BarisKembali } from "@/components/shared/TombolKembali";
import { labelTa, muatArsipPkl, ringkasAngkatan, tahunAjaranPkl } from "@/lib/pkl-arsip";
import { JENIS_LAPORAN } from "@/lib/pkl-label";

export const metadata = { title: "Laporan PKL Tahunan" };

/** LAPORAN PKL TAHUNAN (cetak A4, 9 Okt 2026) — satu tahun ajaran: angka pokok, per DUDI, per kelas, masalah & mutasi.
 *  Angkanya dari `ringkasAngkatan` yang sama dengan layar Arsip & Excel. Akses dijaga layout Pusat PKL. */
export default async function Page({ searchParams }: { searchParams: Promise<{ ta?: string }> }) {
  const { ta: q } = await searchParams;
  const ta = Number(q);
  if (!Number.isInteger(ta)) redirect("/pusat-pkl/arsip");
  const b = (await muatArsipPkl()).filter(x => x.ta === ta);
  const r = ringkasAngkatan(b);
  const ids = b.map(x => x.id);
  const [s, masalah, mutasi] = await Promise.all([
    getSettings(["logo.full_white", "school.structure", "school.name"]),
    prisma.laporanPkl.groupBy({ by: ["jenis"], where: { internshipId: { in: ids } }, _count: { _all: true } }),
    prisma.mutasiPkl.findMany({ where: { internshipId: { in: ids } }, orderBy: { tanggal: "asc" }, select: { id: true, tanggal: true, dariNama: true, keNama: true, alasan: true, internship: { select: { student: { select: { user: { select: { name: true } } } } } } } }),
  ]);
  const kepala = getPrincipalName(s["school.structure"]);
  const ttd = await ttdDariNama(kepala);
  const perKelas = new Map<string, { n: number; ditempatkan: number; selesai: number }>();
  for (const x of b.filter(y => y.status !== "CANCELLED")) { const k = x.kelas ?? x.jurusan ?? "—"; const v = perKelas.get(k) ?? { n: 0, ditempatkan: 0, selesai: 0 }; v.n++; if (x.tempat) v.ditempatkan++; if (x.status === "COMPLETED") v.selesai++; perKelas.set(k, v); }
  const sel = "border border-gray-400 px-2 py-1", kepalaTabel = "border border-[#0F1A45] bg-[#0F1A45] px-2 py-1.5 text-left font-semibold text-white";
  const angka: [string, string | number][] = [["Peserta PKL", r.peserta], ["Mendapat tempat PKL", r.ditempatkan], ["Selesai PKL", r.selesai], ["Dibatalkan", r.batal], ["DUDI yang ditempati", r.dudi], ["Mutasi tempat", r.mutasi], ["Sertifikat terbit", r.sertifikat], ["Rata-rata nilai industri", r.rataIndustri ?? "belum ada"]];
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0 print:pt-0">
      <style>{`@page { size: A4 portrait; margin: 14mm; }`}</style>
      <PageHeader icon={<FileBarChart size={22} />} title="Laporan PKL Tahunan" description={`Tahun ajaran ${labelTa(ta)}`} printHidden />
      <BarisKembali href={`/pusat-pkl/arsip?ta=${ta}`} />
      <div className="mb-5 flex justify-end print:hidden"><PrintButton /></div>
      <div className="print-doc bg-white mx-auto w-full max-w-[210mm] overflow-x-auto px-8 py-0 text-[12px] print:px-2">
        <PrintKop title="LAPORAN PELAKSANAAN PRAKTIK KERJA LAPANGAN" subtitle={`${s["school.name"] || "SMK Al Munawwir IIBS"} · Tahun Ajaran ${labelTa(ta)}`} logoUrl={s["logo.full_white"]} />
        <p className="mb-1 font-semibold">A. Ringkasan</p>
        <table className="mb-4 w-full border-collapse"><tbody>{angka.map(([l, v]) => <tr key={l}><td className={`${sel} w-2/3`}>{l}</td><td className={`${sel} text-right`}>{v}</td></tr>)}</tbody></table>
        <p className="mb-1 font-semibold">B. Per kelas</p>
        <table className="mb-4 w-full border-collapse">
          <thead><tr>{["Kelas", "Peserta", "Mendapat tempat", "Selesai"].map(h => <th key={h} className={kepalaTabel}>{h}</th>)}</tr></thead>
          <tbody>{[...perKelas].sort((a, z) => a[0].localeCompare(z[0], "id", { numeric: true })).map(([k, v]) => <tr key={k}><td className={sel}>{k}</td><td className={`${sel} text-right`}>{v.n}</td><td className={`${sel} text-right`}>{v.ditempatkan}</td><td className={`${sel} text-right`}>{v.selesai}</td></tr>)}</tbody>
        </table>
        <p className="mb-1 font-semibold">C. Per tempat PKL</p>
        {r.perDudi.length === 0 ? <p className="mb-4 text-gray-500">Belum ada siswa yang mendapat tempat PKL pada tahun ajaran ini.</p> : (
          <table className="mb-4 w-full border-collapse">
            <thead><tr>{["No", "DUDI", "Siswa", "Selesai", "Rata-rata nilai industri"].map(h => <th key={h} className={kepalaTabel}>{h}</th>)}</tr></thead>
            <tbody>{r.perDudi.map((d, i) => <tr key={d.nama} style={{ breakInside: "avoid" }}><td className={sel}>{i + 1}</td><td className={sel}>{d.nama}</td><td className={`${sel} text-right`}>{d.siswa}</td><td className={`${sel} text-right`}>{d.selesai}</td><td className={`${sel} text-right`}>{d.rata ?? "—"}</td></tr>)}</tbody>
          </table>
        )}
        <p className="mb-1 font-semibold">D. Masalah yang dilaporkan</p>
        <p className="mb-4">{masalah.length ? masalah.map(m => `${JENIS_LAPORAN[m.jenis] ?? m.jenis}: ${m._count._all}`).join(" · ") : "Tidak ada laporan masalah."}</p>
        <p className="mb-1 font-semibold">E. Mutasi tempat PKL</p>
        {mutasi.length === 0 ? <p className="mb-4">Tidak ada siswa yang pindah tempat.</p> : (
          <table className="mb-4 w-full border-collapse">
            <thead><tr>{["Tanggal", "Siswa", "Dari", "Ke", "Alasan"].map(h => <th key={h} className={kepalaTabel}>{h}</th>)}</tr></thead>
            <tbody>{mutasi.map(m => <tr key={m.id} style={{ breakInside: "avoid" }}><td className={sel}>{m.tanggal.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" })}</td><td className={sel}>{m.internship.student.user.name}</td><td className={sel}>{m.dariNama}</td><td className={sel}>{m.keNama}</td><td className={sel}>{m.alasan}</td></tr>)}</tbody>
          </table>
        )}
        <div className="mt-8 grid grid-cols-2 gap-8 text-center" style={{ breakInside: "avoid" }}>
          <div><p>Mengetahui,</p><p>Kepala Sekolah</p><GambarTtd src={ttd} /><p className="font-semibold underline">{kepala || "........................"}</p></div>
          <div><p>&nbsp;</p><p>Wakil Kepala Bidang Humas</p><GambarTtd src={null} /><p className="font-semibold underline">........................</p></div>
        </div>
        <p className="mt-6 text-[10px] text-gray-500">Tahun ajaran dihitung dari tanggal mulai PKL (Juli = awal tahun ajaran). Dicetak dari Pusat PKL · tahun ajaran berjalan: {labelTa(tahunAjaranPkl(new Date()))}.</p>
      </div>
    </div>
  );
}
