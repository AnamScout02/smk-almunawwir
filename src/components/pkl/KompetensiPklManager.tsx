"use client";
import { useEffect, useState } from "react";
import { Target, Loader2 } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";

type Jurusan = {
  id: string; kode: string; nama: string; jumlahKompetensi: number; peserta: number; jurnal: number; jurnalTanpaTanda: number;
  baris: { kompetensi: string; dudi: string[]; entri: number; siswa: number }[];
  perDudi: { id: string; nama: string; siswa: number; jurnal: number; dilatih: number }[];
};

/** KECOCOKAN KOMPETENSI — kompetensi jurusan vs pekerjaan yang tersedia di DUDI vs yang benar-benar dilatih menurut jurnal. */
export default function KompetensiPklManager() {
  const [data, setData] = useState<Jurusan[] | null>(null);
  const [aktif, setAktif] = useState("");
  useEffect(() => {
    fetch("/api/pkl/kompetensi").then(r => r.json()).then(d => { const j: Jurusan[] = d.jurusan ?? []; setData(j); setAktif((j.find(x => x.peserta > 0) ?? j[0])?.id ?? ""); }).catch(() => setData([]));
  }, []);
  if (!data) return <div className="p-6 lg:p-8 pt-16 lg:pt-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;
  const j = data.find(x => x.id === aktif);
  const tanpaDudi = j?.baris.filter(b => b.dudi.length === 0).length ?? 0;
  const belumDilatih = j?.baris.filter(b => b.entri === 0).length ?? 0;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Target size={22} />} title="Kecocokan Kompetensi" description="Kompetensi jurusan dibandingkan dengan pekerjaan di DUDI dan yang dilatih siswa menurut jurnal" />
      <div className="space-y-6">
        {j && (
          <div className="kisi-kartu kisi-kartu-4">
            <StatTile value={j.jumlahKompetensi} label={`Kompetensi ${j.kode}`} icon={Target} color="primary" />
            <StatTile value={tanpaDudi} label="Tidak disediakan DUDI mana pun" icon={Target} color="amber" sorot={tanpaDudi > 0 && j.jumlahKompetensi > 0} />
            <StatTile value={belumDilatih} label="Belum pernah dilatih" icon={Target} color="red" />
            <StatTile value={j.jurnalTanpaTanda} label="Jurnal tanpa tanda kompetensi" icon={Target} color="gray" />
          </div>
        )}

        <div className="baris-alat">
          <div className="alat-tab flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-gray-100 bg-white p-1 scrollbar-hide">
            {data.map(x => (
              <button key={x.id} type="button" onClick={() => setAktif(x.id)}
                className={`sentuh whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition ${aktif === x.id ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
                {x.kode} <span className="angka font-normal opacity-70">({x.peserta})</span>
              </button>
            ))}
          </div>
        </div>

        {!j ? <p className="panel py-10 text-center text-sm text-gray-400">Belum ada jurusan.</p> : j.jumlahKompetensi === 0 ? (
          <p className="panel px-5 py-10 text-center text-sm text-gray-400">Kompetensi {j.nama} belum diisi. Isi daftar keahliannya di Kelola Jurusan — daftar itu yang dipakai siswa menandai jurnal dan Humas menandai pekerjaan di DUDI.</p>
        ) : (
          <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
            <div className="panel overflow-hidden xl:col-span-8">
              <div className="panel-kepala"><p className="panel-judul">Kompetensi {j.nama}</p></div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr><th className="w-10">No</th><th>Kompetensi</th><th>Tersedia di DUDI</th><th className="text-right">Siswa melatih</th><th className="text-right">Entri jurnal</th></tr></thead>
                  <tbody>
                    {j.baris.map((b, i) => (
                      <tr key={b.kompetensi}>
                        <td className="angka">{i + 1}</td>
                        <td className="font-medium text-primary-900">{b.kompetensi}</td>
                        <td className="text-sm">{b.dudi.length ? <span className="text-gray-600">{b.dudi.slice(0, 3).join(", ")}{b.dudi.length > 3 ? ` +${b.dudi.length - 3}` : ""}</span>
                          : <span className="status-badge bg-amber-50 text-amber-700 border-amber-200">Belum ada DUDI</span>}</td>
                        <td className="angka text-right">{b.siswa}</td>
                        <td className={`angka text-right ${b.entri ? "" : "text-red-600"}`}>{b.entri}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="border-t border-gray-100 px-5 py-3 text-xs text-gray-500">
                &ldquo;Tersedia di DUDI&rdquo; dari pekerjaan yang ditandai di Data DUDI; &ldquo;dilatih&rdquo; dari tanda kompetensi di jurnal harian siswa. Keduanya hanya seakurat tandanya —
                jurnal tanpa tanda tidak terhitung.
              </p>
            </div>
            <div className="panel overflow-hidden xl:col-span-4">
              <div className="panel-kepala"><p className="panel-judul">Per tempat PKL</p></div>
              {j.perDudi.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">Belum ada siswa {j.kode} yang ditempatkan.</p> : (
                <ul className="divide-y divide-gray-100">
                  {j.perDudi.map(d => {
                    const p = Math.round((d.dilatih / j.jumlahKompetensi) * 100);
                    return (
                      <li key={d.id} className="px-5 py-3">
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="min-w-0 truncate font-medium text-primary-900">{d.nama}</span>
                          <span className="angka shrink-0 text-gray-500">{d.dilatih} / {j.jumlahKompetensi}</span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100"><div className={`h-full rounded-full ${p >= 50 ? "bg-emerald-500" : "bg-amber-400"}`} style={{ width: `${p}%` }} /></div>
                        <p className="angka mt-1 text-xs text-gray-400">{d.siswa} siswa · {d.jurnal} entri jurnal</p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
