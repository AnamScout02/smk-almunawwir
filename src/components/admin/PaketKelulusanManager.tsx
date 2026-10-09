"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { GraduationCap, Loader2, FileCheck2, ScrollText, Printer, HandCoins, ExternalLink } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import Modal from "@/components/admin/Modal";
import Select from "@/components/admin/Select";
import DatePicker from "@/components/shared/DatePicker";
import { useToast } from "@/components/shared/ToastProvider";

type Baris = { id: string; nama: string; nis: string; nisn: string | null; kelas: string | null; status: string; skl: { id: string; nomor: string } | null; ijazah: { tanggal: string; oleh: string } | null; dokumenLain: number };
type Data = { kelas: { id: string; name: string }[]; tahun: string[]; baris: Baris[] };
const hariIni = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

/** PAKET KELULUSAN (9 Okt 2026) — per kelas XII atau per tahun lulus: buat Surat Keterangan Lulus massal (bernomor agenda TU,
 *  ber-QR), cetak sekaligus, dan lihat siapa yang ijazahnya sudah/belum diserahkan (data Penyerahan Ijazah). */
export default function PaketKelulusanManager() {
  const toast = useToast();
  const [d, setD] = useState<Data | null>(null);
  const [saring, setSaring] = useState("");
  const [pilih, setPilih] = useState<Set<string>>(new Set());
  const [buat, setBuat] = useState(false);
  const [f, setF] = useState({ tanggal: hariIni(), nomorSk: "", tanggalSk: "" });
  const [sibuk, setSibuk] = useState(false);
  const param = saring.startsWith("k:") ? `kelas=${saring.slice(2)}` : saring.startsWith("t:") ? `lulus=${saring.slice(2)}` : "";
  const muat = useCallback((p: string) => {
    fetch(`/api/admin/paket-kelulusan${p ? `?${p}` : ""}`).then(r => r.json()).then((x: Data & { error?: string }) => { if (x.error) toast.error(x.error); else { setD(x); setPilih(new Set(x.baris.filter(b => !b.skl).map(b => b.id))); } }).catch(() => toast.error("Gagal memuat data."));
  }, [toast]);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const awal = q.get("kelas") ? `k:${q.get("kelas")}` : q.get("lulus") ? `t:${q.get("lulus")}` : "";
    if (awal) queueMicrotask(() => setSaring(awal));
  }, []);
  useEffect(() => { muat(param); }, [muat, param]);

  async function buatSkl() {
    setSibuk(true);
    const r = await fetch("/api/admin/paket-kelulusan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentIds: [...pilih], ...f }) }).catch(() => null);
    const j = await r?.json().catch(() => ({}));
    setSibuk(false);
    if (!r?.ok) { toast.error(j?.error ?? "Gagal membuat SKL."); return; }
    toast.success(`${j.dibuat} SKL dibuat${j.dilewati ? `, ${j.dilewati} sudah ada` : ""}.`);
    if (j.gagal?.length) toast.error(`Gagal untuk: ${j.gagal.slice(0, 3).join(", ")}${j.gagal.length > 3 ? "…" : ""}`);
    setBuat(false); muat(param);
  }
  if (!d) return <div className="p-6 lg:p-8 pt-16 lg:pt-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;
  const b = d.baris, adaSkl = b.filter(x => x.skl).length, serah = b.filter(x => x.ijazah).length;
  const bisaDipilih = b.filter(x => !x.skl);
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<GraduationCap size={22} />} title="Paket Kelulusan" description="Surat Keterangan Lulus massal dan status penyerahan ijazah per kelas" />
      <div className="space-y-6">
        <div className="kisi-kartu kisi-kartu-4">
          <StatTile value={b.length} label="Siswa pada pilihan ini" icon={GraduationCap} color="primary" />
          <StatTile value={adaSkl} label="Sudah punya SKL" icon={ScrollText} color="blue" />
          <StatTile value={serah} label="Ijazah sudah diserahkan" icon={FileCheck2} color="emerald" />
          <StatTile value={b.length - serah} label="Ijazah belum diserahkan" icon={HandCoins} color="amber" />
        </div>
        <div className="baris-alat">
          <div className="alat-saring"><Select value={saring} onChange={setSaring} placeholder="Pilih kelas XII atau tahun lulus" options={[...d.kelas.map(k => ({ value: `k:${k.id}`, label: `Kelas ${k.name}` })), ...d.tahun.map(t => ({ value: `t:${t}`, label: `Lulusan ${t}` }))]} /></div>
          <div className="alat-aksi">
            {adaSkl > 0 && <Link href={`/dashboard/admin/paket-kelulusan/cetak?${param}`} className="btn-modal-cancel btn-teks"><Printer size={16} /> Cetak {Math.min(adaSkl, 60)} SKL</Link>}
            <button type="button" className="btn-modal-save btn-teks" disabled={!pilih.size} onClick={() => setBuat(true)}><ScrollText size={16} /> Buat SKL ({pilih.size})</button>
          </div>
        </div>
        <div className="panel overflow-hidden">
          {!saring ? <p className="py-10 text-center text-sm text-gray-400">Pilih kelas XII atau tahun lulus untuk memulai.</p>
            : b.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">Tidak ada siswa pada pilihan ini.</p> : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr>
                    <th className="w-10"><input type="checkbox" aria-label="Pilih semua yang belum punya SKL" disabled={!bisaDipilih.length} checked={bisaDipilih.length > 0 && bisaDipilih.every(x => pilih.has(x.id))} onChange={e => setPilih(e.target.checked ? new Set(bisaDipilih.map(x => x.id)) : new Set())} /></th>
                    <th>Siswa</th><th>Status</th><th>Surat Keterangan Lulus</th><th>Ijazah</th><th className="text-right">Aksi</th>
                  </tr></thead>
                  <tbody>{b.map(x => (
                    <tr key={x.id}>
                      <td>{!x.skl && <input type="checkbox" aria-label={`Pilih ${x.nama}`} checked={pilih.has(x.id)} onChange={e => setPilih(s => { const n = new Set(s); if (e.target.checked) n.add(x.id); else n.delete(x.id); return n; })} />}</td>
                      <td><span className="font-medium text-primary-900">{x.nama}</span><span className="angka block text-xs text-gray-400">{x.nis}{x.nisn ? ` · NISN ${x.nisn}` : " · NISN kosong"}</span></td>
                      <td><span className={`status-badge ${x.status === "LULUS" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>{x.status === "LULUS" ? "Lulus" : "Aktif"}</span></td>
                      <td>{x.skl ? <span className="angka text-gray-700">{x.skl.nomor}</span> : <span className="text-gray-400">Belum dibuat</span>}</td>
                      <td>{x.ijazah ? <span className="text-emerald-700">Diserahkan {new Date(x.ijazah.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" })}<span className="block text-xs text-gray-400">kepada {x.ijazah.oleh}</span></span> : <span className="text-amber-700">Belum diserahkan{x.dokumenLain ? <span className="block text-xs text-gray-400">{x.dokumenLain} dokumen lain sudah</span> : null}</span>}</td>
                      <td><div className="flex justify-end gap-1.5">
                        {x.skl && <Link href={`/dashboard/admin/persuratan/${x.skl.id}/cetak`} className="btn-modal-cancel px-3 text-xs"><ExternalLink size={14} /> SKL</Link>}
                        {!x.ijazah && <Link href={`/dashboard/admin/ijazah-serah?siswa=${encodeURIComponent(x.nama)}`} className="btn-modal-cancel btn-teks px-3 text-xs">Serahkan ijazah</Link>}
                      </div></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          <p className="border-t border-gray-100 px-5 py-3 text-xs text-gray-500">SKL tersimpan sebagai surat keluar biasa di Agenda Surat (nomornya ikut urutan sekolah) dan bisa dirapikan di sana sebelum dicetak. Penyerahan ijazah dicatat di menu Penyerahan Ijazah; halaman ini hanya membacanya.</p>
        </div>
      </div>
      <Modal open={buat} onClose={() => setBuat(false)} title="Buat Surat Keterangan Lulus" description={`${pilih.size} siswa · nomor surat berurutan menurut abjad`}
        footer={<><button type="button" className="btn-modal-cancel" onClick={() => setBuat(false)}>Batal</button><button type="button" className="btn-modal-save" disabled={sibuk} onClick={buatSkl}>{sibuk && <Loader2 size={14} className="animate-spin" />} Buat {pilih.size} SKL</button></>}>
        <div className="space-y-3">
          <div><label className="label-field">Tanggal surat</label><DatePicker value={f.tanggal} onChange={v => setF(s => ({ ...s, tanggal: v }))} /></div>
          <div><label className="label-field">Nomor SK kelulusan</label><input className="input-field" value={f.nomorSk} onChange={e => setF(s => ({ ...s, nomorSk: e.target.value }))} placeholder="Nomor SK Kepala Sekolah tentang kelulusan" /></div>
          <div><label className="label-field">Tanggal SK kelulusan</label><DatePicker value={f.tanggalSk} onChange={v => setF(s => ({ ...s, tanggalSk: v }))} /></div>
          {d.baris.some(x => pilih.has(x.id) && x.status !== "LULUS") && <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">Sebagian siswa terpilih masih berstatus Aktif. SKL menyatakan mereka LULUS — pastikan sesuai SK kelulusan, dan lepas centang siswa yang tidak lulus.</p>}
        </div>
      </Modal>
    </div>
  );
}
