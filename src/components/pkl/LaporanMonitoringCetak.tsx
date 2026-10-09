import { ClipboardCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getPrincipalName, getSettings } from "@/lib/site-settings";
import { petaTtd, ttdDariNama } from "@/lib/ttd";
import PageHeader from "@/components/admin/PageHeader";
import PrintKop from "@/components/shared/PrintKop";
import PrintButton from "@/components/shared/PrintButton";
import GambarTtd from "@/components/shared/GambarTtd";
import { BarisKembali } from "@/components/shared/TombolKembali";

const CARA: Record<string, string> = { KUNJUNGAN: "Kunjungan", TELEPON: "Telepon", DARING: "Daring" };
const tgl = (d: Date) => d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });

/** LAPORAN MONITORING PKL (9 Okt 2026) — kunjungan/komunikasi satu guru pembimbing dalam satu bulan, siap cetak sebagai
 *  lampiran laporan perjalanan dinas (SPPD): tanggal, DUDI, siswa, hasil, bukti lokasi, dan foto kunjungan.
 *  Penjagaan akses dilakukan PEMANGGIL (Pusat PKL: `aksesPusatPkl`; portal guru: hanya laporannya sendiri). */
export default async function LaporanMonitoringCetak({ teacherId, bulan, kembaliHref }: { teacherId: string; bulan: string; kembaliHref: string }) {
  const [y, m] = /^\d{4}-\d{2}$/.test(bulan) ? bulan.split("-").map(Number) : [new Date().getUTCFullYear(), new Date().getUTCMonth() + 1];
  // Batas bulan dalam WIB (server UTC): 1 <bulan> 00.00 WIB s.d. sebelum 1 bulan berikutnya.
  const dari = new Date(Date.UTC(y, m - 1, 1) - 7 * 3600_000), sampai = new Date(Date.UTC(y, m, 1) - 7 * 3600_000);
  const [guru, catatan, s] = await Promise.all([
    prisma.teacher.findUnique({ where: { id: teacherId }, select: { nip: true, userId: true, user: { select: { name: true } } } }),
    prisma.monitoringPkl.findMany({
      where: { tanggal: { gte: dari, lt: sampai }, internship: { teacherId } }, orderBy: { tanggal: "asc" },
      select: { id: true, tanggal: true, cara: true, catatan: true, fotoUrl: true, jarakMeter: true, lat: true, internship: { select: { company: true, student: { select: { user: { select: { name: true } }, class: { select: { name: true } } } } } } },
    }),
    getSettings(["logo.full_white", "school.structure", "school.name"]),
  ]);
  const kepala = getPrincipalName(s["school.structure"]);
  const [ttdGuru, ttdKepala] = await Promise.all([petaTtd([guru?.userId]).then(p => (guru ? p.get(guru.userId) : undefined)), ttdDariNama(kepala)]);
  const namaBulan = new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "UTC" });
  const foto = catatan.filter(c => c.fotoUrl);
  const kunjungan = catatan.filter(c => c.cara === "KUNJUNGAN").length;
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0 print:pt-0">
      <style>{`@page { size: A4 portrait; margin: 12mm; }`}</style>
      <PageHeader icon={<ClipboardCheck size={22} />} title="Laporan Monitoring PKL" description={`${guru?.user.name ?? "Guru"} · ${namaBulan}`} printHidden />
      <BarisKembali href={kembaliHref} />
      <div className="mb-5 flex justify-end print:hidden"><PrintButton /></div>
      <div className="print-doc bg-white mx-auto w-full max-w-[210mm] overflow-x-auto px-8 py-0 print:px-2">
        <PrintKop title="LAPORAN MONITORING PKL" subtitle={`${s["school.name"] || "SMK Al Munawwir IIBS"} · ${namaBulan}`} logoUrl={s["logo.full_white"]} />
        <table className="mb-4 text-sm">
          <tbody>
            <tr><td className="pr-3">Guru pembimbing</td><td className="pr-2">:</td><td className="font-semibold">{guru?.user.name ?? "-"}</td></tr>
            <tr><td className="pr-3">NIP / NIY</td><td className="pr-2">:</td><td>{guru?.nip || "-"}</td></tr>
            <tr><td className="pr-3">Periode</td><td className="pr-2">:</td><td>{namaBulan}</td></tr>
            <tr><td className="pr-3">Jumlah</td><td className="pr-2">:</td><td>{catatan.length} catatan ({kunjungan} kunjungan langsung)</td></tr>
          </tbody>
        </table>
        {catatan.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">Tidak ada catatan monitoring pada bulan ini.</p> : (
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-[#0F1A45] text-white">
                {["No", "Hari, tanggal", "Tempat PKL", "Siswa", "Cara", "Hasil monitoring", "Bukti lokasi"].map(h => <th key={h} className="border border-[#0F1A45] px-2 py-1.5 text-left font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {catatan.map((c, i) => (
                <tr key={c.id} className="align-top" style={{ breakInside: "avoid" }}>
                  <td className="border border-gray-400 px-2 py-1.5">{i + 1}</td>
                  <td className="border border-gray-400 px-2 py-1.5">{tgl(c.tanggal)}</td>
                  <td className="border border-gray-400 px-2 py-1.5">{c.internship.company}</td>
                  <td className="border border-gray-400 px-2 py-1.5">{c.internship.student.user.name}<br />{c.internship.student.class?.name ?? ""}</td>
                  <td className="border border-gray-400 px-2 py-1.5">{CARA[c.cara] ?? c.cara}</td>
                  <td className="border border-gray-400 px-2 py-1.5 whitespace-pre-line">{c.catatan}</td>
                  <td className="border border-gray-400 px-2 py-1.5">{c.jarakMeter != null ? (c.jarakMeter <= 300 ? `Di lokasi (${c.jarakMeter} m dari titik DUDI)` : `${c.jarakMeter >= 1000 ? `${(c.jarakMeter / 1000).toFixed(1)} km` : `${c.jarakMeter} m`} dari titik DUDI`) : c.lat != null ? "Lokasi tercatat" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {foto.length > 0 && (
          <div className="mt-5" style={{ breakInside: "avoid" }}>
            <p className="mb-2 text-sm font-semibold">Dokumentasi</p>
            <div className="grid grid-cols-3 gap-2">
              {foto.slice(0, 12).map(c => (
                <figure key={c.id} style={{ breakInside: "avoid" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.fotoUrl as string} alt="" className="h-36 w-full border border-gray-300 object-cover" />
                  <figcaption className="mt-0.5 text-[10px]">{c.internship.company} · {c.tanggal.toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" })}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        )}
        <div className="mt-8 grid grid-cols-2 gap-8 text-center text-sm" style={{ breakInside: "avoid" }}>
          <div><p>Mengetahui,</p><p>Kepala Sekolah</p><GambarTtd src={ttdKepala} /><p className="font-semibold underline">{kepala || "........................"}</p></div>
          <div><p>&nbsp;</p><p>Guru Pembimbing</p><GambarTtd src={ttdGuru} /><p className="font-semibold underline">{guru?.user.name ?? "........................"}</p></div>
        </div>
      </div>
    </div>
  );
}
