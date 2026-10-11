"use client";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { DoorOpen, Loader2, Save, Search } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import Select from "@/components/admin/Select";
import { BarisKembali } from "@/components/shared/TombolKembali";
import { useToast } from "@/components/shared/ToastProvider";

interface Baris { classId: string; mapel: string; jam: number; ruang: string }
interface Data { ruang: string[]; kelas: { id: string; nama: string; tingkat: number; jurusan: string }[]; baris: Baris[] }
const kunci = (b: { classId: string; mapel: string }) => `${b.classId}|${b.mapel}`;

/** RUANG PER MAPEL — isi ruang sekali per kelas × mapel; berlaku untuk semua jam mapel itu di kelas tersebut. */
export default function RuangJadwalManager({ kembaliHref }: { kembaliHref: string }) {
  const toast = useToast(), idDaftar = useId();
  const [d, setD] = useState<Data | null>(null);
  const [galat, setGalat] = useState("");
  const [ubah, setUbah] = useState<Record<string, string>>({});
  const [cari, setCari] = useState("");
  const [jurusan, setJurusan] = useState("");
  const [hanyaKosong, setHanyaKosong] = useState(false);
  const [massal, setMassal] = useState("");
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(() => {
    fetch("/api/admin/schedules/ruang", { cache: "no-store" }).then(async r => { const j = await r.json().catch(() => null); if (!r.ok || !j) setGalat(j?.error ?? "Gagal memuat."); else { setD(j); setUbah({}); } })
      .catch(() => setGalat("Gagal memuat."));
  }, []);
  useEffect(() => { muat(); }, [muat]);

  const kelas = useMemo(() => new Map((d?.kelas ?? []).map(k => [k.id, k])), [d]);
  const nilai = (b: Baris) => ubah[kunci(b)] ?? b.ruang;
  const tampil = useMemo(() => (d?.baris ?? []).filter(b => {
    const k = kelas.get(b.classId);
    if (!k) return false;
    if (jurusan && k.jurusan !== jurusan) return false;
    if (hanyaKosong && (ubah[kunci(b)] ?? b.ruang)) return false;
    return !cari || `${b.mapel} ${k.nama}`.toLowerCase().includes(cari.toLowerCase());
  }).sort((a, b) => a.mapel.localeCompare(b.mapel) || (kelas.get(a.classId)?.nama ?? "").localeCompare(kelas.get(b.classId)?.nama ?? "", "id", { numeric: true })), [d, kelas, jurusan, hanyaKosong, cari, ubah]);

  async function simpan() {
    if (!d) return;
    const isi = d.baris.filter(b => ubah[kunci(b)] !== undefined && ubah[kunci(b)] !== b.ruang).map(b => ({ classId: b.classId, mapel: b.mapel, ruang: ubah[kunci(b)].trim() }));
    if (!isi.length) { toast.info("Belum ada yang diubah."); return; }
    setSibuk(true);
    const r = await fetch("/api/admin/schedules/ruang", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isi }) }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setSibuk(false);
    if (!r?.ok) { toast.error(j?.error ?? "Gagal menyimpan."); return; }
    toast.success(`Ruang ${j.kelasMapel} kelas-mapel tersimpan (${j.jam} jam jadwal).`); muat();
  }

  const judul = <PageHeader icon={<DoorOpen size={22} />} title="Ruang per Mapel" description="Isi ruang sekali per kelas dan mapel — berlaku untuk semua jamnya di jadwal" />;
  if (!d) return <div className="p-6 lg:p-8 pt-16 lg:pt-8">{judul}<BarisKembali href={kembaliHref} /><div className="flex min-h-[40vh] items-center justify-center text-gray-400">{galat ? <p className="text-sm">{galat}</p> : <Loader2 size={24} className="animate-spin" />}</div></div>;
  const terisi = d.baris.filter(b => nilai(b)).length, berubah = d.baris.filter(b => ubah[kunci(b)] !== undefined && ubah[kunci(b)] !== b.ruang).length;
  const daftarJurusan = [...new Set(d.kelas.map(k => k.jurusan).filter(Boolean))].sort();
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      {judul}
      <BarisKembali href={kembaliHref} />
      <div className="space-y-6">
        <div className="kisi-kartu kisi-kartu-3">
          <StatTile value={d.baris.length} label="Kelas × mapel di jadwal" ikon="jurnal" color="primary" />
          <StatTile value={terisi} label="Sudah punya ruang" ikon="centang" color="emerald" />
          <StatTile value={d.baris.length - terisi} label="Belum diisi" ikon="waspada" color="amber" sorot={d.baris.length - terisi > 0} />
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Ruang dipakai papan TV lab (siapa yang sedang memakai lab), pemeriksa bentrok saat memesan ruang, dan kolom ruang di jadwal. Mapel yang berlangsung di kelasnya sendiri boleh dibiarkan kosong — cukup isi yang memakai <b>lab, bengkel, aula, atau lapangan</b>.
        </div>
        <div className="baris-alat">
          <div className="alat-cari"><Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" /><input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari mapel atau kelas…" className="input-field pl-10" /></div>
          <div className="alat-saring w-44"><Select value={jurusan} onChange={setJurusan} options={[{ value: "", label: "Semua jurusan" }, ...daftarJurusan.map(j => ({ value: j, label: j }))]} /></div>
          <label className="alat-saring flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" checked={hanyaKosong} onChange={e => setHanyaKosong(e.target.checked)} className="h-4 w-4 rounded border-gray-300" /> Hanya yang kosong</label>
          <div className="alat-aksi"><button type="button" onClick={simpan} disabled={sibuk || !berubah} className="btn-modal-save">{sibuk ? <Loader2 className="animate-spin" /> : <Save />} Simpan{berubah ? ` (${berubah})` : ""}</button></div>
        </div>
        <div className="panel flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-0 flex-1"><label className="label-field" htmlFor="rj-massal">Isi sekaligus untuk <b className="angka">{tampil.length}</b> baris yang sedang tampil</label>
            <input id="rj-massal" list={idDaftar} value={massal} onChange={e => setMassal(e.target.value)} maxLength={60} placeholder="mis. Lab TKJ — saring dulu mapel/jurusannya" className="input-field" /></div>
          <button type="button" disabled={!massal.trim() || !tampil.length} onClick={() => { setUbah(u => ({ ...u, ...Object.fromEntries(tampil.map(b => [kunci(b), massal.trim()])) })); setMassal(""); }} className="btn-modal-cancel btn-teks">Terapkan ke yang tampil</button>
        </div>
        <datalist id={idDaftar}>{d.ruang.map(r => <option key={r} value={r} />)}</datalist>
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th className="w-10">No</th><th>Mapel</th><th>Kelas</th><th className="text-right">Jam di jadwal</th><th>Ruang</th></tr></thead>
              <tbody>
                {tampil.map((b, i) => {
                  const v = nilai(b), diubah = ubah[kunci(b)] !== undefined && ubah[kunci(b)] !== b.ruang;
                  return (
                    <tr key={kunci(b)}>
                      <td className="angka text-gray-400">{i + 1}</td>
                      <td className="font-medium text-primary-900">{b.mapel}</td>
                      <td>{kelas.get(b.classId)?.nama}</td>
                      <td className="angka text-right text-gray-600">{b.jam}</td>
                      <td><input list={idDaftar} value={v === "(campuran)" ? "" : v} maxLength={60} aria-label={`Ruang ${b.mapel} ${kelas.get(b.classId)?.nama ?? ""}`}
                        placeholder={v === "(campuran)" ? "berbeda-beda per jam — ketik untuk menyamakan" : "di kelasnya sendiri"}
                        onChange={e => setUbah(u => ({ ...u, [kunci(b)]: e.target.value }))} className={`input-field min-w-[12rem] ${diubah ? "border-amber-300 bg-amber-50" : ""}`} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {tampil.length === 0 && <p className="py-10 text-center text-sm text-gray-400">Tidak ada baris yang cocok dengan saringan.</p>}
        </div>
      </div>
    </div>
  );
}
