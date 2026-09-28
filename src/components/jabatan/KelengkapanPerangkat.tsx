"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ClipboardCheck, Download, Loader2, Search, XCircle } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import Select from "@/components/admin/Select";
import EmptyState from "@/components/admin/EmptyState";
import Paginasi from "@/components/shared/Paginasi";
import { usePaginasi } from "@/lib/use-paginasi";

interface Baris {
  teacherId: string; guru: string; nip: string | null; mapel: string; tingkat: number; kelas: string[];
  prota: boolean; rpp: number; jurnal: number; lengkap: boolean;
}
interface Data { semester: { label: string }; baris: Baris[]; cakupan: "SEMUA" | "SENDIRI" }

const ROMAWI: Record<number, string> = { 10: "X", 11: "XI", 12: "XII" };

/** KELENGKAPAN PERANGKAT AJAR (21 September 2026) — pemantau untuk Wakil Kepala Kurikulum &
 * Administrator: guru × mapel × tingkat mana yang Prota/Promes dan RPP-nya belum ada. Guru biasa
 * membuka halaman yang sama tetapi hanya melihat baris miliknya, beserta tautan untuk melengkapi.
 * Dipakai portal Admin & portal guru (satu komponen, dua pembungkus — CLAUDE.md #55). */
export default function KelengkapanPerangkat({ protaHref, rppHref }: { protaHref: string; rppHref: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [galat, setGalat] = useState("");
  const [cari, setCari] = useState("");
  const [status, setStatus] = useState("");
  const [tingkat, setTingkat] = useState("");

  const muat = useCallback(async () => {
    try {
      const r = await fetch("/api/kurikulum/kelengkapan-perangkat", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Gagal memuat");
      setData(d as Data);
    } catch (e) { setGalat(e instanceof Error ? e.message : "Gagal memuat"); }
  }, []);
  // Ditunda satu microtask supaya setState tidak terjadi serentak di dalam efek.
  useEffect(() => { queueMicrotask(() => { void muat(); }); }, [muat]);

  const baris = useMemo(() => data?.baris ?? [], [data]);
  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return baris.filter(b =>
      (!status || (status === "lengkap" ? b.lengkap : status === "tanpa-prota" ? !b.prota : status === "tanpa-rpp" ? b.rpp === 0 : !b.lengkap))
      && (!tingkat || String(b.tingkat) === tingkat)
      && (!q || b.guru.toLowerCase().includes(q) || b.mapel.toLowerCase().includes(q) || b.kelas.join(" ").toLowerCase().includes(q)));
  }, [baris, cari, status, tingkat]);
  const hal = usePaginasi(tersaring, 50, `${cari}|${status}|${tingkat}`);

  const lengkap = baris.filter(b => b.lengkap).length;
  const persen = baris.length ? Math.round((lengkap / baris.length) * 100) : 0;
  const semua = data?.cakupan === "SEMUA";

  const pil = (ok: boolean, teksOk: string, teksBelum: string) => (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${ok ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"}`}>
      {ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />} {ok ? teksOk : teksBelum}
    </span>
  );

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<ClipboardCheck size={22} />} title="Kelengkapan Perangkat Ajar"
        description={data ? `Semester ${data.semester.label} · ${semua ? "semua guru" : "perangkat ajar Anda"}` : "Prota, Promes, RPP, dan jurnal mengajar per guru, mapel, dan tingkat"} />

      {galat && <p className="error-msg mb-5">{galat}</p>}

      {!data && !galat ? (
        <div className="flex items-center justify-center min-h-[40vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
      ) : data && (
        <>
          <div className="kisi-kartu kisi-kartu-4 mb-5">
            <StatTile value={`${persen}%`} label="Lengkap" ikon="centang" color={persen >= 80 ? "emerald" : persen >= 50 ? "amber" : "red"} />
            <StatTile value={`${lengkap} / ${baris.length}`} label="Guru × mapel × tingkat lengkap" ikon="daftar-centang" color="primary" />
            <StatTile value={baris.filter(b => !b.prota).length} label="Belum ada Prota & Promes" ikon="kalender" color="amber" sorot={baris.some(b => !b.prota)} />
            <StatTile value={baris.filter(b => b.rpp === 0).length} label="Belum ada RPP / Modul Ajar" ikon="dokumen" color="red" />
          </div>

          <div className="baris-alat mb-5">
            <div className="alat-cari">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari guru, mapel, atau kelas..." className="input-field pl-10 w-full" />
            </div>
            <div className="alat-saring">
              <Select value={status} onChange={setStatus} options={[
                { value: "", label: "Semua status" },
                { value: "belum", label: "Belum lengkap" },
                { value: "lengkap", label: "Sudah lengkap" },
                { value: "tanpa-prota", label: "Belum ada Prota & Promes" },
                { value: "tanpa-rpp", label: "Belum ada RPP" },
              ]} />
            </div>
            <div className="alat-saring">
              <Select value={tingkat} onChange={setTingkat} options={[
                { value: "", label: "Semua tingkat" }, { value: "10", label: "Kelas X" }, { value: "11", label: "Kelas XI" }, { value: "12", label: "Kelas XII" },
              ]} />
            </div>
            <div className="alat-aksi alat-teks">
              {!semua && <Link href={protaHref} className="btn-modal-cancel">Isi Prota & Promes</Link>}
              {!semua && <Link href={rppHref} className="btn-modal-save">Isi RPP</Link>}
              {semua && <a href="/api/kurikulum/kelengkapan-perangkat/ekspor" className="btn-modal-cancel"><Download size={16} /> Unduh Excel</a>}
            </div>
          </div>

          <p className="text-xs text-gray-400 mb-3">
            &ldquo;Lengkap&rdquo; = Prota &amp; Promes sudah ada dan minimal satu RPP/Modul Ajar. Jurnal mengajar ditampilkan sebagai bukti
            pelaksanaan, tetapi tidak ikut syarat — ia bertambah tiap pertemuan, bukan dokumen yang disiapkan di awal semester.
          </p>

          {tersaring.length === 0 ? (
            <EmptyState icon={ClipboardCheck} title={baris.length ? "Tidak ada yang cocok" : "Belum ada penugasan mengajar"}
              description={baris.length ? "Ubah saringan atau kata cari." : "Kelengkapan dihitung dari Penugasan Mengajar semester ini."} />
          ) : (
            <div className="panel overflow-hidden">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr>
                    <th>No</th>{semua && <th>Guru</th>}<th>Mata Pelajaran</th><th>Tingkat</th>
                    <th>Prota &amp; Promes</th><th>RPP</th><th>Jurnal</th><th>Status</th>
                  </tr></thead>
                  <tbody>
                    {hal.potongan.map((b, i) => (
                      <tr key={`${b.teacherId}|${b.mapel}|${b.tingkat}`}>
                        <td className="angka">{hal.awal + i}</td>
                        {semua && <td><span className="font-medium text-gray-700">{b.guru}</span>{b.nip && <span className="block text-xs text-gray-400 angka">{b.nip}</span>}</td>}
                        <td>{b.mapel}<span className="block text-xs text-gray-400">{b.kelas.join(", ")}</span></td>
                        <td>{ROMAWI[b.tingkat] ?? b.tingkat}</td>
                        <td>{pil(b.prota, "Ada", "Belum")}</td>
                        <td>{b.rpp > 0 ? pil(true, `${b.rpp} RPP`, "") : pil(false, "", "Belum")}</td>
                        <td className="angka">{b.jurnal || <span className="text-gray-300">0</span>}</td>
                        <td>{b.lengkap
                          ? <span className="status-badge bg-emerald-50 text-emerald-700 border-emerald-200">Lengkap</span>
                          : <span className="status-badge bg-amber-50 text-amber-700 border-amber-200">Belum lengkap</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Paginasi hal={hal} satuan="baris" className="border-t border-gray-100" />
            </div>
          )}
        </>
      )}
    </div>
  );
}
