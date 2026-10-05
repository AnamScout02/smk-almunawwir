"use client";
import TimePicker from "@/components/shared/TimePicker";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Plus, Trash2, Save, Loader2, Play, Volume2, Upload, X, MonitorPlay } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Modal from "@/components/admin/Modal";
import EmptyState from "@/components/admin/EmptyState";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { useToast } from "@/components/shared/ToastProvider";
import { playBellAudio, unlockAudio } from "@/lib/bell-chime";

interface BellItem { id: string; label: string; time: string; days: string; audioUrl: string | null; active: boolean; profil?: string; berlaku?: boolean }

const DAY_OPTIONS = ["SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
const DAY_SHORT: Record<string, string> = { SENIN: "Sen", SELASA: "Sel", RABU: "Rab", KAMIS: "Kam", JUMAT: "Jum", SABTU: "Sab" };

const EMPTY_FORM = { label: "", time: "06:45", days: [...DAY_OPTIONS], audioUrl: "" as string | null, active: true, profil: "REGULER" };

/** Profil bel (4 Okt 2026, src/lib/bel-profil.ts): bel UJIAN otomatis menggantikan bel REGULER pada tanggal
 *  Kegiatan Ujian yang aktif — di speaker pusat & semua TV. */
const PROFIL = [
  { nilai: "REGULER", label: "Bel Reguler" },
  { nilai: "UJIAN", label: "Bel Ujian" },
];

/** Bel Sekolah Otomatis — jadwal dikelola TU, diputar oleh halaman Player (/dashboard/admin/bel-sekolah/player)
 * yang dibuka di PC TU/Piket sepanjang hari. Native, browser-based — tidak ada hardware relay,
 * suara diputar lewat speaker yang tersambung ke PC itu (lihat bell-chime.ts). */
export default function BelSekolahPage() {
  const confirmDialog = useConfirm();
  const toast = useToast();
  const [items, setItems] = useState<BellItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<BellItem | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState("REGULER");
  const [hariIni, setHariIni] = useState<{ profil: string; kegiatan: string }>({ profil: "REGULER", kegiatan: "" });

  function load() {
    setLoading(true);
    fetch("/api/admin/bell-schedule")
      .then(r => {
        setHariIni({ profil: r.headers.get("X-Profil-Bel") || "REGULER", kegiatan: decodeURIComponent(r.headers.get("X-Kegiatan-Ujian") || "") });
        return r.json();
      })
      .then(d => setItems(Array.isArray(d) ? d : []))
      .catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  function openCreate() { setEditing(null); setForm({ ...EMPTY_FORM, profil: tab }); setModal(true); }
  function openEdit(item: BellItem) {
    setEditing(item);
    setForm({ label: item.label, time: item.time, days: item.days.split(","), audioUrl: item.audioUrl, active: item.active, profil: item.profil || "REGULER" });
    setModal(true);
  }
  function toggleDay(d: string) {
    setForm(f => ({ ...f, days: f.days.includes(d) ? f.days.filter(x => x !== d) : [...f.days, d] }));
  }

  async function handleUpload(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", "bel-sekolah");
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    setUploading(false);
    if (!res.ok) { const d = await res.json(); toast.error(d.error || "Gagal upload audio"); return; }
    const d = await res.json();
    setForm(f => ({ ...f, audioUrl: d.url }));
    toast.success("Audio berhasil diupload.");
  }

  async function handleSave() {
    if (!form.label.trim()) { toast.warning("Nama jadwal wajib diisi."); return; }
    if (form.days.length === 0) { toast.warning("Pilih minimal 1 hari."); return; }
    setSaving(true);
    const url = editing ? `/api/admin/bell-schedule/${editing.id}` : "/api/admin/bell-schedule";
    const res = await fetch(url, {
      method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); toast.error(d.error || "Gagal menyimpan"); return; }
    setModal(false); load();
  }

  async function handleDelete(id: string) {
    if (!await confirmDialog("Hapus jadwal bel ini? Tindakan ini tidak bisa dibatalkan.")) return;
    const res = await fetch(`/api/admin/bell-schedule/${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Gagal menghapus"); return; }
    load();
  }

  async function toggleActive(item: BellItem) {
    const res = await fetch(`/api/admin/bell-schedule/${item.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !item.active }),
    });
    if (!res.ok) { toast.error("Gagal mengubah status"); return; }
    load();
  }

  function testPlay(item: BellItem) {
    unlockAudio();
    playBellAudio(item.audioUrl);
    toast.success(`Menguji suara "${item.label}"...`);
  }

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Bell size={22} />} title="Bel Sekolah Otomatis"
        description="Jadwal bel otomatis — dimainkan lewat halaman Player yang dibuka di PC TU/Piket" />

      <div className="alat-aksi justify-end mb-5">
        <Link href="/dashboard/admin/bel-sekolah/player" target="_blank"
          className="btn-modal-cancel">
          <MonitorPlay size={15} /> Buka Player
        </Link>
        <button onClick={openCreate} className="btn-modal-save"><Plus size={15} /> Tambah Jadwal</button>
      </div>

      <div className="bg-blue-50 border border-blue-100 text-blue-700 rounded-xl p-4 text-sm mb-5">
        Buka halaman <strong>Player</strong> di PC yang tersambung ke speaker sekolah, biarkan terbuka sepanjang jam sekolah (mode layar penuh) — bel akan otomatis berbunyi sesuai jadwal di bawah. Tidak perlu hardware tambahan.
        <span className="mt-2 block">
          <strong>Bel Ujian</strong> otomatis menggantikan Bel Reguler pada tanggal <strong>Kegiatan Ujian</strong> yang aktif (diatur di
          Pusat Ujian), di speaker pusat dan semua TV. Selama Bel Ujian belum disusun, hari ujian tetap memakai Bel Reguler.
        </span>
      </div>

      <div className={`mb-5 rounded-xl border px-4 py-3 text-sm ${hariIni.profil === "UJIAN" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
        Hari ini berlaku: <strong>{hariIni.profil === "UJIAN" ? "Bel Ujian" : "Bel Reguler"}</strong>
        {hariIni.profil === "UJIAN" && hariIni.kegiatan ? ` — ${hariIni.kegiatan}` : ""}
      </div>

      <div className="baris-alat mb-5">
        <div className="alat-tab flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-gray-100 bg-white p-1 scrollbar-hide">
          {PROFIL.map(p => (
            <button key={p.nilai} type="button" onClick={() => setTab(p.nilai)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition ${tab === p.nilai ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
              {p.label} <span className="angka opacity-70">({items.filter(i => (i.profil || "REGULER") === p.nilai).length})</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
      ) : items.filter(i => (i.profil || "REGULER") === tab).length === 0 ? (
        <EmptyState icon={Bell} title={tab === "UJIAN" ? "Belum Ada Bel Ujian" : "Belum Ada Jadwal Bel"}
          description={tab === "UJIAN"
            ? "Susun bel untuk hari ujian, mis. Masuk Sesi 1 07.30, Selesai Sesi 1 09.30. Dipakai otomatis pada tanggal Kegiatan Ujian."
            : "Tambahkan jadwal bel pertama, mis. Bel Masuk jam 06:45."} />
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Waktu</th><th>Nama</th><th>Hari</th>
                  <th>Audio</th><th>Status</th><th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {items.filter(i => (i.profil || "REGULER") === tab).map(item => (
                  <tr key={item.id} className={`${!item.active ? "opacity-40" : ""}`}>
                    <td className="font-bold text-primary-900 font-mono">{item.time}</td>
                    <td>{item.label}</td>
                    <td className="text-xs text-gray-500">{item.days.split(",").map(d => DAY_SHORT[d] ?? d).join(", ")}</td>
                    <td className="text-xs text-gray-500">{item.audioUrl ? "Custom (MP3)" : "Nada Bawaan"}</td>
                    <td>
                      <button onClick={() => toggleActive(item)}
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${item.active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-400"}`}>
                        {item.active ? "Aktif" : "Nonaktif"}
                      </button>
                    </td>
                    <td className="text-right">
                      <div className="alat-aksi justify-end">
                        <button onClick={() => testPlay(item)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition" title="Tes Suara"><Play size={14} /></button>
                        <button onClick={() => openEdit(item)} className="p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg transition text-xs font-semibold px-2">Edit</button>
                        <button onClick={() => handleDelete(item.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? "Edit Jadwal Bel" : "Tambah Jadwal Bel"}
        footer={<>
          <button onClick={() => setModal(false)} className="btn-modal-cancel flex-1">Batal</button>
          <button onClick={handleSave} disabled={saving} className="btn-modal-save flex-1">{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan</button>
        </>}>
        <div className="space-y-4">
          <div>
            <label className="label-field">Nama Jadwal</label>
            <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} className="input-field" placeholder="cth: Bel Masuk, Pergantian Jam 1, Istirahat, Bel Pulang" />
          </div>
          <div>
            <label className="label-field">Jenis Bel</label>
            <div className="flex flex-wrap gap-2">
              {PROFIL.map(p => (
                <button key={p.nilai} type="button" onClick={() => setForm(f => ({ ...f, profil: p.nilai }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${form.profil === p.nilai ? "bg-primary-900 text-white border-primary-900" : "bg-white text-gray-400 border-gray-200"}`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label-field">Waktu</label>
            <TimePicker value={form.time} onChange={v => setForm(f => ({ ...f, time: v }))} className="w-40" />
          </div>
          <div>
            <label className="label-field">Hari</label>
            <div className="flex flex-wrap gap-2">
              {DAY_OPTIONS.map(d => (
                <button key={d} type="button" onClick={() => toggleDay(d)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${form.days.includes(d) ? "bg-primary-900 text-white border-primary-900" : "bg-white text-gray-400 border-gray-200"}`}>
                  {DAY_SHORT[d]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label-field">Audio</label>
            {form.audioUrl ? (
              <div className="flex items-center justify-between bg-primary-50 border border-primary-100 rounded-xl px-4 py-2.5">
                <div className="flex items-center gap-2 text-primary-900 text-sm font-semibold min-w-0"><Volume2 size={15} className="shrink-0" /> <span className="truncate">Audio custom terpasang</span></div>
                <button onClick={() => setForm(f => ({ ...f, audioUrl: "" }))} className="text-red-500 shrink-0"><X size={15} /></button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-500 border border-dashed border-gray-300 rounded-xl px-4 py-2.5 cursor-pointer hover:border-primary-300 transition flex-1">
                  {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                  {uploading ? "Mengupload..." : "Upload MP3 (opsional)"}
                  <input type="file" accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
                </label>
              </div>
            )}
            <p className="text-xs text-gray-400 mt-1.5">Kosongkan untuk pakai nada bel bawaan (tidak perlu file).</p>
          </div>
          {editing && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="w-4 h-4 rounded accent-primary-700" />
              Aktif
            </label>
          )}
        </div>
      </Modal>
    </div>
  );
}
