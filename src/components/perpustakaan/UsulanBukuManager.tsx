"use client";
import { useCallback, useEffect, useState } from "react";
import { Lightbulb, Loader2, Plus, Send, ThumbsUp, Trash2 } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import Modal from "@/components/admin/Modal";
import EmptyState from "@/components/admin/EmptyState";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";

interface Usulan { id: string; judul: string; penulis: string | null; penerbit: string | null; alasan: string | null; pengusulNama: string; peran: string; status: string; tanggapan: string | null; createdAt: string; jumlahDukungan: number; saya: boolean; sayaDukung: boolean }
const STATUS: Record<string, { label: string; kelas: string }> = {
  DIUSULKAN: { label: "Diusulkan", kelas: "bg-amber-50 text-amber-700 border-amber-200" },
  DISETUJUI: { label: "Disetujui", kelas: "bg-blue-50 text-blue-700 border-blue-200" },
  DIBELI: { label: "Sudah tersedia", kelas: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  DITOLAK: { label: "Belum bisa diadakan", kelas: "bg-gray-50 text-gray-600 border-gray-200" },
};
const PERAN: Record<string, string> = { STUDENT: "Siswa", TEACHER: "Guru", TAS: "Pegawai", ADMIN: "Admin" };

/** USULAN BUKU (17 Sep 2026) — anggota mengusulkan & mendukung; petugas menindaklanjuti. */
export default function UsulanBukuManager() {
  const toast = useToast();
  const confirm = useConfirm();
  const [d, setD] = useState<{ petugas: boolean; daftar: Usulan[] } | null>(null);
  const [form, setForm] = useState<null | { judul: string; penulis: string; penerbit: string; alasan: string }>(null);
  const [tindak, setTindak] = useState<null | { u: Usulan; status: string; tanggapan: string }>(null);
  const [saring, setSaring] = useState("DIUSULKAN");
  const [sibuk, setSibuk] = useState(false);
  const muat = useCallback(() => {
    fetch("/api/perpustakaan/usulan", { cache: "no-store" }).then(r => r.json()).then(x => setD(x.daftar ? x : { petugas: false, daftar: [] })).catch(() => setD({ petugas: false, daftar: [] }));
  }, []);
  useEffect(() => { muat(); }, [muat]);
  async function kirim(url: string, method: string, body: unknown, ok: string) {
    setSibuk(true);
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const x = await r?.json().catch(() => null);
    setSibuk(false);
    if (!r?.ok) { toast.error(x?.error ?? "Gagal."); return false; }
    if (ok) toast.success(ok);
    muat(); return true;
  }
  const daftar = (d?.daftar ?? []).filter(u => saring === "SEMUA" || u.status === saring);
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Lightbulb size={22} />} title="Usulan Buku" description={d?.petugas ? "Tindak lanjuti buku yang diusulkan anggota — urut dukungan terbanyak" : "Usulkan buku yang ingin dibaca, atau dukung usulan teman"} />
      <div className="baris-alat mb-5">
        <div className="alat-saring"><Select value={saring} onChange={setSaring} options={[...Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label })), { value: "SEMUA", label: "Semua" }]} /></div>
        <div className="alat-aksi"><button type="button" onClick={() => setForm({ judul: "", penulis: "", penerbit: "", alasan: "" })} className="btn-modal-save"><Plus /> Usulkan Buku</button></div>
      </div>
      {!d ? <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
        : daftar.length === 0 ? <EmptyState icon={Lightbulb} title="Belum ada usulan" description="Jadilah yang pertama mengusulkan buku." />
        : (
          <div className="panel overflow-hidden"><ul className="divide-y divide-gray-50">
            {daftar.map(u => (
              <li key={u.id} className="flex flex-wrap items-start gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-primary-900">{u.judul}</p>
                    <span className={`status-badge ${STATUS[u.status]?.kelas}`}>{STATUS[u.status]?.label}</span>
                  </div>
                  <p className="text-xs text-gray-500">{[u.penulis, u.penerbit].filter(Boolean).join(" · ") || "Penulis belum diisi"} · diusulkan {u.pengusulNama} ({PERAN[u.peran] ?? u.peran})</p>
                  {u.alasan && <p className="mt-1 text-sm text-gray-700">{u.alasan}</p>}
                  {u.tanggapan && <p className="mt-1 text-xs text-emerald-800">Petugas: {u.tanggapan}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button type="button" disabled={sibuk || u.saya} onClick={() => kirim(`/api/perpustakaan/usulan/${u.id}`, "PATCH", { aksi: u.sayaDukung ? "batalDukung" : "dukung" }, "")}
                    title={u.saya ? "Usulan Anda" : u.sayaDukung ? "Batal dukung" : "Dukung"}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${u.sayaDukung || u.saya ? "border-primary-900 bg-primary-900 text-white" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                    <ThumbsUp size={13} /> {u.jumlahDukungan}
                  </button>
                  {d.petugas && <button type="button" onClick={() => setTindak({ u, status: u.status === "DIUSULKAN" ? "DISETUJUI" : u.status, tanggapan: u.tanggapan ?? "" })} className="btn-modal-cancel px-2.5 text-xs">Tindak lanjut</button>}
                  {(d.petugas || (u.saya && u.status === "DIUSULKAN")) && (
                    <button type="button" title="Hapus" onClick={async () => { if (await confirm(`Hapus usulan "${u.judul}"?`)) kirim(`/api/perpustakaan/usulan/${u.id}`, "DELETE", {}, "Usulan dihapus."); }} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"><Trash2 size={14} /></button>
                  )}
                </div>
              </li>
            ))}
          </ul></div>
        )}
      <Modal open={!!form} onClose={() => !sibuk && setForm(null)} title="Usulkan buku"
        footer={<><button type="button" onClick={() => setForm(null)} className="btn-modal-cancel">Batal</button><button type="button" disabled={sibuk || (form?.judul.trim().length ?? 0) < 2} onClick={async () => { if (form && await kirim("/api/perpustakaan/usulan", "POST", form, "Usulan terkirim ke petugas perpustakaan.")) setForm(null); }} className="btn-modal-save"><Send /> Kirim</button></>}>
        {form && (
          <div className="space-y-4">
            <div><label htmlFor="judul-buku" className="label-field">Judul buku *</label><input id="judul-buku" className="input-field" maxLength={200} value={form.judul} onChange={e => setForm({ ...form, judul: e.target.value })} /></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><label htmlFor="penulis-buku" className="label-field">Penulis</label><input id="penulis-buku" className="input-field" maxLength={150} value={form.penulis} onChange={e => setForm({ ...form, penulis: e.target.value })} /></div>
              <div><label htmlFor="penerbit-buku" className="label-field">Penerbit</label><input id="penerbit-buku" className="input-field" maxLength={150} value={form.penerbit} onChange={e => setForm({ ...form, penerbit: e.target.value })} /></div>
            </div>
            <div><label htmlFor="alasan-buku" className="label-field">Mengapa buku ini perlu ada?</label><textarea id="alasan-buku" rows={3} maxLength={1000} className="input-field" value={form.alasan} onChange={e => setForm({ ...form, alasan: e.target.value })} /></div>
          </div>
        )}
      </Modal>
      <Modal open={!!tindak} onClose={() => !sibuk && setTindak(null)} title="Tindak lanjut usulan" description={tindak?.u.judul}
        footer={<><button type="button" onClick={() => setTindak(null)} className="btn-modal-cancel">Batal</button><button type="button" disabled={sibuk} onClick={async () => { if (tindak && await kirim(`/api/perpustakaan/usulan/${tindak.u.id}`, "PATCH", { status: tindak.status, tanggapan: tindak.tanggapan }, "Tersimpan; pengusul & pendukung diberi tahu.")) setTindak(null); }} className="btn-modal-save"><Send /> Simpan</button></>}>
        {tindak && (
          <div className="space-y-4">
            <div><label className="label-field">Status</label><Select value={tindak.status} onChange={v => setTindak({ ...tindak, status: v })} options={Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label }))} /></div>
            <div><label htmlFor="tanggapan-usulan" className="label-field">Tanggapan</label><textarea id="tanggapan-usulan" rows={3} maxLength={500} className="input-field" value={tindak.tanggapan} onChange={e => setTindak({ ...tindak, tanggapan: e.target.value })} placeholder="mis. dijadwalkan pembelian bulan depan" /></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
