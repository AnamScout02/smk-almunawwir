"use client";
import { Users } from "lucide-react";

export interface OpsiKelasPeserta { classId: string; className: string; grade: number; teacherName?: string }

const tingkatDariNama = (n: string) => /^XII\b/.test(n) ? 12 : /^XI\b/.test(n) ? 11 : /^X\b/.test(n) ? 10 : 0;
const LABEL_TINGKAT: Record<number, string> = { 10: "Kelas X", 11: "Kelas XI", 12: "Kelas XII", 0: "Lainnya" };

/** PEMILIH KELAS PESERTA — satu ujian boleh diikuti banyak kelas (mis. PJOK seluruh kelas X).
 * Pilihan diambil dari Penugasan Mengajar mapel ini: guru melihat kelas yang ia ampu, Admin/TAS/
 * Kurikulum melihat semua kelas beserta nama gurunya. Kelas yang sudah tercatat di ujian tetap
 * ditampilkan walau tidak ada di daftar (mis. ujian bersama yang dibuat Admin). */
export default function PilihKelasPeserta({
  opsi, terpilih, tambahan = [], onChange, dikunci = false,
}: {
  opsi: OpsiKelasPeserta[];
  terpilih: string[];
  tambahan?: { id: string; name: string }[];
  onChange: (ids: string[]) => void;
  dikunci?: boolean;
}) {
  const semua = new Map<string, OpsiKelasPeserta>();
  for (const o of opsi) semua.set(o.classId, o);
  for (const k of tambahan) if (!semua.has(k.id)) semua.set(k.id, { classId: k.id, className: k.name, grade: tingkatDariNama(k.name) });
  const daftar = [...semua.values()].sort((a, b) => a.grade - b.grade || a.className.localeCompare(b.className, "id", { numeric: true }));
  const tingkat = [...new Set(daftar.map(d => d.grade))];

  const ubah = (id: string) => onChange(terpilih.includes(id) ? terpilih.filter(x => x !== id) : [...terpilih, id]);
  const pilihTingkat = (g: number) => {
    const ids = daftar.filter(d => d.grade === g).map(d => d.classId);
    const semuaTerpilih = ids.every(id => terpilih.includes(id));
    onChange(semuaTerpilih ? terpilih.filter(x => !ids.includes(x)) : [...new Set([...terpilih, ...ids])]);
  };

  if (!daftar.length) {
    return <p className="text-xs text-gray-400">Belum ada kelas untuk mapel ini di Penugasan Mengajar.</p>;
  }

  const guruLain = new Set(daftar.filter(d => terpilih.includes(d.classId) && d.teacherName).map(d => d.teacherName));

  return (
    <div className="space-y-2.5">
      {tingkat.map(g => {
        const baris = daftar.filter(d => d.grade === g);
        const penuh = baris.every(d => terpilih.includes(d.classId));
        return (
          <div key={g}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{LABEL_TINGKAT[g] ?? `Tingkat ${g}`}</span>
              {baris.length > 1 && !dikunci && (
                <button type="button" onClick={() => pilihTingkat(g)} className="text-xs font-semibold text-primary-700 hover:underline">
                  {penuh ? "Lepas semua" : "Pilih semua"}
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {baris.map(d => {
                const aktif = terpilih.includes(d.classId);
                return (
                  <label key={d.classId} title={d.teacherName ? `Guru: ${d.teacherName}` : undefined}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition ${dikunci ? "cursor-not-allowed opacity-70" : "cursor-pointer"} ${aktif ? "border-primary-300 bg-primary-50 text-primary-900 font-semibold" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                    <input type="checkbox" checked={aktif} disabled={dikunci} onChange={() => ubah(d.classId)} className="w-3.5 h-3.5 accent-primary-700" />
                    {d.className}
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
      <p className="text-xs text-gray-400 flex items-center gap-1">
        <Users size={11} /> {terpilih.length} kelas dipilih
        {guruLain.size > 1 && " · guru pengampu kelas lain ikut bisa memantau & melihat hasil kelasnya"}
      </p>
    </div>
  );
}
