import Link from "next/link";
import { ChartNoAxesCombined } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import { kejanggalanNilai, polaKetidakhadiran, proyeksiKenaikan, type Temuan } from "@/lib/analitik-data";
import KriteriaNaikForm from "@/components/jabatan/KriteriaNaikForm";

const WARNA = { TINGGI: "bg-red-50 text-red-600 border-red-200", SEDANG: "bg-amber-50 text-amber-700 border-amber-200", PANTAU: "bg-blue-50 text-blue-700 border-blue-200" } as const;
const NAMA = { TINGGI: "Tinggi", SEDANG: "Sedang", PANTAU: "Pantau" } as const;

function TabelTemuan({ temuan, kosong }: { temuan: Temuan[]; kosong: string }) {
  if (!temuan.length) return <p className="py-10 text-center text-sm text-gray-400">{kosong}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead><tr><th className="w-10">No</th><th>Jenis</th><th>Siapa / kelas</th><th>Rincian</th><th>Temuan</th></tr></thead>
        <tbody>{temuan.map((t, i) => (
          <tr key={i}><td className="angka text-gray-400">{i + 1}</td>
            <td><span className={`status-badge whitespace-nowrap ${WARNA[t.tingkat]}`}>{t.jenis}</span></td>
            <td className="font-medium text-primary-900">{t.subjek}</td><td className="text-sm text-gray-500">{t.rincian}</td><td className="text-sm text-gray-700">{t.keterangan}</td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}

/** ANALITIK DATA — tiga pembaca atas data yang sudah ada (src/lib/analitik-data.ts). `bolehGuru` = boleh melihat pola
 *  guru & kejanggalan nilai (pimpinan); Kesiswaan/BK hanya bagian siswa. Penjagaan akses dilakukan PEMANGGIL. */
export default async function AnalitikData({ bagian, dasar, bolehGuru, bolehAtur }: { bagian?: string; dasar: string; bolehGuru: boolean; bolehAtur: boolean }) {
  const tab = [...(bolehGuru ? [["nilai", "Kejanggalan Nilai"] as const] : []), ["hadir", "Pola Ketidakhadiran"] as const, ["proyeksi", "Proyeksi Kenaikan"] as const];
  const aktif = tab.find(t => t[0] === bagian)?.[0] ?? tab[0][0];
  const [n, h, p] = await Promise.all([
    aktif === "nilai" ? kejanggalanNilai() : null,
    aktif === "hadir" ? polaKetidakhadiran({ guru: bolehGuru }) : null,
    aktif === "proyeksi" ? proyeksiKenaikan() : null,
  ]);
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<ChartNoAxesCombined size={22} />} title="Analitik Data" description="Kejanggalan nilai, pola ketidakhadiran, dan proyeksi kenaikan — dihitung dari data yang sudah tercatat" />
      <div className="space-y-6">
        {n && <div className="kisi-kartu kisi-kartu-3">
          <StatTile value={n.temuan.length} label="Temuan untuk diperiksa" ikon="waspada" color="amber" />
          <StatTile value={n.cakupan.nilaiHarian} label="Nilai harian dibaca" ikon="jurnal" color="primary" />
          <StatTile value={n.cakupan.hasilUjian} label="Hasil ujian dibaca" ikon="centang" color="blue" />
        </div>}
        {h && <div className="kisi-kartu kisi-kartu-3">
          <StatTile value={h.temuan.length} label="Pola untuk diperiksa" ikon="waspada" color="amber" />
          <StatTile value={h.cakupan.hari} label="Hari absensi dibaca" ikon="kalender" color="primary" />
          <StatTile value={h.cakupan.kelas} label="Kelas yang punya absensi" ikon="kelas" color="blue" />
        </div>}
        {p && <div className="kisi-kartu kisi-kartu-4">
          <StatTile value={p.berisiko.filter(b => b.tingkat === "TINGGI").length} label="Risiko tinggi" ikon="alpha" color="red" sorot={p.berisiko.some(b => b.tingkat === "TINGGI")} />
          <StatTile value={p.berisiko.filter(b => b.tingkat === "SEDANG").length} label="Risiko sedang" ikon="waspada" color="amber" />
          <StatTile value={p.jumlahSiswa} label="Siswa dihitung" ikon="siswa" color="primary" />
          <StatTile value={p.sisaHari} label="Sisa hari sekolah semester ini" ikon="kalender" color="blue" />
        </div>}
        <div className="baris-alat">
          <div className="alat-tab flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-gray-100 bg-white p-1 scrollbar-hide">
            {tab.map(([k, l]) => <Link key={k} href={`${dasar}?bagian=${k}`} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition ${aktif === k ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>{l}</Link>)}
          </div>
        </div>

        {n && <>
          <p className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">Semester {n.semester}. Yang ditandai: satu pertemuan dengan nilai semua siswa sama, nilai seorang siswa yang menyimpang 30 poin atau lebih dari nilai-nilainya sebelumnya, dan selisih besar antara nilai harian dan ujian pada mapel yang sama. Ini <b>daftar untuk diperiksa</b> — banyak yang punya penjelasan wajar (tugas kelompok, remedial).</p>
          <section className="panel overflow-hidden"><TabelTemuan temuan={n.temuan} kosong={n.cakupan.nilaiHarian < 50 ? "Nilai yang tercatat masih terlalu sedikit untuk dibandingkan." : "Tidak ada kejanggalan yang ditemukan."} /></section>
          <p className="text-xs text-gray-500">Dibaca dari {n.cakupan.nilaiHarian.toLocaleString("id-ID")} nilai harian pada {n.cakupan.pertemuanBernilai} pertemuan berjurnal dan {n.cakupan.hasilUjian} hasil ujian. Makin banyak guru menilai lewat Jurnal Mengajar, makin berarti halaman ini.</p>
        </>}

        {h && <>
          <p className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">Semester {h.semester}. Yang dicari: siswa yang ketidakhadirannya menumpuk di satu hari, siswa yang sering tidak ada di satu mapel (menurut jurnal guru), {bolehGuru ? "guru yang jam tidak masuknya menumpuk di satu hari, " : ""}dan kelas yang ketidakhadirannya naik — termasuk menjelang ujian. Izin dan sakit ikut dihitung sebagai tidak hadir.</p>
          <section className="panel overflow-hidden"><TabelTemuan temuan={h.temuan} kosong="Tidak ada pola yang menonjol." /></section>
          <p className="text-xs text-gray-500">Dibaca dari {h.cakupan.absensi.toLocaleString("id-ID")} catatan absensi ({h.cakupan.hari} hari, {h.cakupan.kelas} kelas), {h.cakupan.jurnal.toLocaleString("id-ID")} kehadiran di jurnal guru{bolehGuru ? `, dan ${h.cakupan.piket} jam catatan guru piket` : ""}. Kelas yang absensinya belum diisi tidak bisa dinilai.</p>
        </>}

        {p && <>
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            <p><b>Ini proyeksi, bukan ramalan terlatih.</b> Sekolah belum punya riwayat siapa yang akhirnya tinggal kelas atau keluar, jadi belum ada yang bisa dipakai untuk melatih dan menguji prediksi. Yang dihitung: bila pola 4 pekan terakhir berlanjut sampai akhir semester ({p.sisaHari} hari sekolah lagi), siapa yang akan melewati batas di bawah ini.</p>
            <p className="mt-1">Batas yang dipakai: kehadiran minimal <b>{p.kriteria.minHadir}%</b>, alpha paling banyak <b>{p.kriteria.maksAlpha}</b> kali, mapel di bawah KKM ({p.kkm}) paling banyak <b>{p.kriteria.maksDibawahKkm}</b>. {p.ditetapkan ? "" : <b>Angka ini bawaan, belum ditetapkan sekolah.</b>}</p>
          </div>
          {bolehAtur && <KriteriaNaikForm awal={p.kriteria} />}
          <section className="panel overflow-hidden">
            {p.berisiko.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">Tidak ada siswa yang diperkirakan melewati batas.</p> : (
              <div className="overflow-x-auto"><table className="data-table">
                <thead><tr><th className="w-10">No</th><th>Nama</th><th>Kelas</th><th>Risiko</th><th className="text-right">Hadir kini</th><th className="text-right">Perkiraan akhir</th><th className="text-right">Alpha</th><th className="text-right">&lt; KKM</th><th>Faktor (terbesar lebih dulu)</th></tr></thead>
                <tbody>{p.berisiko.slice(0, 300).map((b, i) => (
                  <tr key={b.id}><td className="angka text-gray-400">{i + 1}</td>
                    <td><span className="font-medium text-primary-900">{b.nama}</span><span className="angka block text-xs text-gray-400">{b.nis}</span></td><td>{b.kelas}</td>
                    <td><span className={`status-badge ${WARNA[b.tingkat!]}`}>{NAMA[b.tingkat!]}</span></td>
                    <td className="angka text-right">{b.persen == null ? "—" : `${b.persen}%`}</td><td className="angka text-right">{b.proyHadir == null ? "—" : `${b.proyHadir}%`}</td>
                    <td className="angka text-right">{b.alpha}</td><td className="angka text-right">{b.mapelBernilai ? b.dibawah : "—"}</td>
                    <td className="text-sm text-gray-700"><ul className="list-disc space-y-0.5 pl-4">{b.faktor.map(f => <li key={f.nama}><b>{f.nama}</b>: {f.ket}</li>)}</ul></td></tr>
                ))}</tbody>
              </table></div>
            )}
          </section>
          <p className="text-xs text-gray-500">{p.jumlahSiswa.toLocaleString("id-ID")} siswa aktif dihitung. {p.tanpaAbsensi} siswa belum punya absensi semester ini dan {p.tanpaNilai} belum punya nilai harian — mereka tidak bisa dinilai dari faktor itu, bukan berarti aman. Peringatan Dini tetap menjadi daftar kerja harian (30 hari terakhir); halaman ini melihat sampai akhir semester.</p>
        </>}
      </div>
    </div>
  );
}
