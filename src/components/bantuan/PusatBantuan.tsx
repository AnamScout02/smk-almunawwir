"use client";
import { useCallback, useEffect, useState } from "react";
import { CircleHelp, Loader2, Plus, Send, Trash2 } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import Modal from "@/components/admin/Modal";
import EmptyState from "@/components/admin/EmptyState";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";

interface Tiket { id: string; pengirimNama: string; peran: string; kontak: string | null; kategori: string; isi: string; status: string; tanggapan: string | null; penanganNama: string | null; createdAt: string }
const STATUS: Record<string, { label: string; kelas: string }> = {
  BARU: { label: "Menunggu", kelas: "bg-amber-50 text-amber-700 border-amber-200" },
  DIPROSES: { label: "Sedang ditangani", kelas: "bg-blue-50 text-blue-700 border-blue-200" },
  SELESAI: { label: "Selesai", kelas: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};
const PERAN: Record<string, string> = { STUDENT: "Siswa", TEACHER: "Guru", TAS: "Pegawai", PARENT: "Orang tua", ADMIN: "Admin" };
const PANDUAN: { t: string; j: string }[] = [
  { t: "Lupa sandi / tidak bisa masuk", j: "Kirim tiket kategori “Lupa/ganti sandi”. Petugas TU akan menyetel ulang sandi Anda menjadi sandi bawaan, lalu ganti sendiri lewat Profil → Ganti Sandi." },
  { t: "Nama, NIS, atau data lain salah", j: "Kirim tiket kategori “Data tidak sesuai” dan sebutkan data yang benar. Perubahan data induk hanya boleh dilakukan TU dari berkas resmi." },
  { t: "Tidak menerima notifikasi", j: "Buka Profil → Aktifkan Notifikasi di HP masing-masing (harus lewat alamat HTTPS aplikasi). Kotak notifikasi tetap terisi walau push belum aktif." },
  { t: "Aplikasi lambat atau halaman kosong", j: "Muat ulang halaman sekali; bila tetap, kirim tiket “Aplikasi bermasalah” beserta nama halaman dan jam kejadian." },
];

/** PUSAT BANTUAN (17 Sep 2026) — panduan singkat + tiket bantuan; staf TU menanggapi. */
export default function PusatBantuan() {
  const toast = useToast();
  const confirm = useConfirm();
  const [d, setD] = useState<{ petugas: boolean; kategori: Record<string, string>; daftar: Tiket[] } | null>(null);
  const [form, setForm] = useState<null | { kategori: string; isi: string; kontak: string }>(null);
  const [balas, setBalas] = useState<null | { t: Tiket; status: string; tanggapan: string }>(null);
  const [sibuk, setSibuk] = useState(false);
  const muat = useCallback(() => {
    fetch("/api/bantuan", { cache: "no-store" }).then(r => r.json()).then(x => setD(x.daftar ? x : { petugas: false, kategori: {}, daftar: [] })).catch(() => setD({ petugas: false, kategori: {}, daftar: [] }));
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
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<CircleHelp size={22} />} title="Pusat Bantuan" description={d?.petugas ? "Tiket bantuan dari pengguna — tangani & balas" : "Panduan singkat dan tempat melaporkan kendala aplikasi"} />
      <div className="baris-alat mb-5"><div className="alat-aksi"><button type="button" onClick={() => setForm({ kategori: "SANDI", isi: "", kontak: "" })} className="btn-modal-save"><Plus /> Kirim Pertanyaan / Kendala</button></div></div>
      {!d?.petugas && (
        <div className="panel mb-6 divide-y divide-gray-50">
          {PANDUAN.map(p => (
            <details key={p.t} className="px-5 py-3">
              <summary className="cursor-pointer text-sm font-semibold text-primary-900">{p.t}</summary>
              <p className="mt-1 text-sm text-gray-700">{p.j}</p>
            </details>
          ))}
        </div>
      )}
      {!d ? <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
        : d.daftar.length === 0 ? <EmptyState icon={CircleHelp} title="Belum ada tiket" description={d.petugas ? "Tiket bantuan dari pengguna akan tampil di sini." : "Kendala yang Anda kirim akan tampil di sini beserta balasannya."} />
        : (
          <div className="panel overflow-hidden"><ul className="divide-y divide-gray-50">
            {d.daftar.map(t => (
              <li key={t.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="status-badge bg-primary-50 text-primary-700 border-primary-100">{d.kategori[t.kategori] ?? t.kategori}</span>
                  <span className={`status-badge ${STATUS[t.status]?.kelas}`}>{STATUS[t.status]?.label}</span>
                  {d.petugas && <span className="text-sm font-semibold text-primary-900">{t.pengirimNama} <span className="text-xs font-normal text-gray-500">({PERAN[t.peran] ?? t.peran})</span></span>}
                  <span className="ml-auto text-xs text-gray-500">{new Date(t.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" })}</span>
                </div>
                <p className="mt-1 whitespace-pre-line text-sm text-gray-700">{t.isi}</p>
                {t.kontak && d.petugas && <p className="text-xs text-gray-500">Kontak: {t.kontak}</p>}
                {t.tanggapan && <p className="mt-1 rounded-lg bg-emerald-50/60 px-3 py-2 text-sm text-emerald-900">Balasan{t.penanganNama ? ` (${t.penanganNama})` : ""}: {t.tanggapan}</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  {d.petugas && <button type="button" onClick={() => setBalas({ t, status: t.status === "BARU" ? "DIPROSES" : t.status, tanggapan: t.tanggapan ?? "" })} className="btn-modal-cancel px-3 text-xs">Balas</button>}
                  {(d.petugas || t.status === "BARU") && <button type="button" title="Hapus" onClick={async () => { if (await confirm("Hapus tiket ini?")) kirim(`/api/bantuan/${t.id}`, "DELETE", {}, "Tiket dihapus."); }} className="btn-modal-cancel px-2.5 text-xs"><Trash2 /></button>}
                </div>
              </li>
            ))}
          </ul></div>
        )}
      <Modal open={!!form} onClose={() => !sibuk && setForm(null)} title="Kirim pertanyaan / kendala" size="lg"
        footer={<><button type="button" onClick={() => setForm(null)} className="btn-modal-cancel">Batal</button>
          <button type="button" disabled={sibuk || (form?.isi.trim().length ?? 0) < 10} onClick={async () => { if (form && await kirim("/api/bantuan", "POST", form, "Terkirim ke petugas TU.")) setForm(null); }} className="btn-modal-save"><Send /> Kirim</button></>}>
        {form && d && (
          <div className="space-y-4">
            <div><label className="label-field">Kategori</label><Select value={form.kategori} onChange={v => setForm({ ...form, kategori: v })} options={Object.entries(d.kategori).map(([value, label]) => ({ value, label }))} /></div>
            <div><label htmlFor="isi-bantuan" className="label-field">Ceritakan kendalanya *</label><textarea id="isi-bantuan" rows={5} maxLength={2000} className="input-field" value={form.isi} onChange={e => setForm({ ...form, isi: e.target.value })} placeholder="Apa yang terjadi, di halaman apa, dan kapan" /></div>
            <div><label htmlFor="kontak-bantuan" className="label-field">Nomor yang bisa dihubungi (opsional)</label><input id="kontak-bantuan" className="input-field" maxLength={100} value={form.kontak} onChange={e => setForm({ ...form, kontak: e.target.value })} /></div>
            {form.kategori === "SANDI" && <p className="rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-800">Sandi akan disetel ulang oleh petugas TU menjadi sandi bawaan. Segera ganti sendiri setelah berhasil masuk.</p>}
          </div>
        )}
      </Modal>
      <Modal open={!!balas} onClose={() => !sibuk && setBalas(null)} title="Balas tiket bantuan" description={balas?.t.pengirimNama}
        footer={<><button type="button" onClick={() => setBalas(null)} className="btn-modal-cancel">Batal</button>
          <button type="button" disabled={sibuk} onClick={async () => { if (balas && await kirim(`/api/bantuan/${balas.t.id}`, "PATCH", { status: balas.status, tanggapan: balas.tanggapan }, "Balasan terkirim.")) setBalas(null); }} className="btn-modal-save"><Send /> Kirim Balasan</button></>}>
        {balas && (
          <div className="space-y-4">
            <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700 whitespace-pre-line">{balas.t.isi}</p>
            <div><label className="label-field">Status</label><Select value={balas.status} onChange={v => setBalas({ ...balas, status: v })} options={Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label }))} /></div>
            <div><label htmlFor="tanggapan-bantuan" className="label-field">Balasan</label><textarea id="tanggapan-bantuan" rows={4} maxLength={2000} className="input-field" value={balas.tanggapan} onChange={e => setBalas({ ...balas, tanggapan: e.target.value })} /></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
