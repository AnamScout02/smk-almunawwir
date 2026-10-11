import { BookUser } from "lucide-react";
import { getSettings } from "@/lib/site-settings";
import { petaTtd } from "@/lib/ttd";
import { kelasBukuWali, susunBukuWali } from "@/lib/buku-wali";
import PageHeader from "@/components/admin/PageHeader";
import PrintKop from "@/components/shared/PrintKop";
import PrintButton from "@/components/shared/PrintButton";
import GambarTtd from "@/components/shared/GambarTtd";
import TombolKembali from "@/components/shared/TombolKembali";

const tgl = (s: string) => new Date(`${s}T00:00:00Z`).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** LEMBAR SISWA — Buku Wali Kelas versi cetak (11 Okt 2026): SATU LEMBAR A4 per siswa untuk dibawa saat pertemuan orang tua
 *  atau pengambilan rapor. `siswa` kosong = seluruh kelas (satu siswa satu halaman). Sumber data sama dengan layarnya
 *  (`susunBukuWali`). Catatan penanganan BK tidak ikut dicetak — lembar ini diperlihatkan ke orang tua. */
export default async function BukuWaliCetak({ session, kelas, siswa, basePath }: { session: { role: string; email: string }; kelas?: string; siswa?: string; basePath: string }) {
  const boleh = await kelasBukuWali(session);
  const dipilih = boleh.find(k => k.id === kelas);
  const kembali = `${basePath}${dipilih ? `?kelas=${dipilih.id}` : ""}`;
  const judul = <PageHeader icon={<BookUser size={22} />} title="Lembar Siswa" description="Ringkasan tiap siswa untuk pertemuan orang tua" printHidden />;
  const d = dipilih ? await susunBukuWali(dipilih.id) : null;
  if (!d) return <div className="p-6 lg:p-8 pt-16 lg:pt-8">{judul}<div className="mb-5 print:hidden"><TombolKembali href={basePath} /></div><p className="py-10 text-center text-sm text-gray-400">Kelas ini bukan kelas wali Anda.</p></div>;
  const baris = siswa ? d.baris.filter(b => b.id === siswa) : d.baris;
  const [s, ttd] = await Promise.all([getSettings(["school.name", "logo.full_white", "nominatif.kecamatan"]), petaTtd([d.kelas.waliUserId])]);
  const hariIni = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  const sel = "border border-gray-300 px-2 py-1", kepala = "border border-gray-300 bg-gray-100 px-2 py-1 text-left font-semibold";
  const Judul = ({ children }: { children: React.ReactNode }) => <h3 className="mb-1 mt-4 text-[12px] font-bold uppercase tracking-wide">{children}</h3>;
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0">
      <style>{`@page { size: A4 portrait; margin: 14mm; }`}</style>
      {judul}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <TombolKembali href={kembali} />
        <div className="alat-aksi"><PrintButton /></div>
      </div>
      {baris.length === 0 && <p className="py-10 text-center text-sm text-gray-400">Siswa tidak ditemukan di kelas ini.</p>}
      <div className="print-doc bg-white mx-auto w-full max-w-[210mm] text-[12px] leading-snug">
        {baris.map((b, i) => {
          const h = b.hadir, total = h.HADIR + h.IZIN + h.SAKIT + h.ALPHA;
          return (
            <section key={b.id} className={`px-8 py-6 print:px-2 print:py-0 ${i < baris.length - 1 ? "break-after-page border-b border-dashed border-gray-300 print:border-0" : ""}`}>
              <PrintKop title="LAPORAN PERKEMBANGAN SISWA" subtitle={`${s["school.name"] || "SMK Al Munawwir IIBS"} · Semester ${d.semester}`} logoUrl={s["logo.full_white"]} />
              <table className="w-full"><tbody>
                <tr><td className="w-28 py-0.5">Nama</td><td className="py-0.5">: <b>{b.nama}</b></td><td className="w-24 py-0.5">Kelas</td><td className="py-0.5">: {d.kelas.nama}</td></tr>
                <tr><td className="py-0.5">Nomor induk</td><td className="py-0.5">: {b.nis}</td><td className="py-0.5">Wali kelas</td><td className="py-0.5">: {d.kelas.wali ?? "—"}</td></tr>
              </tbody></table>

              <Judul>A. Kehadiran</Judul>
              <table className="w-full border-collapse">
                <thead><tr>{["Hari tercatat", "Hadir", "Izin", "Sakit", "Tanpa keterangan", "Persen hadir"].map(x => <th key={x} className={kepala}>{x}</th>)}</tr></thead>
                <tbody><tr>{[total, h.HADIR, h.IZIN, h.SAKIT, h.ALPHA, h.persen == null ? "—" : `${h.persen}%`].map((v, k) => <td key={k} className={`${sel} tabular-nums`}>{v}</td>)}</tr></tbody>
              </table>

              <Judul>B. Nilai — {b.nilai.mapel ? `${b.nilai.mapel} mapel sudah bernilai${b.nilai.rata != null ? `, rata-rata ${Math.round(b.nilai.rata * 10) / 10}` : ""}` : "belum ada nilai semester ini"}</Judul>
              {b.nilai.mapel > 0 && (b.nilai.dibawah.length === 0 ? <p>Semua mapel yang sudah bernilai mencapai KKM.</p> : (
                <table className="w-full border-collapse">
                  <thead><tr>{["Mapel yang belum mencapai KKM", "Nilai", "KKM"].map(x => <th key={x} className={kepala}>{x}</th>)}</tr></thead>
                  <tbody>{b.nilai.dibawah.map(n => <tr key={n.mapel}><td className={sel}>{n.mapel}</td><td className={`${sel} w-20 tabular-nums`}>{n.nilai}</td><td className={`${sel} w-20 tabular-nums`}>{n.kkm}</td></tr>)}</tbody>
                </table>
              ))}

              <Judul>C. Kedisiplinan — {b.poin.level}{b.poin.bersih ? ` (${b.poin.bersih} poin)` : ""}</Judul>
              {b.poin.daftar.length === 0 ? <p>Tidak ada catatan poin semester ini.</p> : (
                <table className="w-full border-collapse">
                  <thead><tr>{["Tanggal", "Catatan", "Poin"].map(x => <th key={x} className={kepala}>{x}</th>)}</tr></thead>
                  <tbody>{b.poin.daftar.map((p, k) => <tr key={k}><td className={`${sel} w-32`}>{tgl(p.tanggal)}</td><td className={sel}>{p.nama}{p.jenis === "PRESTASI" ? " (prestasi)" : p.jenis === "REMISI" ? " (remisi)" : ""}</td><td className={`${sel} w-16 tabular-nums`}>{p.jenis === "PELANGGARAN" ? "+" : "−"}{p.poin}</td></tr>)}</tbody>
                </table>
              )}

              <Judul>D. Kegiatan &amp; izin</Judul>
              <table className="w-full"><tbody>
                <tr><td className="w-44 py-0.5 align-top">Ekstrakurikuler / organisasi</td><td className="py-0.5">: {b.ekskul.join(", ") || "Belum mengikuti"}</td></tr>
                <tr><td className="py-0.5 align-top">Izin &amp; sakit dari orang tua</td><td className="py-0.5">: {b.izin.daftar.length ? `${b.izin.daftar.length} pengajuan semester ini (${b.izin.disetujui} disetujui${b.izin.menunggu ? `, ${b.izin.menunggu} menunggu` : ""})` : "Tidak ada pengajuan"}</td></tr>
                <tr><td className="py-0.5 align-top">Kunjungan rumah</td><td className="py-0.5">: {b.kunjungan.length ? b.kunjungan.map(k => tgl(k.tanggal)).join("; ") : "Belum pernah"}</td></tr>
              </tbody></table>

              <Judul>E. Catatan pertemuan</Judul>
              <div className="h-28 border border-gray-300" />

              <div className="mt-6 grid grid-cols-2 gap-8 text-center">
                <div><p>Orang tua / wali</p><div style={{ height: 56 }} /><p>( ........................................ )</p></div>
                <div><p>{s["nominatif.kecamatan"] || "Singojuruh"}, {tgl(hariIni)}</p><p>Wali kelas</p><GambarTtd src={d.kelas.waliUserId ? ttd.get(d.kelas.waliUserId) : null} /><p className="font-semibold underline">{d.kelas.wali ?? "........................................"}</p></div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
