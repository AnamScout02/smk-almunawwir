"use client";
import React, { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Clock, Loader2, Wand2 } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import Modal from "@/components/admin/Modal";
import Alert from "@/components/admin/Alert";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { useToast } from "@/components/shared/ToastProvider";

interface PeriodItem {
  id: string; day: string; order: number; startTime: string; endTime: string; isBreak: boolean; label: string | null;
}

const DAYS = ["SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
const DAY_LABEL: Record<string, string> = {
  SENIN: "Senin", SELASA: "Selasa", RABU: "Rabu",
  KAMIS: "Kamis", JUMAT: "Jumat", SABTU: "Sabtu",
};
const DAY_COLOR: Record<string, string> = {
  SENIN: "bg-blue-50 border-blue-200 text-blue-800",
  SELASA: "bg-emerald-50 border-emerald-200 text-emerald-800",
  RABU: "bg-amber-50 border-amber-200 text-amber-800",
  KAMIS: "bg-purple-50 border-purple-200 text-purple-800",
  JUMAT: "bg-rose-50 border-rose-200 text-rose-800",
  SABTU: "bg-gray-50 border-gray-200 text-gray-700",
};

const emptyForm = { day: "SENIN", order: "1", startTime: "07:00", endTime: "07:45", isBreak: false, label: "" };

export default function SchoolPeriodsPage() {
  const confirmDialog = useConfirm();
  const toast = useToast();
  const [periods, setPeriods] = useState<PeriodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PeriodItem | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/school-periods");
    setPeriods(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew(day?: string) {
    const dayPeriods = periods.filter(p => p.day === (day ?? "SENIN"));
    const nextOrder = dayPeriods.length > 0 ? Math.max(...dayPeriods.map(p => p.order)) + 1 : 1;
    setForm({ ...emptyForm, day: day ?? "SENIN", order: String(nextOrder) });
    setEditing(null); setShowForm(true); setMsg("");
  }
  function openEdit(p: PeriodItem) {
    setForm({ day: p.day, order: String(p.order), startTime: p.startTime, endTime: p.endTime, isBreak: p.isBreak, label: p.label ?? "" });
    setEditing(p); setShowForm(true); setMsg("");
  }

  async function save() {
    if (!form.day || !form.order || !form.startTime || !form.endTime) { setMsg("Data tidak lengkap"); return; }
    setSaving(true);
    const method = editing ? "PUT" : "POST";
    const url = editing ? `/api/admin/school-periods/${editing.id}` : "/api/admin/school-periods";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (res.ok) { setShowForm(false); load(); }
    else { const d = await res.json(); setMsg(d.error || "Gagal menyimpan"); }
    setSaving(false);
  }

  async function remove(id: string) {
    if (!(await confirmDialog("Hapus jam pelajaran ini?"))) return;
    await fetch(`/api/admin/school-periods/${id}`, { method: "DELETE" });
    load();
  }

  async function seedDefault(replace: boolean) {
    if (replace && !(await confirmDialog("Ini akan menghapus SEMUA kerangka jam yang ada dan menggantinya dengan default. Lanjutkan?"))) return;
    setSeeding(true);
    const res = await fetch("/api/admin/school-periods/seed-default", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ replace }),
    });
    if (res.ok) load();
    else { const d = await res.json(); toast.error(d.error || "Gagal membuat default"); }
    setSeeding(false);
  }

  const byDay = DAYS.reduce<Record<string, PeriodItem[]>>((acc, d) => {
    acc[d] = periods.filter(p => p.day === d).sort((a, b) => a.order - b.order);
    return acc;
  }, {} as Record<string, PeriodItem[]>);

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<Clock size={22} />}
        title="Kerangka Jam Pelajaran"
        description="Kerangka jam ke-1 s/d ke-N per hari — dipakai sebagai slot oleh Generate Jadwal Otomatis"
      />

      <div className="flex flex-wrap gap-2 mb-5">
        {periods.length === 0 ? (
          <button onClick={() => seedDefault(false)} disabled={seeding} className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl border border-primary-100 bg-primary-50 text-primary-700 hover:bg-primary-100 transition disabled:opacity-60">
            {seeding ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />} Buat Default Otomatis
          </button>
        ) : (
          <button onClick={() => seedDefault(true)} disabled={seeding} className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl border border-primary-100 bg-primary-50 text-primary-700 hover:bg-primary-100 transition disabled:opacity-60">
            {seeding ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />} Ganti dengan Default
          </button>
        )}
        <button onClick={() => openNew()} className="btn-gold flex items-center gap-2 text-sm sm:ml-auto">
          <Plus size={15} /> Tambah Jam
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-primary-500" size={32} /></div>
      ) : periods.length === 0 ? (
        <Alert variant="warning">
          Belum ada kerangka jam pelajaran. Klik <strong>Buat Default Otomatis</strong> untuk mulai dari template standar (Senin–Sabtu 10 jam, Jumat 6 jam), lalu sesuaikan sesuai kebutuhan.
        </Alert>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {DAYS.map(day => (
            <div key={day} className={`rounded-2xl border-2 ${DAY_COLOR[day]} overflow-hidden`}>
              <div className="px-4 py-3 flex items-center justify-between">
                <h3 className="font-heading font-bold text-sm">{DAY_LABEL[day]}</h3>
                <button onClick={() => openNew(day)} className="text-xs opacity-70 hover:opacity-100 flex items-center gap-1">
                  <Plus size={12} /> Tambah
                </button>
              </div>
              <div className="bg-white divide-y divide-gray-50">
                {byDay[day].length === 0 ? (
                  <p className="px-4 py-4 text-xs text-gray-400 text-center">Belum ada jam</p>
                ) : byDay[day].map(p => (
                  <div key={p.id} className={`px-4 py-3 flex items-start justify-between group hover:bg-gray-50 ${p.isBreak ? "bg-gray-50/60" : ""}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-bold text-primary-700 font-mono">{p.startTime}–{p.endTime}</span>
                        {p.isBreak && <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">ISTIRAHAT</span>}
                      </div>
                      <p className="font-semibold text-sm text-gray-800 truncate">
                        {p.isBreak ? (p.label || "Istirahat") : `Jam ke-${byDay[day].filter(x => !x.isBreak).findIndex(x => x.id === p.id) + 1}`}
                      </p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition shrink-0 ml-2">
                      <button onClick={() => openEdit(p)} className="p-1 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"><Pencil size={13} /></button>
                      <button onClick={() => remove(p.id)} className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal scrollBody
        open={showForm}
        onClose={() => setShowForm(false)}
        title={<span className="flex items-center gap-2"><Clock size={18} /> {editing ? "Edit Jam Pelajaran" : "Tambah Jam Pelajaran"}</span>}
        footer={
          <>
            <button onClick={() => setShowForm(false)} className="btn-modal-cancel flex-1">Batal</button>
            <button onClick={save} disabled={saving} className="btn-modal-save flex-1 flex items-center justify-center gap-2">
              {saving && <Loader2 size={16} className="animate-spin" />}
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Hari *</label>
              <Select
                value={form.day}
                onChange={v => setForm(f => ({ ...f, day: v }))}
                options={DAYS.map(d => ({ value: d, label: DAY_LABEL[d] }))}
              />
            </div>
            <div>
              <label className="label-field">Urutan ke- *</label>
              <input type="number" min={1} value={form.order} onChange={e => setForm(f => ({ ...f, order: e.target.value }))}
                className="input-field" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Jam Mulai *</label>
              <input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                className="input-field" />
            </div>
            <div>
              <label className="label-field">Jam Selesai *</label>
              <input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                className="input-field" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={form.isBreak} onChange={e => setForm(f => ({ ...f, isBreak: e.target.checked }))} />
            Ini jam istirahat (tidak dipakai untuk pelajaran)
          </label>
          {form.isBreak && (
            <div>
              <label className="label-field">Label Istirahat</label>
              <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                className="input-field" placeholder="Istirahat, Sholat Dzuhur, dll." />
            </div>
          )}
          {msg && <p className="error-msg">{msg}</p>}
        </div>
      </Modal>
    </div>
  );
}
