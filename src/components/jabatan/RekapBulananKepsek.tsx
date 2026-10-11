import { CalendarRange } from "lucide-react";
import { getPrincipalName, getSettings } from "@/lib/site-settings";
import { ttdDariNama } from "@/lib/ttd";
import { bulanSah } from "@/lib/laporan-bulanan-tu";
import { susunRekapKepsek } from "@/lib/rekap-kepsek";
import PageHeader from "@/components/admin/PageHeader";
import PrintKop from "@/components/shared/PrintKop";
import PrintButton from "@/components/shared/PrintButton";
import GambarTtd from "@/components/shared/GambarTtd";
import PilihBulanLaporan from "@/components/admin/PilihBulanLaporan";

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const persen = (p: number | null) => (p === null ? "—" : `${p}%`);

/** REKAP BULANAN KEPALA SEKOLAH — pratinjau layar sekaligus lembar cetak A4 (data: `susunRekapKepsek`). Penjagaan akses
 *  dilakukan PEMANGGIL (halaman admin / portal guru). */
export default async function RekapBulananKepsek({ bulan: minta, dasar }: { bulan?: string; dasar: string }) {
  const bulan = bulanSah(minta);
  const [r, s] = await Promise.all([susunRekapKepsek(bulan), getSettings(["school.name", "logo.full_white", "school.structure", "nominatif.kecamatan"])]);
  const namaKepala = getPrincipalName(s["school.structure"] ?? "");
  const ttd = await ttdDariNama(namaKepala);
  const [th, bl] = bulan.split("-").map(Number), judulBulan = `${BULAN[bl - 1]} ${th}`;
  const sel = "border border-gray-300 px-2 py-1", kepala = "border border-gray-300 bg-gray-100 px-2 py-1 text-left font-semibold";
  const Judul = ({ children }: { children: React.ReactNode }) => <h3 className="mb-1 mt-4 text-[12px] font-bold uppercase tracking-wide">{children}</h3>;
  const Baris = ({ kolom, nilai }: { kolom: string[]; nilai: (string | number)[] }) => (
    <table className="w-full border-collapse">
      <thead><tr>{kolom.map(h => <th key={h} className={kepala}>{h}</th>)}</tr></thead>
      <tbody><tr>{nilai.map((v, i) => <td key={i} className={`${sel} tabular-nums`}>{typeof v === "number" ? v.toLocaleString("id-ID") : v}</td>)}</tr></tbody>
    </table>
  );
  const Daftar = ({ judul, data, satuan }: { judul: string; data: [string, number][]; satuan: string }) => data.length === 0 ? null : (
    <p className="mt-1 text-[11px] text-gray-700"><b>{judul}:</b> {data.map(([n, j]) => `${n} (${j} ${satuan})`).join("; ")}.</p>
  );
  const p = r.pegawai, k = r.kelas, j = r.jurnal, w = r.siswa;
  const hariIni = new Date(Date.now() + 7 * 3600_000).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0">
      <style>{`@page { size: A4 portrait; margin: 14mm; }`}</style>
      <PageHeader icon={<CalendarRange size={22} />} title="Rekap Bulanan" description={`Kehadiran guru & siswa, jurnal mengajar, dan persuratan — ${judulBulan}`} printHidden />
      <div className="baris-alat mb-5 print:hidden">
        <div className="alat-saring w-56"><PilihBulanLaporan bulan={bulan} dasar={dasar} /></div>
        <div className="alat-aksi"><PrintButton /></div>
      </div>
      <div className="print-doc bg-white mx-auto w-full max-w-[210mm] overflow-x-auto px-8 py-6 text-[12px] leading-snug print:px-2 print:py-0">
        <PrintKop title="REKAP BULANAN SEKOLAH" subtitle={`${s["school.name"] || "SMK Al Munawwir IIBS"} · ${judulBulan}`} logoUrl={s["logo.full_white"]} />

        <Judul>A. Kehadiran guru &amp; staf — {persen(p.persen)} hadir</Judul>
        {p.catatan === 0 ? <p className="text-gray-600">Belum ada catatan presensi pegawai pada bulan ini.</p> : <>
          <Baris kolom={["Pegawai tercatat", "Hadir", "Izin", "Sakit", "Dinas luar", "Cuti", "Alpha"]} nilai={[p.orang, p.hadir, p.izin, p.sakit, p.dinas, p.cuti, p.alpha]} />
          {p.turunan > 0 && <p className="mt-1 text-[11px] text-gray-600">Dari {p.hadir.toLocaleString("id-ID")} hari hadir, {p.turunan.toLocaleString("id-ID")} adalah catatan turunan (dari catatan guru piket / jurnal mengajar, bukan pindaian atau isian Tata Usaha).</p>}
          <Daftar judul="Alpha terbanyak" data={p.alphaTerbanyak} satuan="hari" />
        </>}

        <Judul>B. Guru masuk kelas (catatan guru piket) — {persen(k.persen)} jam terisi</Judul>
        {k.dicatat === 0 ? <p className="text-gray-600">Belum ada jam pelajaran yang dicatat guru piket pada bulan ini.</p> : <>
          <Baris kolom={["Jam dicatat", "Hadir", "Terlambat", "Tidak masuk", "…ada tugas titipan", "…tanpa tugas"]} nilai={[k.dicatat, k.hadir, k.terlambat, k.tidakMasuk, k.adaTugas, k.tanpaTugas]} />
          <Daftar judul="Jam tidak masuk terbanyak" data={k.kosongTerbanyak} satuan="jam" />
        </>}

        <Judul>C. Jurnal mengajar — {j.guruMengisi} dari {j.guruBerjadwal} guru berjadwal mengisi</Judul>
        <Baris kolom={["Pertemuan berjurnal", "Guru mengisi", "Guru berjadwal", "Belum mengisi sama sekali"]} nilai={[j.pertemuan, j.guruMengisi, j.guruBerjadwal, j.belumMengisi.length]} />
        {j.belumMengisi.length > 0 && <p className="mt-1 text-[11px] text-gray-700"><b>Belum mengisi jurnal bulan ini:</b> {j.belumMengisi.join("; ")}.</p>}

        <Judul>D. Kehadiran siswa — {persen(w.persen)} hadir</Judul>
        {w.catatan === 0 ? <p className="text-gray-600">Belum ada absensi siswa pada bulan ini.</p> : <>
          <Baris kolom={["Catatan absensi", "Hadir", "Izin", "Sakit", "Alpha"]} nilai={[w.catatan, w.hadir, w.izin, w.sakit, w.alpha]} />
          <table className="mt-2 w-full border-collapse">
            <thead><tr>{["Tingkat", "Catatan", "Persen hadir", "Alpha"].map(h => <th key={h} className={kepala}>{h}</th>)}</tr></thead>
            <tbody>{w.perTingkat.map(t => <tr key={t.tingkat}><td className={sel}>Kelas {t.tingkat}</td><td className={`${sel} tabular-nums`}>{t.catatan.toLocaleString("id-ID")}</td><td className={`${sel} tabular-nums`}>{persen(t.persen)}</td><td className={`${sel} tabular-nums`}>{t.alpha}</td></tr>)}</tbody>
          </table>
          <Daftar judul="Kelas dengan alpha terbanyak" data={w.alphaKelas} satuan="kali" />
        </>}
        <p className="mt-1 text-[11px] text-gray-700">Izin/sakit diajukan orang tua: {w.izinDiajukan}{w.izinMenunggu ? ` (${w.izinMenunggu} masih menunggu keputusan wali kelas)` : ""}. Catatan poin: {w.pelanggaran} pelanggaran, {w.prestasi} prestasi.</p>

        <Judul>E. Persuratan</Judul>
        {!r.surat ? <p className="text-gray-600">Data persuratan tidak terbaca.</p> : (
          <Baris kolom={["Surat masuk", "…sudah didisposisi", "Surat keluar", "Disposisi dibuat", "Disposisi selesai"]} nilai={[r.surat.masuk, r.surat.masukDidisposisi, r.surat.keluar, r.surat.disposisi, r.surat.disposisiSelesai]} />
        )}

        <p className="mt-4 text-[11px] text-gray-600">Disusun otomatis dari Presensi Pegawai, Buku Piket, Jurnal Mengajar, absensi kelas, dan Agenda Surat pada {hariIni}. Angka mengikuti data yang sudah dicatat sampai saat lembar ini dibuka.</p>
        <div className="mt-6 flex justify-end text-center">
          <div><p>{s["nominatif.kecamatan"] || "Singojuruh"}, {hariIni}</p><p>Kepala Sekolah</p><GambarTtd src={ttd} /><p className="font-semibold underline">{namaKepala || "........................................"}</p></div>
        </div>
      </div>
    </div>
  );
}
