import Link from "next/link";
import { ChartNoAxesCombined } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import { BarisKembali } from "@/components/shared/TombolKembali";
import { TautanIkon } from "@/components/shared/IkonNama";
import SaringAngkatan from "@/components/shared/SaringAngkatan";
import PotensiLulusanPanel from "@/components/shared/PotensiLulusanPanel";
import PersainganPanel, { ProyeksiPanel, type SaringPersaingan } from "@/components/shared/PersainganPanel";
import type { SaringPotensi } from "@/lib/potensi-smp";
import { analisisSebaran, geser, periodeDari, type Geser } from "@/lib/analisis-sebaran";

/** ANALISIS SEBARAN (8 Oktober 2026) — tiga bagian dari satu hitungan (`analisisSebaran`): sasaran promosi (pergeseran
 *  pangsa kecamatan), asal sekolah per angkatan, dan siswa aktif yang alamatnya belum lengkap. Dipakai portal Admin &
 *  Guru (pembungkus tipis + penjaga `assertPeta`). */
const TAB = [["promosi", "Sasaran Promosi"], ["sekolah", "Asal Sekolah"], ["potensi", "Potensi Lulusan SMP/MTs"], ["persaingan", "Peta Persaingan"], ["proyeksi", "Proyeksi 3 Tahun"], ["alamat", "Alamat Belum Lengkap"]] as const;
type Bagian = (typeof TAB)[number][0];

const persen = (n: number) => `${n.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
function Arah({ g }: { g: Geser }) {
  if (g.arah === "turun") return <span className="status-badge border-red-200 bg-red-50 text-red-600">Menurun</span>;
  if (g.arah === "naik") return <span className="status-badge border-emerald-200 bg-emerald-50 text-emerald-700">Tumbuh</span>;
  return <span className="text-xs text-gray-400">Stabil</span>;
}
const urutArah = { turun: 0, naik: 1, tetap: 2 };

/** Tiap pintu hanya membuka bagiannya (8 Okt 2026, user: "SPMB fokus SPMB, siswa fokus siswa"): Pusat SPMB = promosi +
 *  sekolah, Data Siswa = alamat. `alamat` = URL halaman ini (untuk tautan tab). */
export default async function AnalisisSebaranHalaman({ indukHref, alamat, kembaliHref, laporanHref, bagian, tampil, judul, keterangan, dari: dariMentah, sampai: sampaiMentah, potensi }: {
  /** Alamat Buku Induk Siswa di portal pemanggil — bila diisi, nama di "Alamat Belum Lengkap" menaut LANGSUNG ke isian alamat siswa itu. */
  indukHref?: string;
  alamat: string; kembaliHref?: string; laporanHref?: string; bagian?: string; dari?: string; sampai?: string; potensi?: SaringPotensi & SaringPersaingan; tampil: Bagian[]; judul: string; keterangan: string;
}) {
  const a = await analisisSebaran();
  const tab = TAB.filter(t => tampil.includes(t[0]));
  const aktif: Bagian = tab.some(t => t[0] === bagian) ? (bagian as Bagian) : tab[0][0];
  // Saringan rentang ANGKATAN MASUK (8 Okt 2026) — hanya untuk Sasaran Promosi & Asal Sekolah; daftar alamat selalu siswa aktif.
  const thSah = (v?: string) => { const n = Number(v); return v && a.tahun.includes(n) ? n : null; };
  let dari = thSah(dariMentah), sampai = thSah(sampaiMentah);
  if (dari && sampai && dari > sampai) [dari, sampai] = [sampai, dari];
  const saring = dari !== null || sampai !== null;
  const tahunPakai = a.tahun.filter(t => (dari === null || t >= dari) && (sampai === null || t <= sampai));
  const q = saring ? `&${new URLSearchParams({ ...(dari ? { dari: String(dari) } : {}), ...(sampai ? { sampai: String(sampai) } : {}) })}` : "";
  const p = saring ? periodeDari(a, tahunPakai) : a.periode;
  const bisaBanding = p.lama.length > 0 && p.baru.length > 0;
  const jumlahDi = (perTahun: Record<number, number>) => tahunPakai.reduce((n, t) => n + (perTahun[t] ?? 0), 0);
  // Rentang yang dipilih sendiri ditampilkan SELURUH tahunnya (tabel bisa digeser); tanpa saringan cukup 6 angkatan terakhir.
  const tahunTampil = saring ? tahunPakai : tahunPakai.slice(-6);
  const rentang = (t: number[]) => (t.length ? (t.length > 1 ? `${t[0]}–${t[t.length - 1]}` : String(t[0])) : "—");
  const belum = a.belumLengkap.flatMap(k => k.siswa);

  const kec = a.kecamatan.map(w => ({ w, g: geser(w.perTahun, p, "terpetakan") }))
    .filter(x => (saring ? jumlahDi(x.w.perTahun) : x.g.jumlahLama + x.g.jumlahBaru) >= (saring ? 1 : 5))
    .sort((x, y) => urutArah[x.g.arah] - urutArah[y.g.arah] || (y.g.pangsaLama - y.g.pangsaBaru) - (x.g.pangsaLama - x.g.pangsaBaru));
  const sek = a.sekolah.map(w => ({ w, n: saring ? jumlahDi(w.perTahun) : w.total, g: geser(w.perTahun, p, "bersekolah") }))
    .filter(x => x.n > 0).sort((x, y) => y.n - x.n);
  const turunKec = kec.filter(x => x.g.arah === "turun").length, turunSek = sek.filter(x => x.g.arah === "turun").length;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<ChartNoAxesCombined size={22} />} title={judul} description={keterangan} />
      {kembaliHref && <BarisKembali href={kembaliHref} />}

      <div className="space-y-6">
        {/* Kartu ringkas hanya untuk tab yang angkanya memang itu; Potensi/Persaingan/Proyeksi punya ringkasannya sendiri. */}
        {aktif === "potensi" || aktif === "persaingan" || aktif === "proyeksi" ? null : tampil.includes("promosi") ? (
          <div className="kisi-kartu kisi-kartu-3">
            <StatTile value={a.kecamatan.length} label="Kecamatan asal siswa" ikon="siswa" color="primary" />
            <StatTile value={a.sekolah.length} label="Sekolah asal (SMP/MTs)" ikon="kelas" color="blue" />
            <StatTile value={turunKec + turunSek} label="Daerah & sekolah menurun" sublabel={`${turunKec} kecamatan · ${turunSek} sekolah`} ikon="tren" color="amber" />
          </div>
        ) : (
          <div className="kisi-kartu">
            <StatTile value={a.ringkas.aktifTerpetakan} label="Siswa aktif sudah terpetakan" sublabel={`dari ${a.ringkas.aktif} siswa aktif`} ikon="hadir" color="emerald" />
            <StatTile value={belum.length} label="Alamat belum lengkap" sublabel="belum sampai kecamatan" ikon="kontak" color="red" />
          </div>
        )}

        <div className="baris-alat">
          <div className={`alat-tab w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-gray-100 bg-white p-1 scrollbar-hide ${tab.length > 1 ? "flex" : "hidden"}`}>
            {tab.map(([k, l]) => (
              <Link key={k} href={`${alamat}?bagian=${k}${q}`} scroll={false}
                className={`sentuh inline-flex items-center whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition ${aktif === k ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
                {l}
              </Link>
            ))}
          </div>
          {(aktif === "promosi" || aktif === "sekolah") && <div className="max-w-full shrink-0"><SaringAngkatan alamat={`${alamat}?bagian=${aktif}`} tahun={a.tahun} dari={dari} sampai={sampai} /></div>}
          <div className="alat-aksi">
            {aktif === "alamat" && belum.length > 0 && <a href="/api/peta/alamat-belum-lengkap" className="btn-modal-cancel btn-teks">Unduh Excel</a>}
            {laporanHref && <TautanIkon href={`${laporanHref}${q ? `?${q.slice(1)}` : ""}`} ikon="cetak" className="btn-modal-cancel btn-teks">Laporan Sebaran</TautanIkon>}
          </div>
        </div>

        {aktif === "promosi" && (
          <div className="panel overflow-hidden">
            <div className="panel-isi border-b border-gray-100 text-sm text-gray-600">
              <p>
                Membandingkan <span className="font-semibold text-navy">pangsa</span> tiap kecamatan pada angkatan masuk {rentang(p.lama)} dengan {rentang(p.baru)} —
                berapa persen dari siswa (yang alamatnya terpetakan) berasal dari kecamatan itu. Dipakai pangsa, bukan jumlah, karena kelengkapan alamat
                tiap angkatan berbeda ({p.terpetakanLama} siswa terpetakan di periode lama, {p.terpetakanBaru} di periode baru).
              </p>
              <p className="mt-1 text-gray-500">
                &ldquo;Menurun&rdquo; = pangsa tinggal 60% atau kurang (selisih sedikitnya 1 poin persen) dan dulu mengirim sedikitnya 5 siswa. Ini daftar untuk ditinjau panitia, bukan kesimpulan.
                {!bisaBanding ? " Rentang yang dipilih terlalu pendek untuk dibandingkan (perlu lebih dari 3 angkatan)." : turunKec === 0 && " Saat ini tidak ada kecamatan yang melewati ambang itu — sebaran asal siswa relatif stabil."}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-10">No</th><th>Kecamatan</th>
                    {tahunTampil.map(t => <th key={t} className="text-right">{t}</th>)}
                    <th className="text-right">Pangsa {rentang(p.lama)}</th><th className="text-right">Pangsa {rentang(p.baru)}</th><th>Arah</th>
                  </tr>
                </thead>
                <tbody>
                  {kec.map(({ w, g }, i) => (
                    <tr key={w.kode}>
                      <td className="angka">{i + 1}</td>
                      <td><p className="font-semibold text-primary-900">{w.nama}</p><p className="text-xs text-gray-400">{w.kab}</p></td>
                      {tahunTampil.map(t => <td key={t} className="angka text-right text-gray-600">{w.perTahun[t] ?? "·"}</td>)}
                      <td className="angka text-right">{persen(g.pangsaLama)}</td>
                      <td className="angka text-right font-semibold text-navy">{persen(g.pangsaBaru)}</td>
                      <td><Arah g={g} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {kec.length === 0 && <p className="py-10 text-center text-sm text-gray-400">Belum ada alamat siswa yang terpetakan sampai kecamatan.</p>}
          </div>
        )}

        {aktif === "sekolah" && (
          <div className="panel overflow-hidden">
            <div className="panel-isi border-b border-gray-100 text-sm text-gray-600">
              <p>
                Jumlah siswa per sekolah asal dan angkatan masuk. Nama sekolah yang ditulis berbeda-beda sudah digabung dengan aturan yang sama seperti menu
                Rapikan Nama Sekolah. {a.tanpaSekolah > 0 && `${a.tanpaSekolah} siswa belum diisi sekolah asalnya.`}
              </p>
              <p className="mt-1 text-gray-500">Tanda &ldquo;Menurun&rdquo; memakai aturan pangsa yang sama dengan Sasaran Promosi — sekolah ini layak dikunjungi lagi saat sosialisasi.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-10">No</th><th>Sekolah asal</th>
                    {tahunTampil.map(t => <th key={t} className="text-right">{t}</th>)}
                    <th className="text-right">{saring ? "Jumlah" : "Total"}</th><th>Arah</th>
                  </tr>
                </thead>
                <tbody>
                  {sek.slice(0, 60).map(({ w, g }, i) => (
                    <tr key={w.nama}>
                      <td className="angka">{i + 1}</td>
                      <td className="font-semibold text-primary-900">{w.nama}</td>
                      {tahunTampil.map(t => <td key={t} className="angka text-right text-gray-600">{w.perTahun[t] ?? "·"}</td>)}
                      <td className="angka text-right font-semibold text-navy">{sek[i].n}</td>
                      <td><Arah g={g} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sek.length > 60 && <p className="border-t border-gray-100 px-5 py-3 text-xs text-gray-500">Menampilkan 60 sekolah teratas dari {sek.length}.</p>}
            {sek.length === 0 && <p className="py-10 text-center text-sm text-gray-400">Belum ada data sekolah asal.</p>}
          </div>
        )}

        {aktif === "potensi" && <PotensiLulusanPanel alamat={`${alamat}?bagian=potensi`} saring={potensi ?? {}} />}

        {aktif === "persaingan" && <PersainganPanel alamat={`${alamat}?bagian=persaingan`} saring={potensi ?? {}} />}
        {aktif === "proyeksi" && <ProyeksiPanel saring={potensi ?? {}} />}

        {aktif === "alamat" && (
          belum.length === 0 ? (
            <div className="panel"><p className="py-10 text-center text-sm text-emerald-700">Semua siswa aktif sudah terpetakan sampai kecamatan.</p></div>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                Siswa aktif di bawah ini belum muncul di peta sampai tingkat kecamatan. Lengkapi lewat Buku Induk Siswa (Tata Usaha), atau minta siswanya
                mengajukan perubahan di menu Biodata — begitu disetujui, peta ikut berubah.
              </p>
              {a.belumLengkap.map(k => (
                <div key={k.kelas} className="panel overflow-hidden">
                  <div className="panel-kepala"><h2 className="panel-judul">{k.kelas}</h2><span className="text-xs text-gray-500">{k.siswa.length} siswa</span></div>
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead><tr><th className="w-10">No</th><th>Nama</th><th>NIS</th><th>Yang kurang</th></tr></thead>
                      <tbody>
                        {k.siswa.map((s, i) => (
                          <tr key={s.id}>
                            <td className="angka">{i + 1}</td>
                            <td className="font-semibold text-primary-900">{indukHref ? <Link href={`${indukHref}?edit=${s.id}&bagian=b&isian=${encodeURIComponent("Provinsi|Desa|Dusun")}`} className="hover:underline">{s.nama}</Link> : s.nama}</td>
                            <td className="font-mono text-xs text-gray-500">{s.nis}</td>
                            <td className="text-gray-600">{s.sebab}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </>
          )
        )}
      </div>
    </div>
  );
}
