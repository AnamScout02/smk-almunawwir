"use client";
import { useCallback, useEffect, useState } from "react";
import { Calculator, Loader2, Download, Search, Save, CheckCircle2, Scale, CircleAlert } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import Modal from "@/components/admin/Modal";
import Select from "@/components/admin/Select";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { predikatPkl } from "@/lib/pkl-label";

type Komponen = { kunci: string; label: string; ket: string };
type Baris = { id: string; nama: string; nis: string; kelas: string | null; tempat: string; status: string; komponen: Record<string, number | null>; akhir: number | null; kosong: string[]; lengkap: boolean; ditetapkan: number | null };
type Data = { bobot: Record<string, number>; baris: Baris[]; komponen: Komponen[] };

/** NILAI AKHIR PKL (9 Okt 2026) — lima komponen berbobot; bobot diatur panitia, nilai DITETAPKAN lewat tombol (sebelum itu
 *  hanya hitungan yang ikut berubah bila data bertambah). */
export default function NilaiPklManager() {
  const toast = useToast(), confirm = useConfirm();
  const [d, setD] = useState<Data | null>(null);
  const [cari, setCari] = useState("");
  const [kelas, setKelas] = useState("");
  const [atur, setAtur] = useState(false);
  const [bobot, setBobot] = useState<Record<string, string>>({});
  const [sibuk, setSibuk] = useState(false);
  const muat = useCallback(() => {
    fetch("/api/pkl/nilai").then(r => r.json()).then((x: Data & { error?: string }) => { if (x.error) toast.error(x.error); else { setD(x); setBobot(Object.fromEntries(Object.entries(x.bobot).map(([k, v]) => [k, String(v)]))); } }).catch(() => toast.error("Gagal memuat nilai."));
  }, [toast]);
  useEffect(() => { muat(); }, [muat]);

  if (!d) return <div className="p-6 lg:p-8 pt-16 lg:pt-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;
  const daftarKelas = [...new Set(d.baris.map(b => b.kelas).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, "id", { numeric: true }));
  const q = cari.trim().toLowerCase();
  const tampil = d.baris.filter(b => (!kelas || b.kelas === kelas) && (!q || `${b.nama} ${b.nis} ${b.tempat}`.toLowerCase().includes(q)));
  const jumlahBobot = d.komponen.reduce((a, k) => a + (Number(bobot[k.kunci]) || 0), 0);

  async function simpanBobot() {
    setSibuk(true);
    const r = await fetch("/api/pkl/nilai", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bobot: Object.fromEntries(Object.entries(bobot).map(([k, v]) => [k, Number(v) || 0])) }) }).catch(() => null);
    setSibuk(false);
    if (!r?.ok) { toast.error("Gagal menyimpan bobot."); return; }
    toast.success("Bobot tersimpan."); setAtur(false); muat();
  }
  async function tetapkan() {
    const kena = tampil.filter(b => b.akhir != null);
    if (!kena.length) { toast.error("Belum ada nilai yang bisa ditetapkan pada saringan ini."); return; }
    const belum = kena.filter(b => !b.lengkap).length;
    if (!(await confirm(`Tetapkan nilai akhir ${kena.length} siswa${kelas ? ` kelas ${kelas}` : ""}? Nilai hitungan disimpan sebagai nilai akhir PKL.${belum ? ` ${belum} di antaranya komponennya belum lengkap — dihitung dari komponen yang ada.` : ""} Bisa ditetapkan ulang kapan saja.`))) return;
    setSibuk(true);
    const r = await fetch("/api/pkl/nilai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: kena.map(b => b.id) }) }).catch(() => null);
    const j = await r?.json().catch(() => ({}));
    setSibuk(false);
    if (!r?.ok) { toast.error(j?.error ?? "Gagal menetapkan."); return; }
    toast.success(`Nilai akhir ${j.ditetapkan} siswa ditetapkan.`); muat();
  }
  const sel = (v: number | null) => (v == null ? <span className="text-gray-300">—</span> : v);
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Calculator size={22} />} title="Nilai Akhir PKL" description="Nilai berbobot dari penilaian industri, guru, jurnal, kehadiran, dan laporan akhir" />
      <div className="space-y-6">
        <div className="kisi-kartu kisi-kartu-4">
          <StatTile value={d.baris.length} label="Siswa ditempatkan" icon={Calculator} color="primary" />
          <StatTile value={d.baris.filter(b => b.lengkap).length} label="Komponen lengkap" icon={CheckCircle2} color="emerald" />
          <StatTile value={d.baris.filter(b => !b.lengkap).length} label="Komponen belum lengkap" icon={CircleAlert} color="amber" />
          <StatTile value={d.baris.filter(b => b.ditetapkan != null).length} label="Nilai sudah ditetapkan" icon={Save} color="blue" />
        </div>
        <div className="baris-alat">
          <div className="alat-cari"><Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" /><input className="input-field pl-10" value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari nama, NIS, atau tempat PKL" /></div>
          <div className="alat-saring"><Select value={kelas} onChange={setKelas} options={[{ value: "", label: "Semua kelas" }, ...daftarKelas.map(k => ({ value: k, label: k }))]} /></div>
          <div className="alat-aksi">
            <button type="button" className="btn-modal-cancel btn-teks" onClick={() => setAtur(true)}><Scale size={16} /> Atur Bobot</button>
            <a href="/api/pkl/nilai?excel=1" className="btn-modal-cancel"><Download size={16} /> Unduh Excel</a>
            <button type="button" className="btn-modal-save btn-teks" disabled={sibuk} onClick={tetapkan}><Save size={16} /> Tetapkan Nilai</button>
          </div>
        </div>
        <div className="panel overflow-hidden">
          {tampil.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">{d.baris.length ? "Tidak ada siswa yang cocok." : "Belum ada siswa yang ditempatkan di DUDI."}</p> : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th className="w-10">No</th><th>Siswa</th>{d.komponen.map(k => <th key={k.kunci} className="text-right" title={k.ket}>{k.label.replace("Nilai ", "")}<span className="block font-normal normal-case text-gray-400">{d.bobot[k.kunci]}%</span></th>)}<th className="text-right">Hitungan</th><th className="text-right">Ditetapkan</th></tr></thead>
                <tbody>{tampil.map((b, i) => (
                  <tr key={b.id}>
                    <td className="angka">{i + 1}</td>
                    <td><span className="font-medium text-primary-900">{b.nama}</span><span className="block text-xs text-gray-400">{b.kelas ?? "—"} · {b.tempat}</span></td>
                    {d.komponen.map(k => <td key={k.kunci} className="angka text-right">{sel(b.komponen[k.kunci])}</td>)}
                    <td className="angka text-right font-semibold text-primary-900" title={b.kosong.length ? `Belum ada: ${b.kosong.join(", ")}` : ""}>{b.akhir ?? "—"}{b.akhir != null && <span className="block text-xs font-normal text-gray-400">{predikatPkl(b.akhir)}{b.lengkap ? "" : " · belum lengkap"}</span>}</td>
                    <td className="angka text-right">{b.ditetapkan ?? <span className="text-gray-300">—</span>}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <p className="border-t border-gray-100 px-5 py-3 text-xs text-gray-500">
            Komponen yang belum ada tidak dihitung nol: nilai dihitung dari komponen yang tersedia dan ditandai &ldquo;belum lengkap&rdquo;. Jurnal = jumlah jurnal dibanding hari kerja (Senin–Sabtu) yang sudah dijalani; kehadiran baru dihitung setelah 5 catatan presensi.
          </p>
        </div>
      </div>
      <Modal open={atur} onClose={() => setAtur(false)} title="Bobot Nilai Akhir PKL" description="Isi 0 untuk komponen yang tidak dipakai"
        footer={<><button type="button" className="btn-modal-cancel" onClick={() => setAtur(false)}>Batal</button><button type="button" className="btn-modal-save" disabled={sibuk || jumlahBobot <= 0} onClick={simpanBobot}>{sibuk && <Loader2 size={14} className="animate-spin" />} Simpan Bobot</button></>}>
        <div className="space-y-3">
          {d.komponen.map(k => (
            <div key={k.kunci} className="flex items-center gap-3">
              <div className="min-w-0 flex-1"><p className="text-sm font-medium text-primary-900">{k.label}</p><p className="text-xs text-gray-400">{k.ket}</p></div>
              <input className="input-field w-20 text-right" inputMode="numeric" value={bobot[k.kunci] ?? ""} onChange={e => setBobot(s => ({ ...s, [k.kunci]: e.target.value.replace(/\D/g, "").slice(0, 3) }))} aria-label={`Bobot ${k.label}`} />
              <span className="text-sm text-gray-500">%</span>
            </div>
          ))}
          <p className={`text-sm ${jumlahBobot === 100 ? "text-emerald-700" : "text-amber-700"}`}>Jumlah bobot: <span className="angka font-semibold">{jumlahBobot}</span>%{jumlahBobot !== 100 && " — tidak harus 100; perbandingannya yang dipakai."}</p>
        </div>
      </Modal>
    </div>
  );
}
