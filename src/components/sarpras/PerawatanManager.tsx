"use client";
import { useCallback, useEffect, useState } from "react";
import { CalendarCheck, Check, Loader2, Pencil, Plus, Trash2, Wrench } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import Modal from "@/components/admin/Modal";
import EmptyState from "@/components/admin/EmptyState";
import DatePicker from "@/components/shared/DatePicker";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { hariIniWib, tgl } from "@/components/sarpras/sarpras-umum";
import { BarisKembali } from "@/components/shared/TombolKembali";

interface Jadwal {
  id: string; judul: string; lokasi: string | null; intervalHari: number; berikutnya: string; terakhir: string | null; penanggungJawab: string | null;
  lingkup: string; aktif: boolean; catatan: string | null; asset: { id: string; name: string; location: string | null } | null;
  riwayat: { id: string; tanggal: string; hasil: string; catatan: string | null; olehNama: string }[];
}
interface Data { akses: { penuh: boolean }; daftar: Jadwal[]; aset: { id: string; name: string; location: string | null }[] }

const INTERVAL = [
  { value: "7", label: "Tiap minggu" }, { value: "14", label: "Tiap 2 minggu" }, { value: "30", label: "Tiap bulan" },
  { value: "90", label: "Tiap 3 bulan" }, { value: "180", label: "Tiap 6 bulan" }, { value: "365", label: "Tiap tahun" },
];
const tglWib = (s: string) => new Date(new Date(s).getTime() + 7 * 3600_000).toISOString().slice(0, 10);

/** PERAWATAN BERKALA — jadwal servis AC, pembersihan komputer lab, pengecekan APAR, dll. Jatuh tempo masuk "Perlu tindakan". */
export default function PerawatanManager({ lingkupLab = false, kembaliHref }: { lingkupLab?: boolean; kembaliHref?: string }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState<Data | null>(null);
  const [galat, setGalat] = useState("");
  const [form, setForm] = useState<null | { id?: string; judul: string; assetId: string; lokasi: string; intervalHari: string; berikutnya: string; penanggungJawab: string; catatan: string }>(null);
  const [selesai, setSelesai] = useState<Jadwal | null>(null);
  const [hasil, setHasil] = useState({ tanggal: hariIniWib(), hasil: "BAIK", catatan: "" });
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(() => {
    fetch("/api/sarpras/perawatan", { cache: "no-store" }).then(async r => {
      const d = await r.json().catch(() => null);
      if (!r.ok) setGalat(d?.error ?? "Gagal memuat."); else setData(d);
    }).catch(() => setGalat("Gagal memuat."));
  }, []);
  useEffect(() => { muat(); }, [muat]);

  async function kirim(url: string, method: string, body: unknown, ok: string) {
    setSibuk(true);
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setSibuk(false);
    if (!r?.ok) { toast.error(d?.error ?? "Gagal menyimpan."); return false; }
    toast.success(ok); muat(); return true;
  }
  async function simpan() {
    if (!form) return;
    const body = { ...form, intervalHari: Number(form.intervalHari), berikutnya: `${form.berikutnya}T07:00:00+07:00` };
    if (await kirim(form.id ? `/api/sarpras/perawatan/${form.id}` : "/api/sarpras/perawatan", form.id ? "PATCH" : "POST", body, "Jadwal perawatan tersimpan.")) setForm(null);
  }

  const hariIni = hariIniWib();
  const status = (j: Jadwal) => {
    const t = tglWib(j.berikutnya);
    if (!j.aktif) return { label: "Nonaktif", kelas: "bg-gray-50 text-gray-500 border-gray-200" };
    if (t < hariIni) return { label: "Terlewat", kelas: "bg-red-50 text-red-600 border-red-200" };
    if (t === hariIni) return { label: "Hari ini", kelas: "bg-amber-50 text-amber-700 border-amber-200" };
    const sisa = Math.round((new Date(t).getTime() - new Date(hariIni).getTime()) / 86400000);
    return sisa <= 7 ? { label: `${sisa} hari lagi`, kelas: "bg-blue-50 text-blue-700 border-blue-200" } : { label: "Terjadwal", kelas: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  };
  const jatuhTempo = (data?.daftar ?? []).filter(j => j.aktif && tglWib(j.berikutnya) <= hariIni).length;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Wrench size={22} />} title={lingkupLab ? "Perawatan Lab" : "Perawatan Berkala"}
        description={data ? `${data.daftar.filter(j => j.aktif).length} jadwal aktif · ${jatuhTempo} jatuh tempo` : "Jadwal perawatan rutin sarana & prasarana"} />
      {kembaliHref && <BarisKembali href={kembaliHref} />}
      {galat ? <EmptyState icon={Wrench} title="Tidak tersedia" description={galat} /> : !data ? (
        <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
      ) : (
        <>
          <div className="alat-aksi justify-end mb-5">
            <button type="button" className="btn-modal-save" onClick={() => setForm({ judul: "", assetId: "", lokasi: "", intervalHari: "30", berikutnya: hariIni, penanggungJawab: "", catatan: "" })}><Plus /> Tambah Jadwal</button>
          </div>
          {data.daftar.length === 0 ? <EmptyState icon={Wrench} title="Belum ada jadwal perawatan" description="Contoh: servis AC tiap 3 bulan, bersihkan komputer lab tiap bulan, cek APAR tiap 6 bulan." /> : (
            <div className="panel overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Pekerjaan</th><th className="hidden md:table-cell">Interval</th><th>Berikutnya</th><th className="hidden lg:table-cell">Terakhir</th><th className="text-right">Aksi</th></tr></thead>
                <tbody>
                  {data.daftar.map(j => {
                    const st = status(j);
                    return (
                      <tr key={j.id}>
                        <td className="min-w-[12rem]">
                          <p className="font-semibold text-primary-900">{j.judul}</p>
                          <p className="text-xs text-gray-500">{j.asset ? `${j.asset.name}${j.asset.location ? ` · ${j.asset.location}` : ""}` : j.lokasi ?? "—"}{j.penanggungJawab ? ` · PJ ${j.penanggungJawab}` : ""}</p>
                        </td>
                        <td className="hidden md:table-cell text-xs text-gray-600">{INTERVAL.find(i => Number(i.value) === j.intervalHari)?.label ?? `Tiap ${j.intervalHari} hari`}</td>
                        <td className="whitespace-nowrap"><p className="text-sm">{tgl(j.berikutnya)}</p><span className={`status-badge ${st.kelas}`}>{st.label}</span></td>
                        <td className="hidden lg:table-cell text-xs text-gray-600">
                          {j.riwayat[0] ? <>{tgl(j.riwayat[0].tanggal)} · {j.riwayat[0].olehNama}{j.riwayat[0].hasil === "PERLU_PERBAIKAN" && <span className="ml-1 text-red-600">(perlu perbaikan)</span>}</> : "—"}
                        </td>
                        <td className="text-right whitespace-nowrap">
                          {j.aktif && <button type="button" onClick={() => { setSelesai(j); setHasil({ tanggal: hariIni, hasil: "BAIK", catatan: "" }); }} className="btn-modal-save px-2.5 text-xs"><CalendarCheck /> Dikerjakan</button>}
                          <button type="button" title="Edit" onClick={() => setForm({ id: j.id, judul: j.judul, assetId: j.asset?.id ?? "", lokasi: j.lokasi ?? "", intervalHari: String(j.intervalHari), berikutnya: tglWib(j.berikutnya), penanggungJawab: j.penanggungJawab ?? "", catatan: j.catatan ?? "" })}
                            className="ml-1 p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"><Pencil size={14} /></button>
                          <button type="button" title="Hapus" onClick={async () => { if (await confirm(`Hapus jadwal "${j.judul}"?`)) kirim(`/api/sarpras/perawatan/${j.id}`, "DELETE", {}, "Jadwal dihapus."); }}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"><Trash2 size={14} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <Modal open={!!form} onClose={() => !sibuk && setForm(null)} title={form?.id ? "Ubah jadwal perawatan" : "Jadwal perawatan baru"} size="lg"
        footer={<><button type="button" onClick={() => setForm(null)} className="btn-modal-cancel">Batal</button><button type="button" disabled={sibuk || !form?.judul.trim()} onClick={simpan} className="btn-modal-save">{sibuk ? <Loader2 className="animate-spin" /> : <Check />} Simpan</button></>}>
        {form && (
          <div className="space-y-4">
            <div><label htmlFor="judul-rawat" className="label-field">Pekerjaan *</label><input id="judul-rawat" className="input-field" maxLength={150} value={form.judul} onChange={e => setForm({ ...form, judul: e.target.value })} placeholder="mis. Servis AC, cek APAR, bersihkan PC lab" /></div>
            {!form.id && (
              <div><label className="label-field">Barang (opsional)</label>
                <Select value={form.assetId} onChange={v => setForm({ ...form, assetId: v })} placeholder="Tanpa barang tertentu"
                  options={[{ value: "", label: "— Tanpa barang tertentu —" }, ...(data?.aset ?? []).map(a => ({ value: a.id, label: `${a.name}${a.location ? ` — ${a.location}` : ""}` }))]} /></div>
            )}
            {!form.assetId && <div><label htmlFor="lokasi-rawat" className="label-field">Lokasi{lingkupLab ? " (mengandung kata Lab)" : ""}</label><input id="lokasi-rawat" className="input-field" maxLength={150} value={form.lokasi} onChange={e => setForm({ ...form, lokasi: e.target.value })} placeholder={lingkupLab ? "mis. Lab Komputer 1" : "mis. Gedung A, semua kelas"} /></div>}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><label className="label-field">Interval</label><Select value={form.intervalHari} onChange={v => setForm({ ...form, intervalHari: v })} options={INTERVAL.some(i => i.value === form.intervalHari) ? INTERVAL : [...INTERVAL, { value: form.intervalHari, label: `Tiap ${form.intervalHari} hari` }]} /></div>
              <div><label className="label-field">Dikerjakan berikutnya</label><DatePicker value={form.berikutnya} onChange={v => setForm({ ...form, berikutnya: v })} /></div>
            </div>
            <div><label htmlFor="pj-rawat" className="label-field">Penanggung jawab</label><input id="pj-rawat" className="input-field" maxLength={100} value={form.penanggungJawab} onChange={e => setForm({ ...form, penanggungJawab: e.target.value })} placeholder="mis. teknisi AC, laboran" /></div>
            <div><label htmlFor="catatan-rawat" className="label-field">Catatan</label><textarea id="catatan-rawat" rows={2} className="input-field" maxLength={500} value={form.catatan} onChange={e => setForm({ ...form, catatan: e.target.value })} /></div>
          </div>
        )}
      </Modal>

      <Modal open={!!selesai} onClose={() => !sibuk && setSelesai(null)} title="Perawatan dikerjakan" description={selesai?.judul}
        footer={<><button type="button" onClick={() => setSelesai(null)} className="btn-modal-cancel">Batal</button>
          <button type="button" disabled={sibuk} onClick={async () => { if (selesai && await kirim(`/api/sarpras/perawatan/${selesai.id}`, "PATCH", { aksi: "selesai", ...hasil, tanggal: `${hasil.tanggal}T12:00:00+07:00` }, "Perawatan tercatat; jadwal berikutnya diperbarui.")) setSelesai(null); }} className="btn-modal-save"><Check /> Simpan</button></>}>
        <div className="space-y-4">
          <div><label className="label-field">Tanggal dikerjakan</label><DatePicker value={hasil.tanggal} onChange={v => setHasil(h => ({ ...h, tanggal: v }))} /></div>
          <div><label className="label-field">Hasil</label><Select value={hasil.hasil} onChange={v => setHasil(h => ({ ...h, hasil: v }))} options={[{ value: "BAIK", label: "Baik / normal" }, { value: "PERLU_PERBAIKAN", label: "Ditemukan kerusakan (buat laporan)" }]} /></div>
          <div><label htmlFor="catatan-hasil" className="label-field">Catatan</label><textarea id="catatan-hasil" rows={3} className="input-field" maxLength={1000} value={hasil.catatan} onChange={e => setHasil(h => ({ ...h, catatan: e.target.value }))} /></div>
          {selesai && selesai.riwayat.length > 0 && (
            <div><p className="label-kecil mb-1">Riwayat</p><ul className="space-y-1 text-xs text-gray-600">{selesai.riwayat.map(r => <li key={r.id}>{tgl(r.tanggal)} · {r.olehNama} · {r.hasil === "BAIK" ? "baik" : "perlu perbaikan"}{r.catatan ? ` — ${r.catatan}` : ""}</li>)}</ul></div>
          )}
        </div>
      </Modal>
    </div>
  );
}
