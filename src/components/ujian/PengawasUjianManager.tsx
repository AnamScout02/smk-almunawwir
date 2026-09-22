"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LayoutGrid, Loader2, Save, School, Shuffle, UserCheck } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import EmptyState from "@/components/admin/EmptyState";
import PrintButton from "@/components/shared/PrintButton";
import DatePicker from "@/components/shared/DatePicker";
import { useToast } from "@/components/shared/ToastProvider";
import PengawasKelasPanel, { type BarisKelas } from "@/components/ujian/PengawasKelasPanel";

interface Data {
  kegiatan: { id: string; nama: string; singkatan: string; tanggalMulai: string | null; tanggalSelesai: string | null; mekanisme: string; _count: { exams: number } }[];
  kegiatanId: string; guru: { id: string; nama: string }[]; ruang: { id: string; nama: string }[]; sesi: number[];
  jadwal: { id: string; ruangId: string; tanggal: string; sesi: number; teacherId: string; catatan: string | null }[];
  /** RUANG = pengawas per ruang × sesi (tabel di bawah); KELAS = jadwal ujian × kelas, pengawas guru mapel (PengawasKelasPanel). */
  mekanisme: "RUANG" | "KELAS"; perKelas: BarisKelas[];
}
const kunci = (t: string, s: number, r: string) => `${t}|${s}|${r}`;
const tglWib = (s: string) => new Date(new Date(s).getTime() + 7 * 3600_000).toISOString().slice(0, 10);

/** PEMBAGIAN PENGAWAS UJIAN (18 Sep 2026) — tanggal × sesi × ruang; "Bagi Otomatis" menyebar guru merata & tidak dobel di sesi sama. */
export default function PengawasUjianManager() {
  const toast = useToast();
  const [d, setD] = useState<Data | null>(null);
  const [galat, setGalat] = useState("");
  const [isi, setIsi] = useState<Record<string, string>>({});
  const [tanggal, setTanggal] = useState<string[]>([]);
  const [tambah, setTambah] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const muat = useCallback((kegiatanId?: string) => {
    fetch(`/api/ujian/pengawas${kegiatanId ? `?kegiatanId=${kegiatanId}` : ""}`, { cache: "no-store" }).then(async r => {
      const x = await r.json().catch(() => null);
      if (!r.ok) { setGalat(x?.error ?? "Gagal memuat."); return; }
      setD(x);
      setIsi(Object.fromEntries(x.jadwal.map((j: Data["jadwal"][number]) => [kunci(j.tanggal, j.sesi, j.ruangId), j.teacherId])));
      const dariJadwal = [...new Set(x.jadwal.map((j: Data["jadwal"][number]) => j.tanggal))] as string[];
      const keg = x.kegiatan.find((k: Data["kegiatan"][number]) => k.id === x.kegiatanId);
      const rentang: string[] = [];
      if (keg?.tanggalMulai && keg?.tanggalSelesai) {
        for (let t = new Date(tglWib(keg.tanggalMulai)); t <= new Date(tglWib(keg.tanggalSelesai)) && rentang.length < 21; t.setDate(t.getDate() + 1)) rentang.push(t.toISOString().slice(0, 10));
      }
      setTanggal([...new Set([...rentang, ...dariJadwal])].sort());
    }).catch(() => setGalat("Gagal memuat."));
  }, []);
  useEffect(() => { muat(); }, [muat]);

  const slot = useMemo(() => tanggal.flatMap(t => (d?.sesi ?? [1]).flatMap(s => (d?.ruang ?? []).map(r => ({ t, s, r })))), [tanggal, d]);
  function bagiOtomatis() {
    if (!d?.guru.length) return;
    const beban = new Map(d.guru.map(g => [g.id, 0]));
    const baru: Record<string, string> = {};
    for (const t of tanggal) {
      for (const s of d.sesi.length ? d.sesi : [1]) {
        const dipakai = new Set<string>();
        for (const r of d.ruang) {
          const pilihan = [...beban.entries()].filter(([id]) => !dipakai.has(id)).sort((a, b) => a[1] - b[1])[0];
          if (!pilihan) continue;
          baru[kunci(t, s, r.id)] = pilihan[0];
          dipakai.add(pilihan[0]);
          beban.set(pilihan[0], pilihan[1] + 1);
        }
      }
    }
    setIsi(baru);
    toast.success("Dibagi merata — periksa dan sesuaikan bila perlu, lalu Simpan.");
  }
  async function simpan(kabari: boolean) {
    if (!d) return;
    setSibuk(true);
    const baris = slot.map(x => ({ tanggal: x.t, sesi: x.s, ruangId: x.r.id, teacherId: isi[kunci(x.t, x.s, x.r.id)] ?? "" }));
    const r = await fetch("/api/ujian/pengawas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kegiatanId: d.kegiatanId, baris, kabari }) }).catch(() => null);
    const x = await r?.json().catch(() => null);
    setSibuk(false);
    if (!r?.ok) { toast.error(x?.error ?? "Gagal menyimpan."); return; }
    toast.success(kabari ? "Tersimpan & pengawas diberi tahu." : "Tersimpan.");
    muat(d.kegiatanId);
  }
  async function ubahMekanisme(v: string) {
    if (!d || v === d.mekanisme) return;
    const r = await fetch("/api/ujian/pengawas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kegiatanId: d.kegiatanId, mekanisme: v }) }).catch(() => null);
    if (!r?.ok) { toast.error("Gagal mengubah cara pelaksanaan."); return; }
    toast.success(v === "KELAS" ? "Kegiatan ini sekarang per kelas — pengawas otomatis guru mapel." : "Kegiatan ini sekarang per ruang.");
    muat(d.kegiatanId);
  }
  const bebanGuru = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of Object.values(isi)) if (v) m.set(v, (m.get(v) ?? 0) + 1);
    return m;
  }, [isi]);

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <style>{`@page { size: A4 landscape; margin: 1cm; }`}</style>
      <PageHeader icon={<UserCheck size={22} />} title="Pembagian Pengawas Ujian"
        description={d?.mekanisme === "KELAS" ? "Per kelas — jadwal tiap kelas, pengawas otomatis guru mapel (bisa diganti)" : "Tanggal × sesi × ruang — bagi otomatis merata, lalu sesuaikan"} printHidden />
      {galat ? <EmptyState icon={UserCheck} title="Tidak tersedia" description={galat} /> : !d ? (
        <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
      ) : d.kegiatan.length === 0 ? <EmptyState icon={UserCheck} title="Belum ada kegiatan ujian" description="Buat kegiatan ujian dulu di Administrasi Ujian." /> : (
        <>
          <div className="baris-alat mb-5 print:hidden">
            <div className="alat-saring"><Select value={d.kegiatanId} onChange={v => muat(v)} options={d.kegiatan.map(k => ({ value: k.id, label: `${k.singkatan} — ${k.nama} (${k._count.exams} ujian)` }))} /></div>
            <div className="alat-saring">
              <Select value={d.mekanisme} onChange={ubahMekanisme} options={[
                { value: "KELAS", label: "Per kelas — pengawas guru mapel" },
                { value: "RUANG", label: "Per ruang — pengawas per ruang × sesi" },
              ]} />
            </div>
            {d.mekanisme !== "KELAS" && (
              <>
                <div className="alat-saring"><DatePicker value={tambah} onChange={v => { if (v) { setTanggal(t => [...new Set([...t, v])].sort()); setTambah(""); } }} placeholder="Tambah tanggal" /></div>
                <div className="alat-aksi">
                  <button type="button" onClick={bagiOtomatis} className="btn-modal-cancel btn-teks"><Shuffle /> Bagi Otomatis</button>
                  <PrintButton />
                  <button type="button" disabled={sibuk} onClick={() => simpan(false)} className="btn-modal-cancel">{sibuk ? <Loader2 className="animate-spin" /> : <Save />} Simpan</button>
                  <button type="button" disabled={sibuk} onClick={() => simpan(true)} className="btn-modal-save"><UserCheck /> Simpan & Kabari</button>
                </div>
              </>
            )}
          </div>
          {d.mekanisme === "KELAS" ? (
            <PengawasKelasPanel kegiatanId={d.kegiatanId} baris={d.perKelas} guru={d.guru} onTersimpan={() => muat(d.kegiatanId)} />
          ) : d.ruang.length === 0 ? (
            <div className="panel pb-6">
              {(d.kegiatan.find(k => k.id === d.kegiatanId)?._count.exams ?? 0) === 0 ? (
                <EmptyState icon={UserCheck} title="Belum ada ujian di kegiatan ini"
                  description="Pilih kegiatan lain di kotak kiri atas, atau buat ujian yang memakai kegiatan ini lebih dulu." />
              ) : (
                <EmptyState icon={UserCheck} title="Ruang ujian belum dibagi"
                  description="Kegiatan ini diatur per ruang: bagikan peserta ke ruang dulu di Denah Ruang — daftar ruang di sini mengikuti pembagian itu. Bila siswa ujian di kelasnya masing-masing, jadikan kegiatan ini per kelas: pengawasnya otomatis guru mapel." />
              )}
              <div className="flex flex-wrap justify-center gap-2">
                <Link href="/pusat-ujian/administrasi/ruang" className="btn-modal-cancel"><LayoutGrid /> Buka Denah Ruang</Link>
                <button type="button" onClick={() => ubahMekanisme("KELAS")} className="btn-modal-save"><School /> Jadikan Per Kelas</button>
              </div>
            </div>
          ) : (
            <div className="print-doc bg-white panel overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Tanggal</th><th>Sesi</th>{d.ruang.map(r => <th key={r.id}>{r.nama}</th>)}</tr></thead>
                <tbody>
                  {tanggal.map(t => (d.sesi.length ? d.sesi : [1]).map(s => (
                    <tr key={`${t}-${s}`}>
                      <td className="whitespace-nowrap text-xs">{new Date(t).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}</td>
                      <td className="angka text-center">{s}</td>
                      {d.ruang.map(r => (
                        <td key={r.id} className="min-w-[10rem]">
                          <span className="hidden print:inline text-xs">{d.guru.find(g => g.id === isi[kunci(t, s, r.id)])?.nama ?? "—"}</span>
                          <span className="print:hidden">
                            <Select value={isi[kunci(t, s, r.id)] ?? ""} onChange={v => setIsi(p => ({ ...p, [kunci(t, s, r.id)]: v }))} placeholder="—"
                              options={[{ value: "", label: "— kosong —" }, ...d.guru.map(g => ({ value: g.id, label: `${g.nama}${bebanGuru.get(g.id) ? ` (${bebanGuru.get(g.id)})` : ""}` }))]} />
                          </span>
                        </td>
                      ))}
                    </tr>
                  )))}
                </tbody>
              </table>
              {tanggal.length === 0 && <p className="px-4 py-8 text-center text-sm text-gray-500">Tambahkan tanggal pelaksanaan dulu (kegiatan ini belum punya rentang tanggal).</p>}
            </div>
          )}
          {d.mekanisme !== "KELAS" && <p className="mt-3 text-xs text-gray-500 print:hidden">Pembagian otomatis memastikan satu guru tidak mengawasi dua ruang pada sesi yang sama dan beban tersebar merata. Angka di kurung = jumlah sesi guru itu.</p>}
        </>
      )}
    </div>
  );
}
