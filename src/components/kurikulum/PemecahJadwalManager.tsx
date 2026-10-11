"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Puzzle, Sparkles, Check } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import Select from "@/components/admin/Select";
import DatePicker from "@/components/shared/DatePicker";
import { BarisKembali } from "@/components/shared/TombolKembali";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";

interface Sisi { kelas: string; mapel: string; minggu: string; tetap: boolean }
interface Keadaan { kurang: { id: string; kelas: string; mapel: string; guru: string; kurang: number }[]; bentrok: { kunci: string; guru: string; hari: string; jam: string; a: Sisi; b: Sisi }[]; selTotal: number; terkunci: boolean }
interface Langkah { jenis: "BARU" | "PINDAH"; kelas: string; mapel: string; guru: string; dari: string | null; ke: string; data: unknown }
interface Usulan { langkah: Langkah[]; gagal: string[]; teruraikan: number; sisaBentrok: number; bentrokSesudah: number; sah: boolean }
interface Pengganti {
  tanggal: string; hari: string; guru: { id: string; nama: string }[]; berhalangan: { id: string; nama: string; alasan: string }[];
  blok: { teacherId: string; guru: string; kelas: string; mapel: string; mulai: string; selesai: string; jam: number; calon: number; usulan: { nama: string; alasan: string } | null; lainnya: { id: string; nama: string; alasan: string }[] }[];
}
const mg = (w: string) => (w === "SEMUA" ? "tiap minggu" : `minggu ${w === "A" ? 1 : 2}`);
const hariIni = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

/** PEMECAH JADWAL — mengusulkan cara memasukkan jam yang belum terjadwal dan mengurai bentrok guru dengan MENGGESER
 *  pelajaran lain (rantai geser), serta menyarankan guru pengganti. Semua berupa usulan: jadwal baru berubah saat
 *  "Terapkan" ditekan, dan server memeriksa ulang sebelum menulis. */
export default function PemecahJadwalManager({ kembaliHref }: { kembaliHref: string }) {
  const toast = useToast(), confirm = useConfirm();
  const [tab, setTab] = useState<"jadwal" | "pengganti">("jadwal");
  const [d, setD] = useState<Keadaan | null>(null);
  const [galat, setGalat] = useState("");
  const [pilih, setPilih] = useState<Set<string>>(new Set());
  const [usul, setUsul] = useState<Usulan | null>(null);
  const [sibuk, setSibuk] = useState("");
  const [tanggal, setTanggal] = useState(hariIni());
  const [tambahan, setTambahan] = useState<string[]>([]);
  const [p, setP] = useState<Pengganti | null>(null);

  const muat = useCallback(() => {
    fetch("/api/admin/schedules/pemecah", { cache: "no-store" }).then(async r => { const j = await r.json().catch(() => null); if (!r.ok || !j) setGalat(j?.error ?? "Gagal memuat."); else { setD(j); setPilih(new Set()); } }).catch(() => setGalat("Gagal memuat."));
  }, []);
  useEffect(() => { muat(); }, [muat]);
  useEffect(() => {
    if (tab !== "pengganti") return;
    setP(null);
    fetch(`/api/admin/schedules/pengganti?tanggal=${tanggal}&guru=${tambahan.join(",")}`, { cache: "no-store" }).then(r => (r.ok ? r.json() : null)).then(j => setP(j)).catch(() => {});
  }, [tab, tanggal, tambahan]);

  async function susun(isiKurang: boolean, bentrok: string[] | "semua" | null) {
    setSibuk("susun"); setUsul(null);
    const r = await fetch("/api/admin/schedules/pemecah", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aksi: "usul", isiKurang, bentrok }) }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setSibuk("");
    if (!r?.ok || !j) { toast.error(j?.error ?? "Gagal menyusun usulan."); return; }
    setUsul(j);
    if (!j.langkah.length) toast.info("Tidak ada langkah yang bisa diusulkan.");
  }
  async function terapkan() {
    if (!usul || !(await confirm(`Terapkan ${usul.langkah.length} langkah ini ke Jadwal Pelajaran? Jadwal kelas yang disebut akan berubah.`))) return;
    setSibuk("terap");
    const r = await fetch("/api/admin/schedules/pemecah", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aksi: "terapkan", langkah: usul.langkah.map(l => l.data) }) }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setSibuk("");
    if (!r?.ok) { toast.error(j?.error ?? "Gagal menerapkan."); return; }
    toast.success(`Diterapkan: ${j.dibuat} jam baru, ${j.diubah} jam dipindah.`); setUsul(null); muat();
  }

  const perGuru = useMemo(() => { const m = new Map<string, Keadaan["bentrok"]>(); for (const b of d?.bentrok ?? []) m.set(b.guru, [...(m.get(b.guru) ?? []), b]); return [...m.entries()].sort((a, b) => b[1].length - a[1].length); }, [d]);
  const judul = <PageHeader icon={<Puzzle size={22} />} title="Pemecah Jadwal" description="Usulan memasukkan jam yang belum terjadwal, mengurai bentrok guru, dan guru pengganti" />;
  if (!d) return <div className="p-6 lg:p-8 pt-16 lg:pt-8">{judul}<BarisKembali href={kembaliHref} /><div className="flex min-h-[40vh] items-center justify-center text-gray-400">{galat ? <p className="text-sm">{galat}</p> : <Loader2 size={24} className="animate-spin" />}</div></div>;
  const jamKurang = d.kurang.reduce((n, k) => n + k.kurang, 0);
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      {judul}
      <BarisKembali href={kembaliHref} />
      <div className="space-y-6">
        <div className="kisi-kartu kisi-kartu-3">
          <StatTile value={jamKurang} label="Jam belum terjadwal" ikon="waspada" color={jamKurang ? "amber" : "emerald"} sorot={jamKurang > 0} />
          <StatTile value={d.bentrok.length} label="Bentrok guru (di luar rangkap yang diizinkan)" ikon="alpha" color={d.bentrok.length ? "red" : "emerald"} />
          <StatTile value={d.selTotal} label="Jam pelajaran di jadwal" ikon="jurnal" color="primary" />
        </div>
        <div className="baris-alat">
          <div className="alat-tab flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-gray-100 bg-white p-1 scrollbar-hide">
            {([["jadwal", "Jadwal"], ["pengganti", "Guru Pengganti"]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setTab(k)} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition ${tab === k ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>{l}</button>)}
          </div>
        </div>

        {tab === "jadwal" && <>
          {d.terkunci && <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Jadwal sedang <b>dikunci</b>. Usulan tetap bisa disusun dan ditinjau, tetapi baru bisa diterapkan setelah kuncinya dibuka di halaman Jadwal Pelajaran.</p>}
          <section className="panel overflow-hidden">
            <div className="panel-kepala"><p className="panel-judul">Jam yang belum terjadwal</p>
              {d.kurang.length > 0 && <button type="button" disabled={!!sibuk} onClick={() => susun(true, null)} className="btn-modal-save btn-teks px-3 text-xs">{sibuk === "susun" ? <Loader2 className="animate-spin" /> : <Sparkles />} Carikan tempat</button>}</div>
            {d.kurang.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">Semua penugasan mengajar sudah mendapat jam sesuai jatahnya.</p> : (
              <div className="overflow-x-auto"><table className="data-table">
                <thead><tr><th className="w-10">No</th><th>Kelas</th><th>Mapel</th><th>Guru</th><th className="text-right">Kurang</th></tr></thead>
                <tbody>{d.kurang.map((k, i) => <tr key={k.id}><td className="angka text-gray-400">{i + 1}</td><td className="font-medium text-primary-900">{k.kelas}</td><td>{k.mapel}</td><td>{k.guru}</td><td className="angka text-right">{k.kurang} jam</td></tr>)}</tbody>
              </table></div>
            )}
          </section>

          <section className="panel overflow-hidden">
            <div className="panel-kepala"><p className="panel-judul">Bentrok guru <span className="angka ml-1 text-xs font-normal text-gray-400">{d.bentrok.length}</span></p>
              {d.bentrok.length > 0 && <div className="flex flex-wrap gap-1.5">
                <button type="button" disabled={!!sibuk || pilih.size === 0} onClick={() => susun(false, [...pilih])} className="btn-modal-cancel btn-teks px-3 text-xs">Uraikan yang dipilih ({pilih.size})</button>
                <button type="button" disabled={!!sibuk} onClick={() => susun(false, "semua")} className="btn-modal-save btn-teks px-3 text-xs">{sibuk === "susun" ? <Loader2 className="animate-spin" /> : <Sparkles />} Uraikan semua</button>
              </div>}</div>
            {d.bentrok.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">Tidak ada guru yang dijadwalkan di dua kelas pada jam yang sama.</p> : (
              <div className="divide-y divide-gray-100">
                <p className="px-4 py-3 text-xs text-gray-500 sm:px-5">Satu guru di dua kelas pada jam yang sama. Rangkap yang memang diizinkan per mapel (mis. PJOK dua kelas) tidak dihitung. Sebagian bentrok dengan kelas XII bisa jadi disengaja selama mereka PKL — pilih saja yang memang ingin diurai.</p>
                {perGuru.map(([guru, daftar]) => (
                  <details key={guru} className="px-4 py-3 sm:px-5">
                    <summary className="cursor-pointer text-sm font-semibold text-primary-900">{guru} <span className="angka ml-1 text-xs font-normal text-gray-400">{daftar.length} jam</span></summary>
                    <ul className="mt-2 space-y-1.5">
                      {daftar.map(b => (
                        <li key={b.kunci}><label className="flex items-start gap-2 text-sm text-gray-700">
                          <input type="checkbox" checked={pilih.has(b.kunci)} onChange={e => setPilih(s => { const n = new Set(s); if (e.target.checked) n.add(b.kunci); else n.delete(b.kunci); return n; })} className="mt-0.5 h-4 w-4 rounded border-gray-300" />
                          <span><b className="angka">{b.hari} {b.jam}</b> — {b.a.kelas} {b.a.mapel} <span className="text-xs text-gray-400">({mg(b.a.minggu)})</span> × {b.b.kelas} {b.b.mapel} <span className="text-xs text-gray-400">({mg(b.b.minggu)})</span>{b.a.tetap && b.b.tetap && <span className="ml-1 text-xs text-amber-700">keduanya dipatok preferensi</span>}</span>
                        </label></li>
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
            )}
          </section>

          {usul && (
            <section className="panel overflow-hidden">
              <div className="panel-kepala"><p className="panel-judul">Usulan <span className="angka ml-1 text-xs font-normal text-gray-400">{usul.langkah.length} langkah</span></p>
                {usul.langkah.length > 0 && usul.sah && <button type="button" disabled={!!sibuk || d.terkunci} onClick={terapkan} className="btn-awas btn-teks px-3 text-xs">{sibuk === "terap" ? <Loader2 className="animate-spin" /> : <Check />} Terapkan ke Jadwal</button>}</div>
              <div className="panel-isi space-y-3">
                <p className="text-sm text-gray-700">
                  {usul.langkah.filter(l => l.jenis === "BARU").length} jam baru dimasukkan, {usul.langkah.filter(l => l.jenis === "PINDAH").length} jam dipindah.
                  {usul.teruraikan > 0 && <> {usul.teruraikan} bentrok terurai{usul.sisaBentrok ? `, ${usul.sisaBentrok} tidak menemukan jalan` : ""}; bentrok tersisa setelah usulan ini: <b className="angka">{usul.bentrokSesudah}</b>.</>}
                </p>
                {!usul.sah && <p className="error-msg">Pemeriksaan mandiri gagal — usulan ini tidak bisa diterapkan. Susun ulang.</p>}
                {usul.gagal.map(g => <p key={g} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{g}</p>)}
              </div>
              {usul.langkah.length > 0 && <div className="overflow-x-auto"><table className="data-table">
                <thead><tr><th className="w-10">No</th><th>Langkah</th><th>Kelas</th><th>Mapel</th><th>Guru</th><th>Dari</th><th>Ke</th></tr></thead>
                <tbody>{usul.langkah.map((l, i) => (
                  <tr key={i}><td className="angka text-gray-400">{i + 1}</td>
                    <td><span className={`status-badge ${l.jenis === "BARU" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>{l.jenis === "BARU" ? "Masukkan" : "Pindah"}</span></td>
                    <td className="font-medium text-primary-900">{l.kelas}</td><td>{l.mapel}</td><td className="text-sm text-gray-600">{l.guru}</td><td className="text-sm text-gray-500">{l.dari ?? "—"}</td><td className="text-sm font-medium text-primary-900">{l.ke}</td></tr>
                ))}</tbody>
              </table></div>}
            </section>
          )}
          <p className="text-xs text-gray-500">Cara kerjanya: untuk menaruh satu jam, pemecah boleh memindahkan pelajaran lain yang menghalangi — dan pelajaran itu boleh menggeser yang lain lagi, sampai dua tingkat. Jam yang dipatok lewat Preferensi Hari/Jam tidak pernah digeser. Jam yang dipindah bisa terlepas dari bloknya; tinjau daftar langkahnya sebelum menerapkan.</p>
        </>}

        {tab === "pengganti" && <>
          <div className="baris-alat items-end">
            <div className="alat-saring w-52"><label className="label-field">Tanggal</label><DatePicker value={tanggal} onChange={setTanggal} /></div>
            <div className="alat-saring w-72"><label className="label-field">Tambahkan guru yang tidak masuk</label>
              <Select value="" onChange={v => v && setTambahan(t => (t.includes(v) ? t : [...t, v]))} placeholder="Pilih guru…" options={(p?.guru ?? []).filter(g => !p?.berhalangan.some(b => b.id === g.id)).map(g => ({ value: g.id, label: g.nama }))} /></div>
            {tambahan.length > 0 && <button type="button" onClick={() => setTambahan([])} className="btn-modal-cancel btn-teks">Kosongkan pilihan</button>}
          </div>
          {!p ? <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div> : (
            <section className="panel overflow-hidden">
              <div className="panel-kepala"><p className="panel-judul">Jam yang perlu pengganti <span className="angka ml-1 text-xs font-normal text-gray-400">{p.blok.length}</span></p></div>
              <p className="px-4 pt-3 text-sm text-gray-600 sm:px-5">{p.berhalangan.length ? <>Tidak masuk: {p.berhalangan.map(b => b.nama).join(", ")}.</> : "Belum ada guru yang tercatat tidak masuk pada tanggal ini di Presensi Pegawai. Tambahkan lewat pilihan di atas."}</p>
              {p.blok.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">{p.berhalangan.length ? "Guru tersebut tidak punya jam mengajar pada hari ini." : "Tidak ada jam yang perlu pengganti."}</p> : (
                <div className="overflow-x-auto"><table className="data-table">
                  <thead><tr><th className="w-10">No</th><th>Jam</th><th>Kelas</th><th>Mapel</th><th>Guru tidak masuk</th><th>Usulan pengganti</th><th>Pilihan lain</th></tr></thead>
                  <tbody>{p.blok.map((b, i) => (
                    <tr key={`${b.teacherId}${b.kelas}${b.mulai}`}><td className="angka text-gray-400">{i + 1}</td><td className="angka whitespace-nowrap">{b.mulai}–{b.selesai}</td><td className="font-medium text-primary-900">{b.kelas}</td><td>{b.mapel}</td><td className="text-sm text-gray-600">{b.guru}</td>
                      <td>{b.usulan ? <><span className="font-medium text-primary-900">{b.usulan.nama}</span><span className="block text-xs text-gray-500">{b.usulan.alasan}</span></> : <span className="text-sm text-red-600">Tidak ada guru yang kosong di jam ini</span>}</td>
                      <td className="text-sm text-gray-600">{b.lainnya.map(x => x.nama).join("; ") || "—"}</td></tr>
                  ))}</tbody>
                </table></div>
              )}
              <p className="px-4 py-3 text-xs text-gray-500 sm:px-5">Usulan saja — tidak ada yang ditetapkan atau dikabari dari halaman ini. Urutannya: mengajar mapel yang sama, mengajar di kelas itu, sedang ada jam lain hari itu, lalu yang jamnya paling sedikit.</p>
            </section>
          )}
        </>}
      </div>
    </div>
  );
}
