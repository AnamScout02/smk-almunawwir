"use client";
import { useEffect, useState } from "react";
import { CalendarClock, Loader2, Plus, Trash2, X } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { PageSkeleton } from "@/components/shared/Skeleton";

interface RosterEntry { id: string; day: string; weekType: string; notes: string | null; userId: string; userName: string; userRole: string; userNip: string | null }
interface UserOption { id: string; name: string; role: string; nip: string | null }

const DAYS = ["SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
const WEEK_TABS = [
  { value: "SEMUA", label: "Setiap Minggu (Tetap)" },
  { value: "A", label: "Minggu 1" },
  { value: "B", label: "Minggu 2" },
];

export default function DutyRosterManager() {
  const confirmDialog = useConfirm();
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [weekTab, setWeekTab] = useState("SEMUA");
  const [addingDay, setAddingDay] = useState<string | null>(null);
  const [pickUserId, setPickUserId] = useState("");
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState("");

  function load() {
    setLoading(true);
    setError("");
    fetch("/api/teacher/wakasek/penjamin-mutu/duty-roster").then(async r => {
      if (!r.ok) { const d = await r.json(); setError(d.error || "Gagal memuat data"); setLoading(false); return; }
      const d = await r.json();
      setRoster(d.roster ?? []);
      setUsers(d.users ?? []);
      setLoading(false);
    }).catch(() => { setError("Gagal memuat data"); setLoading(false); });
  }
  useEffect(() => { load(); }, []);

  // "Setiap Minggu" = kelola baseline (weekType SEMUA) saja. "Minggu 1"/"Minggu 2" = tampilkan
  // gabungan baseline + entri spesifik minggu itu (efektif berlaku minggu tsb), entri baru yang
  // ditambahkan di tab ini otomatis weekType-nya ikut tab yang aktif.
  function entriesForDay(day: string) {
    return roster.filter(r => r.day === day && (weekTab === "SEMUA" ? r.weekType === "SEMUA" : r.weekType === weekTab || r.weekType === "SEMUA"));
  }

  function openAdd(day: string) { setAddingDay(day); setPickUserId(""); setAddError(""); }

  async function handleAdd() {
    if (!addingDay || !pickUserId) return;
    setSaving(true);
    setAddError("");
    const res = await fetch("/api/teacher/wakasek/penjamin-mutu/duty-roster", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day: addingDay, weekType: weekTab, userId: pickUserId }),
    });
    setSaving(false);
    if (res.ok) { setAddingDay(null); load(); return; }
    // Dulu di sini diam saja kalau gagal (bikin bingung: kelihatannya "kekirim" padahal
    // sebenarnya ditolak server) — sekarang selalu tampilkan alasan gagalnya.
    const d = await res.json().catch(() => null);
    setAddError(d?.error || "Gagal menyimpan, coba lagi.");
  }

  async function handleDelete(r: RosterEntry) {
    if (!(await confirmDialog(`Hapus ${r.userName} dari piket hari ${r.day}?`))) return;
    await fetch(`/api/teacher/wakasek/penjamin-mutu/duty-roster/${r.id}`, { method: "DELETE" });
    load();
  }

  if (error) {
    return (
      <div className="p-6 lg:p-8 pt-16 lg:pt-8">
        <div className="bg-red-50 border border-red-100 text-red-600 rounded-xl p-4 text-sm">{error}</div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<CalendarClock size={22} />}
        title="Jadwal Piket Guru & Staff"
        description="Atur guru & staff yang bertugas piket per hari — ikut rotasi 2 minggu (Minggu 1/Minggu 2) seperti jadwal pelajaran"
      />

      {loading ? (
        <PageSkeleton />
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-6">
            {WEEK_TABS.map(t => (
              <button key={t.value} onClick={() => setWeekTab(t.value)}
                className={`text-sm font-semibold px-4 py-2.5 rounded-xl transition ${weekTab === t.value ? "bg-primary-900 text-white" : "bg-white border border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {DAYS.map(day => {
              const entries = entriesForDay(day);
              return (
                <div key={day} className="panel p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-bold text-primary-900 text-sm">{day}</p>
                    <button onClick={() => openAdd(day)} className="p-1.5 rounded-lg hover:bg-primary-50 text-primary-700 transition" title="Tambah">
                      <Plus size={15} />
                    </button>
                  </div>
                  {entries.length === 0 ? (
                    <p className="text-sm text-gray-400">Belum ada petugas piket.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {entries.map(e => (
                        <div key={e.id} className="flex items-center justify-between gap-2 bg-primary-50/60 rounded-lg px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-primary-900 truncate">{e.userName}</p>
                            <p className="text-xs text-gray-400">
                              {e.userRole === "TEACHER" ? "Guru" : "Staff/TAS"}{e.userNip ? ` · ${e.userNip}` : ""}
                              {e.weekType === "SEMUA" && weekTab !== "SEMUA" ? " · Tetap" : ""}
                            </p>
                          </div>
                          <button onClick={() => handleDelete(e)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition shrink-0" title="Hapus">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {addingDay === day && (
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-gray-500">Tambah Petugas</p>
                        <button onClick={() => setAddingDay(null)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
                      </div>
                      <Select value={pickUserId} onChange={setPickUserId} placeholder="— Pilih Guru/Staff —"
                        options={users
                          .filter(u => !entries.some(e => e.userId === u.id))
                          .map(u => ({ value: u.id, label: `${u.name}${u.nip ? ` (${u.nip})` : ""} — ${u.role === "TEACHER" ? "Guru" : "Staff"}` }))} />
                      {addError && <p className="text-xs text-red-500 font-medium">{addError}</p>}
                      <button onClick={handleAdd} disabled={!pickUserId || saving}
                        className="btn-modal-save w-full">
                        {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Tambahkan
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
