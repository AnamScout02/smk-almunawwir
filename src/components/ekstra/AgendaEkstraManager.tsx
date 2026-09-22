"use client";
import TimePicker from "@/components/shared/TimePicker";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Award, CalendarClock, Loader2, Plus, Trash2 } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import Modal from "@/components/admin/Modal";
import EmptyState from "@/components/admin/EmptyState";
import { WaktuPilih, hariIniWib, keIso, rentang } from "@/components/sarpras/sarpras-umum";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";

interface Agenda { id: string; extracurricularId: string; judul: string; jenis: string; mulai: string; selesai: string | null; tempat: string | null; catatan: string | null; hasil: string | null; olehNama: string }
const JENIS: Record<string, string> = { LATIHAN: "Latihan", LOMBA: "Lomba", PENTAS: "Pentas/pameran", RAPAT: "Rapat" };
const WARNA: Record<string, string> = { LATIHAN: "bg-blue-50 text-blue-700 border-blue-200", LOMBA: "bg-amber-50 text-amber-700 border-amber-200", PENTAS: "bg-purple-50 text-purple-700 border-purple-200", RAPAT: "bg-gray-50 text-gray-600 border-gray-200" };

/** JADWAL LATIHAN & LOMBA EKSTRAKURIKULER (17 Sep 2026). */
export default function AgendaEkstraManager() {
  const toast = useToast();
  const confirm = useConfirm();
  const [d, setD] = useState<{ ekskul: { id: string; name: string }[]; agenda: Agenda[] } | null>(null);
  const [galat, setGalat] = useState("");
  const [form, setForm] = useState<null | { extracurricularId: string; judul: string; jenis: string; tanggal: string; jam: string; jamSelesai: string; tempat: string; catatan: string; hasil: string; kabari: boolean }>(null);
  const [sibuk, setSibuk] = useState(false);
  const muat = useCallback(() => {
    fetch("/api/teacher/ekstrakurikuler-agenda", { cache: "no-store" }).then(async r => {
      const x = await r.json().catch(() => null);
      if (!r.ok) setGalat(x?.error ?? "Gagal memuat."); else setD(x);
    }).catch(() => setGalat("Gagal memuat."));
  }, []);
  useEffect(() => { muat(); }, [muat]);
  async function simpan() {
    if (!form) return;
    setSibuk(true);
    const body = { ...form, mulai: keIso(form.tanggal, form.jam), selesai: form.jamSelesai ? keIso(form.tanggal, form.jamSelesai) : null };
    const r = await fetch("/api/teacher/ekstrakurikuler-agenda", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const x = await r?.json().catch(() => null);
    setSibuk(false);
    if (!r?.ok) { toast.error(x?.error ?? "Gagal menyimpan."); return; }
    toast.success(form.kabari ? "Agenda tersimpan & anggota diberi tahu." : "Agenda tersimpan.");
    setForm(null); muat();
  }
  const nama = (id: string) => d?.ekskul.find(e => e.id === id)?.name ?? "";
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<CalendarClock size={22} />} title="Jadwal Latihan & Lomba" description="Agenda ekstrakurikuler binaan Anda — anggota bisa dikabari lewat notifikasi" />
      {galat ? <EmptyState icon={CalendarClock} title="Tidak tersedia" description={galat} /> : !d ? (
        <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
      ) : (
        <>
          <div className="baris-alat mb-5">
            <div className="alat-aksi">
              <Link href="/dashboard/teacher/ekstrakurikuler/nilai" className="btn-modal-cancel btn-teks"><Award /> Nilai Ekstra</Link>
              <button type="button" onClick={() => setForm({ extracurricularId: d.ekskul[0]?.id ?? "", judul: "", jenis: "LATIHAN", tanggal: hariIniWib(), jam: "15:30", jamSelesai: "17:00", tempat: "", catatan: "", hasil: "", kabari: true })} className="btn-modal-save"><Plus /> Tambah Agenda</button>
            </div>
          </div>
          {d.agenda.length === 0 ? <EmptyState icon={CalendarClock} title="Belum ada agenda" description="Tambahkan jadwal latihan rutin atau rencana lomba." /> : (
            <div className="panel overflow-hidden"><ul className="divide-y divide-gray-50">
              {d.agenda.map(a => (
                <li key={a.id} className="flex flex-wrap items-start gap-2 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-primary-900">{a.judul}</p>
                      <span className={`status-badge ${WARNA[a.jenis] ?? ""}`}>{JENIS[a.jenis] ?? a.jenis}</span>
                      <span className="text-xs text-gray-500">{nama(a.extracurricularId)}</span>
                    </div>
                    <p className="text-xs text-gray-600">{rentang(a.mulai, a.selesai ?? a.mulai)}{a.tempat ? ` · ${a.tempat}` : ""}</p>
                    {a.catatan && <p className="mt-1 text-sm text-gray-700">{a.catatan}</p>}
                    {a.hasil && <p className="mt-1 text-sm font-medium text-emerald-800">Hasil: {a.hasil}</p>}
                  </div>
                  <button type="button" title="Hapus" onClick={async () => { if (await confirm(`Hapus agenda "${a.judul}"?`)) { const r = await fetch(`/api/teacher/ekstrakurikuler-agenda?id=${a.id}`, { method: "DELETE" }).catch(() => null); if (r?.ok) muat(); else toast.error("Gagal menghapus."); } }}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"><Trash2 size={14} /></button>
                </li>
              ))}
            </ul></div>
          )}
        </>
      )}
      <Modal open={!!form} onClose={() => !sibuk && setForm(null)} title="Agenda ekstrakurikuler" size="lg" scrollBody
        footer={<><button type="button" onClick={() => setForm(null)} className="btn-modal-cancel">Batal</button><button type="button" disabled={sibuk || !form?.judul.trim()} onClick={simpan} className="btn-modal-save">{sibuk ? <Loader2 className="animate-spin" /> : <Plus />} Simpan</button></>}>
        {form && d && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><label className="label-field">Ekstrakurikuler</label><Select value={form.extracurricularId} onChange={v => setForm({ ...form, extracurricularId: v })} options={d.ekskul.map(e => ({ value: e.id, label: e.name }))} /></div>
              <div><label className="label-field">Jenis</label><Select value={form.jenis} onChange={v => setForm({ ...form, jenis: v })} options={Object.entries(JENIS).map(([value, label]) => ({ value, label }))} /></div>
            </div>
            <div><label htmlFor="judul-agenda" className="label-field">Judul *</label><input id="judul-agenda" className="input-field" maxLength={200} value={form.judul} onChange={e => setForm({ ...form, judul: e.target.value })} placeholder="mis. Latihan rutin, Lomba LKBB tingkat kabupaten" /></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <WaktuPilih id="jam-agenda" label="Mulai" tanggal={form.tanggal} jam={form.jam} onTanggal={v => setForm({ ...form, tanggal: v })} onJam={v => setForm({ ...form, jam: v })} />
              <div><label htmlFor="jam-selesai-agenda" className="label-field">Selesai (jam)</label><TimePicker value={form.jamSelesai} onChange={v => setForm({ ...form, jamSelesai: v })} id="jam-selesai-agenda" /></div>
            </div>
            <div><label htmlFor="tempat-agenda" className="label-field">Tempat</label><input id="tempat-agenda" className="input-field" maxLength={150} value={form.tempat} onChange={e => setForm({ ...form, tempat: e.target.value })} /></div>
            <div><label htmlFor="catatan-agenda" className="label-field">Catatan</label><textarea id="catatan-agenda" rows={2} maxLength={1000} className="input-field" value={form.catatan} onChange={e => setForm({ ...form, catatan: e.target.value })} /></div>
            {form.jenis === "LOMBA" && <div><label htmlFor="hasil-agenda" className="label-field">Hasil (bila sudah selesai)</label><input id="hasil-agenda" className="input-field" maxLength={300} value={form.hasil} onChange={e => setForm({ ...form, hasil: e.target.value })} placeholder="mis. Juara 2 tingkat kabupaten" /></div>}
            <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.kabari} onChange={e => setForm({ ...form, kabari: e.target.checked })} className="h-4 w-4 rounded border-gray-300" /> Kabari anggota lewat notifikasi</label>
          </div>
        )}
      </Modal>
    </div>
  );
}
