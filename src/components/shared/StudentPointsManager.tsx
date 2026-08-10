"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldAlert, Plus, Trash2, Save, Loader2, Search, ClipboardList, Award, ListChecks, BookOpenCheck } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import Modal from "@/components/admin/Modal";
import EmptyState from "@/components/admin/EmptyState";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { useToast } from "@/components/shared/ToastProvider";

interface ViolationType { id: string; category: string; name: string; pointsMin: number; pointsMax: number; piketAllowed: boolean; active: boolean }
interface AchievementType { id: string; name: string; pointsMin: number; pointsMax: number; active: boolean }
interface StudentHit { id: string; nis: string; name: string; className: string }
interface PointRecord {
  id: string; kind: string; points: number; note: string | null; date: string; semester: string;
  recordedByName: string; recordedByRole: string;
  student: { id: string; nis: string; user: { name: string }; class: { name: string } | null };
  violationType: { name: string; category: string } | null;
  achievementType: { name: string } | null;
}

function generateSemesters(): string[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const cur = month >= 7 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
  const prev = month >= 7 ? `${year - 1}/${year}` : `${year - 2}/${year - 1}`;
  return [`Ganjil ${prev}`, `Genap ${prev}`, `Ganjil ${cur}`, `Genap ${cur}`];
}
const SEMESTERS = generateSemesters();

/** Kelola poin pelanggaran & prestasi siswa (Tata Tertib Peserta Didik) — akses PENUH, khusus
 * Admin/Wakasek Kesiswaan/Guru BK (lihat assertStudentPointsFull, kesiswaan-guard.ts). Dipakai
 * bareng portal admin & guru (pola komponen manager lintas portal, no.14 CLAUDE.md).
 * `isAdmin` dikirim dari wrapper page (server component tahu session.role) — dipakai buat
 * menampilkan opsi "Remisi" di tab Catat Poin, karena BAB V Tata Tertib membatasi wewenang
 * remisi HANYA Kepala Sekolah (akun ADMIN), bukan BK/Wakasek Kesiswaan walau mereka full-access
 * utk pelanggaran/prestasi biasa. */
export default function StudentPointsManager({ isAdmin = false }: { isAdmin?: boolean }) {
  const confirmDialog = useConfirm();
  const toast = useToast();
  const pathname = usePathname();
  const tataTertibHref = pathname?.startsWith("/dashboard/admin") ? "/dashboard/admin/tata-tertib" : "/dashboard/teacher/tata-tertib";
  const [tab, setTab] = useState<"catat" | "riwayat" | "jenis">("catat");

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<ShieldAlert size={22} />} title="Poin Siswa"
        description="Poin pelanggaran & prestasi sesuai Tata Tertib Peserta Didik"
        actions={<Link href={tataTertibHref} className="flex items-center gap-1.5 text-sm font-semibold text-white/80 hover:text-white bg-white/10 hover:bg-white/15 px-4 py-2.5 rounded-xl transition"><BookOpenCheck size={15} /> Baca Tata Tertib Lengkap</Link>} />

      <div className="flex gap-2 mb-6 flex-wrap">
        {([["catat", "Catat Poin", Plus], ["riwayat", "Riwayat", ClipboardList], ["jenis", "Kelola Jenis", ListChecks]] as const).map(([v, label, Icon]) => (
          <button key={v} onClick={() => setTab(v)}
            className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-xl transition ${tab === v ? "bg-primary-900 text-white" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === "catat" && <CatatPoinTab toast={toast} isAdmin={isAdmin} />}
      {tab === "riwayat" && <RiwayatTab toast={toast} confirmDialog={confirmDialog} />}
      {tab === "jenis" && <KelolaJenisTab toast={toast} confirmDialog={confirmDialog} />}
    </div>
  );
}

// ── Tab: Catat Poin ──────────────────────────────────────────────────────────
function CatatPoinTab({ toast, isAdmin }: { toast: ReturnType<typeof useToast>; isAdmin: boolean }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<StudentHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [student, setStudent] = useState<StudentHit | null>(null);
  const [kind, setKind] = useState<"PELANGGARAN" | "PRESTASI" | "REMISI">("PELANGGARAN");
  const [violationTypes, setViolationTypes] = useState<ViolationType[]>([]);
  const [achievementTypes, setAchievementTypes] = useState<AchievementType[]>([]);
  const [typeId, setTypeId] = useState("");
  const [points, setPoints] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/student-points/violation-types").then(r => r.json()).then(d => { if (Array.isArray(d)) setViolationTypes(d.filter((t: ViolationType) => t.active)); }).catch(() => {});
    fetch("/api/admin/student-points/achievement-types").then(r => r.json()).then(d => { if (Array.isArray(d)) setAchievementTypes(d.filter((t: AchievementType) => t.active)); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) { setHits([]); return; }
    setSearching(true);
    const t = setTimeout(() => {
      fetch(`/api/admin/student-points/students-lookup?q=${encodeURIComponent(query)}`)
        .then(r => r.json()).then(d => { if (Array.isArray(d)) setHits(d); })
        .catch(() => {}).finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const selectedType = kind === "PELANGGARAN" ? violationTypes.find(t => t.id === typeId) : kind === "PRESTASI" ? achievementTypes.find(t => t.id === typeId) : undefined;

  function pickType(id: string) {
    setTypeId(id);
    const t = kind === "PELANGGARAN" ? violationTypes.find(v => v.id === id) : achievementTypes.find(v => v.id === id);
    if (t) setPoints(t.pointsMin === t.pointsMax ? String(t.pointsMin) : "");
  }

  async function handleSubmit() {
    if (!student) { toast.warning("Pilih siswa dulu."); return; }
    if (kind !== "REMISI" && !typeId) { toast.warning("Pilih jenis pelanggaran/prestasi."); return; }
    if (kind === "REMISI" && !note.trim()) { toast.warning("Alasan remisi wajib diisi."); return; }
    const pts = Number(points);
    if (!points || isNaN(pts) || pts <= 0) { toast.warning("Isi poin."); return; }
    setSaving(true);
    const res = await fetch("/api/admin/student-points/records", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: student.id, kind, points: pts, note,
        violationTypeId: kind === "PELANGGARAN" ? typeId : undefined,
        achievementTypeId: kind === "PRESTASI" ? typeId : undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); toast.error(d.error || "Gagal menyimpan"); return; }
    const kindLabel = kind === "PELANGGARAN" ? "pelanggaran" : kind === "PRESTASI" ? "prestasi" : "remisi";
    toast.success(`Poin ${kindLabel} tercatat untuk ${student.name}.`);
    setStudent(null); setQuery(""); setTypeId(""); setPoints(""); setNote("");
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 max-w-2xl space-y-5">
      <div>
        <label className="label-field">Siswa</label>
        {student ? (
          <div className="flex items-center justify-between bg-primary-50 border border-primary-100 rounded-xl px-4 py-2.5">
            <div><p className="font-semibold text-primary-900 text-sm">{student.name}</p><p className="text-xs text-gray-400">{student.nis} · {student.className}</p></div>
            <button onClick={() => { setStudent(null); setQuery(""); }} className="text-xs text-red-500 font-semibold">Ganti</button>
          </div>
        ) : (
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari nama atau NIS siswa..." className="input-field pl-10" />
            {searching && <Loader2 size={15} className="animate-spin absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" />}
            {hits.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                {hits.map(h => (
                  <button key={h.id} onClick={() => { setStudent(h); setHits([]); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-primary-50 transition-colors border-b border-gray-50 last:border-0">
                    <p className="font-semibold text-sm text-primary-900">{h.name}</p>
                    <p className="text-xs text-gray-400">{h.nis} · {h.className}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <label className="label-field">Jenis</label>
        <div className="flex gap-2">
          <button onClick={() => { setKind("PELANGGARAN"); setTypeId(""); setPoints(""); setNote(""); }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition ${kind === "PELANGGARAN" ? "bg-red-50 border-red-200 text-red-700" : "bg-white border-gray-200 text-gray-400"}`}>
            Pelanggaran
          </button>
          <button onClick={() => { setKind("PRESTASI"); setTypeId(""); setPoints(""); setNote(""); }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition ${kind === "PRESTASI" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-white border-gray-200 text-gray-400"}`}>
            Prestasi
          </button>
          {isAdmin && (
            <button onClick={() => { setKind("REMISI"); setTypeId(""); setPoints(""); setNote(""); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition ${kind === "REMISI" ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white border-gray-200 text-gray-400"}`}>
              Remisi
            </button>
          )}
        </div>
        {kind === "REMISI" && (
          <p className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 mt-2">
            Remisi mengurangi akumulasi poin pelanggaran siswa. Sesuai BAB V Tata Tertib, hanya Kepala Sekolah yang berwenang memberi remisi, atas usulan Wali Kelas/Guru BK/Wakasek Kesiswaan — maksimal sekali per tahun ajaran.
          </p>
        )}
      </div>

      {kind !== "REMISI" && (
        <div>
          <label className="label-field">{kind === "PELANGGARAN" ? "Jenis Pelanggaran" : "Jenis Prestasi"}</label>
          <Select value={typeId} onChange={pickType}
            options={(kind === "PELANGGARAN" ? violationTypes : achievementTypes).map(t => ({
              value: t.id,
              label: `${t.name} (${t.pointsMin === t.pointsMax ? t.pointsMin : `${t.pointsMin}-${t.pointsMax}`} poin)`,
            }))}
            placeholder="— Pilih —" />
        </div>
      )}

      {kind !== "REMISI" && selectedType && (
        <div>
          <label className="label-field">Poin ({selectedType.pointsMin}-{selectedType.pointsMax})</label>
          <input type="number" min={selectedType.pointsMin} max={selectedType.pointsMax} value={points}
            onChange={e => setPoints(e.target.value)} className="input-field w-32" />
        </div>
      )}

      {kind === "REMISI" && (
        <div>
          <label className="label-field">Poin yang Diremisi (dikurangi dari akumulasi pelanggaran)</label>
          <input type="number" min={1} value={points} onChange={e => setPoints(e.target.value)} className="input-field w-32" />
        </div>
      )}

      <div>
        <label className="label-field">{kind === "REMISI" ? "Alasan Remisi (wajib)" : "Catatan (opsional)"}</label>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} className="input-field"
          placeholder={kind === "REMISI" ? "Alasan pemberian remisi — mis. sudah menunjukkan perubahan sikap sejak SP1..." : "Detail kejadian..."} />
      </div>

      <button onClick={handleSubmit} disabled={saving} className="btn-gold flex items-center gap-2 text-sm">
        {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Simpan Catatan
      </button>
    </div>
  );
}

// ── Tab: Riwayat ─────────────────────────────────────────────────────────────
function RiwayatTab({ toast, confirmDialog }: { toast: ReturnType<typeof useToast>; confirmDialog: ReturnType<typeof useConfirm> }) {
  const [semester, setSemester] = useState(SEMESTERS[2]);
  const [records, setRecords] = useState<PointRecord[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    fetch(`/api/admin/student-points/records?semester=${encodeURIComponent(semester)}`)
      .then(r => r.json()).then(d => setRecords(Array.isArray(d) ? d : []))
      .catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, [semester]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDelete(id: string) {
    if (!await confirmDialog("Hapus catatan poin ini? Tindakan ini tidak bisa dibatalkan.")) return;
    const res = await fetch(`/api/admin/student-points/records/${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Gagal menghapus"); return; }
    load();
  }

  return (
    <div>
      <div className="mb-4 w-56">
        <Select value={semester} onChange={setSemester} options={SEMESTERS.map(s => ({ value: s, label: s }))} />
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center"><Loader2 size={24} className="animate-spin text-primary-500" /></div>
        ) : records.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Belum Ada Catatan" description="Belum ada poin tercatat untuk semester ini." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-primary-100 text-left text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">
                  <th className="px-4 py-3">Tanggal</th><th className="px-4 py-3">Siswa</th><th className="px-4 py-3">Jenis</th>
                  <th className="px-4 py-3">Poin</th><th className="px-4 py-3">Dicatat Oleh</th><th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id} className="border-b border-gray-50 last:border-0 hover:bg-primary-50/30">
                    <td className="px-4 py-2.5 whitespace-nowrap text-xs">{new Date(r.date).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</td>
                    <td className="px-4 py-2.5">
                      <p className="font-semibold text-primary-900">{r.student.user.name}</p>
                      <p className="text-xs text-gray-400">{r.student.nis} · {r.student.class?.name ?? "—"}</p>
                    </td>
                    <td className="px-4 py-2.5 max-w-xs">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.kind === "PELANGGARAN" ? "bg-red-50 text-red-600" : r.kind === "REMISI" ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"}`}>
                        {r.kind === "PELANGGARAN" ? "Pelanggaran" : r.kind === "REMISI" ? "Remisi" : "Prestasi"}
                      </span>
                      <p className="text-xs text-gray-600 mt-1">{r.violationType?.name ?? r.achievementType?.name ?? "Remisi poin"}</p>
                      {r.note && <p className="text-[11px] text-gray-400 italic mt-0.5">{r.note}</p>}
                    </td>
                    <td className="px-4 py-2.5 font-bold">{r.kind === "PELANGGARAN" ? "+" : "-"}{r.points}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-400">{r.recordedByName}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => handleDelete(r.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab: Kelola Jenis ────────────────────────────────────────────────────────
function KelolaJenisTab({ toast, confirmDialog }: { toast: ReturnType<typeof useToast>; confirmDialog: ReturnType<typeof useConfirm> }) {
  const [sub, setSub] = useState<"pelanggaran" | "prestasi">("pelanggaran");
  const [violations, setViolations] = useState<ViolationType[]>([]);
  const [achievements, setAchievements] = useState<AchievementType[]>([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<ViolationType | AchievementType | null>(null);
  const [form, setForm] = useState({ category: "", name: "", pointsMin: "", pointsMax: "", piketAllowed: false, active: true });
  const [saving, setSaving] = useState(false);

  function load() {
    fetch("/api/admin/student-points/violation-types").then(r => r.json()).then(d => setViolations(Array.isArray(d) ? d : [])).catch(() => {});
    fetch("/api/admin/student-points/achievement-types").then(r => r.json()).then(d => setAchievements(Array.isArray(d) ? d : [])).catch(() => {});
  }
  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm({ category: sub === "pelanggaran" ? violations[0]?.category ?? "" : "", name: "", pointsMin: "", pointsMax: "", piketAllowed: false, active: true });
    setModal(true);
  }
  function openEdit(t: ViolationType | AchievementType) {
    setEditing(t);
    setForm({
      category: "category" in t ? t.category : "", name: t.name, pointsMin: String(t.pointsMin), pointsMax: String(t.pointsMax),
      piketAllowed: "piketAllowed" in t ? t.piketAllowed : false, active: t.active,
    });
    setModal(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.pointsMin || !form.pointsMax) { toast.warning("Nama dan rentang poin wajib diisi."); return; }
    if (sub === "pelanggaran" && !form.category.trim()) { toast.warning("Kategori wajib diisi."); return; }
    setSaving(true);
    const base = sub === "pelanggaran" ? "/api/admin/student-points/violation-types" : "/api/admin/student-points/achievement-types";
    const url = editing ? `${base}/${editing.id}` : base;
    const body = sub === "pelanggaran"
      ? { category: form.category, name: form.name, pointsMin: Number(form.pointsMin), pointsMax: Number(form.pointsMax), piketAllowed: form.piketAllowed, active: form.active }
      : { name: form.name, pointsMin: Number(form.pointsMin), pointsMax: Number(form.pointsMax), active: form.active };
    const res = await fetch(url, { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); toast.error(d.error || "Gagal menyimpan"); return; }
    setModal(false); load();
  }

  async function handleDelete(id: string) {
    if (!await confirmDialog("Hapus jenis ini? Kalau sudah pernah dipakai mencatat siswa, akan dinonaktifkan saja (bukan dihapus).")) return;
    const base = sub === "pelanggaran" ? "/api/admin/student-points/violation-types" : "/api/admin/student-points/achievement-types";
    const res = await fetch(`${base}/${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Gagal menghapus"); return; }
    load();
  }

  const items = sub === "pelanggaran" ? violations : achievements;
  const grouped = sub === "pelanggaran"
    ? Object.entries(violations.reduce<Record<string, ViolationType[]>>((acc, v) => { (acc[v.category] ??= []).push(v); return acc; }, {}))
    : [["Prestasi", achievements] as [string, AchievementType[]]];

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex gap-2">
          <button onClick={() => setSub("pelanggaran")} className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${sub === "pelanggaran" ? "bg-primary-900 text-white" : "bg-gray-50 text-gray-500"}`}>Pelanggaran</button>
          <button onClick={() => setSub("prestasi")} className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${sub === "prestasi" ? "bg-primary-900 text-white" : "bg-gray-50 text-gray-500"}`}>Prestasi</button>
        </div>
        <button onClick={openCreate} className="btn-gold flex items-center gap-2 text-sm"><Plus size={15} /> Tambah Jenis</button>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={Award} title="Belum Ada Data" />
      ) : (
        <div className="space-y-6">
          {grouped.map(([category, list]) => (
            <div key={category} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100"><h3 className="font-heading font-bold text-primary-900 text-sm">{category}</h3></div>
              <div className="divide-y divide-gray-50">
                {list.map(t => (
                  <div key={t.id} className={`flex items-center justify-between px-5 py-3 ${!t.active ? "opacity-40" : ""}`}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-primary-900">{t.name}</p>
                      <p className="text-xs text-gray-400">
                        {t.pointsMin === t.pointsMax ? `${t.pointsMin} poin` : `${t.pointsMin}-${t.pointsMax} poin`}
                        {sub === "pelanggaran" && (t as ViolationType).piketAllowed && <span className="ml-2 text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">Boleh Guru Piket</span>}
                        {!t.active && <span className="ml-2 text-[10px] font-bold text-gray-400">(Nonaktif)</span>}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => openEdit(t)} className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg transition text-xs font-semibold px-2">Edit</button>
                      <button onClick={() => handleDelete(t.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? "Edit Jenis" : "Tambah Jenis"}
        footer={<>
          <button onClick={() => setModal(false)} className="btn-modal-cancel flex-1">Batal</button>
          <button onClick={handleSave} disabled={saving} className="btn-modal-save flex-1">{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan</button>
        </>}>
        <div className="space-y-4">
          {sub === "pelanggaran" && (
            <div>
              <label className="label-field">Kategori</label>
              <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="input-field"
                placeholder="cth: Kehadiran / Penampilan / Kenakalan dan Kriminalitas" />
            </div>
          )}
          <div>
            <label className="label-field">Deskripsi</label>
            <textarea value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} rows={2} className="input-field" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label-field">Poin Min</label><input type="number" value={form.pointsMin} onChange={e => setForm(f => ({ ...f, pointsMin: e.target.value }))} className="input-field" /></div>
            <div><label className="label-field">Poin Max</label><input type="number" value={form.pointsMax} onChange={e => setForm(f => ({ ...f, pointsMax: e.target.value }))} className="input-field" /></div>
          </div>
          {sub === "pelanggaran" && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.piketAllowed} onChange={e => setForm(f => ({ ...f, piketAllowed: e.target.checked }))} className="w-4 h-4 rounded accent-primary-700" />
              Boleh dicatat Guru Piket biasa (bukan cuma BK/Wakasek Kesiswaan)
            </label>
          )}
          {editing && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="w-4 h-4 rounded accent-primary-700" />
              Aktif (tampil di daftar pilihan saat mencatat)
            </label>
          )}
        </div>
      </Modal>
    </div>
  );
}
