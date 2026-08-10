"use client";
import { useMemo, useState } from "react";
import { CheckSquare, Square } from "lucide-react";
import PrintKop from "@/components/shared/PrintKop";

const GRADE_LABEL: Record<number, string> = { 10: "X", 11: "XI", 12: "XII" };

interface StudentRow { id: string; nis: string; user: { name: string; email: string } }
interface ClassRow {
  id: string; name: string; grade: number;
  major: { name: string; code: string };
  homeroom: { user: { name: string } } | null;
  ketuaKelas: { user: { name: string } } | null;
  sekretaris: { user: { name: string } } | null;
  students: StudentRow[];
}

/** Pemilih kelas + area cetak "Cetak Data Kelas" — cuma kelas yg dicentang yg dirender ke DOM,
 * jadi otomatis cuma itu yg ikut tercetak (kelas yg tidak dicentang tidak ada di halaman sama
 * sekali, bukan cuma disembunyikan CSS). Default semua tercentang (perilaku lama: cetak semua). */
export default function CetakDataKelasClient({ classes, logoUrl }: { classes: ClassRow[]; logoUrl?: string }) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(classes.map(c => c.id)));

  const grouped = useMemo(() => {
    const byGrade = new Map<number, ClassRow[]>();
    for (const c of classes) byGrade.set(c.grade, [...(byGrade.get(c.grade) ?? []), c]);
    return [...byGrade.entries()].sort(([a], [b]) => a - b);
  }, [classes]);

  const selectedClasses = classes.filter(c => selected.has(c.id));

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleGrade(ids: string[], allSelected: boolean) {
    setSelected(prev => {
      const next = new Set(prev);
      for (const id of ids) { if (allSelected) next.delete(id); else next.add(id); }
      return next;
    });
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6 print:hidden">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-primary-900">Pilih kelas yang akan dicetak ({selectedClasses.length}/{classes.length} dipilih)</p>
          <div className="flex gap-2">
            <button onClick={() => setSelected(new Set(classes.map(c => c.id)))}
              className="text-xs font-semibold text-primary-600 hover:text-primary-800 px-3 py-1.5 rounded-lg hover:bg-primary-50 transition">
              Pilih Semua
            </button>
            <button onClick={() => setSelected(new Set())}
              className="text-xs font-semibold text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition">
              Kosongkan
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {grouped.map(([grade, items]) => {
            const ids = items.map(c => c.id);
            const allSelected = ids.every(id => selected.has(id));
            return (
              <div key={grade}>
                <button onClick={() => toggleGrade(ids, allSelected)}
                  className="flex items-center gap-2 text-xs font-bold text-primary-800 uppercase tracking-wide mb-2 hover:text-gold transition">
                  {allSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                  Tingkat {GRADE_LABEL[grade] ?? grade}
                </button>
                <div className="flex flex-wrap gap-2 pl-1">
                  {items.map(c => (
                    <label key={c.id}
                      className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border cursor-pointer transition ${
                        selected.has(c.id) ? "bg-primary-50 border-primary-200 text-primary-800" : "bg-gray-50 border-gray-200 text-gray-500"
                      }`}>
                      <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} className="accent-primary-700" />
                      {c.name}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedClasses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center text-gray-400 text-sm print:hidden">
          Belum ada kelas dipilih untuk dicetak.
        </div>
      ) : (
        selectedClasses.map((cls, i) => (
          <div key={cls.id}
            className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-6 print:border-0 print:shadow-none print:rounded-none print:p-0 mb-8 print:mb-0 ${i < selectedClasses.length - 1 ? "break-after-page" : ""}`}>
            <div className="print:block hidden">
              <PrintKop title={`Data Kelas — ${cls.name}`} subtitle="SMK Al-Munawwir IIBS" logoUrl={logoUrl} edgeClassName="-mx-6 print:-mx-2" />
            </div>

            <h3 className="font-heading font-bold text-primary-900 text-lg mb-3 print:hidden">
              Kelas {cls.name} <span className="text-sm font-normal text-gray-400">— Tingkat {GRADE_LABEL[cls.grade] ?? cls.grade}</span>
            </h3>

            <div className="grid grid-cols-3 gap-3 text-sm bg-gray-50 rounded-xl p-4 mb-5 print:bg-transparent print:border print:border-gray-300 print:rounded-none">
              <div><span className="text-gray-500">Jurusan</span><span className="mx-2">:</span><strong>{cls.major.code} — {cls.major.name}</strong></div>
              <div><span className="text-gray-500">Wali Kelas</span><span className="mx-2">:</span><strong className={cls.homeroom ? "" : "text-amber-500"}>{cls.homeroom?.user.name ?? "Belum ditentukan"}</strong></div>
              <div><span className="text-gray-500">Jumlah Siswa</span><span className="mx-2">:</span><strong>{cls.students.length}</strong></div>
              <div><span className="text-gray-500">Ketua Kelas</span><span className="mx-2">:</span><strong>{cls.ketuaKelas?.user.name ?? "—"}</strong></div>
              <div><span className="text-gray-500">Sekretaris</span><span className="mx-2">:</span><strong>{cls.sekretaris?.user.name ?? "—"}</strong></div>
              <div><span className="text-gray-500">Dicetak</span><span className="mx-2">:</span><strong>{new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</strong></div>
            </div>

            <p className="text-xs font-bold text-primary-800 uppercase tracking-wide mb-2">Daftar Akun Login Siswa</p>
            {cls.students.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Belum ada siswa aktif di kelas ini.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200 print:border-0 print:rounded-none">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-primary-900 text-white print:bg-gray-100 print:text-primary-900">
                      <th className="border border-primary-800 print:border-gray-300 px-3 py-2 text-left w-10">No</th>
                      <th className="border border-primary-800 print:border-gray-300 px-3 py-2 text-left">Nama</th>
                      <th className="border border-primary-800 print:border-gray-300 px-3 py-2 text-left">NIS</th>
                      <th className="border border-primary-800 print:border-gray-300 px-3 py-2 text-left">Username (Email)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cls.students.map((s, idx) => (
                      <tr key={s.id} className="hover:bg-primary-50/30 print:hover:bg-transparent">
                        <td className="border border-gray-200 px-3 py-1.5 text-gray-400">{idx + 1}</td>
                        <td className="border border-gray-200 px-3 py-1.5 font-medium text-primary-900">{s.user.name}</td>
                        <td className="border border-gray-200 px-3 py-1.5 font-mono">{s.nis}</td>
                        <td className="border border-gray-200 px-3 py-1.5 font-mono">{s.user.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="text-[11px] text-gray-400 italic mt-4">
              Catatan: password tidak dapat dicetak karena tersimpan dalam bentuk terenkripsi satu-arah (tidak bisa dibaca ulang oleh siapa pun). Beri tahu siswa password default akun barunya lewat menu Akun Pengguna.
            </p>
          </div>
        ))
      )}
    </>
  );
}
