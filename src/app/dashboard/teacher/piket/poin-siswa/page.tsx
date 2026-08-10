"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldAlert, Search, Save, Loader2, BookOpenCheck } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import { useToast } from "@/components/shared/ToastProvider";

interface ViolationType { id: string; name: string; pointsMin: number; pointsMax: number; piketAllowed: boolean; active: boolean }
interface StudentHit { id: string; nis: string; name: string; className: string }

/** Catat poin pelanggaran KHUSUS Guru Piket — cuma 2 jenis yg boleh (Terlambat & seragam/atribut
 * tidak sesuai ketentuan, ditandai piketAllowed=true), TIDAK bisa lihat riwayat siapa pun (murni
 * submit, lihat & kelola penuh cuma BK/Wakasek Kesiswaan — src/lib/kesiswaan-guard.ts). Halaman
 * ini bisa dibuka guru mana pun, tapi POST-nya ditolak server kalau bukan piket hari ini. */
export default function PiketPoinSiswaPage() {
  const toast = useToast();
  const [types, setTypes] = useState<ViolationType[]>([]);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<StudentHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [student, setStudent] = useState<StudentHit | null>(null);
  const [typeId, setTypeId] = useState("");
  const [points, setPoints] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/student-points/violation-types").then(r => r.json())
      .then(d => { if (Array.isArray(d)) setTypes(d.filter((t: ViolationType) => t.active && t.piketAllowed)); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) { setHits([]); return; }
    setSearching(true);
    const t = setTimeout(() => {
      fetch(`/api/admin/student-points/students-lookup?q=${encodeURIComponent(query)}`)
        .then(r => r.json())
        .then(d => { if (Array.isArray(d)) setHits(d); else toast.error(d.error || "Gagal mencari — pastikan Anda terjadwal piket hari ini."); })
        .catch(() => {}).finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const selectedType = types.find(t => t.id === typeId);

  function pickType(id: string) {
    setTypeId(id);
    const t = types.find(v => v.id === id);
    if (t) setPoints(t.pointsMin === t.pointsMax ? String(t.pointsMin) : "");
  }

  async function handleSubmit() {
    if (!student) { toast.warning("Pilih siswa dulu."); return; }
    if (!typeId) { toast.warning("Pilih jenis pelanggaran."); return; }
    const pts = Number(points);
    if (!points || isNaN(pts)) { toast.warning("Isi poin."); return; }
    setSaving(true);
    const res = await fetch("/api/admin/student-points/records", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: student.id, kind: "PELANGGARAN", violationTypeId: typeId, points: pts, note }),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); toast.error(d.error || "Gagal menyimpan — pastikan Anda terjadwal piket hari ini."); return; }
    toast.success(`Poin tercatat untuk ${student.name}.`);
    setStudent(null); setQuery(""); setTypeId(""); setPoints(""); setNote("");
  }

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<ShieldAlert size={22} />} title="Catat Poin Siswa (Piket)"
        description="Khusus Terlambat & seragam/atribut tidak sesuai ketentuan — jenis pelanggaran lain hubungi BK/Wakasek Kesiswaan"
        actions={<Link href="/dashboard/teacher/tata-tertib" className="flex items-center gap-1.5 text-sm font-semibold text-white/80 hover:text-white bg-white/10 hover:bg-white/15 px-4 py-2.5 rounded-xl transition"><BookOpenCheck size={15} /> Baca Tata Tertib Lengkap</Link>} />

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
          <label className="label-field">Jenis Pelanggaran</label>
          {types.length === 0 ? (
            <p className="text-sm text-gray-400 italic">Belum ada jenis pelanggaran yang boleh dicatat piket. Hubungi Admin/BK.</p>
          ) : (
            <Select value={typeId} onChange={pickType}
              options={types.map(t => ({ value: t.id, label: `${t.name} (${t.pointsMin === t.pointsMax ? t.pointsMin : `${t.pointsMin}-${t.pointsMax}`} poin)` }))}
              placeholder="— Pilih —" />
          )}
        </div>

        {selectedType && (
          <div>
            <label className="label-field">Poin ({selectedType.pointsMin}-{selectedType.pointsMax})</label>
            <input type="number" min={selectedType.pointsMin} max={selectedType.pointsMax} value={points}
              onChange={e => setPoints(e.target.value)} className="input-field w-32" />
          </div>
        )}

        <div>
          <label className="label-field">Catatan (opsional)</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} className="input-field" placeholder="Detail kejadian..." />
        </div>

        <button onClick={handleSubmit} disabled={saving} className="btn-gold flex items-center gap-2 text-sm">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Simpan Catatan
        </button>
      </div>
    </div>
  );
}
