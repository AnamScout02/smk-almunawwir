"use client";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Activity, ChevronDown, Download, ExternalLink, Loader2, Search } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import EmptyState from "@/components/admin/EmptyState";
import StatTile from "@/components/admin/StatTile";

type Kegiatan = { id: string; nama: string; singkatan: string; aktif: boolean; tahunAjaran: string | null; jumlahUjian: number };
type Ujian = {
  id: string; judul: string; mapel: string; jenis: string; kelas: string;
  peserta: number; butir: number; perluRevisi: number;
  reliabilitas: { alpha: number; kategori: string } | null; alasanReliabilitas: string | null; rerata: number | null;
  revisi: { nomor: number; tipe: string; kesukaran: number | null; dayaBeda: number | null; alasan: string[]; cuplikan: string }[];
};

const GAYA_REL: Record<string, string> = {
  Tinggi: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Cukup: "bg-amber-50 text-amber-700 border-amber-200",
  Rendah: "bg-red-50 text-red-700 border-red-200",
};

/** REKAP ANALISIS BUTIR per kegiatan ujian (5 Oktober 2026) — satu layar untuk Kurikulum & guru: reliabilitas tiap
 *  ujian dan SEMUA butir bertanda "perlu revisi", tanpa membuka tab Hasil satu per satu. Angkanya dari hitungan yang
 *  SAMA dengan tab Hasil (src/lib/analisis-butir.ts). Cakupan mengikuti Daftar Ujian pemanggil. */
export default function AnalisisButirKegiatan() {
  const [kegiatan, setKegiatan] = useState<Kegiatan[]>([]);
  const [kegiatanId, setKegiatanId] = useState("");
  const [ujian, setUjian] = useState<Ujian[]>([]);
  const [muat, setMuat] = useState(true);
  const [cari, setCari] = useState("");
  const [saring, setSaring] = useState<"semua" | "revisi" | "rendah">("semua");
  const [buka, setBuka] = useState<string | null>(null);

  const ambil = useCallback((id?: string) => {
    setMuat(true);
    fetch(`/api/ujian/analisis-butir${id ? `?kegiatanId=${id}` : ""}`, { cache: "no-store" })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) { setKegiatan(d.kegiatan ?? []); setKegiatanId(d.kegiatanId ?? ""); setUjian(d.ujian ?? []); } })
      .catch(() => {})
      .finally(() => setMuat(false));
  }, []);
  useEffect(() => { queueMicrotask(() => ambil()); }, [ambil]);

  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return ujian.filter(u => {
      if (saring === "revisi" && !u.perluRevisi) return false;
      if (saring === "rendah" && u.reliabilitas?.kategori !== "Rendah") return false;
      return !q || `${u.mapel} ${u.judul} ${u.kelas}`.toLowerCase().includes(q);
    });
  }, [ujian, cari, saring]);

  const dianalisis = ujian.filter(u => u.peserta > 0).length;
  const totalRevisi = ujian.reduce((n, u) => n + u.perluRevisi, 0);
  const berRel = ujian.filter(u => u.reliabilitas);
  const rerataRel = berRel.length ? Math.round((berRel.reduce((n, u) => n + (u.reliabilitas?.alpha ?? 0), 0) / berRel.length) * 100) / 100 : null;
  const rendah = berRel.filter(u => u.reliabilitas?.kategori === "Rendah").length;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Activity size={22} />} title="Analisis Butir Soal"
        description="Reliabilitas tiap ujian dan butir yang perlu direvisi dalam satu kegiatan" />

      <div className="space-y-6">
        <div className="kisi-kartu kisi-kartu-4">
          <StatTile value={`${dianalisis}/${ujian.length}`} label="Ujian sudah dikerjakan" ikon="dokumen" color="primary" />
          <StatTile value={totalRevisi} label="Butir perlu revisi" ikon="peringatan" color={totalRevisi ? "amber" : "gray"} sorot={totalRevisi > 0} />
          <StatTile value={rerataRel ?? "—"} label="Rata-rata reliabilitas" ikon="tren" color="blue" />
          <StatTile value={rendah} label="Ujian reliabilitas rendah" ikon="waspada" color={rendah ? "red" : "gray"} />
        </div>

        <div className="baris-alat">
          <div className="alat-saring min-w-[14rem]">
            <Select value={kegiatanId} onChange={v => { setKegiatanId(v); ambil(v); }}
              options={kegiatan.map(k => ({ value: k.id, label: `${k.nama}${k.tahunAjaran ? ` · ${k.tahunAjaran}` : ""}${k.aktif ? " (aktif)" : ""}` }))} />
          </div>
          <div className="alat-cari">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari mapel, ujian, atau kelas..." className="input-field pl-10" />
          </div>
          <div className="alat-tab flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-gray-100 bg-white p-1 scrollbar-hide">
            {([["semua", "Semua"], ["revisi", "Ada butir revisi"], ["rendah", "Reliabilitas rendah"]] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setSaring(k)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition ${saring === k ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>{l}</button>
            ))}
          </div>
          {kegiatanId && (
            <div className="alat-aksi">
              <a href={`/api/ujian/analisis-butir/ekspor?kegiatanId=${kegiatanId}`} className="btn-modal-cancel"><Download size={16} /> Unduh Excel</a>
            </div>
          )}
        </div>

        {muat ? (
          <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
        ) : !ujian.length ? (
          <EmptyState icon={Activity} title="Belum ada ujian" description={kegiatan.length ? "Kegiatan ini belum punya ujian yang bisa Anda lihat." : "Belum ada kegiatan ujian yang berisi ujian."} />
        ) : !tampil.length ? (
          <p className="py-10 text-center text-sm text-gray-400">Tidak ada ujian yang cocok dengan saringan.</p>
        ) : (
          <div className="panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-10">No</th><th>Ujian</th><th>Kelas</th>
                    <th className="text-right">Peserta</th><th className="text-right">Rerata</th>
                    <th>Reliabilitas</th><th className="text-right">Perlu revisi</th><th className="text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {tampil.map((u, i) => (
                    <Fragment key={u.id}>
                      <tr>
                        <td className="angka">{i + 1}</td>
                        <td>
                          <p className="font-medium text-primary-900">{u.mapel}</p>
                          <p className="text-xs text-gray-500">{u.judul}{u.jenis !== "REGULER" ? ` · ${u.jenis === "SUSULAN" ? "Susulan" : "Remedial"}` : ""}</p>
                        </td>
                        <td className="text-sm text-gray-600">{u.kelas || "—"}</td>
                        <td className="angka text-right">{u.peserta}</td>
                        <td className="angka text-right">{u.rerata ?? "—"}</td>
                        <td>
                          {u.reliabilitas
                            ? <span className={`status-badge ${GAYA_REL[u.reliabilitas.kategori] ?? ""}`}><span className="angka">{u.reliabilitas.alpha.toFixed(2)}</span> · {u.reliabilitas.kategori}</span>
                            : <span className="text-xs text-gray-400">{u.alasanReliabilitas ?? "belum bisa dihitung"}</span>}
                        </td>
                        <td className="text-right">
                          {u.perluRevisi ? (
                            <button type="button" onClick={() => setBuka(b => (b === u.id ? null : u.id))}
                              className="inline-flex items-center gap-1 text-sm font-semibold text-amber-700 hover:underline">
                              <span className="angka">{u.perluRevisi}</span> butir
                              <ChevronDown size={14} className={`transition-transform ${buka === u.id ? "rotate-180" : ""}`} />
                            </button>
                          ) : <span className="text-sm text-gray-400">—</span>}
                        </td>
                        <td className="text-right">
                          <a href={`/pusat-ujian/${u.id}?tab=hasil`} title="Buka tab Hasil ujian ini"
                            className="inline-flex p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"><ExternalLink size={14} /></a>
                        </td>
                      </tr>
                      {buka === u.id && (
                        <tr>
                          <td colSpan={8} className="bg-amber-50/40">
                            <ul className="space-y-2 py-1">
                              {u.revisi.map(r => (
                                <li key={r.nomor} className="text-sm">
                                  <span className="font-semibold text-primary-900">Soal {r.nomor}</span>
                                  <span className="text-gray-500"> · kesukaran {r.kesukaran ?? "—"} · daya beda {r.dayaBeda ?? "—"}</span>
                                  <span className="block text-amber-700">{r.alasan.join("; ")}</span>
                                  {r.cuplikan && <span className="block text-xs text-gray-500 line-clamp-2">{r.cuplikan}</span>}
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <p className="text-xs text-gray-400">
          Butir ditandai &quot;perlu revisi&quot; bila peserta ≥ 10 dan: daya beda terbalik/lemah, terlalu sukar (&lt; 10% benar), terlalu mudah (&gt; 95% benar),
          atau ≥ 2 pengecoh tidak dipilih siapa pun. Reliabilitas = Cronbach alpha; ≥ 0,70 tinggi, 0,50–0,69 cukup, &lt; 0,50 rendah.
        </p>
      </div>
    </div>
  );
}
