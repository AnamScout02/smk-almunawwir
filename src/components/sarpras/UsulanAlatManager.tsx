"use client";
import { useCallback, useEffect, useState } from "react";
import { Boxes, Loader2, Plus, Send, Trash2 } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import Modal from "@/components/admin/Modal";
import EmptyState from "@/components/admin/EmptyState";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";

interface Usulan { id: string; nama: string; jumlah: number; satuan: string; perkiraanHarga: number | null; alasan: string; majorId: string | null; lingkup: string; pengusulNama: string; status: string; tanggapan: string | null; createdAt: string }
const STATUS: Record<string, { label: string; kelas: string }> = {
  DIUSULKAN: { label: "Diusulkan", kelas: "bg-amber-50 text-amber-700 border-amber-200" },
  DISETUJUI: { label: "Disetujui", kelas: "bg-blue-50 text-blue-700 border-blue-200" },
  DIBELI: { label: "Sudah diadakan", kelas: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  DITOLAK: { label: "Belum bisa diadakan", kelas: "bg-gray-50 text-gray-600 border-gray-200" },
};
const rupiah = (n: number) => `Rp${n.toLocaleString("id-ID")}`;

/** USULAN ALAT & BAHAN PRAKTIK (17 Sep 2026) — pengusul melihat usulannya; pengelola Sarpras/Lab menindaklanjuti. */
export default function UsulanAlatManager() {
  const toast = useToast();
  const confirm = useConfirm();
  const [d, setD] = useState<{ kelola: boolean; jurusan: { id: string; code: string; name: string }[]; daftar: Usulan[] } | null>(null);
  const [form, setForm] = useState<null | { nama: string; jumlah: string; satuan: string; perkiraanHarga: string; alasan: string; majorId: string; lingkup: string }>(null);
  const [tindak, setTindak] = useState<null | { u: Usulan; status: string; tanggapan: string }>(null);
  const [saring, setSaring] = useState("DIUSULKAN");
  const [sibuk, setSibuk] = useState(false);
  const muat = useCallback(() => {
    fetch("/api/sarpras/usulan-alat", { cache: "no-store" }).then(r => r.json()).then(x => setD(x.daftar ? x : { kelola: false, jurusan: [], daftar: [] })).catch(() => setD({ kelola: false, jurusan: [], daftar: [] }));
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
  const total = daftar.reduce((a, u) => a + (u.perkiraanHarga ?? 0) * u.jumlah, 0);
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Boxes size={22} />} title="Usulan Alat & Bahan Praktik" description={d?.kelola ? "Usulan dari kaprogli, kepala lab, dan guru — tindak lanjuti pengadaannya" : "Usulkan alat atau bahan praktik yang dibutuhkan jurusan Anda"} />
      <div className="baris-alat mb-5">
        <div className="alat-saring"><Select value={saring} onChange={setSaring} options={[...Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label })), { value: "SEMUA", label: "Semua" }]} /></div>
        <div className="alat-aksi"><button type="button" onClick={() => setForm({ nama: "", jumlah: "1", satuan: "unit", perkiraanHarga: "", alasan: "", majorId: "", lingkup: "SARPRAS" })} className="btn-modal-save"><Plus /> Usulkan</button></div>
      </div>
      {!d ? <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
        : daftar.length === 0 ? <EmptyState icon={Boxes} title="Belum ada usulan" description="Usulkan alat/bahan praktik yang dibutuhkan agar bisa dianggarkan." />
        : (
          <>
            {total > 0 && <p className="mb-3 text-sm text-gray-600">Perkiraan biaya daftar ini: <strong className="angka">{rupiah(total)}</strong></p>}
            <div className="panel overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Alat / bahan</th><th className="text-center">Jumlah</th><th className="hidden md:table-cell">Perkiraan</th><th>Status</th><th className="text-right">Aksi</th></tr></thead>
                <tbody>{daftar.map(u => (
                  <tr key={u.id}>
                    <td className="min-w-[12rem]">
                      <p className="font-semibold text-primary-900">{u.nama}{u.lingkup === "LAB" && <span className="ml-2 status-badge bg-purple-50 text-purple-700 border-purple-200">Lab</span>}</p>
                      <p className="text-xs text-gray-500">{u.pengusulNama}{u.majorId ? ` · ${d.jurusan.find(j => j.id === u.majorId)?.code ?? ""}` : ""}</p>
                      <p className="text-xs text-gray-600">{u.alasan}</p>
                      {u.tanggapan && <p className="text-xs text-emerald-800">Sarpras: {u.tanggapan}</p>}
                    </td>
                    <td className="angka text-center whitespace-nowrap">{u.jumlah} {u.satuan}</td>
                    <td className="hidden md:table-cell text-xs whitespace-nowrap">{u.perkiraanHarga ? rupiah(u.perkiraanHarga * u.jumlah) : "—"}</td>
                    <td><span className={`status-badge ${STATUS[u.status]?.kelas}`}>{STATUS[u.status]?.label}</span></td>
                    <td className="text-right whitespace-nowrap">
                      {d.kelola && <button type="button" onClick={() => setTindak({ u, status: u.status === "DIUSULKAN" ? "DISETUJUI" : u.status, tanggapan: u.tanggapan ?? "" })} className="btn-modal-cancel px-2.5 text-xs">Tindak lanjut</button>}
                      {(d.kelola || u.status === "DIUSULKAN") && <button type="button" title="Hapus" onClick={async () => { if (await confirm(`Hapus usulan "${u.nama}"?`)) kirim(`/api/sarpras/usulan-alat/${u.id}`, "DELETE", {}, "Usulan dihapus."); }} className="ml-1 p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"><Trash2 size={14} /></button>}
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </>
        )}
      <Modal open={!!form} onClose={() => !sibuk && setForm(null)} title="Usulkan alat / bahan praktik" size="lg"
        footer={<><button type="button" onClick={() => setForm(null)} className="btn-modal-cancel">Batal</button>
          <button type="button" disabled={sibuk || (form?.nama.trim().length ?? 0) < 2 || (form?.alasan.trim().length ?? 0) < 5} onClick={async () => { if (form && await kirim("/api/sarpras/usulan-alat", "POST", { ...form, jumlah: Number(form.jumlah), perkiraanHarga: Number(form.perkiraanHarga) || null }, "Usulan terkirim ke Sarpras.")) setForm(null); }} className="btn-modal-save"><Send /> Kirim</button></>}>
        {form && d && (
          <div className="space-y-4">
            <div><label htmlFor="nama-alat" className="label-field">Nama alat/bahan *</label><input id="nama-alat" className="input-field" maxLength={200} value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })} placeholder="mis. Kabel UTP Cat6, tinta plotter" /></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div><label htmlFor="jumlah-alat" className="label-field">Jumlah</label><input id="jumlah-alat" type="number" min={1} className="input-field" value={form.jumlah} onChange={e => setForm({ ...form, jumlah: e.target.value })} /></div>
              <div><label htmlFor="satuan-alat" className="label-field">Satuan</label><input id="satuan-alat" className="input-field" maxLength={20} value={form.satuan} onChange={e => setForm({ ...form, satuan: e.target.value })} /></div>
              <div><label htmlFor="harga-alat" className="label-field">Perkiraan harga/satuan</label><input id="harga-alat" type="number" min={0} className="input-field" value={form.perkiraanHarga} onChange={e => setForm({ ...form, perkiraanHarga: e.target.value })} placeholder="opsional" /></div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><label className="label-field">Jurusan (opsional)</label><Select value={form.majorId} onChange={v => setForm({ ...form, majorId: v })} options={[{ value: "", label: "Umum / semua jurusan" }, ...d.jurusan.map(j => ({ value: j.id, label: `${j.code} — ${j.name}` }))]} /></div>
              <div><label className="label-field">Untuk</label><Select value={form.lingkup} onChange={v => setForm({ ...form, lingkup: v })} options={[{ value: "SARPRAS", label: "Sarana umum / bengkel" }, { value: "LAB", label: "Laboratorium" }]} /></div>
            </div>
            <div><label htmlFor="alasan-alat" className="label-field">Alasan kebutuhan *</label><textarea id="alasan-alat" rows={3} maxLength={1000} className="input-field" value={form.alasan} onChange={e => setForm({ ...form, alasan: e.target.value })} placeholder="Dipakai untuk praktik apa, kondisi sekarang bagaimana" /></div>
          </div>
        )}
      </Modal>
      <Modal open={!!tindak} onClose={() => !sibuk && setTindak(null)} title="Tindak lanjut usulan" description={tindak?.u.nama}
        footer={<><button type="button" onClick={() => setTindak(null)} className="btn-modal-cancel">Batal</button>
          <button type="button" disabled={sibuk} onClick={async () => { if (tindak && await kirim(`/api/sarpras/usulan-alat/${tindak.u.id}`, "PATCH", { status: tindak.status, tanggapan: tindak.tanggapan }, "Tersimpan; pengusul diberi tahu.")) setTindak(null); }} className="btn-modal-save"><Send /> Simpan</button></>}>
        {tindak && (
          <div className="space-y-4">
            <div><label className="label-field">Status</label><Select value={tindak.status} onChange={v => setTindak({ ...tindak, status: v })} options={Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label }))} /></div>
            <div><label htmlFor="tanggapan-alat" className="label-field">Tanggapan</label><textarea id="tanggapan-alat" rows={3} maxLength={500} className="input-field" value={tindak.tanggapan} onChange={e => setTindak({ ...tindak, tanggapan: e.target.value })} placeholder="mis. masuk anggaran triwulan depan" /></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
