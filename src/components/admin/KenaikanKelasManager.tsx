"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GraduationCap, Loader2, Search, Save, Trash2, ListChecks, ArrowUpCircle, RotateCcw } from "lucide-react";
import StatTile from "@/components/admin/StatTile";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import Select from "@/components/admin/Select";
import DatePicker from "@/components/shared/DatePicker";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { KEPUTUSAN_KENAIKAN, labelOf, styleOf } from "@/lib/tu-konstanta";

interface DecisionRow {
  id: string; studentId: string;
  student: { id: string; nis: string; user: { name: string }; class: { name: string; grade: number } | null; major: { code: string } };
  academicYearId: string; academicYear: { id: string; name: string };
  fromClass: string | null; toClass: string | null;
  decision: string; reason: string | null; decidedAt: string; notes: string | null;
}
interface YearOpt { id: string; name: string; isActive: boolean }
interface ClassOpt { id: string; name: string; grade: number }
interface StudentRow { id: string; nis: string; user: { name: string }; class: { name: string } | null }

const todayStr = () => new Date().toLocaleDateString("sv-SE");

/** Halaman ini sengaja BUKAN form satu-satu: rapat kenaikan kelas memutuskan SEKELAS sekaligus,
 * jadi alurnya "pilih kelas -> seluruh siswanya muncul -> set keputusan per baris -> simpan
 * sekali". Keputusan yang sudah tersimpan otomatis termuat kembali saat kelas dipilih ulang. */
export default function KenaikanKelasManager() {
  const toast = useToast();
  const confirmDialog = useConfirm();

  const [years, setYears] = useState<YearOpt[]>([]);
  const [classes, setClasses] = useState<ClassOpt[]>([]);
  const [yearId, setYearId] = useState("");
  const [classId, setClassId] = useState("");
  const [tanggal, setTanggal] = useState(todayStr());

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [saved, setSaved] = useState<DecisionRow[]>([]);
  const [draft, setDraft] = useState<Record<string, { decision: string; reason: string; toClass: string }>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/admin/tahun-ajaran").then(r => r.json()).then((d: YearOpt[]) => {
      if (!Array.isArray(d)) return;
      setYears(d);
      const aktif = d.find(y => y.isActive);
      if (aktif) setYearId(aktif.id);
    }).catch(() => {});
    fetch("/api/admin/classes").then(r => r.json()).then((d: ClassOpt[]) => {
      setClasses(Array.isArray(d) ? d : []);
    }).catch(() => {});
  }, []);

  const loadSaved = useCallback(() => {
    if (!yearId) return;
    fetch(`/api/admin/kenaikan-kelas?academicYearId=${yearId}`)
      .then(r => r.json()).then(d => setSaved(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [yearId]);
  useEffect(() => { loadSaved(); }, [loadSaved]);

  // Pilih kelas -> tarik rosternya, lalu isi draft dari keputusan yang sudah tersimpan (kalau ada)
  useEffect(() => {
    if (!classId) { setStudents([]); setDraft({}); return; }
    setLoading(true);
    fetch(`/api/admin/classes/${classId}/roster`)
      .then(r => r.json())
      .then((d: StudentRow[]) => {
        const list = Array.isArray(d) ? d : [];
        setStudents(list);
        const init: Record<string, { decision: string; reason: string; toClass: string }> = {};
        for (const s of list) {
          const prev = saved.find(x => x.studentId === s.id);
          init[s.id] = {
            decision: prev?.decision ?? "NAIK",
            reason: prev?.reason ?? "",
            toClass: prev?.toClass ?? "",
          };
        }
        setDraft(init);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [classId, saved]);

  function setRow(id: string, patch: Partial<{ decision: string; reason: string; toClass: string }>) {
    setDraft(d => ({ ...d, [id]: { ...d[id], ...patch } }));
  }

  async function simpanSemua() {
    if (!yearId) return toast.error("Tahun ajaran wajib dipilih.");
    if (students.length === 0) return toast.error("Pilih kelas dulu.");
    // Tinggal kelas WAJIB beralasan — ini keputusan yang paling sering dipertanyakan wali murid,
    // jadi jangan biarkan tersimpan tanpa dasar tertulis.
    const tanpaAlasan = students.filter(s => draft[s.id]?.decision === "TINGGAL" && !draft[s.id]?.reason.trim());
    if (tanpaAlasan.length > 0) {
      return toast.error(`Alasan wajib diisi untuk ${tanpaAlasan.length} siswa yang tinggal kelas.`);
    }

    setSaving(true);
    const kelasAsal = classes.find(c => c.id === classId)?.name ?? "";
    const res = await fetch("/api/admin/kenaikan-kelas", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: students.map(s => ({
          studentId: s.id, academicYearId: yearId, fromClass: kelasAsal,
          toClass: draft[s.id]?.toClass || null, decision: draft[s.id]?.decision || "NAIK",
          reason: draft[s.id]?.reason || null, decidedAt: tanggal,
        })),
      }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) return toast.error("Gagal menyimpan keputusan.");
    toast.success(`Keputusan ${students.length} siswa tersimpan.`);
    loadSaved();
  }

  async function hapus(r: DecisionRow) {
    if (!(await confirmDialog(`Hapus keputusan untuk "${r.student.user.name}"?`))) return;
    const res = await fetch(`/api/admin/kenaikan-kelas/${r.id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) return toast.error("Gagal menghapus.");
    toast.success("Keputusan dihapus."); loadSaved();
  }

  const savedFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return saved.filter(r => !q || r.student.user.name.toLowerCase().includes(q) || r.student.nis.toLowerCase().includes(q));
  }, [saved, search]);

  const rekap = useMemo(() => ({
    naik: saved.filter(r => r.decision === "NAIK").length,
    tinggal: saved.filter(r => r.decision === "TINGGAL").length,
    lulus: saved.filter(r => r.decision === "LULUS").length,
  }), [saved]);

  const fmt = (d: string) => new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<GraduationCap size={22} />} title="Buku Kenaikan Kelas"
        description="Keputusan naik / tinggal kelas / lulus per siswa tiap tahun ajaran" />

      <div className="page-card p-4 mb-5">
        <p className="text-sm font-semibold text-primary-900 mb-3 flex items-center gap-2">
          <ListChecks size={16} /> Input Keputusan per Kelas
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          <Select value={yearId} onChange={setYearId} placeholder="Pilih tahun ajaran..."
            options={years.map(y => ({ value: y.id, label: y.name + (y.isActive ? " (aktif)" : "") }))} />
          <Select value={classId} onChange={setClassId} placeholder="Pilih kelas..."
            options={classes.map(c => ({ value: c.id, label: c.name }))} />
          <DatePicker value={tanggal} onChange={setTanggal} />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
      ) : students.length > 0 ? (
        <div className="page-card overflow-hidden mb-6">
          <div className="overflow-auto scrollbar-visible max-h-[55vh]">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="sticky top-0 z-20">Siswa</th>
                  <th className="sticky top-0 z-20 w-44">Keputusan</th>
                  <th className="sticky top-0 z-20 w-40">Kelas Tujuan</th>
                  <th className="sticky top-0 z-20">Alasan (wajib bila tinggal kelas)</th>
                </tr>
              </thead>
              <tbody>
                {students.map(s => (
                  <tr key={s.id}>
                    <td className="font-medium">
                      {s.user.name}
                      <span className="block text-xs text-gray-400">{s.nis}</span>
                    </td>
                    <td>
                      <Select value={draft[s.id]?.decision ?? "NAIK"} onChange={v => setRow(s.id, { decision: v })}
                        options={KEPUTUSAN_KENAIKAN.map(k => ({ value: k.value, label: k.label }))} />
                    </td>
                    <td>
                      <input value={draft[s.id]?.toClass ?? ""} onChange={e => setRow(s.id, { toClass: e.target.value })}
                        placeholder="Mis. XI TKJ 1" className="input-field w-full text-xs" />
                    </td>
                    <td>
                      <input value={draft[s.id]?.reason ?? ""} onChange={e => setRow(s.id, { reason: e.target.value })}
                        placeholder={draft[s.id]?.decision === "TINGGAL" ? "Wajib diisi" : "Opsional"}
                        className={`input-field w-full text-xs ${draft[s.id]?.decision === "TINGGAL" && !draft[s.id]?.reason.trim() ? "border-red-300" : ""}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end p-3 border-t border-gray-100">
            <button onClick={simpanSemua} disabled={saving} className="btn-modal-save">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              Simpan Keputusan {students.length} Siswa
            </button>
          </div>
        </div>
      ) : classId ? (
        <EmptyState icon={GraduationCap} title="Kelas Kosong" description="Tidak ada siswa aktif di kelas ini." />
      ) : null}

      {saved.length > 0 && (
        <>
          <div className="kisi-kartu kisi-kartu-3 mb-5">
            <StatTile value={rekap.naik} label="Naik Kelas" icon={ArrowUpCircle} color="emerald" />
            <StatTile value={rekap.tinggal} label="Tinggal Kelas" icon={RotateCcw} color="red" />
            <StatTile value={rekap.lulus} label="Lulus" icon={GraduationCap} color="blue" />
          </div>

          <div className="baris-alat mb-5">
        <div className="alat-cari">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Cari keputusan tersimpan..." className="input-field pl-10 w-full" />
          </div>
      </div>

          <div className="page-card overflow-hidden">
            <div className="overflow-auto scrollbar-visible">
              <table className="data-table">
                <thead>
                  <tr><th>Siswa</th><th>Dari Kelas</th><th>Ke Kelas</th><th>Keputusan</th><th>Alasan</th><th>Tanggal</th><th>Aksi</th></tr>
                </thead>
                <tbody>
                  {savedFiltered.map(r => (
                    <tr key={r.id}>
                      <td className="font-medium">
                        {r.student.user.name}
                        <span className="block text-xs text-gray-400">{r.student.nis}</span>
                      </td>
                      <td className="text-sm">{r.fromClass || "—"}</td>
                      <td className="text-sm">{r.toClass || "—"}</td>
                      <td>
                        <span className={`px-2 py-0.5 rounded-full border text-xs font-semibold ${styleOf(KEPUTUSAN_KENAIKAN, r.decision)}`}>
                          {labelOf(KEPUTUSAN_KENAIKAN, r.decision)}
                        </span>
                      </td>
                      <td className="text-sm max-w-[16rem]">{r.reason || "—"}</td>
                      <td className="text-sm whitespace-nowrap">{fmt(r.decidedAt)}</td>
                      <td>
                        <button onClick={() => hapus(r)} title="Hapus"
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Menampilkan {savedFiltered.length} dari {saved.length} keputusan tersimpan
          </p>
        </>
      )}
    </div>
  );
}
