import KendaliPotensi from "@/components/shared/KendaliPotensi";
import IsianPromosiSekolah from "@/components/shared/IsianPromosiSekolah";
import { kabupatenBoleh, saringPotensi, susunPotensi, type SaringPotensi } from "@/lib/potensi-smp";

/** POTENSI LULUSAN SMP/MTs (8 Oktober 2026) — berapa siswa kelas IX di tiap SMP/MTs (sumber: Sekolah Kita Kemendikdasmen)
 *  dibandingkan dengan berapa yang selama ini masuk ke kita. Dipakai di Pusat SPMB → Sasaran Promosi. */
const fmt = (n: number) => n.toLocaleString("id-ID");
const persen = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%` : "—");

export default async function PotensiLulusanPanel({ alamat, saring }: { alamat: string; saring: SaringPotensi }) {
  const boleh = await kabupatenBoleh();
  if (!boleh.length) return <div className="panel"><p className="py-10 text-center text-sm text-gray-400">Belum ada alamat siswa yang terpetakan, jadi belum ada kabupaten yang bisa diambil datanya.</p></div>;
  const kab = boleh.find(k => k.nama === saring.kab)?.nama ?? boleh[0].nama;
  const p = await susunPotensi(kab);
  const nTh = Math.max(1, p.tahunKita.length);
  const f = saringPotensi(p, saring);
  const { kec, baris, kecUrut } = f;
  const satu = f.satuKec;
  const jumlah = baris.reduce((t, b) => ({ k9: t.k9 + b.k9, l: t.l + b.k9L, p: t.p + b.k9P, kita: t.kita + (b.kita ?? 0) }), { k9: 0, l: 0, p: 0, kita: 0 });
  const semester = [...new Set(p.baris.map(b => b.semester).filter((x): x is string => !!x))].sort().reverse();
  const tglAmbil = p.diambil?.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
  const rentang = p.tahunKita.length > 1 ? `${p.tahunKita[0]}–${p.tahunKita[p.tahunKita.length - 1]}` : String(p.tahunKita[0] ?? "");

  return (
    <>
      <KendaliPotensi alamat={alamat} kab={kab} kec={kec} jenjang={f.jenjang} status={f.status} q={f.q} urut={f.urut} adaData={p.baris.length > 0}
        daftarKab={boleh.map(k => ({ value: k.nama, label: `${k.nama} (${k.siswa} siswa kita)` }))}
        daftarKec={f.pilihanKec.map(([n, k9]) => ({ value: n, label: `${n} (${fmt(k9)})` }))} />

      {p.baris.length === 0 ? (
        <div className="panel">
          <p className="py-10 text-center text-sm text-gray-400">
            Data {kab} belum pernah diambil. Tekan &ldquo;Ambil dari Sekolah Kita&rdquo; — pengambilan berjalan di latar beberapa menit.
          </p>
        </div>
      ) : (
        <>
          <div className="panel panel-isi text-sm text-gray-600">
            <p>
              Jumlah siswa per tingkat diambil dari situs <span className="font-semibold text-navy">Sekolah Kita</span> Kemendikdasmen (laporan Dapodik sekolah
              {semester.length ? `, semester ${semester.map(s => `${s.slice(0, 4)}/${Number(s.slice(0, 4)) + 1} ${s.endsWith("1") ? "ganjil" : "genap"}`).join(" & ")}` : ""}),
              terakhir disalin {tglAmbil}. <span className="font-semibold text-navy">Kelas IX</span> = calon lulusan yang bisa mendaftar tahun depan.
            </p>
            <p className="mt-1 text-gray-500">
              &ldquo;Masuk ke kita&rdquo; = siswa kita dari sekolah itu pada angkatan {rentang}, dirata-rata per tahun; &ldquo;Serapan&rdquo; membandingkannya dengan kelas IX
              sekarang, jadi itu perkiraan kasar, bukan angka pasti. Tanda &ldquo;—&rdquo; = belum ada siswa kita yang tercatat dari sekolah itu (atau namanya tidak bisa dipasangkan dengan pasti).
              Nama kepala sekolah dan nomor HP tidak ada di sumber terbuka — isi lewat tombol pensil di tiap baris; isian itu tidak hilang saat data diperbarui.
            </p>
          </div>

          {!satu && kecUrut.length > 1 && (
            <div className="panel overflow-hidden">
              <div className="panel-kepala"><h2 className="panel-judul">Rekap per kecamatan{f.keterangan ? ` — ${f.keterangan}` : ""}</h2><span className="text-xs text-gray-500">{kecUrut.length} kecamatan</span></div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr><th className="w-10">No</th><th>Kecamatan</th><th className="text-right">SMP/MTs</th><th className="text-right">Kelas IX</th><th className="text-right">Masuk ke kita / tahun</th><th className="text-right">Serapan</th></tr></thead>
                  <tbody>
                    {kecUrut.map(([n, x], i) => (
                      <tr key={n}>
                        <td className="angka">{i + 1}</td>
                        <td className="font-semibold text-primary-900">{n}</td>
                        <td className="angka text-right">{x.sekolah}</td>
                        <td className="angka text-right font-semibold text-navy">{fmt(x.k9)}</td>
                        <td className="angka text-right">{x.kita ? (x.kita / nTh).toLocaleString("id-ID", { maximumFractionDigits: 1 }) : "·"}</td>
                        <td className="angka text-right">{x.kita ? persen(x.kita / nTh, x.k9) : "·"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="panel overflow-hidden">
            <div className="panel-kepala"><h2 className="panel-judul">{f.keterangan ? `${kab} — ${f.keterangan}` : `Seluruh SMP & MTs di ${kab}`}</h2><span className="text-xs text-gray-500">{baris.length} sekolah</span></div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-10">No</th><th>Sekolah</th>{!satu && <th>Kecamatan</th>}
                    <th className="text-right">Kelas IX</th><th className="text-right">L / P</th>
                    <th>Kepala sekolah &amp; kontak</th>
                    <th className="text-right">Masuk ke kita / tahun</th><th className="text-right">Serapan</th><th />
                  </tr>
                </thead>
                <tbody>
                  {baris.slice(0, 150).map((b, i) => (
                    <tr key={b.npsn}>
                      <td className="angka">{i + 1}</td>
                      <td>
                        <p className="font-semibold text-primary-900">{b.nama}</p>
                        <p className="text-xs text-gray-500">{[b.alamat, b.jarak !== null && `${b.jarak.toLocaleString("id-ID")} km dari sekolah`].filter(Boolean).join(" · ")}</p>
                        <p className="text-xs text-gray-400">{[b.bentuk, b.status.toLowerCase(), b.akreditasi && `akreditasi ${b.akreditasi}`, b.guru > 0 && `${b.guru} guru`, `NPSN ${b.npsn}`, b.namaKita && `di data kita: ${b.namaKita}`].filter(Boolean).join(" · ")}</p>
                      </td>
                      {!satu && <td className="text-gray-600">{b.kecamatan}</td>}
                      <td className="angka text-right font-semibold text-navy">{fmt(b.k9)}</td>
                      <td className="angka text-right text-gray-600">{b.k9L} / {b.k9P}</td>
                      <td className="text-xs text-gray-600">
                        {b.kepala && <p className="font-semibold text-primary-900">{b.kepala}</p>}
                        {b.kontak && <p className="angka">{b.kontak}</p>}
                        {[b.telepon, b.email].filter(Boolean).map(x => <p key={x} className="break-all text-gray-500">{x}</p>)}
                        {b.dikunjungi && <p className="text-emerald-700">Dikunjungi {b.dikunjungi.split("-").reverse().join("/")}</p>}
                        {b.catatan && <p className="text-gray-500">{b.catatan}</p>}
                        {!b.kepala && !b.kontak && !b.telepon && !b.email && <span className="text-gray-400">—</span>}
                      </td>
                      <td className="angka text-right">{b.kita === null ? "—" : b.kita ? (b.kita / nTh).toLocaleString("id-ID", { maximumFractionDigits: 1 }) : "0"}</td>
                      <td className="angka text-right">{b.kita ? persen(b.kita / nTh, b.k9) : b.kita === null ? "—" : "0%"}</td>
                      <td className="text-right"><IsianPromosiSekolah npsn={b.npsn} nama={b.nama} awal={{ kepala: b.kepala ?? "", kontak: b.kontak ?? "", catatan: b.catatan ?? "", dikunjungi: b.dikunjungi ?? "" }} /></td>
                    </tr>
                  ))}
                  {baris.length === 0 && <tr><td colSpan={satu ? 8 : 9} className="py-10 text-center text-sm text-gray-400">Tidak ada sekolah yang cocok dengan saringan.</td></tr>}
                  <tr className="font-semibold">
                    <td /><td>Jumlah {baris.length} sekolah</td>{!satu && <td />}
                    <td className="angka text-right">{fmt(jumlah.k9)}</td><td className="angka text-right">{fmt(jumlah.l)} / {fmt(jumlah.p)}</td><td />
                    <td className="angka text-right">{(jumlah.kita / nTh).toLocaleString("id-ID", { maximumFractionDigits: 1 })}</td>
                    <td className="angka text-right">{persen(jumlah.kita / nTh, jumlah.k9)}</td><td />
                  </tr>
                </tbody>
              </table>
            </div>
            {baris.length > 150 && <p className="border-t border-gray-100 px-5 py-3 text-xs text-gray-500">Menampilkan 150 sekolah pertama dari {baris.length}. Pilih kecamatan untuk mempersempit, atau unduh Excel.</p>}
          </div>
        </>
      )}
    </>
  );
}
