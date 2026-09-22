"use client";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, BriefcaseBusiness, Loader2, Pencil, Plus, Save, Trash2, Users } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import Modal from "@/components/admin/Modal";
import EmptyState from "@/components/admin/EmptyState";
import ImageUpload from "@/components/admin/ImageUpload";
import DatePicker from "@/components/shared/DatePicker";
import PilihBanyak from "@/components/shared/PilihBanyak";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";

interface Lowongan { id: string; judul: string; perusahaan: string; partnerId: string | null; lokasi: string | null; jenis: string; jurusanIds: string[]; kualifikasi: string; deskripsi: string | null; gaji: string | null; batas: string | null; kontak: string | null; tautanLamar: string | null; posterUrl: string | null; aktif: boolean; pembuatNama: string; jumlahMinat: number }
interface Data { jenis: Record<string, string>; jurusan: { id: string; code: string; name: string }[]; mitra: { id: string; name: string }[]; daftar: Lowongan[] }
interface Peminat { studentId: string; status: string; catatan: string | null; pada: string; nama: string; nis: string; kelas: string; email: string; hp: string }
const STATUS: Record<string, string> = { BERMINAT: "Berminat", DIKIRIM: "Berkas dikirim", PANGGILAN: "Dipanggil tes", DITERIMA: "Diterima", TIDAK_LOLOS: "Tidak lolos" };
const kosong = () => ({ judul: "", perusahaan: "", partnerId: "", lokasi: "", jenis: "PENUH_WAKTU", jurusanIds: [] as string[], kualifikasi: "", deskripsi: "", gaji: "", batas: "", kontak: "", tautanLamar: "", posterUrl: "", aktif: true });
const tglWib = (s: string) => new Date(new Date(s).getTime() + 7 * 3600_000).toISOString().slice(0, 10);

/** KELOLA LOWONGAN KERJA BKK (17 Sep 2026). */
export default function LowonganManager() {
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState<Data | null>(null);
  const [galat, setGalat] = useState("");
  const [form, setForm] = useState<(ReturnType<typeof kosong> & { id?: string }) | null>(null);
  const [peminat, setPeminat] = useState<{ l: Lowongan; daftar: Peminat[] | null } | null>(null);
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(() => {
    fetch("/api/bkk/lowongan", { cache: "no-store" }).then(async r => {
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.kelola) setGalat(d?.error ?? "Khusus pengelola BKK."); else setData(d);
    }).catch(() => setGalat("Gagal memuat."));
  }, []);
  useEffect(() => { muat(); }, [muat]);

  async function simpan() {
    if (!form) return;
    setSibuk(true);
    const body = { ...form, batas: form.batas ? `${form.batas}T23:59:59+07:00` : null };
    const r = await fetch(form.id ? `/api/bkk/lowongan/${form.id}` : "/api/bkk/lowongan", { method: form.id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setSibuk(false);
    if (!r?.ok) { toast.error(d?.error ?? "Gagal menyimpan."); return; }
    toast.success(form.id ? "Lowongan diperbarui." : "Lowongan terbit — siswa kelas XII yang sesuai menerima notifikasi.");
    setForm(null); muat();
  }
  async function bukaPeminat(l: Lowongan) {
    setPeminat({ l, daftar: null });
    const d = await fetch(`/api/bkk/lowongan/${l.id}`, { cache: "no-store" }).then(r => r.json()).catch(() => null);
    setPeminat({ l, daftar: d?.peminat ?? [] });
  }
  async function ubahStatus(studentId: string, status: string) {
    if (!peminat) return;
    const r = await fetch(`/api/bkk/lowongan/${peminat.l.id}/minat`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentId, status }) }).catch(() => null);
    if (r?.ok) { toast.success("Status diperbarui & siswa diberi tahu."); bukaPeminat(peminat.l); } else toast.error("Gagal.");
  }

  if (peminat) return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Users size={22} />} title={`Peminat: ${peminat.l.judul}`} description={`${peminat.l.perusahaan} · ${peminat.daftar?.length ?? "…"} siswa`} />
      <div className="alat-aksi justify-end mb-5"><button type="button" onClick={() => { setPeminat(null); muat(); }} className="btn-modal-cancel"><ArrowLeft /> Kembali</button></div>
      {!peminat.daftar ? <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
        : peminat.daftar.length === 0 ? <EmptyState icon={Users} title="Belum ada peminat" description="Siswa yang menekan Saya Berminat tampil di sini." />
        : (
          <div className="panel overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Siswa</th><th className="hidden md:table-cell">Kontak</th><th>Catatan</th><th>Status</th></tr></thead>
              <tbody>{peminat.daftar.map(p => (
                <tr key={p.studentId}>
                  <td className="min-w-[10rem]"><p className="font-semibold text-primary-900">{p.nama}</p><p className="text-xs text-gray-500">{p.kelas} · NIS {p.nis}</p></td>
                  <td className="hidden md:table-cell text-xs text-gray-600">{p.hp || "—"}<br />{p.email}</td>
                  <td className="text-xs text-gray-600 min-w-[10rem]">{p.catatan ?? "—"}</td>
                  <td className="min-w-[11rem]"><Select value={p.status} onChange={v => ubahStatus(p.studentId, v)} options={Object.entries(STATUS).map(([value, label]) => ({ value, label }))} /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
    </div>
  );

  const hariIni = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<BriefcaseBusiness size={22} />} title="Lowongan Kerja BKK" description="Informasi lowongan untuk siswa kelas XII (hanya terlihat setelah login)" />
      {galat ? <EmptyState icon={BriefcaseBusiness} title="Tidak tersedia" description={galat} /> : !data ? (
        <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
      ) : (
        <>
          <div className="alat-aksi justify-end mb-5"><button type="button" onClick={() => setForm(kosong())} className="btn-modal-save"><Plus /> Tambah Lowongan</button></div>
          {data.daftar.length === 0 ? <EmptyState icon={BriefcaseBusiness} title="Belum ada lowongan" description="Tambahkan lowongan dari mitra industri atau info kerja lainnya." /> : (
            <div className="panel overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Posisi</th><th className="hidden md:table-cell">Jurusan</th><th className="hidden md:table-cell">Batas</th><th className="text-center">Peminat</th><th>Status</th><th className="text-right">Aksi</th></tr></thead>
                <tbody>{data.daftar.map(l => {
                  const lewat = l.batas && tglWib(l.batas) < hariIni;
                  return (
                    <tr key={l.id}>
                      <td className="min-w-[12rem]"><p className="font-semibold text-primary-900">{l.judul}</p><p className="text-xs text-gray-500">{l.perusahaan}{l.lokasi ? ` · ${l.lokasi}` : ""} · {data.jenis[l.jenis]}</p></td>
                      <td className="hidden md:table-cell text-xs text-gray-600">{l.jurusanIds.length ? l.jurusanIds.map(id => data.jurusan.find(j => j.id === id)?.code ?? "?").join(", ") : "Semua"}</td>
                      <td className="hidden md:table-cell text-xs whitespace-nowrap">{l.batas ? new Date(l.batas).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }) : "—"}</td>
                      <td className="text-center"><button type="button" onClick={() => bukaPeminat(l)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-primary-700 hover:bg-primary-50"><Users size={14} /> {l.jumlahMinat}</button></td>
                      <td>
                        <button type="button" onClick={async () => { const r = await fetch(`/api/bkk/lowongan/${l.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aktif: !l.aktif }) }).catch(() => null); if (r?.ok) muat(); }}
                          className={`status-badge ${lewat ? "bg-gray-50 text-gray-500 border-gray-200" : l.aktif ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-50 text-gray-500 border-gray-200"}`}>{lewat ? "Lewat batas" : l.aktif ? "Tayang" : "Disembunyikan"}</button>
                      </td>
                      <td className="text-right whitespace-nowrap">
                        <button type="button" title="Edit" onClick={() => setForm({ id: l.id, judul: l.judul, perusahaan: l.perusahaan, partnerId: l.partnerId ?? "", lokasi: l.lokasi ?? "", jenis: l.jenis, jurusanIds: l.jurusanIds, kualifikasi: l.kualifikasi, deskripsi: l.deskripsi ?? "", gaji: l.gaji ?? "", batas: l.batas ? tglWib(l.batas) : "", kontak: l.kontak ?? "", tautanLamar: l.tautanLamar ?? "", posterUrl: l.posterUrl ?? "", aktif: l.aktif })}
                          className="p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg"><Pencil size={14} /></button>
                        <button type="button" title="Hapus" onClick={async () => { if (await confirm(`Hapus lowongan "${l.judul}"?`)) { const r = await fetch(`/api/bkk/lowongan/${l.id}`, { method: "DELETE" }).catch(() => null); if (r?.ok) muat(); } }}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          )}
        </>
      )}
      <Modal open={!!form} onClose={() => !sibuk && setForm(null)} title={form?.id ? "Ubah lowongan" : "Lowongan baru"} size="xl" scrollBody
        footer={<><button type="button" onClick={() => setForm(null)} className="btn-modal-cancel">Batal</button><button type="button" disabled={sibuk} onClick={simpan} className="btn-modal-save">{sibuk ? <Loader2 className="animate-spin" /> : <Save />} Simpan</button></>}>
        {form && data && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><label htmlFor="posisi" className="label-field">Posisi *</label><input id="posisi" className="input-field" maxLength={150} value={form.judul} onChange={e => setForm({ ...form, judul: e.target.value })} placeholder="mis. Teknisi Jaringan" /></div>
              <div><label className="label-field">Mitra industri (opsional)</label>
                <Select value={form.partnerId} onChange={v => setForm({ ...form, partnerId: v, perusahaan: data.mitra.find(m => m.id === v)?.name ?? form.perusahaan })} placeholder="Pilih mitra" options={[{ value: "", label: "— Bukan mitra —" }, ...data.mitra.map(m => ({ value: m.id, label: m.name }))]} /></div>
              <div><label htmlFor="perusahaan" className="label-field">Perusahaan *</label><input id="perusahaan" className="input-field" maxLength={150} value={form.perusahaan} onChange={e => setForm({ ...form, perusahaan: e.target.value })} /></div>
              <div><label htmlFor="lokasi-kerja" className="label-field">Lokasi</label><input id="lokasi-kerja" className="input-field" maxLength={150} value={form.lokasi} onChange={e => setForm({ ...form, lokasi: e.target.value })} /></div>
              <div><label className="label-field">Jenis</label><Select value={form.jenis} onChange={v => setForm({ ...form, jenis: v })} options={Object.entries(data.jenis).map(([value, label]) => ({ value, label }))} /></div>
              <div><label className="label-field">Batas lamaran</label><DatePicker value={form.batas} onChange={v => setForm({ ...form, batas: v })} placeholder="Tanpa batas" /></div>
            </div>
            <PilihBanyak label="Jurusan sasaran (kosongkan = semua jurusan)" opsi={data.jurusan.map(j => ({ value: j.id, label: j.code }))} nilai={form.jurusanIds} onChange={v => setForm({ ...form, jurusanIds: v })} />
            <div><label htmlFor="kualifikasi" className="label-field">Kualifikasi *</label><textarea id="kualifikasi" rows={4} maxLength={3000} className="input-field" value={form.kualifikasi} onChange={e => setForm({ ...form, kualifikasi: e.target.value })} placeholder="Satu syarat per baris" /></div>
            <div><label htmlFor="deskripsi-kerja" className="label-field">Deskripsi pekerjaan</label><textarea id="deskripsi-kerja" rows={3} maxLength={5000} className="input-field" value={form.deskripsi} onChange={e => setForm({ ...form, deskripsi: e.target.value })} /></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div><label htmlFor="gaji" className="label-field">Gaji/fasilitas</label><input id="gaji" className="input-field" maxLength={100} value={form.gaji} onChange={e => setForm({ ...form, gaji: e.target.value })} placeholder="mis. UMR + makan" /></div>
              <div><label htmlFor="kontak-kerja" className="label-field">Kontak</label><input id="kontak-kerja" className="input-field" maxLength={200} value={form.kontak} onChange={e => setForm({ ...form, kontak: e.target.value })} /></div>
              <div><label htmlFor="tautan-lamar" className="label-field">Tautan lamaran</label><input id="tautan-lamar" className="input-field" maxLength={500} value={form.tautanLamar} onChange={e => setForm({ ...form, tautanLamar: e.target.value })} placeholder="https://…" /></div>
            </div>
            <ImageUpload value={form.posterUrl} onChange={v => setForm({ ...form, posterUrl: v })} folder="bkk" label="Poster lowongan (opsional)" />
            <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.aktif} onChange={e => setForm({ ...form, aktif: e.target.checked })} className="h-4 w-4 rounded border-gray-300" /> Tayangkan sekarang</label>
          </div>
        )}
      </Modal>
    </div>
  );
}
