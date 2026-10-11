"use client";
import { useCallback, useEffect, useState } from "react";
import { CalendarRange, Loader2, Plus, Printer, Save, Trash2, Upload } from "lucide-react";
import Modal from "@/components/admin/Modal";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import EmptyState from "@/components/admin/EmptyState";
import PrintButton from "@/components/shared/PrintButton";
import { useToast } from "@/components/shared/ToastProvider";

interface Item { materi: string; jp: number; pekanMulai: number | null; pekanSelesai: number | null; catatan: string | null }
interface Data {
  tahun: { id: string; name: string; isActive: boolean }[]; tahunAjaranId: string; semester: string; subject: string; tingkat: number;
  mapel: string[]; tingkatTersedia: number[]; rentang: { nama: string; mulai: string; selesai: string } | null;
  pekan: { bulan: { bulan: string; label: string; pekan: number; efektif: number; sebagian: number; libur: number }[]; totalEfektif: number };
  rencana: { items: Item[]; catatan: string | null } | null;
}

/** PROTA/PROMES & PEKAN EFEKTIF (18 Sep 2026) — pekan efektif dihitung dari Kalender Pendidikan, guru tinggal mengalokasikan JP. */
export default function RencanaAjarManager() {
  const toast = useToast();
  const [d, setD] = useState<Data | null>(null);
  const [galat, setGalat] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [catatan, setCatatan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  // Impor dari berkas Word/Excel guru (10 Okt 2026): dibaca server, DITINJAU di sini, baru disimpan lewat tombol Simpan.
  const [impor, setImpor] = useState<{ butir: Item[]; cara: string; kolomMateri?: string; catatan: string[]; nama: string } | null>(null);
  const [membaca, setMembaca] = useState(false);
  async function bacaBerkas(file: File | null) {
    if (!file) return;
    const fd = new FormData(); fd.set("file", file);
    setMembaca(true);
    const r = await fetch("/api/teacher/rencana-ajar/impor", { method: "POST", body: fd }).catch(() => null);
    const x = await r?.json().catch(() => null);
    setMembaca(false);
    if (!r?.ok || !x?.butir) { toast.error(x?.error ?? "Berkas gagal dibaca."); return; }
    setImpor({ ...x, nama: file.name });
  }
  function pakaiImpor(ganti: boolean) {
    if (!impor) return;
    setItems(i => (ganti ? impor.butir : [...i.filter(x => x.materi.trim()), ...impor.butir]));
    toast.success(`${impor.butir.length} materi dimasukkan. Periksa JP & pekannya, lalu tekan Simpan.`);
    setImpor(null);
  }
  const muat = useCallback((q: Partial<{ tahunAjaranId: string; semester: string; subject: string; tingkat: number }> = {}) => {
    const p = new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)]));
    fetch(`/api/teacher/rencana-ajar?${p}`, { cache: "no-store" }).then(async r => {
      const x = await r.json().catch(() => null);
      if (!r.ok) { setGalat(x?.error ?? "Gagal memuat."); return; }
      setD(x); setItems(x.rencana?.items ?? []); setCatatan(x.rencana?.catatan ?? "");
    }).catch(() => setGalat("Gagal memuat."));
  }, []);
  useEffect(() => { muat(); }, [muat]);
  const ganti = (q: Partial<{ tahunAjaranId: string; semester: string; subject: string; tingkat: number }>) =>
    muat({ tahunAjaranId: d?.tahunAjaranId, semester: d?.semester, subject: d?.subject, tingkat: d?.tingkat, ...q });
  async function simpan() {
    if (!d?.rentang) return;
    setSibuk(true);
    const r = await fetch("/api/teacher/rencana-ajar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject: d.subject, tingkat: d.tingkat, tahunAjaran: d.rentang.nama, semester: d.semester, items, catatan }) }).catch(() => null);
    const x = await r?.json().catch(() => null);
    setSibuk(false);
    if (!r?.ok) { toast.error(x?.error ?? "Gagal menyimpan."); return; }
    toast.success("Program tersimpan.");
  }
  const totalJp = items.reduce((t, i) => t + (Number(i.jp) || 0), 0);
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <style>{`@page { size: A4; margin: 1.2cm; }`}</style>
      <PageHeader icon={<CalendarRange size={22} />} title="Prota, Promes & Pekan Efektif" description="Pekan efektif dihitung otomatis dari Kalender Pendidikan — tinggal atur materi dan alokasi jam" printHidden />
      {galat ? <EmptyState icon={CalendarRange} title="Tidak tersedia" description={galat} /> : !d ? (
        <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
      ) : d.mapel.length === 0 ? <EmptyState icon={CalendarRange} title="Belum ada pembagian mengajar" description="Program tahunan disusun dari mapel yang Anda ampu — hubungi Wakil Kepala Kurikulum." /> : (
        <>
          <div className="baris-alat mb-5 print:hidden">
            <div className="alat-saring"><Select value={d.tahunAjaranId} onChange={v => ganti({ tahunAjaranId: v })} options={d.tahun.map(t => ({ value: t.id, label: `${t.name}${t.isActive ? " (aktif)" : ""}` }))} /></div>
            <div className="alat-saring"><Select value={d.semester} onChange={v => ganti({ semester: v })} options={[{ value: "GANJIL", label: "Semester Ganjil" }, { value: "GENAP", label: "Semester Genap" }]} /></div>
            <div className="alat-saring"><Select value={d.subject} onChange={v => ganti({ subject: v })} options={d.mapel.map(m => ({ value: m, label: m }))} /></div>
            <div className="alat-saring"><Select value={String(d.tingkat)} onChange={v => ganti({ tingkat: Number(v) })} options={(d.tingkatTersedia.length ? d.tingkatTersedia : [10, 11, 12]).map(t => ({ value: String(t), label: `Kelas ${t}` }))} /></div>
            <div className="alat-aksi">
              <PrintButton />
              <button type="button" disabled={sibuk} onClick={simpan} className="btn-modal-save">{sibuk ? <Loader2 className="animate-spin" /> : <Save />} Simpan</button>
            </div>
          </div>
          <div className="print-doc bg-white space-y-5">
            <div className="panel p-5">
              <p className="label-kecil mb-3">Pekan efektif {d.semester === "GENAP" ? "Semester Genap" : "Semester Ganjil"} {d.rentang?.nama}</p>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr><th>Bulan</th><th className="text-center">Jumlah pekan</th><th className="text-center">Efektif penuh</th><th className="text-center">Sebagian</th><th className="text-center">Libur</th></tr></thead>
                  <tbody>
                    {d.pekan.bulan.map(b => (
                      <tr key={b.bulan}><td>{b.label}</td><td className="angka text-center">{b.pekan}</td><td className="angka text-center">{b.efektif}</td><td className="angka text-center">{b.sebagian}</td><td className="angka text-center">{b.libur}</td></tr>
                    ))}
                    <tr className="font-semibold"><td>Jumlah</td><td className="angka text-center">{d.pekan.bulan.reduce((t, b) => t + b.pekan, 0)}</td><td className="angka text-center" colSpan={3}>{d.pekan.totalEfektif} pekan bisa dipakai KBM</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-gray-500">&ldquo;Sebagian&rdquo; = pekan yang sebagian harinya libur (masih bisa dipakai KBM). Sumber: Kalender Pendidikan & hari libur nasional.</p>
            </div>
            <div className="panel p-5">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <p className="label-kecil">Program semester — {d.subject} kelas {d.tingkat}</p>
                <span className="text-xs text-gray-500">total {totalJp} JP</span>
                <label className={`btn-modal-cancel btn-teks ml-auto cursor-pointer px-3 text-xs print:hidden ${membaca ? "pointer-events-none opacity-60" : ""}`}>
                  {membaca ? <Loader2 className="animate-spin" /> : <Upload />} Impor dari Word / Excel
                  <input type="file" accept=".docx,.xlsx,.xls" className="sr-only" onChange={e => { void bacaBerkas(e.target.files?.[0] ?? null); e.target.value = ""; }} />
                </label>
                <button type="button" onClick={() => setItems(i => [...i, { materi: "", jp: 2, pekanMulai: null, pekanSelesai: null, catatan: null }])} className="btn-modal-cancel px-3 text-xs print:hidden"><Plus /> Tambah Materi</button>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr><th>#</th><th>Materi / tujuan pembelajaran</th><th className="text-center">JP</th><th className="text-center">Pekan</th><th>Catatan</th><th className="print:hidden" /></tr></thead>
                  <tbody>
                    {items.map((it, i) => (
                      <tr key={i}>
                        <td className="angka text-gray-500">{i + 1}</td>
                        <td className="min-w-[14rem]">
                          <span className="hidden print:inline">{it.materi}</span>
                          <input aria-label={`Materi ${i + 1}`} className="input-field print:hidden" maxLength={300} value={it.materi} onChange={e => setItems(a => a.map((x, j) => (j === i ? { ...x, materi: e.target.value } : x)))} />
                        </td>
                        <td className="text-center">
                          <span className="hidden print:inline">{it.jp}</span>
                          <input aria-label={`JP ${i + 1}`} type="number" min={0} className="input-field w-20 print:hidden" value={it.jp} onChange={e => setItems(a => a.map((x, j) => (j === i ? { ...x, jp: Number(e.target.value) || 0 } : x)))} />
                        </td>
                        <td className="whitespace-nowrap text-center text-xs">
                          <span className="hidden print:inline">{it.pekanMulai ?? "-"}–{it.pekanSelesai ?? "-"}</span>
                          <span className="print:hidden inline-flex gap-1">
                            <input aria-label={`Pekan mulai ${i + 1}`} type="number" min={1} className="input-field w-16" value={it.pekanMulai ?? ""} onChange={e => setItems(a => a.map((x, j) => (j === i ? { ...x, pekanMulai: Number(e.target.value) || null } : x)))} />
                            <input aria-label={`Pekan selesai ${i + 1}`} type="number" min={1} className="input-field w-16" value={it.pekanSelesai ?? ""} onChange={e => setItems(a => a.map((x, j) => (j === i ? { ...x, pekanSelesai: Number(e.target.value) || null } : x)))} />
                          </span>
                        </td>
                        <td className="min-w-[8rem]">
                          <span className="hidden print:inline">{it.catatan ?? ""}</span>
                          <input aria-label={`Catatan ${i + 1}`} className="input-field print:hidden" maxLength={300} value={it.catatan ?? ""} onChange={e => setItems(a => a.map((x, j) => (j === i ? { ...x, catatan: e.target.value } : x)))} />
                        </td>
                        <td className="text-right print:hidden"><button type="button" title="Hapus" onClick={() => setItems(a => a.filter((_, j) => j !== i))} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"><Trash2 size={14} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {items.length === 0 && <p className="px-4 py-8 text-center text-sm text-gray-500">Belum ada materi — tekan &ldquo;Tambah Materi&rdquo;.</p>}
              </div>
              <div className="mt-3">
                <span className="hidden print:inline text-sm">{catatan}</span>
                <textarea aria-label="Catatan program" rows={2} maxLength={1000} className="input-field print:hidden" value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="Catatan (mis. cadangan pekan untuk remedial/ujian)" />
              </div>
            </div>
          </div>
        </>
      )}
      <Modal open={!!impor} onClose={() => setImpor(null)} size="xl" scrollBody title="Tinjau Hasil Impor" description={impor ? `${impor.nama} · ${impor.butir.length} materi terbaca${impor.kolomMateri ? ` dari kolom "${impor.kolomMateri}"` : ""}` : undefined}
        footer={<>
          <button type="button" onClick={() => setImpor(null)} className="btn-modal-cancel">Batal</button>
          {items.some(x => x.materi.trim()) && <button type="button" onClick={() => pakaiImpor(false)} className="btn-modal-cancel">Tambahkan di bawah yang ada</button>}
          <button type="button" onClick={() => pakaiImpor(true)} className="btn-modal-save">{items.some(x => x.materi.trim()) ? "Ganti semua materi" : "Pakai hasil ini"}</button>
        </>}>
        {impor && (
          <div className="space-y-3">
            {impor.catatan.map((c, i) => <p key={i} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{c}</p>)}
            <p className="text-sm text-gray-600">Hasil bacaan belum disimpan. Setelah dipakai, materi, JP, dan pekannya masih bisa diubah di tabel, lalu tekan <b>Simpan</b>.</p>
            <div className="max-h-[50vh] overflow-auto rounded-xl border border-gray-100">
              <table className="data-table">
                <thead><tr><th className="w-10">No</th><th>Materi / tujuan pembelajaran</th><th className="text-right">JP</th><th className="text-center">Pekan</th></tr></thead>
                <tbody>
                  {impor.butir.map((b, i) => (
                    <tr key={i}><td className="angka text-gray-400">{i + 1}</td><td>{b.materi}</td><td className="angka text-right">{b.jp || "—"}</td><td className="angka text-center">{b.pekanMulai ? `${b.pekanMulai}${b.pekanSelesai && b.pekanSelesai !== b.pekanMulai ? `–${b.pekanSelesai}` : ""}` : "—"}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
