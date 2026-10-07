import { BarChart3, Filter, MapPin, School, Award, ListChecks, Wallet, CalendarClock, Shirt, HeartPulse } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import Panel from "@/components/shared/Panel";
import { verifyRole } from "@/lib/dal";
import { assertSpmb } from "@/lib/spmb";
import { jabatanAtauAlihkan } from "@/lib/jabatan-guard";
import { corongPendaftaran, peringkatPerujuk, sebaranSekolah, sebaranWilayah } from "@/lib/spmb-statistik";
import { LABEL_JENIS } from "@/lib/spmb-perujuk";
import { statistikTahapan } from "@/lib/spmb-statistik-tahapan";
import { INFO_TAHAP, rupiah, type KodeTahap } from "@/lib/spmb-tahapan";

export const dynamic = "force-dynamic";

const RENTANG = [
  { kode: "7", label: "7 hari", hari: 7 },
  { kode: "30", label: "30 hari", hari: 30 },
  { kode: "90", label: "90 hari", hari: 90 },
  { kode: "semua", label: "Semua", hari: 3650 },
] as const;

/** STATISTIK & SEBARAN SPMB (2 Oktober 2026) — corong pendaftaran (dari jejak tanpa data pribadi,
 *  src/lib/spmb-jejak.ts), sebaran wilayah & asal sekolah (untuk memilih daerah/sekolah promosi), dan
 *  peringkat perujuk dengan nama UTUH (halaman publik hanya menampilkan nama tersamar). */
export default async function Page({ searchParams }: { searchParams: Promise<{ rentang?: string }> }) {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  await jabatanAtauAlihkan(session, () => assertSpmb(session));
  const { rentang } = await searchParams;
  const r = RENTANG.find(x => x.kode === rentang) ?? RENTANG[1];

  const [corong, wilayah, sekolah, perujuk, th] = await Promise.all([
    corongPendaftaran(new Date(Date.now() - r.hari * 86_400_000)),
    sebaranWilayah(),
    sebaranSekolah(30),
    peringkatPerujuk(20),
    statistikTahapan(),
  ]);
  const barisTahap = [...th.perGelombang, ...(th.perGelombang.length > 1 ? [th.semua] : [])];
  const t = corong.tahap;
  const kunjung = t[0].jumlah;
  const kirim = t[t.length - 1].jumlah;
  const persen = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);
  const maksWil = Math.max(1, ...wilayah.map(w => w.jumlah));
  const maksSek = Math.max(1, ...sekolah.map(s => s.jumlah));

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<BarChart3 size={22} />} title="Statistik & Sebaran"
        description="Corong pendaftaran, kemajuan tahapan & pembayaran, asal daerah & sekolah pendaftar, dan peringkat perujuk" />

      <div className="space-y-6">
        <div className="kisi-kartu kisi-kartu-5">
          <StatTile value={kunjung} label="Pengunjung halaman SPMB" ikon="kunjungan" color="blue" />
          <StatTile value={t[1].jumlah} label="Mulai mengisi formulir" ikon="dokumen" color="purple" />
          <StatTile value={kirim} label="Berhasil mendaftar" ikon="centang" color="emerald" />
          <StatTile value={`${persen(kirim, kunjung)}%`} label="Pengunjung yang mendaftar" ikon="persen" color="amber" />
          <StatTile value={corong.kuis} label="Menyelesaikan kuis jurusan" ikon="prestasi" color="primary" />
        </div>

        <div className="baris-alat">
          <div className="alat-tab flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-gray-100 bg-white p-1 scrollbar-hide">
            {RENTANG.map(x => (
              <a key={x.kode} href={`?rentang=${x.kode}`}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  x.kode === r.kode ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
                {x.label}
              </a>
            ))}
          </div>
        </div>

        <Panel judul="Corong pendaftaran" ikon={<Filter size={16} />}
          keterangan={`${r.kode === "semua" ? "Sejak dicatat" : `${r.label} terakhir`} · dihitung per peramban, tanpa data pribadi`}>
          {kunjung === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">Belum ada kunjungan tercatat pada rentang ini.</p>
          ) : (
            <ol className="space-y-3">
              {t.map((x, i) => {
                const turun = i > 0 && t[i - 1].jumlah ? 100 - persen(x.jumlah, t[i - 1].jumlah) : 0;
                return (
                  <li key={x.kode}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 text-gray-600">{x.label}</span>
                      <span className="angka shrink-0 font-semibold text-navy">
                        {x.jumlah} <span className="font-normal text-gray-400">({persen(x.jumlah, kunjung)}%)</span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100">
                      <span className="block h-full rounded-full bg-primary-700" style={{ width: `${persen(x.jumlah, kunjung)}%` }} />
                    </div>
                    {i > 0 && turun >= 30 && t[i - 1].jumlah >= 5 && (
                      <p className="mt-1 text-xs text-amber-700">{Math.round(turun)}% berhenti sebelum tahap ini — periksa bagian formulir sebelumnya.</p>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </Panel>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 items-start">
          <Panel judul="Sebaran wilayah pendaftar" ikon={<MapPin size={16} />}
            keterangan="Kabupaten/kota & kecamatan pilihan pendaftar · pendaftar ditolak tidak dihitung">
            {wilayah.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-400">Belum ada pendaftar.</p>
            ) : (
              <ul className="space-y-3">
                {wilayah.map(w => (
                  <li key={w.nama}>
                    <details className="group">
                      <summary className="cursor-pointer list-none">
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="min-w-0 font-medium text-navy">{w.nama}</span>
                          <span className="angka shrink-0 font-semibold text-navy">{w.jumlah}</span>
                        </div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100">
                          <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${(w.jumlah / maksWil) * 100}%` }} />
                        </div>
                      </summary>
                      {w.kecamatan.length > 0 && (
                        <ul className="mt-2 space-y-1 border-l-2 border-gray-100 pl-3">
                          {w.kecamatan.map(k => (
                            <li key={k.nama} className="flex justify-between gap-3 text-sm text-gray-600">
                              <span>Kec. {k.nama}</span><span className="angka font-medium">{k.jumlah}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel judul="Asal sekolah terbanyak" ikon={<School size={16} />}
            keterangan="Nama sekolah diseragamkan (mis. SMPN = SMP NEGERI) · 30 teratas">
            {sekolah.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-400">Belum ada pendaftar.</p>
            ) : (
              <ul className="space-y-3">
                {sekolah.map(s => (
                  <li key={s.nama}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 text-gray-600">{s.nama}</span>
                      <span className="angka shrink-0 font-semibold text-navy">{s.jumlah}</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100">
                      <span className="block h-full rounded-full bg-blue-500" style={{ width: `${(s.jumlah / maksSek) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        {/* Tahapan calon (6 Okt 2026) — angka gabungan, hitungan sama dengan halaman Tahapan Calon. */}
        <Panel judul="Kemajuan tahapan per gelombang" ikon={<ListChecks size={16} />} isi={false}
          keterangan="Jumlah calon yang sudah menuntaskan tiap tahap">
          {th.semua.total === 0 ? <p className="py-10 text-center text-sm text-gray-400">Belum ada pendaftar.</p> : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Gelombang</th><th className="text-right">Pendaftar</th>
                  {th.kode.filter(k => k !== "DAFTAR").map(k => <th key={k} className="text-right">{INFO_TAHAP[k as KodeTahap].judul}</th>)}
                  <th className="text-right">Resmi MPLS</th></tr></thead>
                <tbody>
                  {barisTahap.map(r => (
                    <tr key={r.nama} className={r === th.semua ? "font-semibold" : ""}>
                      <td className="text-navy">{r.nama}</td>
                      <td className="angka text-right">{r.total}</td>
                      {th.kode.filter(k => k !== "DAFTAR").map(k => <td key={k} className="angka text-right">{r.tahap[k]}</td>)}
                      <td className="angka text-right">{r.tuntas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel judul="Pembayaran daftar ulang per gelombang" ikon={<Wallet size={16} />} isi={false}
          keterangan="Hanya pembayaran yang sudah disahkan dihitung terkumpul; calon yang tidak diterima tidak dihitung">
          {th.semua.total === 0 ? <p className="py-10 text-center text-sm text-gray-400">Belum ada pendaftar.</p> : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Gelombang</th><th className="text-right">Terkumpul</th><th className="text-right">Lunas</th>
                  <th className="text-right">Mencicil</th><th className="text-right">Belum bayar</th><th className="text-right">Bukti menunggu</th></tr></thead>
                <tbody>
                  {barisTahap.map(r => (
                    <tr key={r.nama} className={r === th.semua ? "font-semibold" : ""}>
                      <td className="text-navy">{r.nama}</td>
                      <td className="angka text-right">{rupiah(r.bayar.terkumpul)}</td>
                      <td className="angka text-right">{r.bayar.lunas}</td>
                      <td className="angka text-right">{r.bayar.mencicil}</td>
                      <td className="angka text-right">{r.bayar.belum}</td>
                      <td className="angka text-right">{r.bayar.menunggu}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 items-start">
          <Panel judul="Sesi kedatangan" ikon={<CalendarClock size={16} />} isi={false}>
            {th.sesi.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">Belum ada sesi.</p> : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr><th>Sesi</th><th className="text-right">Terisi</th></tr></thead>
                  <tbody>
                    {th.sesi.map(x => (
                      <tr key={x.gelombang + x.label}>
                        <td><span className="angka">{x.label}</span><span className="block text-xs text-gray-400">{x.gelombang}{x.tempat ? ` · ${x.tempat}` : ""}</span></td>
                        <td className="angka text-right">{x.terisi} / {x.kuota}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel judul="Pesanan seragam" ikon={<Shirt size={16} />}>
            {Object.keys(th.seragam).length === 0 ? <p className="text-sm text-gray-400">Belum ada pilihan ukuran.</p> : (
              <div className="space-y-4">
                {Object.entries(th.seragam).map(([item, ukuran]) => (
                  <div key={item}>
                    <p className="label-kecil mb-2 text-primary-700">{item}</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(ukuran).map(([u, n]) => (
                        <span key={u} className="rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-1 text-sm"><span className="font-semibold text-navy">{u}</span> <span className="angka text-gray-500">{n}</span></span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel judul="Ringkasan kesehatan" ikon={<HeartPulse size={16} />} keterangan="Angka gabungan — rincian per calon hanya di Tahapan Calon">
            {th.kesehatan.diperiksa === 0 ? <p className="text-sm text-gray-400">Belum ada calon yang diperiksa.</p> : (
              <div className="space-y-2 text-sm">
                <p className="text-gray-600"><span className="angka font-semibold text-navy">{th.kesehatan.diperiksa}</span> calon sudah diperiksa</p>
                {["Kurus berat", "Kurus", "Normal", "Gemuk", "Obesitas"].filter(k => th.kesehatan.imt[k]).map(k => (
                  <div key={k} className="flex justify-between"><span className="text-gray-500">IMT {k}</span><span className="angka font-medium">{th.kesehatan.imt[k]}</span></div>
                ))}
                <div className="flex justify-between border-t border-gray-100 pt-2"><span className="text-gray-500">Tes buta warna tidak normal</span>
                  <span className={`angka font-medium ${th.kesehatan.butaWarna ? "text-amber-700" : ""}`}>{th.kesehatan.butaWarna}</span></div>
              </div>
            )}
          </Panel>
        </div>

        <Panel judul="Peringkat perujuk" ikon={<Award size={16} />} isi={false}
          keterangan="Nama utuh hanya untuk panitia — di halaman SPMB publik nama disamarkan">
          {perujuk.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">Belum ada pendaftar yang datang lewat kode referral.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th className="w-10">No</th><th>Nama</th><th>Jenis</th><th>Kode</th><th className="text-right">Pendaftar</th></tr></thead>
                <tbody>
                  {perujuk.map((p, i) => (
                    <tr key={p.id}>
                      <td className="angka">{i + 1}</td>
                      <td className="font-medium text-navy">{p.nama}</td>
                      <td>{LABEL_JENIS[p.jenis] ?? p.jenis}</td>
                      <td className="angka">{p.kode}</td>
                      <td className="angka text-right font-semibold">{p.jumlah}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
