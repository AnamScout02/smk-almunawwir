export const dynamic = "force-dynamic";
import { CalendarRange } from "lucide-react";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { getPrincipalName, getSettings } from "@/lib/site-settings";
import { ttdDariNama } from "@/lib/ttd";
import PageHeader from "@/components/admin/PageHeader";
import PrintKop from "@/components/shared/PrintKop";
import PrintButton from "@/components/shared/PrintButton";
import GambarTtd from "@/components/shared/GambarTtd";
import PilihBulanLaporan from "@/components/admin/PilihBulanLaporan";
import { bulanSah, susunLaporanBulanan } from "@/lib/laporan-bulanan-tu";

export const metadata = { title: "Laporan Bulanan TU" };
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const tgl = (d: Date | null) => (d ? d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }) : "—");
const rp = (n: number) => `Rp${n.toLocaleString("id-ID")}`;
const sel = "border border-gray-400 px-2 py-1", kepala = "border border-[#0F1A45] bg-[#0F1A45] px-2 py-1.5 text-left font-semibold text-white";

function Angka({ baris }: { baris: [string, string | number][] }) {
  return (
    <table className="mb-4 w-full border-collapse" style={{ breakInside: "avoid" }}>
      <tbody>{baris.map(([l, v]) => <tr key={l}><td className={`${sel} w-2/3`}>{l}</td><td className={`${sel} text-right`}>{typeof v === "number" ? v.toLocaleString("id-ID") : v}</td></tr>)}</tbody>
    </table>
  );
}
const rinci = (a: [string, number][]) => (a.length ? a.map(([k, n]) => `${k} ${n}`).join(" · ") : "—");

/** LAPORAN BULANAN TATA USAHA — satu dokumen cetak A4 per bulan dari data yang sudah ada (`susunLaporanBulanan`).
 *  Halaman ini sekaligus pratinjau layar & lembar cetak (kertas `.print-doc`; ukuran huruf & tabelnya gaya dokumen cetak). */
export default async function Page({ searchParams }: { searchParams: Promise<{ bulan?: string }> }) {
  await verifyTasAccess();
  const bulan = bulanSah((await searchParams).bulan);
  const [r, s] = await Promise.all([susunLaporanBulanan(bulan), getSettings(["logo.full_white", "school.structure", "school.name"])]);
  const namaKepala = getPrincipalName(s["school.structure"]);
  const ttd = await ttdDariNama(namaKepala);
  const [th, bl] = bulan.split("-").map(Number);
  const judulBulan = `${BULAN[bl - 1]} ${th}`;
  const berjalan = r.sampai > new Date();
  const dibuat = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
  const mutasi = [...r.siswa.masuk.map(m => ({ ...m, arah: "Masuk" })), ...r.siswa.keluar.map(m => ({ ...m, arah: "Keluar" }))];
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0 print:pt-0">
      <style>{`@page { size: A4 portrait; margin: 14mm; }`}</style>
      <PageHeader icon={<CalendarRange size={22} />} title="Laporan Bulanan TU" description={`Rekap pekerjaan Tata Usaha — ${judulBulan}`} printHidden />
      <div className="baris-alat mb-5 print:hidden">
        <div className="alat-saring"><PilihBulanLaporan bulan={bulan} dasar="/dashboard/admin/laporan-bulanan" /></div>
        <div className="alat-aksi"><PrintButton /></div>
      </div>
      <div className="print-doc bg-white mx-auto w-full max-w-[210mm] overflow-x-auto px-8 py-6 text-[12px] print:px-2 print:py-0">
        <PrintKop title="LAPORAN BULANAN TATA USAHA" subtitle={`${s["school.name"] || "SMK Al Munawwir IIBS"} · ${judulBulan}`} logoUrl={s["logo.full_white"]} />
        {berjalan && <p className="mb-3 italic text-gray-600">Bulan ini masih berjalan — angka di bawah adalah keadaan sampai {dibuat}.</p>}

        <p className="mb-1 font-semibold">A. Persuratan</p>
        <Angka baris={[
          ["Surat masuk", r.surat.masuk], ["   – sudah dipindai", r.surat.masukDipindai], ["   – sudah didisposisi", r.surat.masukDidisposisi],
          ["Surat keluar", r.surat.keluar], ["   – sudah ada isinya", r.surat.keluarBerisi],
          ["Disposisi dibuat", r.surat.disposisi], ["Disposisi diselesaikan", r.surat.disposisiSelesai],
          ["Surat dikirim lewat ekspedisi", r.surat.ekspedisi], ["   – sudah ada tanda terima", r.surat.ekspedisiDiterima],
        ]} />
        {r.surat.perKlasifikasi.length > 0 && <p className="mb-4">Surat keluar per klasifikasi: {rinci(r.surat.perKlasifikasi)}</p>}

        <p className="mb-1 font-semibold">B. Layanan & dokumen</p>
        <Angka baris={[
          ["Surat keterangan untuk siswa", r.layanan.suratKet], ["Permintaan legalisir", r.layanan.legalisir], ["   – jumlah lembar", r.layanan.legalisirLembar],
          ["Legalisir diambil", r.layanan.legalisirDiambil], ["Ijazah diserahkan", r.layanan.ijazah], ["Rapor diambil", r.layanan.rapor],
          ["Tamu tercatat", r.layanan.tamu], ["Arsip baru", r.layanan.arsip],
          ["Bantuan / beasiswa cair", r.layanan.bantuan], ["   – nilai", rp(r.layanan.bantuanNominal)], ["   – sudah diambil", r.layanan.bantuanDiambil],
        ]} />
        <p className="mb-4">
          {r.layanan.suratKetPerJenis.length > 0 && <>Surat keterangan: {rinci(r.layanan.suratKetPerJenis)}<br /></>}
          {r.layanan.legalisirPerDokumen.length > 0 && <>Legalisir: {rinci(r.layanan.legalisirPerDokumen)}<br /></>}
          {r.layanan.tamuPerKategori.length > 0 && <>Tamu: {rinci(r.layanan.tamuPerKategori)}</>}
        </p>

        <p className="mb-1 font-semibold">C. Siswa</p>
        <table className="mb-2 w-full border-collapse" style={{ breakInside: "avoid" }}>
          <thead><tr>{["Tingkat", "Laki-laki", "Perempuan", "Jumlah"].map(h => <th key={h} className={kepala}>{h}</th>)}</tr></thead>
          <tbody>
            {r.siswa.keadaan.map(k => <tr key={k.label}><td className={sel}>{k.label}</td><td className={`${sel} text-right`}>{k.L}</td><td className={`${sel} text-right`}>{k.P}</td><td className={`${sel} text-right`}>{k.jumlah}</td></tr>)}
            <tr className="font-semibold"><td className={sel}>Jumlah siswa aktif</td><td className={`${sel} text-right`}>{r.siswa.keadaan.reduce((a, k) => a + k.L, 0)}</td><td className={`${sel} text-right`}>{r.siswa.keadaan.reduce((a, k) => a + k.P, 0)}</td><td className={`${sel} text-right`}>{r.siswa.totalAktif}</td></tr>
          </tbody>
        </table>
        <p className="mb-3 text-gray-600">Keadaan siswa adalah keadaan pada {dibuat}, bukan potret akhir bulan.</p>
        <Angka baris={[
          ["Mutasi masuk (pindahan)", r.siswa.masuk.length], ["Mutasi keluar (pindah / keluar)", r.siswa.keluar.length], ["Lulus", r.siswa.lulus],
          ["Pendaftar SPMB baru", r.siswa.spmb], ["Pengajuan biodata siswa diputuskan", r.siswa.biodata],
        ]} />
        {mutasi.length > 0 && (
          <table className="mb-4 w-full border-collapse">
            <thead><tr>{["Tanggal", "Arah", "Nama", "NIS", "Kelas", "Keterangan"].map(h => <th key={h} className={kepala}>{h}</th>)}</tr></thead>
            <tbody>{mutasi.map(m => <tr key={m.arah + m.id} style={{ breakInside: "avoid" }}><td className={sel}>{tgl(m.tanggal)}</td><td className={sel}>{m.arah}</td><td className={sel}>{m.nama}</td><td className={sel}>{m.nis}</td><td className={sel}>{m.kelas}</td><td className={sel}>{m.lain}</td></tr>)}</tbody>
          </table>
        )}

        <p className="mb-1 font-semibold">D. Kepegawaian</p>
        <Angka baris={[
          ["Catatan presensi pegawai", r.pegawai.presensiTotal], ["Pengajuan cuti / izin", r.pegawai.cuti], ["   – jumlah hari", r.pegawai.cutiHari],
          ["Pengajuan biodata pegawai diputuskan", r.pegawai.biodata],
        ]} />
        <p className="mb-4">
          {r.pegawai.presensi.length > 0 && <>Presensi: {rinci(r.pegawai.presensi.map(([k, n]) => [k.replace(/_/g, " ").toLowerCase(), n]))}<br /></>}
          {r.pegawai.cutiPerJenis.length > 0 && <>Cuti: {rinci(r.pegawai.cutiPerJenis.map(([k, n]) => [k.toLowerCase(), n]))}</>}
        </p>

        <div className="mt-8 grid grid-cols-2 gap-8 text-center" style={{ breakInside: "avoid" }}>
          <div><p>Mengetahui,</p><p>Kepala Sekolah</p><GambarTtd src={ttd} /><p className="font-semibold underline">{namaKepala || "........................"}</p></div>
          <div><p>Singojuruh, {dibuat}</p><p>Kepala Tata Usaha</p><GambarTtd src={null} /><p className="font-semibold underline">........................</p></div>
        </div>
      </div>
    </div>
  );
}
