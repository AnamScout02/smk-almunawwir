import { Award } from "lucide-react";
import { getPrincipalName, getSettings } from "@/lib/site-settings";
import { petaTtd, ttdDariNama } from "@/lib/ttd";
import PageHeader from "@/components/admin/PageHeader";
import PrintKop from "@/components/shared/PrintKop";
import PrintButton from "@/components/shared/PrintButton";
import GambarTtd from "@/components/shared/GambarTtd";
import TombolKembali from "@/components/shared/TombolKembali";
import type { RaporKinerja } from "@/lib/rapor-kinerja";

const tgl = (s: string) => new Date(`${s}T00:00:00Z`).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const ROMAWI: Record<number, string> = { 10: "X", 11: "XI", 12: "XII", 13: "XIII" };
const pct = (p: number | null) => (p === null ? "—" : `${p}%`);

/** LEMBAR RAPOR KINERJA GURU (server component; pratinjau layar sekaligus lembar cetak A4). Data: `susunRaporKinerja`.
 *  Penjagaan akses dilakukan PEMANGGIL (halaman admin / portal guru). */
export default async function RaporKinerjaLembar({ r, kembaliHref }: { r: RaporKinerja; kembaliHref?: string }) {
  const s = await getSettings(["school.name", "logo.full_white", "school.structure"]);
  const namaKepala = getPrincipalName(s["school.structure"] ?? "");
  const [ttdKepala, ttdGuru] = await Promise.all([ttdDariNama(namaKepala), petaTtd([r.guru.userId]).then(m => m.get(r.guru.userId))]);
  const k = r.kehadiran, c = r.kelas, j = r.jurnal;
  const sel = "border border-gray-300 px-2 py-1";
  const kepala = "border border-gray-300 bg-gray-100 px-2 py-1 text-left font-semibold";
  const Judul = ({ children }: { children: React.ReactNode }) => <h3 className="mb-1 mt-4 text-[12px] font-bold uppercase tracking-wide">{children}</h3>;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0">
      <style>{`@page { size: A4 portrait; margin: 14mm; }`}</style>
      <PageHeader icon={<Award size={22} />} title="Rapor Kinerja Guru" description={`${r.guru.nama} · ${r.semester}`} printHidden />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <TombolKembali href={kembaliHref} />
        <div className="alat-aksi"><PrintButton /></div>
      </div>

      <div className="print-doc bg-white mx-auto w-full max-w-[210mm] overflow-x-auto px-8 py-6 text-[12px] leading-snug print:px-2 print:py-0">
        <PrintKop title="RAPOR KINERJA GURU" subtitle={`${s["school.name"] || "SMK Al Munawwir IIBS"} · Semester ${r.semester}`} logoUrl={s["logo.full_white"]} />
        <table className="w-full">
          <tbody>
            <tr><td className="w-36 py-0.5">Nama</td><td className="py-0.5">: <b>{r.guru.nama}</b></td><td className="w-28 py-0.5">Periode</td><td className="py-0.5">: {tgl(r.mulai)} – {tgl(r.sampai)}</td></tr>
            <tr><td className="py-0.5">Nomor induk</td><td className="py-0.5">: {r.guru.nip || "—"}</td><td className="py-0.5">Wali kelas</td><td className="py-0.5">: {r.guru.wali.join(", ") || "—"}</td></tr>
            <tr><td className="py-0.5 align-top">Jabatan</td><td className="py-0.5">: {r.guru.jabatan.join(", ") || "Guru"}</td><td className="py-0.5 align-top">Mapel</td><td className="py-0.5">: {r.guru.mapel.join(", ") || "—"}</td></tr>
          </tbody>
        </table>

        <Judul>A. Kehadiran di sekolah{k.sejak > r.mulai ? ` (presensi pegawai dicatat sejak ${tgl(k.sejak)})` : ""}</Judul>
        <table className="w-full border-collapse">
          <thead><tr>{["Hari sekolah", "Hadir", "Izin", "Sakit", "Dinas luar", "Cuti", "Alpha", "Belum tercatat", "Persen hadir"].map(h => <th key={h} className={kepala}>{h}</th>)}</tr></thead>
          <tbody><tr>{[k.hariSekolah, k.hadir, k.izin, k.sakit, k.dinas, k.cuti, k.alpha, k.belumTercatat, pct(k.persen)].map((v, i) => <td key={i} className={`${sel} tabular-nums`}>{v}</td>)}</tr></tbody>
        </table>
        <p className="mt-1 text-[11px] text-gray-600">
          {k.turunan > 0 && <>Dari {k.hadir} hari hadir, {k.turunan} hari adalah catatan turunan (dari catatan guru piket / jurnal mengajar, bukan pindaian atau isian Tata Usaha). </>}
          {k.belumTercatat > 0 && <>&ldquo;Belum tercatat&rdquo; berarti tidak ada catatan apa pun untuk hari itu — bukan alpha.</>}
        </p>

        <Judul>B. Masuk kelas (catatan guru piket)</Judul>
        {c.dicatat === 0 ? <p className="text-gray-600">Belum ada jam pelajaran guru ini yang dicatat guru piket pada periode ini.</p> : (
          <table className="w-full border-collapse">
            <thead><tr>{["Jam dicatat piket", "Hadir", "Terlambat", "Izin", "Sakit", "Alpha", "Tidak hadir, ada tugas", "Persen masuk"].map(h => <th key={h} className={kepala}>{h}</th>)}</tr></thead>
            <tbody><tr>{[c.dicatat, c.hadir, c.terlambat, c.izin, c.sakit, c.alpha, c.tugas, pct(c.persen)].map((v, i) => <td key={i} className={`${sel} tabular-nums`}>{v}</td>)}</tr></tbody>
          </table>
        )}

        <Judul>C. Jurnal mengajar & keterlaksanaan — {j.terisi} dari {j.pertemuan} pertemuan ({pct(j.persen)})</Judul>
        {j.baris.length === 0 ? <p className="text-gray-600">Tidak ada jadwal mengajar pada semester ini.</p> : (
          <table className="w-full border-collapse">
            <thead><tr>{["Kelas", "Mapel", "Pertemuan", "Jurnal", "%", "Materi Prota tercatat"].map(h => <th key={h} className={kepala}>{h}</th>)}</tr></thead>
            <tbody>
              {j.baris.map(b => (
                <tr key={`${b.classId}|${b.mapel}`}>
                  <td className={sel}>{b.kelas}</td><td className={sel}>{b.mapel}</td>
                  <td className={`${sel} tabular-nums`}>{b.pertemuan}</td><td className={`${sel} tabular-nums`}>{b.jurnal}</td><td className={`${sel} tabular-nums`}>{pct(b.persen)}</td>
                  <td className={sel}>{b.rencana ? `${b.rencana.tercapai}/${b.rencana.total}${b.rencana.tertinggal ? ` · tertinggal ${b.rencana.tertinggal}` : ""}` : "belum ada Prota/Promes"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <Judul>D. Perangkat ajar</Judul>
        {r.perangkat.length === 0 ? <p className="text-gray-600">Tidak ada penugasan mengajar.</p> : (
          <table className="w-full border-collapse">
            <thead><tr>{["Mapel", "Tingkat", "Prota & Promes", "RPP", "Form Nilai Rapor", "Kisi-kisi ujian"].map(h => <th key={h} className={kepala}>{h}</th>)}</tr></thead>
            <tbody>
              {r.perangkat.map(p => (
                <tr key={`${p.mapel}|${p.tingkat}`}>
                  <td className={sel}>{p.mapel}</td><td className={sel}>{ROMAWI[p.tingkat] ?? p.tingkat}</td>
                  <td className={sel}>{p.prota ? "Ada" : "Belum"}</td><td className={`${sel} tabular-nums`}>{p.rpp || "Belum"}</td>
                  <td className={sel}>{p.form.dikirim}/{p.form.kelas} kelas terkirim</td>
                  <td className={sel}>{p.ujian.jumlah ? `${p.ujian.kisiLengkap}/${p.ujian.jumlah} ujian lengkap` : "belum ada ujian"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <Judul>E. Supervisi & penilaian kinerja</Judul>
        {r.supervisi.length === 0 ? <p className="text-gray-600">Belum ada supervisi yang dicatat pada semester ini.</p> : (
          <table className="w-full border-collapse">
            <thead><tr>{["Tanggal", "Jenis", "Mapel / kelas", "Nilai", "Predikat", "Penilai", "Tindak lanjut"].map(h => <th key={h} className={kepala}>{h}</th>)}</tr></thead>
            <tbody>
              {r.supervisi.map((x, i) => (
                <tr key={i}><td className={sel}>{tgl(x.tanggal)}</td><td className={sel}>{x.jenis}</td><td className={sel}>{[x.mapel, x.kelas].filter(Boolean).join(" · ") || "—"}</td>
                  <td className={`${sel} tabular-nums`}>{x.nilaiAkhir ?? "—"}</td><td className={sel}>{x.predikat ?? "—"}</td><td className={sel}>{x.penilaiNama}</td><td className={sel}>{x.tindakLanjut ?? "—"}</td></tr>
              ))}
            </tbody>
          </table>
        )}

        <Judul>F. Pengembangan keprofesian (PKB) — {r.pkb.jumlah} kegiatan, {r.pkb.jp} JP</Judul>
        {r.pkb.jumlah === 0 ? <p className="text-gray-600">Belum ada kegiatan PKB yang dicatat pada semester ini.</p> : (
          <table className="w-full border-collapse">
            <thead><tr>{["Tanggal", "Kegiatan", "Jenis", "Penyelenggara", "JP"].map(h => <th key={h} className={kepala}>{h}</th>)}</tr></thead>
            <tbody>{r.pkb.daftar.map((x, i) => <tr key={i}><td className={sel}>{tgl(x.mulai)}</td><td className={sel}>{x.judul}</td><td className={sel}>{x.jenis}</td><td className={sel}>{x.penyelenggara ?? "—"}</td><td className={`${sel} tabular-nums`}>{x.jamPelajaran ?? "—"}</td></tr>)}</tbody>
          </table>
        )}

        <Judul>G. Masukan rekan</Judul>
        <p>{r.masukan.apresiasi + r.masukan.saran + r.masukan.kritik === 0 ? "Belum ada masukan rekan pada semester ini." : `Apresiasi ${r.masukan.apresiasi} · Saran ${r.masukan.saran} · Kritik ${r.masukan.kritik} (jumlah saja; isi masukan hanya dibaca penerimanya).`}</p>

        <Judul>Catatan pimpinan</Judul>
        <div className="h-16 border border-gray-300" />

        <p className="mt-2 text-[10.5px] text-gray-500">
          Seluruh angka dibaca dari data MyAlwis per {tgl(r.sampai)}; lembar ini tidak memuat nilai gabungan — pembobotan antar-aspek adalah wewenang pimpinan.
          Pertemuan terjadwal dihitung dari jadwal yang berlaku sekarang (hari libur & hari ujian tidak dihitung).
        </p>
        <div className="mt-6 grid grid-cols-2 gap-8 text-center" style={{ breakInside: "avoid" }}>
          <div><p>Mengetahui,</p><p>Kepala Sekolah</p><GambarTtd src={ttdKepala} /><p className="font-semibold underline">{namaKepala || "........................"}</p></div>
          <div><p>Singojuruh, {tgl(r.sampai)}</p><p>Guru yang bersangkutan</p><GambarTtd src={ttdGuru} /><p className="font-semibold underline">{r.guru.nama}</p></div>
        </div>
      </div>
    </div>
  );
}
