"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Camera, FileText, Loader2, Plus, Send, Trash2 } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import Modal from "@/components/admin/Modal";
import EmptyState from "@/components/admin/EmptyState";
import ImageUpload from "@/components/admin/ImageUpload";
import DatePicker from "@/components/shared/DatePicker";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";

interface Usulan { id: string; judul: string; isi: string; tanggalKegiatan: string | null; fotoUrls: string[]; pengusulNama: string; status: string; tanggapan: string | null; newsId: string | null; createdAt: string }
const STATUS: Record<string, { label: string; kelas: string }> = {
  BARU: { label: "Menunggu", kelas: "bg-amber-50 text-amber-700 border-amber-200" },
  DIPROSES: { label: "Sedang disunting", kelas: "bg-blue-50 text-blue-700 border-blue-200" },
  DITERBITKAN: { label: "Diterbitkan", kelas: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  DITOLAK: { label: "Belum bisa diterbitkan", kelas: "bg-gray-50 text-gray-600 border-gray-200" },
};

/** PENGAJUAN LIPUTAN (17 Sep 2026) — guru mengirim cerita & foto kegiatan; Tim Branding menyunting jadi berita. */
export default function LiputanManager({ beritaHref }: { beritaHref: string }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [d, setD] = useState<{ tim: boolean; daftar: Usulan[] } | null>(null);
  const [form, setForm] = useState<null | { judul: string; isi: string; tanggalKegiatan: string; fotoUrls: string[] }>(null);
  const [tindak, setTindak] = useState<null | { u: Usulan; status: string; tanggapan: string }>(null);
  const [sibuk, setSibuk] = useState(false);
  const muat = useCallback(() => {
    fetch("/api/liputan", { cache: "no-store" }).then(r => r.json()).then(x => setD(x.daftar ? x : { tim: false, daftar: [] })).catch(() => setD({ tim: false, daftar: [] }));
  }, []);
  useEffect(() => { muat(); }, [muat]);
  async function kirim(url: string, method: string, body: unknown, ok: string) {
    setSibuk(true);
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const x = await r?.json().catch(() => null);
    setSibuk(false);
    if (!r?.ok) { toast.error(x?.error ?? "Gagal."); return null; }
    if (ok) toast.success(ok);
    muat(); return x;
  }
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Camera size={22} />} title={d?.tim ? "Usulan Liputan Masuk" : "Kirim Liputan Kegiatan"}
        description={d?.tim ? "Cerita & foto dari guru — sunting menjadi berita sekolah" : "Kirim cerita dan foto kegiatan untuk diterbitkan Tim Branding"} />
      <div className="baris-alat mb-5">
        <div className="alat-aksi">
          {d?.tim && <Link href={beritaHref} className="btn-modal-cancel btn-teks"><FileText /> Kelola Berita</Link>}
          <button type="button" onClick={() => setForm({ judul: "", isi: "", tanggalKegiatan: new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10), fotoUrls: [] })} className="btn-modal-save"><Plus /> Kirim Liputan</button>
        </div>
      </div>
      {!d ? <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
        : d.daftar.length === 0 ? <EmptyState icon={Camera} title="Belum ada usulan liputan" description="Kirim cerita kegiatan kelas, lomba, atau acara sekolah beserta fotonya." />
        : (
          <div className="panel overflow-hidden"><ul className="divide-y divide-gray-50">
            {d.daftar.map(u => (
              <li key={u.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-primary-900">{u.judul}</p>
                  <span className={`status-badge ${STATUS[u.status]?.kelas}`}>{STATUS[u.status]?.label}</span>
                  <span className="ml-auto text-xs text-gray-500">{u.pengusulNama} · {new Date(u.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" })}</span>
                </div>
                <p className="mt-1 whitespace-pre-line text-sm text-gray-700">{u.isi}</p>
                {u.fotoUrls.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {u.fotoUrls.map(f => <a key={f} href={f} target="_blank" rel="noopener noreferrer"><img src={f} alt="" className="h-16 w-24 rounded-lg object-cover" /></a>)}
                  </div>
                )}
                {u.tanggapan && <p className="mt-1 text-xs text-emerald-800">Tim Branding: {u.tanggapan}</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  {d.tim && !u.newsId && <button type="button" disabled={sibuk} onClick={async () => { const x = await kirim(`/api/liputan/${u.id}`, "PATCH", { aksi: "draf" }, "Draf berita dibuat — lanjutkan menyunting di Kelola Berita."); if (x?.newsId) window.location.href = beritaHref; }} className="btn-modal-save px-3 text-xs"><FileText /> Jadikan Draf Berita</button>}
                  {d.tim && <button type="button" onClick={() => setTindak({ u, status: u.status === "BARU" ? "DIPROSES" : u.status, tanggapan: u.tanggapan ?? "" })} className="btn-modal-cancel px-3 text-xs">Tanggapi</button>}
                  {(d.tim || u.status === "BARU") && <button type="button" onClick={async () => { if (await confirm(`Hapus usulan "${u.judul}"?`)) kirim(`/api/liputan/${u.id}`, "DELETE", {}, "Usulan dihapus."); }} className="btn-modal-cancel px-2.5 text-xs"><Trash2 /></button>}
                </div>
              </li>
            ))}
          </ul></div>
        )}
      <Modal open={!!form} onClose={() => !sibuk && setForm(null)} title="Kirim liputan kegiatan" size="lg" scrollBody
        footer={<><button type="button" onClick={() => setForm(null)} className="btn-modal-cancel">Batal</button>
          <button type="button" disabled={sibuk || (form?.judul.trim().length ?? 0) < 4 || (form?.isi.trim().length ?? 0) < 20} onClick={async () => { if (form && await kirim("/api/liputan", "POST", form, "Terkirim ke Tim Branding.")) setForm(null); }} className="btn-modal-save"><Send /> Kirim</button></>}>
        {form && (
          <div className="space-y-4">
            <div><label htmlFor="judul-liputan" className="label-field">Judul kegiatan *</label><input id="judul-liputan" className="input-field" maxLength={200} value={form.judul} onChange={e => setForm({ ...form, judul: e.target.value })} placeholder="mis. Kunjungan industri kelas XI TKJ" /></div>
            <div><label className="label-field">Tanggal kegiatan</label><DatePicker value={form.tanggalKegiatan} onChange={v => setForm({ ...form, tanggalKegiatan: v })} /></div>
            <div><label htmlFor="isi-liputan" className="label-field">Cerita kegiatan *</label><textarea id="isi-liputan" rows={6} maxLength={5000} className="input-field" value={form.isi} onChange={e => setForm({ ...form, isi: e.target.value })} placeholder="Apa yang terjadi, siapa yang terlibat, hasilnya apa" /></div>
            <div className="space-y-2">
              <p className="label-field">Foto ({form.fotoUrls.length}/8)</p>
              {form.fotoUrls.length < 8 && <ImageUpload value="" onChange={v => v && setForm({ ...form, fotoUrls: [...form.fotoUrls, v] })} folder="liputan" label="Tambah foto" />}
              {form.fotoUrls.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {form.fotoUrls.map(f => (
                    <button key={f} type="button" onClick={() => setForm({ ...form, fotoUrls: form.fotoUrls.filter(x => x !== f) })} title="Hapus foto" className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={f} alt="" className="h-16 w-24 rounded-lg object-cover" />
                      <span className="absolute right-1 top-1 rounded bg-red-600 px-1 text-xs font-bold text-white">×</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
      <Modal open={!!tindak} onClose={() => !sibuk && setTindak(null)} title="Tanggapi usulan liputan" description={tindak?.u.judul}
        footer={<><button type="button" onClick={() => setTindak(null)} className="btn-modal-cancel">Batal</button>
          <button type="button" disabled={sibuk} onClick={async () => { if (tindak && await kirim(`/api/liputan/${tindak.u.id}`, "PATCH", { status: tindak.status, tanggapan: tindak.tanggapan }, "Tersimpan; pengusul diberi tahu.")) setTindak(null); }} className="btn-modal-save"><Send /> Simpan</button></>}>
        {tindak && (
          <div className="space-y-4">
            <div><label className="label-field">Status</label><Select value={tindak.status} onChange={v => setTindak({ ...tindak, status: v })} options={Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label }))} /></div>
            <div><label htmlFor="tanggapan-liputan" className="label-field">Tanggapan</label><textarea id="tanggapan-liputan" rows={3} maxLength={500} className="input-field" value={tindak.tanggapan} onChange={e => setTindak({ ...tindak, tanggapan: e.target.value })} /></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
