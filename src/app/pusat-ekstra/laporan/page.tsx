export const dynamic = "force-dynamic";
import { FileText } from "lucide-react";
import { verifyRole } from "@/lib/dal";
import { getPrincipalName, getSettings } from "@/lib/site-settings";
import { petaTtd, ttdDariNama } from "@/lib/ttd";
import { ekskulBoleh, hariWibIso } from "@/lib/ekstra-server";
import { laporanBulananEkstra } from "@/lib/ekstra-laporan";
import PageHeader from "@/components/admin/PageHeader";
import PrintKop from "@/components/shared/PrintKop";
import PrintButton from "@/components/shared/PrintButton";
import GambarTtd from "@/components/shared/GambarTtd";
import PilihLaporanEkstra from "@/components/ekstra/PilihLaporanEkstra";

export const metadata = { title: "Laporan Bulanan Ekstrakurikuler" };
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const tgl = (s: string) => new Date(`${s}T00:00:00Z`).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** LAPORAN BULANAN EKSTRAKURIKULER — pratinjau layar sekaligus lembar cetak A4. Data: `laporanBulananEkstra`.
 *  Koordinator melihat semua ekskul; pembina ber-akun hanya ekskulnya (dijaga `ekskulBoleh`). */
export default async function Page({ searchParams }: { searchParams: Promise<{ ekskul?: string; bulan?: string }> }) {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  const q = await searchParams;
  const { daftar } = await ekskulBoleh(session);
  const bulan = /^\d{4}-\d{2}$/.test(q.bulan ?? "") ? (q.bulan as string) : hariWibIso().slice(0, 7);
  const id = daftar.find(d => d.id === q.ekskul)?.id ?? daftar[0]?.id ?? "";
  const [l, s] = await Promise.all([id ? laporanBulananEkstra(id, bulan) : null, getSettings(["logo.full_white", "school.structure", "school.name"])]);
  const [th, bl] = bulan.split("-").map(Number), judulBulan = `${BULAN[bl - 1]} ${th}`;
  const namaKepala = getPrincipalName(s["school.structure"]);
  const pembina = l?.pembinaAkun[0] ?? null;
  const [ttdKepala, ttdPembina] = await Promise.all([ttdDariNama(namaKepala), pembina ? petaTtd([pembina.userId]).then(m => m.get(pembina.userId)) : undefined]);
  const namaPembina = pembina?.nama ?? l?.ekskul.pembinaNama ?? "";
  const sel = "border border-gray-300 px-2 py-1", kepala = "border border-gray-300 bg-gray-100 px-2 py-1 text-left font-semibold";

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0">
      <style>{`@page { size: A4 portrait; margin: 14mm; }`}</style>
      <PageHeader icon={<FileText size={22} />} title="Laporan Bulanan" description="Pertemuan, kehadiran anggota, dan foto kegiatan satu ekstrakurikuler dalam sebulan" printHidden />
      <div className="baris-alat mb-5 print:hidden">
        <PilihLaporanEkstra ekskul={id} bulan={bulan} daftar={daftar.map(d => ({ id: d.id, nama: d.name }))} />
        <div className="alat-aksi">
          {l && <a href={`/api/ekstra/laporan?ekskul=${id}&bulan=${bulan}`} className="btn-modal-cancel">Unduh Excel</a>}
          <PrintButton />
        </div>
      </div>
      {!l ? <p className="py-10 text-center text-sm text-gray-400">Belum ada ekstrakurikuler yang bisa dilaporkan.</p> : (
        <div className="print-doc bg-white mx-auto w-full max-w-[210mm] overflow-x-auto px-8 py-6 text-[12px] leading-snug print:px-2 print:py-0">
          <PrintKop title="LAPORAN KEGIATAN EKSTRAKURIKULER" subtitle={`${l.ekskul.name} · ${judulBulan}`} logoUrl={s["logo.full_white"]} />
          <table className="w-full">
            <tbody>
              <tr><td className="w-32 py-0.5">Kegiatan</td><td className="py-0.5">: <b>{l.ekskul.name}</b>{l.ekskul.jenis === "INTRA" ? " (organisasi intra)" : ""}</td><td className="w-32 py-0.5">Bulan</td><td className="py-0.5">: {judulBulan}</td></tr>
              <tr><td className="py-0.5">Pembina</td><td className="py-0.5">: {[...l.pembinaAkun.map(p => p.nama), ...(l.ekskul.pembinaNama ? [`${l.ekskul.pembinaNama} (luar sekolah)`] : [])].join(", ") || "—"}</td><td className="py-0.5">Jadwal rutin</td><td className="py-0.5">: {l.ekskul.jadwalRutin || "—"}</td></tr>
              <tr><td className="py-0.5">Anggota</td><td className="py-0.5">: {l.ringkas.anggota} siswa</td><td className="py-0.5">Pertemuan</td><td className="py-0.5">: {l.ringkas.pertemuan} kali ({l.ringkas.berfoto} berfoto){l.ringkas.persenHadir !== null ? ` · rata-rata hadir ${l.ringkas.persenHadir}%` : ""}</td></tr>
            </tbody>
          </table>

          <h3 className="mb-1 mt-4 text-[12px] font-bold uppercase tracking-wide">A. Pertemuan</h3>
          {l.pertemuan.length === 0 ? <p className="text-gray-600">Tidak ada pertemuan yang dicatat pada bulan ini.</p> : (
            <table className="w-full border-collapse">
              <thead><tr>{["No", "Tanggal", "Kegiatan / materi", "Hadir", "Dicatat oleh", "Foto"].map(h => <th key={h} className={kepala}>{h}</th>)}</tr></thead>
              <tbody>
                {l.pertemuan.map((p, i) => (
                  <tr key={p.tanggal}>
                    <td className={`${sel} tabular-nums`}>{i + 1}</td><td className={`${sel} whitespace-nowrap`}>{tgl(p.tanggal)}</td><td className={sel}>{p.kegiatan || "—"}</td>
                    <td className={`${sel} whitespace-nowrap tabular-nums`}>{p.peserta ? `${p.hadir}/${p.peserta}` : "belum diabsen"}</td>
                    <td className={sel}>{p.oleh || "—"}{p.lewatTautan ? " (tautan)" : ""}</td><td className={`${sel} tabular-nums`}>{p.foto.length || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {l.agenda.length > 0 && (<>
            <h3 className="mb-1 mt-4 text-[12px] font-bold uppercase tracking-wide">B. Lomba, pentas, dan agenda lain</h3>
            <ul className="list-disc pl-5">{l.agenda.map((a, i) => <li key={i}>{new Date(a.mulai).toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" })} — {a.judul}{a.tempat ? `, ${a.tempat}` : ""}{a.hasil ? ` · hasil: ${a.hasil}` : ""}</li>)}</ul>
          </>)}

          <h3 className="mb-1 mt-4 text-[12px] font-bold uppercase tracking-wide">{l.agenda.length ? "C" : "B"}. Kehadiran anggota</h3>
          {l.rekap.length === 0 ? <p className="text-gray-600">Belum ada anggota.</p> : (
            <table className="w-full border-collapse">
              <thead><tr>{["No", "Nama", "Kelas", "Hadir", "Izin", "Sakit", "Tanpa kabar", "%"].map(h => <th key={h} className={kepala}>{h}</th>)}</tr></thead>
              <tbody>
                {l.rekap.map((r, i) => (
                  <tr key={r.nis}><td className={`${sel} tabular-nums`}>{i + 1}</td><td className={sel}>{r.nama}{r.peran ? ` (${r.peran})` : ""}</td><td className={`${sel} whitespace-nowrap`}>{r.kelas}</td>
                    {[r.hadir, r.izin, r.sakit, r.alpha, r.persen === null ? "—" : `${r.persen}%`].map((v, k) => <td key={k} className={`${sel} tabular-nums`}>{v}</td>)}</tr>
                ))}
              </tbody>
            </table>
          )}

          {l.pertemuan.some(p => p.foto.length) && (
            <div style={{ breakInside: "avoid" }}>
              <h3 className="mb-1 mt-4 text-[12px] font-bold uppercase tracking-wide">Foto kegiatan</h3>
              <div className="grid grid-cols-3 gap-2">
                {l.pertemuan.flatMap(p => p.foto.slice(0, 2).map(f => ({ f, t: p.tanggal }))).slice(0, 9).map(x => (
                  // eslint-disable-next-line @next/next/no-img-element -- berkas unggahan, dicetak apa adanya
                  <figure key={x.f}><img src={x.f} alt={`Foto kegiatan ${x.t}`} className="aspect-[4/3] w-full border border-gray-300 object-cover" /><figcaption className="text-[10.5px] text-gray-600">{tgl(x.t)}</figcaption></figure>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 grid grid-cols-2 gap-8 text-center" style={{ breakInside: "avoid" }}>
            <div><p>Mengetahui,</p><p>Kepala Sekolah</p><GambarTtd src={ttdKepala} /><p className="font-semibold underline">{namaKepala || "........................"}</p></div>
            <div><p>Singojuruh, {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" })}</p><p>Pembina</p><GambarTtd src={ttdPembina} /><p className="font-semibold underline">{namaPembina || "........................"}</p></div>
          </div>
        </div>
      )}
    </div>
  );
}
