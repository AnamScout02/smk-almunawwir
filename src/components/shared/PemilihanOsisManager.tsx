"use client";
import TimePicker from "@/components/shared/TimePicker";
import { useCallback, useEffect, useState } from "react";
import { BarChart3, ChevronLeft, Loader2, Play, Plus, Save, Square, Trash2, Vote } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import Modal from "@/components/admin/Modal";
import ImageUpload from "@/components/admin/ImageUpload";
import DatePicker from "@/components/shared/DatePicker";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";

interface Ringkas { id: string; judul: string; mulai: string; selesai: string; status: string; statusEfektif: string; _count: { calon: number; pemilih: number } }
interface Calon { id?: string; nomor: number; ketua: string; wakil: string; kelas: string; foto: string; visi: string; misi: string; suara?: number }
interface Detail {
  id: string; judul: string; mulai: string; selesai: string; status: string; statusEfektif: string; kelasIds: string[];
  semuaKelas: { id: string; name: string }[]; calon: Calon[]; partisipasi: { kelas: string; hakPilih: number; memilih: number }[];
}

const LABEL: Record<string, [string, string]> = {
  DRAF: ["Draf", "bg-gray-50 text-gray-600 border-gray-200"], BUKA: ["Sedang berlangsung", "bg-emerald-50 text-emerald-700 border-emerald-200"],
  BELUM_MULAI: ["Dibuka, belum mulai", "bg-blue-50 text-blue-700 border-blue-200"], TUTUP: ["Selesai", "bg-primary-50 text-primary-900 border-primary-100"],
};
const teksWaktu = (d: string) => new Date(d).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
const CALON_KOSONG = (nomor: number): Calon => ({ nomor, ketua: "", wakil: "", kelas: "", foto: "", visi: "", misi: "" });

/** PEMILIHAN OSIS ONLINE — pengelola (Pembina OSIS, Wakasek Kesiswaan, Admin). 17 Sep 2026. */
export default function PemilihanOsisManager() {
  const toast = useToast();
  const confirmDialog = useConfirm();
  const [daftar, setDaftar] = useState<Ringkas[] | null>(null);
  const [galat, setGalat] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [baru, setBaru] = useState(false);
  const [form, setForm] = useState({ judul: "", tglMulai: "", jamMulai: "07:00", tglSelesai: "", jamSelesai: "12:00" });
  const [calon, setCalon] = useState<Calon[]>([]);
  const [kelasIds, setKelasIds] = useState<string[]>([]);
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(() => {
    fetch("/api/osis/pemilihan", { cache: "no-store" }).then(async r => {
      const d = await r.json().catch(() => null);
      if (!r.ok) setGalat(d?.error ?? "Gagal memuat."); else setDaftar(d);
    }).catch(() => setGalat("Gagal memuat."));
  }, []);
  useEffect(() => { muat(); }, [muat]);

  const bukaDetail = useCallback((id: string) => {
    fetch(`/api/osis/pemilihan/${id}`, { cache: "no-store" }).then(r => r.json()).then((d: Detail) => {
      setDetail(d);
      setCalon(d.calon.length ? d.calon.map(c => ({ ...c, wakil: c.wakil ?? "", kelas: c.kelas ?? "", foto: c.foto ?? "", misi: c.misi ?? "" })) : [CALON_KOSONG(1)]);
      setKelasIds(d.kelasIds);
    }).catch(() => toast.error("Gagal memuat pemilihan."));
  }, [toast]);

  async function buat() {
    setSibuk(true);
    const r = await fetch("/api/osis/pemilihan", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ judul: form.judul, mulai: `${form.tglMulai}T${form.jamMulai}:00+07:00`, selesai: `${form.tglSelesai}T${form.jamSelesai}:00+07:00` }),
    }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setSibuk(false);
    if (!r?.ok) { toast.error(d?.error ?? "Gagal membuat."); return; }
    setBaru(false); muat(); bukaDetail(d.id);
  }

  async function patch(body: Record<string, unknown>, pesan: string) {
    if (!detail) return;
    setSibuk(true);
    const r = await fetch(`/api/osis/pemilihan/${detail.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setSibuk(false);
    if (!r?.ok) { toast.error(d?.error ?? "Gagal menyimpan."); return; }
    toast.success(pesan); bukaDetail(detail.id); muat();
  }

  async function hapus() {
    if (!detail || !(await confirmDialog(`Hapus pemilihan "${detail.judul}"?`))) return;
    const r = await fetch(`/api/osis/pemilihan/${detail.id}`, { method: "DELETE" }).catch(() => null);
    if (!r?.ok) { toast.error("Gagal menghapus."); return; }
    setDetail(null); muat();
  }

  if (galat) return <div className="p-6 lg:p-8 pt-16 lg:pt-8"><EmptyState icon={Vote} title="Tidak tersedia" description={galat} /></div>;

  if (detail) {
    const draf = detail.status === "DRAF";
    const totalSuara = detail.calon.reduce((a, c) => a + (c.suara ?? 0), 0);
    const [lab, kel] = LABEL[detail.statusEfektif] ?? LABEL.DRAF;
    return (
      <div className="p-6 lg:p-8 pt-16 lg:pt-8">
        <PageHeader icon={<Vote size={22} />} title={detail.judul} description={`${teksWaktu(detail.mulai)} – ${teksWaktu(detail.selesai)} WIB`} />
        <div className="baris-alat mb-5">
          <button type="button" onClick={() => setDetail(null)} className="btn-modal-cancel"><ChevronLeft size={15} /> Semua pemilihan</button>
          <span className={`alat-saring status-badge ${kel}`}>{lab}</span>
          <div className="alat-aksi">
            {draf && <button type="button" onClick={hapus} className="btn-modal-cancel"><Trash2 size={15} /> Hapus</button>}
            {draf && <button type="button" disabled={sibuk} onClick={() => patch({ kelasIds, calon }, "Calon & pengaturan tersimpan.")} className="btn-modal-cancel"><Save size={15} /> Simpan</button>}
            {draf && <button type="button" disabled={sibuk} onClick={async () => { if (await confirmDialog("Buka pemilihan? Calon tidak bisa diubah lagi.")) patch({ status: "BUKA" }, "Pemilihan dibuka."); }} className="btn-modal-save"><Play size={15} /> Buka Pemilihan</button>}
            {detail.status === "BUKA" && <button type="button" disabled={sibuk} onClick={async () => { if (await confirmDialog("Tutup pemilihan sekarang?")) patch({ status: "TUTUP" }, "Pemilihan ditutup."); }} className="btn-hapus"><Square size={15} /> Tutup Sekarang</button>}
          </div>
        </div>

        {draf ? (
          <div className="space-y-5">
            <div className="panel p-5">
              <p className="label-field">Kelas yang boleh memilih</p>
              <div className="flex flex-wrap gap-2">
                {detail.semuaKelas.map(k => (
                  <button key={k.id} type="button" onClick={() => setKelasIds(ids => ids.includes(k.id) ? ids.filter(x => x !== k.id) : [...ids, k.id])}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${kelasIds.includes(k.id) ? "border-primary-900 bg-primary-900 text-white" : "border-gray-200 text-gray-600"}`}>{k.name}</button>
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-500">{kelasIds.length ? `${kelasIds.length} kelas dipilih` : "Tidak ada yang dipilih = semua siswa aktif boleh memilih."}</p>
            </div>
            {calon.map((c, i) => (
              <div key={i} className="panel p-5">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-900 font-heading font-bold text-white">{c.nomor}</span>
                  <h3 className="font-heading font-bold text-primary-900">Calon nomor {c.nomor}</h3>
                  <button type="button" onClick={() => setCalon(cs => cs.filter((_, j) => j !== i).map((x, j) => ({ ...x, nomor: j + 1 })))} className="ml-auto text-xs font-semibold text-red-600 hover:underline">Hapus calon</button>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-[10rem_minmax(0,1fr)]">
                  <ImageUpload value={c.foto} onChange={url => setCalon(cs => cs.map((x, j) => (j === i ? { ...x, foto: url } : x)))} folder="osis" aspect="portrait" label="Foto" />
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {([["ketua", "Nama calon ketua"], ["wakil", "Nama calon wakil"], ["kelas", "Kelas"]] as const).map(([k, l]) => (
                      <div key={k}><label className="label-field">{l}</label><input value={c[k]} onChange={e => setCalon(cs => cs.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))} className="input-field" /></div>
                    ))}
                    <div className="sm:col-span-2"><label className="label-field">Visi</label><textarea value={c.visi} rows={2} onChange={e => setCalon(cs => cs.map((x, j) => (j === i ? { ...x, visi: e.target.value } : x)))} className="input-field" /></div>
                    <div className="sm:col-span-2"><label className="label-field">Misi (satu per baris)</label><textarea value={c.misi} rows={4} onChange={e => setCalon(cs => cs.map((x, j) => (j === i ? { ...x, misi: e.target.value } : x)))} className="input-field" /></div>
                  </div>
                </div>
              </div>
            ))}
            <button type="button" onClick={() => setCalon(cs => [...cs, CALON_KOSONG(cs.length + 1)])} className="btn-modal-cancel"><Plus size={15} /> Tambah Calon</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 items-start">
            <div className="panel p-5 xl:col-span-7">
              <h3 className="font-heading font-bold text-primary-900 text-sm mb-4 flex items-center gap-2"><BarChart3 size={15} className="text-primary-700" /> Perolehan suara ({totalSuara})</h3>
              <div className="space-y-4">
                {detail.calon.map(c => {
                  const persen = totalSuara ? Math.round(((c.suara ?? 0) / totalSuara) * 1000) / 10 : 0;
                  return (
                    <div key={c.id}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span><strong className="text-primary-900">{c.nomor}. {c.ketua}</strong>{c.wakil ? <span className="text-gray-500"> & {c.wakil}</span> : null}</span>
                        <span className="tabular-nums font-semibold text-primary-900">{c.suara ?? 0} · {persen}%</span>
                      </div>
                      <div className="mt-1 h-3 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-primary-700" style={{ width: `${persen}%` }} /></div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="panel overflow-hidden xl:col-span-5">
              <div className="border-b border-gray-100 px-5 py-3.5"><h3 className="font-heading font-bold text-primary-900 text-sm">Partisipasi per kelas</h3></div>
              <div className="max-h-[28rem] overflow-auto">
                <table className="data-table">
                  <thead><tr><th>Kelas</th><th className="text-right">Memilih</th><th className="text-right">%</th></tr></thead>
                  <tbody>
                    {detail.partisipasi.map(k => (
                      <tr key={k.kelas}><td className="font-medium">{k.kelas}</td><td className="text-right tabular-nums">{k.memilih}/{k.hakPilih}</td><td className="text-right tabular-nums">{k.hakPilih ? Math.round((k.memilih / k.hakPilih) * 100) : 0}%</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Vote size={22} />} title="Pemilihan OSIS" description="Pemilihan ketua OSIS secara online — satu siswa satu suara, pilihan dirahasiakan, hasil langsung terlihat" />
      <div className="alat-aksi justify-end mb-5"><button type="button" onClick={() => setBaru(true)} className="btn-modal-save"><Plus size={15} /> Buat Pemilihan</button></div>
      {!daftar ? <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
        : daftar.length === 0 ? <EmptyState icon={Vote} title="Belum ada pemilihan" description="Buat pemilihan, tambahkan calon beserta visi-misi, lalu buka sesuai jadwal." />
        : (
          <div className="panel overflow-hidden">
            <ul className="divide-y divide-gray-50">
              {daftar.map(p => {
                const [lab, kel] = LABEL[p.statusEfektif] ?? LABEL.DRAF;
                return (
                  <li key={p.id}>
                    <button type="button" onClick={() => bukaDetail(p.id)} className="flex w-full flex-wrap items-center gap-3 px-5 py-4 text-left hover:bg-gray-50">
                      <span className="min-w-0 flex-1"><span className="block font-semibold text-primary-900">{p.judul}</span><span className="text-xs text-gray-500">{teksWaktu(p.mulai)} – {teksWaktu(p.selesai)} · {p._count.calon} calon · {p._count.pemilih} suara</span></span>
                      <span className={`status-badge ${kel}`}>{lab}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      <Modal open={baru} onClose={() => !sibuk && setBaru(false)} title="Buat pemilihan"
        footer={<><button type="button" onClick={() => setBaru(false)} className="btn-modal-cancel">Batal</button>
          <button type="button" onClick={buat} disabled={sibuk || !form.judul || !form.tglMulai || !form.tglSelesai} className="btn-modal-save">{sibuk ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Buat</button></>}>
        <div className="space-y-4">
          <div><label htmlFor="judul-osis" className="label-field">Judul</label><input id="judul-osis" value={form.judul} onChange={e => setForm(f => ({ ...f, judul: e.target.value }))} className="input-field" placeholder="Pemilihan Ketua OSIS 2026/2027" /></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2"><label className="label-field">Mulai</label><DatePicker value={form.tglMulai} onChange={v => setForm(f => ({ ...f, tglMulai: v }))} /></div>
            <div><label className="label-field">Jam</label><TimePicker value={form.jamMulai} onChange={v => setForm(f => ({ ...f, jamMulai: v }))} /></div>
            <div className="sm:col-span-2"><label className="label-field">Selesai</label><DatePicker value={form.tglSelesai} onChange={v => setForm(f => ({ ...f, tglSelesai: v }))} /></div>
            <div><label className="label-field">Jam</label><TimePicker value={form.jamSelesai} onChange={v => setForm(f => ({ ...f, jamSelesai: v }))} /></div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
