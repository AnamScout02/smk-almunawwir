import { BarChart3, Filter, MapPin, School, Award } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import Panel from "@/components/shared/Panel";
import { verifyRole } from "@/lib/dal";
import { assertSpmb } from "@/lib/spmb";
import { jabatanAtauAlihkan } from "@/lib/jabatan-guard";
import { corongPendaftaran, peringkatPerujuk, sebaranSekolah, sebaranWilayah } from "@/lib/spmb-statistik";
import { LABEL_JENIS } from "@/lib/spmb-perujuk";

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

  const [corong, wilayah, sekolah, perujuk] = await Promise.all([
    corongPendaftaran(new Date(Date.now() - r.hari * 86_400_000)),
    sebaranWilayah(),
    sebaranSekolah(30),
    peringkatPerujuk(20),
  ]);
  const t = corong.tahap;
  const kunjung = t[0].jumlah;
  const kirim = t[t.length - 1].jumlah;
  const persen = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);
  const maksWil = Math.max(1, ...wilayah.map(w => w.jumlah));
  const maksSek = Math.max(1, ...sekolah.map(s => s.jumlah));

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<BarChart3 size={22} />} title="Statistik & Sebaran"
        description="Corong pendaftaran, asal daerah & sekolah pendaftar, dan peringkat perujuk" />

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
