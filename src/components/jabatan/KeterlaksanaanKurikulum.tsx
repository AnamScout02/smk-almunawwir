"use client";
import { useEffect, useMemo, useState } from "react";
import { Download, GaugeCircle, Loader2, Search } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import Select from "@/components/admin/Select";
import Paginasi from "@/components/shared/Paginasi";
import { usePaginasi } from "@/lib/use-paginasi";

interface Baris {
  teacherId: string; guru: string; classId: string; kelas: string; tingkat: number; mapel: string;
  pertemuan: number; jp: number; jurnal: number; persen: number | null; tertinggal: number; jurnalTerakhir: string | null;
  rencana: { total: number; tercapai: number; seharusnya: number | null; tertinggal: number | null; berikut: string | null } | null;
}
interface Data { semester: string; mulai: string; sampai: string; pekan: number; baris: Baris[]; cakupan: "SEMUA" | "SENDIRI"; dipantau: number[]; semuaTingkat: boolean; error?: string }
type Tab = "kelas" | "guru" | "mapel";
const ROMAWI: Record<number, string> = { 10: "X", 11: "XI", 12: "XII", 13: "XIII" };
const tgl = (s: string) => new Date(`${s}T00:00:00Z`).toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "UTC" });
const warna = (p: number | null) => p === null ? "bg-gray-200" : p >= 80 ? "bg-emerald-500" : p >= 50 ? "bg-amber-400" : "bg-red-500";
const teksWarna = (p: number | null) => p === null ? "text-gray-400" : p >= 80 ? "text-emerald-700" : p >= 50 ? "text-amber-700" : "text-red-600";

function Batang({ p }: { p: number | null }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 shrink-0 rounded-full bg-gray-100"><div className={`h-1.5 rounded-full ${warna(p)}`} style={{ width: `${p ?? 0}%` }} /></div>
      <span className={`angka text-xs font-semibold ${teksWarna(p)}`}>{p === null ? "—" : `${p}%`}</span>
    </div>
  );
}

/** PAPAN KETERLAKSANAAN KURIKULUM (10 Okt 2026) — hitungan dari src/lib/keterlaksanaan.ts. Dipakai portal admin & guru. */
export default function KeterlaksanaanKurikulum() {
  const [d, setD] = useState<Data | null>(null);
  const [galat, setGalat] = useState("");
  const [semua, setSemua] = useState(false);
  const [tab, setTab] = useState<Tab>("kelas");
  const [cari, setCari] = useState("");
  const [saring, setSaring] = useState("");

  useEffect(() => {
    setD(null);
    fetch(`/api/kurikulum/keterlaksanaan${semua ? "?semua=1" : ""}`, { cache: "no-store" })
      .then(async r => { const j = await r.json().catch(() => null); if (!r.ok || !j) setGalat(j?.error ?? "Gagal memuat data."); else setD(j); })
      .catch(() => setGalat("Gagal memuat data."));
  }, [semua]);

  const baris = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return (d?.baris ?? []).filter(b =>
      (!q || `${b.kelas} ${b.mapel} ${b.guru}`.toLowerCase().includes(q)) &&
      (saring === "" || (saring === "kosong" ? b.pertemuan > 0 && b.jurnal === 0 : saring === "rendah" ? (b.persen ?? 100) < 50 : saring === "materi" ? !!b.rencana?.tertinggal : saring === "tanpa-prota" ? !b.rencana : true)));
  }, [d, cari, saring]);

  const kelompok = useMemo(() => {
    if (tab === "kelas") return [];
    const peta = new Map<string, { nama: string; pertemuan: number; jurnal: number; baris: number; kosong: number; materi: number }>();
    for (const b of baris) {
      const k = tab === "guru" ? b.teacherId : b.mapel, a = peta.get(k) ?? { nama: tab === "guru" ? b.guru : b.mapel, pertemuan: 0, jurnal: 0, baris: 0, kosong: 0, materi: 0 };
      a.pertemuan += b.pertemuan; a.jurnal += Math.min(b.jurnal, b.pertemuan || b.jurnal); a.baris += 1;
      if (b.pertemuan > 0 && b.jurnal === 0) a.kosong += 1;
      a.materi += b.rencana?.tertinggal ?? 0;
      peta.set(k, a);
    }
    return [...peta.values()].map(a => ({ ...a, persen: a.pertemuan ? Math.min(100, Math.round((a.jurnal / a.pertemuan) * 100)) : null }))
      .sort((a, b) => (a.persen ?? 101) - (b.persen ?? 101) || a.nama.localeCompare(b.nama));
  }, [baris, tab]);

  const hal = usePaginasi(baris, 50, `${cari}|${saring}|${semua}`);

  if (!d && !galat) return <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;
  const semuaBaris = d?.baris ?? [];
  const tPertemuan = semuaBaris.reduce((t, b) => t + b.pertemuan, 0), tJurnal = semuaBaris.reduce((t, b) => t + Math.min(b.jurnal, b.pertemuan || b.jurnal), 0);
  const persen = tPertemuan ? Math.round((tJurnal / tPertemuan) * 100) : 0;
  const kosong = semuaBaris.filter(b => b.pertemuan > 0 && b.jurnal === 0).length;
  const berProta = semuaBaris.filter(b => b.rencana).length;
  const sendiri = d?.cakupan === "SENDIRI";

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<GaugeCircle size={22} />} title="Keterlaksanaan Kurikulum"
        description={d ? `${d.semester} · ${tgl(d.mulai)} – ${tgl(d.sampai)} · pekan efektif ke-${d.pekan}${sendiri ? " · kelas & mapel yang Anda ampu" : ""}` : "Jam terjadwal, jurnal terisi, dan materi tercapai"} />
      {!d ? <p className="py-10 text-center text-sm text-gray-400">{galat}</p> : (
        <div className="space-y-6">
          <div className="kisi-kartu kisi-kartu-5">
            <StatTile value={`${persen}%`} label="Keterlaksanaan (jurnal ÷ pertemuan)" ikon="persen" color={persen >= 80 ? "emerald" : persen >= 50 ? "amber" : "red"} />
            <StatTile value={tPertemuan} label="Pertemuan terjadwal" ikon="kalender" color="primary" />
            <StatTile value={tJurnal} label="Jurnal terisi" ikon="jurnal" color="blue" />
            <StatTile value={kosong} label="Kelas–mapel tanpa jurnal" ikon="peringatan" color={kosong ? "red" : "gray"} sorot={kosong > 0} />
            <StatTile value={`${berProta}/${semuaBaris.length}`} label="Sudah punya Prota/Promes" ikon="dokumen" color="purple" />
          </div>

          <div className="baris-alat">
            <div className="alat-cari"><Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" /><input className="input-field pl-10" value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari kelas, mapel, atau guru" /></div>
            <div className="alat-saring"><Select value={saring} onChange={setSaring} options={[
              { value: "", label: "Semua keadaan" }, { value: "kosong", label: "Belum ada jurnal sama sekali" }, { value: "rendah", label: "Keterlaksanaan di bawah 50%" },
              { value: "materi", label: "Materi tertinggal dari Prota" }, { value: "tanpa-prota", label: "Belum punya Prota/Promes" }]} /></div>
            {!sendiri && (
              <div className="alat-tab flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-gray-100 bg-white p-1 scrollbar-hide">
                {([["kelas", "Per kelas & mapel"], ["guru", "Per guru"], ["mapel", "Per mapel"]] as [Tab, string][]).map(([k, l]) => (
                  <button key={k} type="button" onClick={() => setTab(k)} className={`sentuh whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition ${tab === k ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>{l}</button>
                ))}
              </div>
            )}
            {!sendiri && (
              <div className="alat-aksi">
                <button type="button" onClick={() => setSemua(s => !s)} className="btn-modal-cancel btn-teks">{semua ? `Hanya tingkat dipantau (${d.dipantau.map(t => ROMAWI[t] ?? t).join(", ")})` : "Semua tingkat"}</button>
                <a href={`/api/kurikulum/keterlaksanaan/ekspor${semua ? "?semua=1" : ""}`} className="btn-modal-cancel"><Download /> Unduh Excel</a>
              </div>
            )}
          </div>

          <div className="panel overflow-hidden">
            {tab === "kelas" || sendiri ? (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr><th className="w-10">No</th><th>Kelas</th><th>Mapel</th>{!sendiri && <th>Guru</th>}<th className="text-right">Pertemuan</th><th className="text-right">Jurnal</th><th>Keterlaksanaan</th><th>Jurnal terakhir</th><th>Materi (Prota/Promes)</th></tr></thead>
                  <tbody>
                    {hal.potongan.map((b, i) => (
                      <tr key={`${b.teacherId}|${b.classId}|${b.mapel}`} className={b.pertemuan > 0 && b.jurnal === 0 ? "bg-red-50/50" : ""}>
                        <td className="angka text-gray-400">{hal.awal + i}</td>
                        <td className="whitespace-nowrap font-semibold text-primary-900">{b.kelas}</td>
                        <td className="min-w-[10rem]">{b.mapel}</td>
                        {!sendiri && <td className="min-w-[11rem] text-gray-600">{b.guru}</td>}
                        <td className="angka text-right">{b.pertemuan}</td>
                        <td className="angka text-right">{b.jurnal}{b.tertinggal > 0 && <span className="ml-1 text-xs text-red-600">−{b.tertinggal}</span>}</td>
                        <td><Batang p={b.persen} /></td>
                        <td className="whitespace-nowrap text-xs text-gray-500">{b.jurnalTerakhir ? tgl(b.jurnalTerakhir) : "—"}</td>
                        <td className="text-xs">
                          {b.rencana ? (
                            <>
                              <span className="angka font-semibold text-primary-900">{b.rencana.tercapai}/{b.rencana.total}</span> butir tercatat
                              {b.rencana.tertinggal ? <span className="ml-1 font-semibold text-red-600">· tertinggal {b.rencana.tertinggal}</span> : b.rencana.seharusnya !== null ? <span className="ml-1 text-emerald-600">· sesuai rencana</span> : null}
                              {b.rencana.berikut && <span className="block max-w-xs truncate text-gray-400">Berikutnya: {b.rencana.berikut}</span>}
                            </>
                          ) : <span className="text-gray-400">Belum ada Prota/Promes</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr><th className="w-10">No</th><th>{tab === "guru" ? "Guru" : "Mapel"}</th><th className="text-right">Kelas–mapel</th><th className="text-right">Pertemuan</th><th className="text-right">Jurnal</th><th>Keterlaksanaan</th><th className="text-right">Tanpa jurnal</th><th className="text-right">Materi tertinggal</th></tr></thead>
                  <tbody>
                    {kelompok.map((k, i) => (
                      <tr key={k.nama}>
                        <td className="angka text-gray-400">{i + 1}</td>
                        <td className="font-semibold text-primary-900">{k.nama}</td>
                        <td className="angka text-right">{k.baris}</td><td className="angka text-right">{k.pertemuan}</td><td className="angka text-right">{k.jurnal}</td>
                        <td><Batang p={k.persen} /></td>
                        <td className={`angka text-right ${k.kosong ? "font-semibold text-red-600" : ""}`}>{k.kosong}</td>
                        <td className={`angka text-right ${k.materi ? "font-semibold text-red-600" : ""}`}>{k.materi}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {baris.length === 0 && <p className="py-10 text-center text-sm text-gray-400">Tidak ada baris yang cocok.</p>}
            {(tab === "kelas" || sendiri) && <Paginasi hal={hal} satuan="baris" className="border-t border-gray-100" />}
          </div>

          <p className="text-xs text-gray-500">
            Pertemuan terjadwal dihitung dari Jadwal Pelajaran yang berlaku sekarang, tiap hari sekolah sejak awal semester; hari libur dan hari ujian tidak dihitung.
            Bila jadwal diganti di tengah semester, angka sebelum penggantian adalah perkiraan. &ldquo;Materi tercatat&rdquo; = butir Prota/Promes yang tertulis di Jurnal Mengajar —
            jurnal yang ditulis dengan kata lain tidak terhitung, jadi pakai tombol Simpan pada kartu Jurnal Hari Ini supaya teksnya sama.
          </p>
        </div>
      )}
    </div>
  );
}
