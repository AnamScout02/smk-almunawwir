"use client";
import TimePicker from "@/components/shared/TimePicker";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BadgeCheck, ClipboardList, DoorOpen, Loader2, LogIn, Printer, Save, ScanLine, Search, ShieldAlert, Siren, Image as ImageIcon } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import EmptyState from "@/components/admin/EmptyState";
import { useToast } from "@/components/shared/ToastProvider";
import { tautanJabatan, BASE_GURU } from "@/lib/rute-jabatan";
import BarisPintasan from "@/components/shared/BarisPintasan";

interface Ringkasan {
  tanggal: string; petugas: string; tamu: number; laporan: string; hak: { piketHariIni: boolean; penjaminMutu: boolean; jadwalPiket: boolean };
  guruTidakHadir: { guru: string; kelas: string; mapel: string; jam: string; status: string; tugas: boolean | null; catatan: string | null }[];
  terlambat: { nama: string; nis: string; kelas: string; poin: number; waktu: string }[];
  izinKeluar: { id: string; nama: string; nis: string; kelas: string; alasan: string; keluar: string; rencana: string | null; kembali: string | null; oleh: string; perluFoto: boolean; adaBukti: boolean; buktiPada: string | null }[];
}
interface Cari { id: string; nis: string; name: string; className: string }
const jam = (d: string) => new Date(d).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
const STATUS_GURU: Record<string, string> = { TERLAMBAT: "Terlambat", IZIN: "Izin", SAKIT: "Sakit", ALPHA: "Tanpa keterangan" };

/** DASHBOARD PIKET HARIAN (17 Sep 2026). */
/** Dipakai portal GURU (pemegang tugasnya) dan portal ADMIN (superadmin — akses penuh tanpa
 * dilempar ke shell portal guru, keputusan user 19 September 2026). */
export default function BukuPiketHarian({ basePath = BASE_GURU }: { basePath?: string }) {
  const toast = useToast();
  const [data, setData] = useState<Ringkasan | null>(null);
  const [galat, setGalat] = useState("");
  const [cari, setCari] = useState("");
  const [hasilCari, setHasilCari] = useState<Cari[]>([]);
  const [pilih, setPilih] = useState<Cari | null>(null);
  const [alasan, setAlasan] = useState("");
  const [rencana, setRencana] = useState("");
  /** SENGAJA tanpa bawaan (""): guru piket harus memilih dulu sebelum "Catat Keluar" aktif.
   *  Kalau bawaannya "tidak", petugas yang tidak menyadari pilihan ini selalu menghasilkan izin
   *  tanpa bukti foto — bug default-diam-diam yang sama seperti dropdown kehadiran (CLAUDE.md #10). */
  const [perluFoto, setPerluFoto] = useState<"" | "ya" | "tidak">("");
  const [kode, setKode] = useState("");
  const [laporan, setLaporan] = useState("");
  const [sibuk, setSibuk] = useState("");
  const kodeRef = useRef<HTMLInputElement>(null);

  const muat = useCallback(() => {
    fetch("/api/teacher/piket-harian", { cache: "no-store" }).then(async r => {
      const d = await r.json().catch(() => null);
      if (!r.ok || !d) setGalat(d?.error ?? "Gagal memuat."); else { setData(d); setLaporan(l => l || d.laporan); }
    }).catch(() => setGalat("Gagal memuat."));
  }, []);
  useEffect(() => { muat(); }, [muat]);

  useEffect(() => {
    if (cari.trim().length < 2 || pilih) { setHasilCari([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/admin/student-points/students-lookup?q=${encodeURIComponent(cari.trim())}`).then(r => r.json())
        .then(d => setHasilCari(Array.isArray(d) ? d : [])).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [cari, pilih]);

  async function kirim(body: Record<string, string | boolean>, sukses: string) {
    setSibuk(String(body.aksi));
    const r = await fetch("/api/teacher/piket-harian", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setSibuk("");
    if (!r?.ok) { toast.error(d?.error ?? "Gagal menyimpan."); return false; }
    toast.success(d?.nama ? `${d.nama} ${sukses}` : sukses);
    muat();
    return true;
  }

  if (galat) return <div className="p-6 lg:p-8 pt-16 lg:pt-8"><EmptyState icon={ShieldAlert} title="Tidak tersedia" description={galat} /></div>;
  if (!data) return <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;
  const diLuar = data.izinKeluar.filter(i => !i.kembali);
  const buktiTertunda = data.izinKeluar.filter(i => i.perluFoto && !i.adaBukti);
  const tanggal = new Date(`${data.tanggal}T00:00:00Z`).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0">
      <PageHeader icon={<Siren size={22} />} title="Piket Harian" description={`${tanggal} · petugas ${data.petugas}`} printHidden />

      <div className="space-y-6 print:hidden">
        <div className="kisi-kartu kisi-kartu-5">
          <StatTile ikon="guru" color={data.guruTidakHadir.length ? "red" : "emerald"} value={data.guruTidakHadir.length} label="Jam pelajaran guru tidak hadir" />
          <StatTile ikon="jam" color={data.terlambat.length ? "amber" : "emerald"} value={data.terlambat.length} label="Siswa terlambat" />
          <StatTile ikon="kunjungan" color={diLuar.length ? "amber" : "blue"} value={diLuar.length} label="Siswa sedang di luar sekolah" sorot={diLuar.length > 0} />
          <StatTile ikon="foto" color={buktiTertunda.length ? "red" : "emerald"} value={buktiTertunda.length} label="Bukti foto izin keluar belum masuk" sorot={buktiTertunda.length > 0} />
          <StatTile ikon="kontak" color="purple" value={data.tamu} label="Tamu tercatat" />
        </div>

        <BarisPintasan items={[
            ...(data.hak.piketHariIni || data.hak.penjaminMutu ? [{ href: tautanJabatan(basePath, "wakasek/penjamin-mutu/kedisiplinan"), label: "Catat kehadiran guru", ikon: BadgeCheck }] : []),
            data.hak.piketHariIni
              ? { href: tautanJabatan(basePath, "piket/poin-siswa"), label: "Catat poin (terlambat/atribut)", ikon: ShieldAlert }
              : { href: tautanJabatan(basePath, "kesiswaan/poin-siswa"), label: "Poin siswa", ikon: ShieldAlert },
            ...(data.hak.piketHariIni ? [{ href: tautanJabatan(basePath, "absensi-scan"), label: "Scan kartu absensi", ikon: ScanLine }] : []),
            ...(data.hak.jadwalPiket ? [{ href: tautanJabatan(basePath, "wakasek/penjamin-mutu/jadwal-piket"), label: "Jadwal piket", ikon: ClipboardList }] : []),
        ]} />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 items-start">
          <div className="panel p-5 space-y-4">
            <h3 className="font-heading font-bold text-primary-900 text-sm flex items-center gap-2"><DoorOpen size={15} className="text-amber-600" /> Izin keluar lingkungan sekolah</h3>
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={pilih ? `${pilih.name} — ${pilih.className}` : cari} onChange={e => { setPilih(null); setCari(e.target.value); }}
                placeholder="Cari nama atau NIS siswa" className="input-field pl-10" />
              {hasilCari.length > 0 && (
                <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-gray-100 bg-white shadow-lg">
                  {hasilCari.map(s => (
                    <li key={s.id}><button type="button" onClick={() => { setPilih(s); setHasilCari([]); }} className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50">
                      <span className="font-medium text-primary-900">{s.name}</span> <span className="text-xs text-gray-500">{s.className} · {s.nis}</span>
                    </button></li>
                  ))}
                </ul>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <input value={alasan} onChange={e => setAlasan(e.target.value)} placeholder="Alasan keluar" className="input-field sm:col-span-2" />
              <TimePicker value={rencana} onChange={v => setRencana(v)} title="Rencana kembali" />
            </div>
            {/* Menentukan wujud izin ini di portal siswa, DIPILIH SEBELUM dicatat keluar (30 Sep 2026):
                "Wajib bukti foto" = siswa harus mengunggah foto dari tempat tujuan; "Tidak perlu" =
                izin hanya jadi surat izin keluar untuk ditunjukkan ke petugas keamanan / tempat tujuan. */}
            <div>
              <p className="label-field">Bukti foto dari tempat tujuan</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {([
                  { nilai: "tidak" as const, judul: "Tidak perlu bukti foto", ket: "Siswa hanya menerima surat izin keluar untuk ditunjukkan ke petugas keamanan." },
                  { nilai: "ya" as const, judul: "Wajib bukti foto", ket: "Siswa harus mengunggah foto dari tempat tujuan di portalnya." },
                ]).map(o => (
                  <label key={o.nilai}
                    className={`sentuh flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition ${
                      perluFoto === o.nilai ? "border-primary-500 bg-primary-50" : "border-gray-100 bg-[#f5f6fa] hover:bg-gray-50"}`}>
                    <input type="radio" name="perlu-bukti-foto" value={o.nilai} checked={perluFoto === o.nilai}
                      onChange={() => setPerluFoto(o.nilai)} className="mt-0.5 h-4 w-4 shrink-0 accent-primary-700" />
                    <span className="min-w-0 text-sm">
                      <span className="font-medium text-primary-900">{o.judul}</span>
                      <span className="block text-xs text-gray-500">{o.ket}</span>
                    </span>
                  </label>
                ))}
              </div>
              {!perluFoto && <p className="mt-1.5 text-xs text-gray-400">Pilih salah satu dulu sebelum mencatat keluar.</p>}
            </div>
            <button type="button" disabled={!pilih || alasan.trim().length < 3 || !perluFoto || sibuk === "keluar"} className="btn-modal-save"
              onClick={async () => { if (pilih && perluFoto && await kirim({ aksi: "keluar", studentId: pilih.id, alasan, kembaliRencana: rencana, perluFoto: perluFoto === "ya" }, "tercatat keluar.")) { setPilih(null); setCari(""); setAlasan(""); setRencana(""); setPerluFoto(""); } }}>
              {sibuk === "keluar" ? <Loader2 size={15} className="animate-spin" /> : <DoorOpen size={15} />} Catat Keluar
            </button>
            <form className="flex gap-2" onSubmit={async e => { e.preventDefault(); if (await kirim({ aksi: "kembali", kode }, "sudah kembali.")) { setKode(""); kodeRef.current?.focus(); } }}>
              <input ref={kodeRef} value={kode} onChange={e => setKode(e.target.value)} placeholder="Siswa kembali: pindai kartu / ketik NIS" className="input-field" />
              <button type="submit" disabled={!kode.trim() || sibuk === "kembali"} className="btn-modal-cancel shrink-0"><LogIn size={15} /> Kembali</button>
            </form>
            {data.izinKeluar.length > 0 && (
              <ul className="divide-y divide-gray-50 border-t border-gray-100">
                {data.izinKeluar.map(i => (
                  <li key={i.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                    <span className="min-w-0 flex-1"><span className="font-medium text-primary-900">{i.nama}</span> <span className="text-xs text-gray-500">{i.kelas} · {i.alasan}</span></span>
                    <span className="text-xs text-gray-500 tabular-nums">keluar {jam(i.keluar)}{i.rencana ? ` · rencana ${i.rencana}` : ""}</span>
                    {i.kembali ? <span className="status-badge bg-emerald-50 text-emerald-700 border-emerald-200">kembali {jam(i.kembali)}</span>
                      : <span className="status-badge bg-amber-50 text-amber-700 border-amber-200">di luar</span>}
                    {i.perluFoto && (i.adaBukti
                      ? <a href={`/api/izin-keluar/${i.id}/bukti`} target="_blank" rel="noreferrer"
                          className="status-badge border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
                          <ImageIcon size={12} /> bukti foto
                        </a>
                      : <span className="status-badge bg-red-50 text-red-600 border-red-200">bukti belum ada</span>)}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-6">
            <div className="panel p-5">
              <h3 className="font-heading font-bold text-primary-900 text-sm mb-2">Guru tidak hadir / terlambat</h3>
              {data.guruTidakHadir.length === 0 ? <p className="py-4 text-center text-sm text-gray-500">Belum ada catatan. Kehadiran guru dicatat di menu &ldquo;Catat kehadiran guru&rdquo;.</p> : (
                <ul className="divide-y divide-gray-50">
                  {data.guruTidakHadir.map((g, i) => (
                    <li key={i} className="py-2 text-sm">
                      <p><span className="font-medium text-primary-900">{g.guru}</span> <span className="text-xs text-gray-500">· {g.kelas} · {g.mapel} · {g.jam}</span></p>
                      <p className="text-xs text-gray-600">{STATUS_GURU[g.status] ?? g.status}{g.tugas === true ? " · tugas dititipkan" : g.tugas === false ? " · tanpa tugas (kelas kosong)" : ""}{g.catatan ? ` · ${g.catatan}` : ""}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="panel p-5">
              <h3 className="font-heading font-bold text-primary-900 text-sm mb-2">Siswa terlambat</h3>
              {data.terlambat.length === 0 ? <p className="py-4 text-center text-sm text-gray-500">Belum ada siswa terlambat tercatat.</p> : (
                <ul className="divide-y divide-gray-50">
                  {data.terlambat.map((t, i) => (
                    <li key={i} className="flex justify-between gap-2 py-2 text-sm"><span><span className="font-medium text-primary-900">{t.nama}</span> <span className="text-xs text-gray-500">· {t.kelas}</span></span><span className="text-xs tabular-nums text-gray-500">{jam(t.waktu)} · {t.poin} poin</span></li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="panel p-5 space-y-3">
          <h3 className="font-heading font-bold text-primary-900 text-sm">Catatan laporan piket</h3>
          <textarea value={laporan} onChange={e => setLaporan(e.target.value)} rows={4} maxLength={5000} className="input-field" placeholder="Kejadian penting hari ini, tindak lanjut, dll." />
          <div className="alat-aksi alat-teks justify-end">
            <button type="button" onClick={() => window.print()} className="btn-modal-cancel"><Printer size={15} /> Cetak Laporan Piket</button>
            <button type="button" onClick={() => kirim({ aksi: "laporan", catatan: laporan }, "Catatan laporan tersimpan.")} disabled={sibuk === "laporan"} className="btn-modal-save">
              {sibuk === "laporan" ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Simpan Catatan
            </button>
          </div>
        </div>
      </div>

      {/* Lembar cetak laporan piket */}
      <div className="print-doc bg-white hidden print:block p-6 text-sm">
        <style>{"@page { size: A4 portrait; margin: 1.5cm; }"}</style>
        <h1 className="text-center text-lg font-bold">LAPORAN PIKET HARIAN</h1>
        <p className="text-center mb-4">{tanggal} · Petugas: {data.petugas}</p>
        <p className="font-bold mt-3">A. Guru tidak hadir / terlambat ({data.guruTidakHadir.length})</p>
        <ol className="list-decimal pl-6">{data.guruTidakHadir.map((g, i) => <li key={i}>{g.guru} — {g.kelas}, {g.mapel}, {g.jam}: {STATUS_GURU[g.status] ?? g.status}{g.tugas ? " (tugas dititipkan)" : ""}</li>)}</ol>
        <p className="font-bold mt-3">B. Siswa terlambat ({data.terlambat.length})</p>
        <ol className="list-decimal pl-6">{data.terlambat.map((t, i) => <li key={i}>{t.nama} ({t.kelas}) — {jam(t.waktu)}</li>)}</ol>
        <p className="font-bold mt-3">C. Izin keluar lingkungan sekolah ({data.izinKeluar.length})</p>
        <ol className="list-decimal pl-6">{data.izinKeluar.map(i => <li key={i.id}>{i.nama} ({i.kelas}) — {i.alasan}; keluar {jam(i.keluar)}, {i.kembali ? `kembali ${jam(i.kembali)}` : "belum kembali"}{i.perluFoto ? `; bukti foto ${i.adaBukti ? "sudah masuk" : "BELUM masuk"}` : ""}</li>)}</ol>
        <p className="font-bold mt-3">D. Tamu tercatat: {data.tamu}</p>
        <p className="font-bold mt-3">E. Catatan</p>
        <p className="whitespace-pre-line">{laporan || "-"}</p>
        <div className="mt-12 flex justify-end"><div className="text-center"><p>Petugas Piket,</p><p className="mt-16 font-bold underline">{data.petugas}</p></div></div>
      </div>
    </div>
  );
}
