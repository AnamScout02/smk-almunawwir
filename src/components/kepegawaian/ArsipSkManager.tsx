"use client";
import { useSorotBaris } from "@/lib/cari-awal";
import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Loader2, Plus, Save, Trash2, Upload } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import Modal from "@/components/admin/Modal";
import EmptyState from "@/components/admin/EmptyState";
import DatePicker from "@/components/shared/DatePicker";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";

interface Arsip { id: string; teacherId: string; jenis: string; judul: string; nomor: string | null; tanggal: string; berlakuSampai: string | null; berkas: string | null; catatan: string | null; olehNama: string }
interface Data { kelola: boolean; jenis: Record<string, string>; teacherId: string; guru: { id: string; nama: string; nip: string }[]; daftar: Arsip[] }
const tgl = (s: string) => new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
const hariIni = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

/** ARSIP SK & DOKUMEN KEPEGAWAIAN (17 Sep 2026) — berkas disimpan di folder rahasia, dibuka lewat rute berizin. */
export default function ArsipSkManager() {
  const toast = useToast();
  const confirm = useConfirm();
  const [d, setD] = useState<Data | null>(null);
  const [galat, setGalat] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [form, setForm] = useState<null | { teacherId: string; jenis: string; judul: string; nomor: string; tanggal: string; berlakuSampai: string; catatan: string; berkas: string }>(null);
  const [mengunggah, setMengunggah] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const berkasRef = useRef<HTMLInputElement>(null);
  const muat = useCallback((tid?: string) => {
    fetch(`/api/kepegawaian/sk${tid ? `?teacherId=${tid}` : ""}`, { cache: "no-store" }).then(async r => {
      const x = await r.json().catch(() => null);
      if (!r.ok) setGalat(x?.error ?? "Gagal memuat."); else { setD(x); setTeacherId(x.teacherId ?? ""); }
    }).catch(() => setGalat("Gagal memuat."));
  }, []);
  useEffect(() => { muat(); }, [muat]);
  useSorotBaris();

  async function unggah(file: File) {
    setMengunggah(true);
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch("/api/kepegawaian/sk/lampiran", { method: "POST", body: fd }).catch(() => null);
    const x = await r?.json().catch(() => null);
    setMengunggah(false);
    if (!r?.ok) { toast.error(x?.error ?? "Gagal mengunggah."); return; }
    setForm(f => f && ({ ...f, berkas: x.berkas }));
    toast.success("Berkas terunggah.");
  }
  async function simpan() {
    if (!form) return;
    setSibuk(true);
    const r = await fetch("/api/kepegawaian/sk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, tanggal: `${form.tanggal}T00:00:00+07:00`, berlakuSampai: form.berlakuSampai ? `${form.berlakuSampai}T23:59:59+07:00` : null }) }).catch(() => null);
    const x = await r?.json().catch(() => null);
    setSibuk(false);
    if (!r?.ok) { toast.error(x?.error ?? "Gagal menyimpan."); return; }
    toast.success("Dokumen tersimpan."); setForm(null); muat(teacherId);
  }
  const hampir = (s: string | null) => s && new Date(s).getTime() <= Date.now() + 60 * 86400000;
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<FileText size={22} />} title="Arsip SK & Dokumen Kepegawaian" description={d?.kelola ? "SK, sertifikat, dan piagam pegawai — berkas tersimpan rahasia" : "Dokumen kepegawaian Anda"} />
      {galat ? <EmptyState icon={FileText} title="Tidak tersedia" description={galat} /> : !d ? (
        <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
      ) : (
        <>
          <div className="baris-alat mb-5">
            {d.kelola && <div className="alat-saring"><Select value={teacherId} onChange={v => { setTeacherId(v); muat(v); }} placeholder="Semua pegawai" options={[{ value: "", label: "Semua pegawai" }, ...d.guru.map(g => ({ value: g.id, label: `${g.nama} (${g.nip})` }))]} /></div>}
            {d.kelola && <div className="alat-aksi"><button type="button" onClick={() => setForm({ teacherId: teacherId || d.guru[0]?.id || "", jenis: "SK", judul: "", nomor: "", tanggal: hariIni(), berlakuSampai: "", catatan: "", berkas: "" })} className="btn-modal-save"><Plus /> Tambah Dokumen</button></div>}
          </div>
          {d.daftar.length === 0 ? <EmptyState icon={FileText} title="Belum ada dokumen" description={d.kelola ? "Tambahkan SK pengangkatan, SK pembagian tugas, sertifikat pendidik, dan piagam." : "Dokumen kepegawaian Anda akan tampil di sini setelah diarsipkan TU."} /> : (
            <div className="panel overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Dokumen</th>{d.kelola && <th className="hidden md:table-cell">Pegawai</th>}<th>Tanggal</th><th>Berlaku s/d</th><th className="text-right">Aksi</th></tr></thead>
                <tbody>{d.daftar.map(a => (
                  <tr key={a.id} data-baris={a.id}>
                    <td className="min-w-[12rem]">
                      <p className="font-semibold text-primary-900">{a.judul}</p>
                      <p className="text-xs text-gray-500">{d.jenis[a.jenis] ?? a.jenis}{a.nomor ? ` · ${a.nomor}` : ""}</p>
                      {a.catatan && <p className="text-xs text-gray-600">{a.catatan}</p>}
                    </td>
                    {d.kelola && <td className="hidden md:table-cell text-xs text-gray-600">{d.guru.find(g => g.id === a.teacherId)?.nama ?? "—"}</td>}
                    <td className="text-xs whitespace-nowrap">{tgl(a.tanggal)}</td>
                    <td className="text-xs whitespace-nowrap">{a.berlakuSampai ? <span className={hampir(a.berlakuSampai) ? "font-semibold text-red-600" : ""}>{tgl(a.berlakuSampai)}</span> : "—"}</td>
                    <td className="text-right whitespace-nowrap">
                      {a.berkas && <a href={`/api/kepegawaian/sk/${a.id}/berkas`} target="_blank" rel="noopener noreferrer" className="btn-modal-cancel px-2.5 text-xs">Buka</a>}
                      {d.kelola && <button type="button" title="Hapus" onClick={async () => { if (await confirm(`Hapus dokumen "${a.judul}"?`)) { const r = await fetch(`/api/kepegawaian/sk/${a.id}`, { method: "DELETE" }).catch(() => null); if (r?.ok) muat(teacherId); } }} className="ml-1 p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"><Trash2 size={14} /></button>}
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </>
      )}
      <Modal open={!!form} onClose={() => !sibuk && setForm(null)} title="Tambah dokumen kepegawaian" size="lg" scrollBody
        footer={<><button type="button" onClick={() => setForm(null)} className="btn-modal-cancel">Batal</button><button type="button" disabled={sibuk || !form?.judul.trim()} onClick={simpan} className="btn-modal-save">{sibuk ? <Loader2 className="animate-spin" /> : <Save />} Simpan</button></>}>
        {form && d && (
          <div className="space-y-4">
            <div><label className="label-field">Pegawai</label><Select value={form.teacherId} onChange={v => setForm({ ...form, teacherId: v })} options={d.guru.map(g => ({ value: g.id, label: `${g.nama} (${g.nip})` }))} /></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><label className="label-field">Jenis</label><Select value={form.jenis} onChange={v => setForm({ ...form, jenis: v })} options={Object.entries(d.jenis).map(([value, label]) => ({ value, label }))} /></div>
              <div><label htmlFor="nomor-sk" className="label-field">Nomor</label><input id="nomor-sk" className="input-field" maxLength={100} value={form.nomor} onChange={e => setForm({ ...form, nomor: e.target.value })} /></div>
            </div>
            <div><label htmlFor="judul-sk" className="label-field">Judul dokumen *</label><input id="judul-sk" className="input-field" maxLength={200} value={form.judul} onChange={e => setForm({ ...form, judul: e.target.value })} placeholder="mis. SK Pembagian Tugas Mengajar 2026/2027" /></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><label className="label-field">Tanggal dokumen</label><DatePicker value={form.tanggal} onChange={v => setForm({ ...form, tanggal: v })} /></div>
              <div><label className="label-field">Berlaku sampai (opsional)</label><DatePicker value={form.berlakuSampai} onChange={v => setForm({ ...form, berlakuSampai: v })} placeholder="Tanpa batas" /></div>
            </div>
            <div>
              <p className="label-field">Berkas (PDF/foto, rahasia)</p>
              <div className="flex flex-wrap items-center gap-2">
                <input ref={berkasRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) unggah(f); }} />
                <button type="button" onClick={() => berkasRef.current?.click()} disabled={mengunggah} className="btn-modal-cancel">{mengunggah ? <Loader2 className="animate-spin" /> : <Upload />} Pilih Berkas</button>
                {form.berkas && <span className="text-xs text-emerald-700">Berkas siap disimpan</span>}
              </div>
            </div>
            <div><label htmlFor="catatan-sk" className="label-field">Catatan</label><input id="catatan-sk" className="input-field" maxLength={500} value={form.catatan} onChange={e => setForm({ ...form, catatan: e.target.value })} /></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
