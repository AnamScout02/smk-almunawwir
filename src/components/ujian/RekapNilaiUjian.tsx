"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, BookOpen, BookOpenCheck, Download, FileSpreadsheet, Loader2, School, Search, Sheet, Users } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import EmptyState from "@/components/admin/EmptyState";
import StatTile from "@/components/admin/StatTile";
import GroupedSection from "@/components/admin/GroupedSection";
import { keteranganSingkatan, labelMapel } from "@/lib/singkatan-mapel";
import {
  legerKelas, rekapMapel, ringkasanKelasMapel, semuaMapel, statistik, LABEL_STATUS_NILAI,
  type DataRekap, type SelNilai, type StatusNilai,
} from "@/lib/rekap-nilai-hitung";

type Kegiatan = { id: string; nama: string; singkatan: string; aktif: boolean; tahunAjaran: string | null; jumlahUjian: number };
type Tab = "kelas" | "mapel" | "ringkasan";

const GAYA_STATUS: Record<StatusNilai, string> = {
  TUNTAS: "bg-emerald-50 text-emerald-700 border-emerald-200",
  TUNTAS_REMEDIAL: "bg-blue-50 text-blue-700 border-blue-200",
  BELUM_TUNTAS: "bg-red-50 text-red-700 border-red-200",
  BELUM_IKUT: "bg-gray-50 text-gray-500 border-gray-200",
};

/** Sel nilai di layar — aturan warnanya sama dengan berkas Excel (src/lib/rekap-nilai-excel.ts). */
function Nilai({ sel, kkm }: { sel?: SelNilai; kkm: number }) {
  if (!sel || sel.n === null) return <span className="text-gray-300">—</span>;
  const bawah = sel.n < kkm;
  const ket = [sel.s ? "sementara: uraian belum dikoreksi" : "", sel.su ? "nilai ujian susulan" : "", sel.r != null ? `remedial ${sel.r}` : ""].filter(Boolean).join(" · ");
  return (
    <span title={ket || undefined}
      className={`inline-flex items-baseline gap-0.5 rounded-md px-1.5 py-0.5 angka ${sel.s ? "bg-amber-50 italic" : bawah ? "bg-red-50" : ""} ${bawah ? "font-bold text-red-600" : "text-gray-800"}`}>
      {sel.n}{sel.s && "*"}
      {sel.su && <sup className="text-[11px] font-semibold text-blue-600">S</sup>}
      {sel.r != null && <sup className="text-[11px] font-semibold text-emerald-700">R{sel.r}</sup>}
    </span>
  );
}

/** REKAP NILAI UJIAN (21 September 2026) — leger per kelas, rekap per mapel, dan ringkasan kelas × mapel, masing-masing
 * bisa diunduh sebagai Excel bergaya. Permintaan user: rekap saja, TIDAK dikirim ke Jurnal/rapor (sekolah akan memakai
 * e-Rapor pemerintah). Cakupan: guru = ujian yang diampu + semua mapel kelas walinya; Admin/Wakakur = semua. */
export default function RekapNilaiUjian() {
  const [kegiatan, setKegiatan] = useState<Kegiatan[]>([]);
  const [kegiatanId, setKegiatanId] = useState("");
  const [data, setData] = useState<DataRekap | null>(null);
  const [muat, setMuat] = useState(true);
  const [tab, setTab] = useState<Tab>("kelas");
  const [kelasId, setKelasId] = useState("");
  const [mapel, setMapel] = useState("");
  const [cari, setCari] = useState("");

  const ambil = useCallback((id?: string) => {
    setMuat(true);
    fetch(`/api/ujian/rekap-nilai${id ? `?kegiatanId=${id}` : ""}`, { cache: "no-store" })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!d) return;
        setKegiatan(d.kegiatan ?? []); setKegiatanId(d.kegiatanId ?? ""); setData(d.data ?? null);
        setKelasId(k => (d.data?.kelas.some((x: { id: string }) => x.id === k) ? k : d.data?.kelas[0]?.id ?? ""));
        setMapel(m => { const ms = d.data ? semuaMapel(d.data) : []; return ms.includes(m) ? m : ms[0] ?? ""; });
      })
      .catch(() => {})
      .finally(() => setMuat(false));
  }, []);
  useEffect(() => { queueMicrotask(() => ambil()); }, [ambil]);

  const q = cari.trim().toLowerCase();
  const cocok = (s: { nama: string; nis: string }) => !q || s.nama.toLowerCase().includes(q) || s.nis.includes(q);
  const leger = useMemo(() => (data && kelasId ? legerKelas(data, kelasId) : null), [data, kelasId]);
  const perMapel = useMemo(() => (data && mapel ? rekapMapel(data, mapel) : null), [data, mapel]);
  const ringkasan = useMemo(() => (data ? ringkasanKelasMapel(data) : null), [data]);
  const daftarMapel = useMemo(() => (data ? semuaMapel(data) : []), [data]);

  const unduh = (semua: boolean) => {
    const p = new URLSearchParams({ kegiatanId, mode: tab });
    if (tab === "kelas") p.set("kelasId", semua ? "semua" : kelasId);
    if (tab === "mapel") p.set("mapel", semua ? "semua" : mapel);
    return `/api/ujian/rekap-nilai/ekspor?${p}`;
  };

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<FileSpreadsheet size={22} />} title="Rekap Nilai Ujian"
        description="Leger per kelas, rekap per mapel, dan ringkasan — bisa diunduh sebagai Excel" />

      <div className="baris-alat mb-4">
        <div className="alat-saring">
          <Select value={kegiatanId} onChange={v => ambil(v)} placeholder="Pilih kegiatan"
            options={kegiatan.map(k => ({ value: k.id, label: `${k.singkatan} — ${k.nama}${k.tahunAjaran ? ` ${k.tahunAjaran}` : ""} (${k.jumlahUjian} ujian)` }))} />
        </div>
        <div className="alat-tab flex gap-1 bg-gray-100 rounded-xl p-1">
          {([["kelas", "Per Kelas"], ["mapel", "Per Mapel"], ["ringkasan", "Ringkasan"]] as [Tab, string][]).map(([t, l]) => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${tab === t ? "bg-primary-900 text-white" : "text-gray-600 hover:bg-white"}`}>{l}</button>
          ))}
        </div>
        {data && tab !== "ringkasan" && (
          <div className="alat-aksi alat-teks">
            <a href={unduh(false)} className="btn-modal-cancel"><Download /> Unduh Excel</a>
            <a href={unduh(true)} className="btn-modal-save"><Sheet /> {tab === "kelas" ? "Semua Kelas" : "Semua Mapel"}</a>
          </div>
        )}
        {data && tab === "ringkasan" && (
          <div className="alat-aksi alat-teks"><a href={unduh(false)} className="btn-modal-save"><Download /> Unduh Excel</a></div>
        )}
      </div>

      {muat && !data ? (
        <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
      ) : !data || !data.kelas.length ? (
        <EmptyState icon={BookOpenCheck} title="Belum ada nilai ujian"
          description={kegiatan.length ? "Kegiatan ini belum punya ujian yang bisa Anda lihat nilainya." : "Belum ada kegiatan ujian yang berisi ujian."} />
      ) : (
        <div className={muat ? "opacity-60 pointer-events-none" : ""}>
          {tab !== "ringkasan" && (
            <div className="baris-alat mb-4">
              <div className="alat-cari">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari nama atau NIS..." className="input-field pl-10" />
              </div>
              <div className="alat-saring">
                {tab === "kelas"
                  ? <Select value={kelasId} onChange={setKelasId} options={data.kelas.map(k => ({ value: k.id, label: `${k.nama} (${data.siswa.filter(s => s.classId === k.id).length} siswa)` }))} />
                  : <Select value={mapel} onChange={setMapel} options={daftarMapel.map(m => ({ value: m, label: m }))} />}
              </div>
            </div>
          )}

          {/* ---------------- PER KELAS (LEGER) ---------------- */}
          {tab === "kelas" && leger && (() => {
            const semuaNilai = leger.baris.flatMap(b => b.sel.map(s => s.n)).filter((x): x is number => x !== null);
            const st = statistik(leger.baris.map(b => b.rata).filter((x): x is number => x !== null));
            const bawah = leger.baris.reduce((n, b) => n + b.sel.filter((s, i) => s.n !== null && s.n < (leger.kkm[leger.mapel[i]] ?? 75)).length, 0);
            return (
              <>
                <div className="kisi-kartu kisi-kartu-4 mb-4">
                  <StatTile value={leger.baris.length} label="Siswa" icon={Users} color="primary" size="md" />
                  <StatTile value={st.rata ?? "—"} label="Rata-rata kelas" icon={BarChart3} color="blue" size="md" />
                  <StatTile value={leger.mapel.length} label={leger.mapelDiniyah.length ? `Mapel utama (+${leger.mapelDiniyah.length} Diniyah)` : "Mapel diujikan"} icon={BookOpen} color="emerald" size="md" />
                  <StatTile value={bawah} label={`Nilai di bawah KKM (dari ${semuaNilai.length})`} icon={AlertTriangle} color={bawah ? "red" : "gray"} size="md" />
                </div>
                <div className="panel overflow-hidden"><div className="overflow-x-auto scrollbar-visible">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th className="w-10 text-center">No</th><th className="min-w-[8.5rem]">Nama / NIS</th>
                        {leger.mapel.map(m => <th key={m} className="text-center min-w-[5.5rem] normal-case" title={m}>{labelMapel(m, data.singkatan)}</th>)}
                        <th className="text-center">Jumlah</th><th className="text-center">Rata-rata</th><th className="text-center">Peringkat</th>
                        {/* Mapel DINIYAH: tambahan, tidak ikut jumlah/rata-rata/peringkat (keputusan user 21 Sep 2026). */}
                        {leger.mapelDiniyah.map(m => <th key={m} className="text-center min-w-[5.5rem] normal-case !bg-amber-50 !text-amber-800" title={`${m} — mapel Diniyah (tambahan)`}>{labelMapel(m, data.singkatan)}<span className="block text-[11px] font-normal">Diniyah</span></th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {leger.baris.filter(b => cocok(b.siswa)).map((b, i) => (
                        <tr key={b.siswa.id}>
                          <td className="text-center angka">{i + 1}</td>
                          <td className="max-w-[9rem] sm:max-w-none">
                            <span className="block font-medium text-gray-800 leading-snug sm:whitespace-nowrap">{b.siswa.nama}</span>
                            <span className="block text-xs text-gray-400 angka">{b.siswa.nis}</span>
                          </td>
                          {leger.mapel.map((m, j) => <td key={m} className="text-center"><Nilai sel={b.sel[j]} kkm={leger.kkm[m] ?? 75} /></td>)}
                          <td className="text-center angka">{b.jumlah ?? "—"}</td>
                          <td className="text-center angka font-bold text-primary-900">{b.rata ?? "—"}</td>
                          <td className="text-center angka">{b.peringkat ?? "—"}</td>
                          {leger.mapelDiniyah.map((m, j) => <td key={m} className="text-center bg-amber-50/40"><Nilai sel={b.selDiniyah[j]} kkm={leger.kkm[m] ?? 75} /></td>)}
                        </tr>
                      ))}
                    </tbody>
                    {/* Baris kaki (21 Sep 2026): dulu labelnya satu sel colSpan=3 rata kanan — tidak ikut kolom beku, jadi saat
                        tabel digeser di HP labelnya hilang dan angkanya tanpa keterangan. Sekarang sel per kolom seperti badan. */}
                    <tfoot className="bg-[#f5f6fa] text-sm text-gray-700">
                      {([["KKM", "kkm"], ["Rata-rata", "rata"], ["Tertinggi", "maks"], ["Terendah", "min"]] as const).map(([l, k], i) => (
                        <tr key={l} className={i === 0 ? "border-t-2 border-gray-200" : undefined}>
                          <td /><td className="label-kecil !text-gray-500 whitespace-nowrap">{l}</td>
                          {leger.perMapel.map(p => <td key={p.mapel} className={`text-center angka ${k === "rata" ? "font-bold text-primary-900" : "font-semibold"}`}>{p[k] ?? "—"}</td>)}
                          <td /><td /><td />
                          {leger.perMapelDiniyah.map(p => <td key={p.mapel} className="text-center angka font-semibold bg-amber-50/40">{p[k] ?? "—"}</td>)}
                        </tr>
                      ))}
                      <tr>
                        <td /><td className="label-kecil !text-gray-500 whitespace-nowrap">Tuntas</td>
                        {leger.perMapel.map(p => <td key={p.mapel} className="text-center angka font-semibold">{p.tuntas}/{p.ikut}</td>)}
                        <td /><td /><td />
                        {leger.perMapelDiniyah.map(p => <td key={p.mapel} className="text-center angka font-semibold bg-amber-50/40">{p.tuntas}/{p.ikut}</td>)}
                      </tr>
                    </tfoot>
                  </table>
                </div></div>
              </>
            );
          })()}

          {/* ---------------- PER MAPEL ---------------- */}
          {tab === "mapel" && perMapel && (
            <>
              <div className="kisi-kartu kisi-kartu-4 mb-4">
                <StatTile value={perMapel.grup.length} label="Kelas" icon={School} color="primary" size="md" />
                <StatTile value={perMapel.ringkas.ikut} label="Siswa ikut" icon={Users} color="blue" size="md" />
                <StatTile value={perMapel.ringkas.rata ?? "—"} label="Rata-rata" icon={BarChart3} color="emerald" size="md" />
                <StatTile value={perMapel.grup.reduce((n, g) => n + g.ringkas.belumTuntas, 0)} label="Belum tuntas" icon={AlertTriangle} color="red" size="md" />
              </div>
              <div className="space-y-4">
                {perMapel.grup.map(g => (
                  <GroupedSection key={g.kelas.id} title={g.kelas.nama} count={g.baris.length} icon={BookOpenCheck}
                    subtitle={`KKM ${g.kkm} · rata-rata ${g.ringkas.rata ?? "—"} · tertinggi ${g.ringkas.maks ?? "—"} · terendah ${g.ringkas.min ?? "—"} · tuntas ${g.ringkas.tuntas + g.ringkas.tuntasRemedial}/${g.ringkas.ikut}`}>
                    <div className="overflow-x-auto">
                      <table className="data-table">
                        <thead><tr><th className="w-10 text-center">No</th><th>Nama / NIS</th><th className="text-center">Nilai</th><th className="text-center">Remedial</th><th>Status</th></tr></thead>
                        <tbody>
                          {g.baris.filter(b => cocok(b.siswa)).map((b, i) => (
                            <tr key={b.siswa.id}>
                              <td className="text-center angka">{i + 1}</td>
                              <td>
                                <span className="block font-medium text-gray-800 leading-snug">{b.siswa.nama}</span>
                                <span className="block text-xs text-gray-400 angka">{b.siswa.nis}</span>
                              </td>
                              <td className="text-center"><Nilai sel={b.sel} kkm={g.kkm} /></td>
                              <td className="text-center angka">{b.sel.r ?? "—"}</td>
                              <td><span className={`status-badge ${GAYA_STATUS[b.status]}`}>{LABEL_STATUS_NILAI[b.status]}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </GroupedSection>
                ))}
              </div>
            </>
          )}

          {/* ---------------- RINGKASAN KELAS × MAPEL ---------------- */}
          {tab === "ringkasan" && ringkasan && (
            <div className="panel overflow-hidden"><div className="overflow-x-auto scrollbar-visible">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Kelas</th><th className="text-center">Siswa</th>
                    {ringkasan.mapel.map((m, i) => (
                      <th key={m} className={`text-center min-w-[6rem] normal-case ${ringkasan.diniyah[i] ? "!bg-amber-50 !text-amber-800" : ""}`}>
                        <span title={m}>{labelMapel(m, data.singkatan)}</span>{ringkasan.diniyah[i] && <span className="block text-[11px] font-normal">Diniyah</span>}
                      </th>
                    ))}
                    <th className="text-center">Rata-rata kelas{ringkasan.diniyah.some(Boolean) && <span className="block text-[11px] font-normal normal-case">tanpa Diniyah</span>}</th>
                  </tr>
                </thead>
                <tbody>
                  {ringkasan.baris.map(b => (
                    <tr key={b.kelas.id}>
                      <td className="whitespace-nowrap font-medium text-gray-800">{b.kelas.nama}</td>
                      <td className="text-center angka">{b.jumlahSiswa}</td>
                      {b.sel.map((x, j) => (
                        <td key={j} className="text-center">
                          {x ? (
                            <span className="block angka">
                              <span className="font-semibold text-gray-800">{x.rata ?? "—"}</span>
                              {x.persenTuntas != null && <span className={`block text-xs ${x.persenTuntas < 75 ? "text-red-600 font-semibold" : "text-gray-500"}`}>{x.persenTuntas}% tuntas</span>}
                            </span>
                          ) : <span className="text-gray-300">·</span>}
                        </td>
                      ))}
                      <td className="text-center angka font-bold text-primary-900">{b.rataKelas ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-[#f5f6fa] text-sm text-gray-700">
                  <tr className="border-t-2 border-gray-200">
                    <td className="label-kecil !text-gray-500 whitespace-nowrap">Rata-rata mapel</td><td />
                    {ringkasan.perMapel.map((v, i) => <td key={i} className="text-center angka font-bold text-primary-900">{v ?? "—"}</td>)}<td />
                  </tr>
                </tfoot>
              </table>
            </div></div>
          )}

          {keteranganSingkatan(Object.keys(data.singkatan ?? {}).sort((a, b) => a.localeCompare(b, "id")), data.singkatan) && (
            <p className="mt-3 text-xs text-gray-600"><span className="font-semibold">Singkatan:</span> {keteranganSingkatan(Object.keys(data.singkatan ?? {}).sort((a, b) => a.localeCompare(b, "id")), data.singkatan)}</p>
          )}
          <p className="mt-3 text-xs text-gray-500">
            <span className="font-semibold text-red-600">Merah</span> = di bawah KKM · <span className="italic bg-amber-50 px-1">82*</span> = sementara (uraian belum dikoreksi) ·
            <sup className="text-blue-600 font-semibold">S</sup> = nilai ujian susulan · <sup className="text-emerald-700 font-semibold">R</sup> = nilai remedial · — = belum ikut.
            KKM dari Data Mapel (kosong = KKM bawaan sekolah). Mapel <span className="font-semibold text-amber-800">Diniyah</span> adalah
            mapel tambahan: ditampilkan terpisah dan tidak ikut jumlah, rata-rata, maupun peringkat.
          </p>
        </div>
      )}
    </div>
  );
}
