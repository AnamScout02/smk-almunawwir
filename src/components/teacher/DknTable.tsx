"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { ClipboardList, Loader2, ClipboardPaste, ArrowLeft } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import Select from "@/components/admin/Select";
import PrintButton from "@/components/shared/PrintButton";
import PrintKop from "@/components/shared/PrintKop";
import { useToast } from "@/components/shared/ToastProvider";
import { usePrintTitle } from "@/lib/usePrintTitle";
import { buildPrintFilename } from "@/lib/print-filename";
import { keteranganSingkatan, labelMapel } from "@/lib/singkatan-mapel";

interface StudentRow { id: string; nis: string; name: string }
interface DknData {
  class: { name: string; grade: number; major: { name: string } | null }; students: StudentRow[]; subjects: string[]; singkatan?: Record<string, string>;
  scores: Record<string, Record<string, number | null>>;
  /** Kolom gabungan DPK/KK & sel yang nilainya otomatis (rapor gabungan / rata-rata DKN bagian lama). */
  gabungan?: string[]; otomatis?: Record<string, Record<string, "rapor" | "bagian">>;
}

function generateSemesters(): { list: string[]; currentIndex: number } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const currentTahunAjaran = month >= 7 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
  const prevTahunAjaran = month >= 7 ? `${year - 1}/${year}` : `${year - 2}/${year - 1}`;
  const list = [`Ganjil ${prevTahunAjaran}`, `Genap ${prevTahunAjaran}`, `Ganjil ${currentTahunAjaran}`, `Genap ${currentTahunAjaran}`];
  // Juli-Desember = semester Ganjil tahun ajaran berjalan (index 2); Januari-Juni = Genap (index 3).
  return { list, currentIndex: month >= 7 ? 2 : 3 };
}
const { list: SEMESTERS, currentIndex: CURRENT_SEMESTER_INDEX } = generateSemesters();

export default function DknTable({ classId, logoUrl, backHref }: { classId: string; logoUrl?: string; backHref: string }) {
  const toast = useToast();
  const [semester, setSemester] = useState(SEMESTERS[CURRENT_SEMESTER_INDEX]);
  const [data, setData] = useState<DknData | null>(null);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Record<string, string>>({}); // key `${studentId}::${subject}` -> input string sedang diketik
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [pasting, setPasting] = useState(false);
  const tableRef = useRef<HTMLTableElement>(null);

  usePrintTitle(data ? buildPrintFilename("DKN", data.class.name, semester) : null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/teacher/dkn/${classId}?semester=${encodeURIComponent(semester)}`).then(r => r.json())
      .then((d: DknData) => { setData(d); setEdits({}); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [classId, semester]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(studentId: string, subject: string, raw: string) {
    const key = `${studentId}::${subject}`;
    const current = data?.scores[studentId]?.[subject] ?? null;
    const otomatis = !!data?.otomatis?.[studentId]?.[subject];
    // Kolom gabungan (DPK/KK): mengosongkan nilai ketikan wali = kembali ke nilai otomatis dari rapor.
    if (raw.trim() === "" && data?.gabungan?.includes(subject) && current !== null && !otomatis) {
      setSavingKey(key);
      const r = await fetch(`/api/teacher/dkn/${classId}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentId, subject, semester }) }).catch(() => null);
      setSavingKey(null);
      if (!r?.ok) { toast.error("Gagal mengembalikan ke nilai otomatis."); return; }
      toast.success("Kembali ke nilai otomatis dari rapor.");
      load();
      return;
    }
    if (raw.trim() === "" || raw === String(current ?? "")) { setEdits(p => { const n = { ...p }; delete n[key]; return n; }); return; }
    const score = Number(raw);
    if (isNaN(score) || score < 0 || score > 100) { toast.error("Nilai harus angka 0-100."); return; }
    setSavingKey(key);
    const res = await fetch(`/api/teacher/dkn/${classId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, subject, semester, score }),
    });
    setSavingKey(null);
    if (!res.ok) { const d = await res.json(); toast.error(d.error || "Gagal menyimpan nilai"); return; }
    setData(prev => prev ? {
      ...prev, scores: { ...prev.scores, [studentId]: { ...prev.scores[studentId], [subject]: score } },
      otomatis: { ...prev.otomatis, [studentId]: Object.fromEntries(Object.entries(prev.otomatis?.[studentId] ?? {}).filter(([k]) => k !== subject)) },
    } : prev);
    setEdits(p => { const n = { ...p }; delete n[key]; return n; });
  }

  // Navigasi ala spreadsheet (panah/Enter) + paste blok sel dari Excel — supaya input DKN terasa
  // seperti excel "live" sesuai permintaan user, tanpa perlu library grid pihak ketiga.
  function focusCell(row: number, col: number) {
    if (!data) return;
    const r = Math.max(0, Math.min(row, data.students.length - 1));
    const c = Math.max(0, Math.min(col, data.subjects.length - 1));
    const el = tableRef.current?.querySelector<HTMLInputElement>(`input[data-row="${r}"][data-col="${c}"]`);
    el?.focus();
    el?.select();
  }

  function handleCellKeyDown(e: React.KeyboardEvent<HTMLInputElement>, row: number, col: number) {
    switch (e.key) {
      case "ArrowUp": e.preventDefault(); focusCell(row - 1, col); break;
      case "ArrowDown": case "Enter": e.preventDefault(); focusCell(row + 1, col); break;
      case "ArrowLeft":
        if ((e.target as HTMLInputElement).selectionStart === 0) { e.preventDefault(); focusCell(row, col - 1); }
        break;
      case "ArrowRight": {
        const el = e.target as HTMLInputElement;
        if (el.selectionEnd === el.value.length) { e.preventDefault(); focusCell(row, col + 1); }
        break;
      }
    }
  }

  /** Tempel blok sel yang di-copy dari Excel (TSV: tab antar-kolom, newline antar-baris) mulai
   * dari sel yang sedang fokus, meluas ke kanan/bawah sesuai ukuran blok yang ditempel — dipotong
   * otomatis kalau melebihi jumlah siswa/mapel yang ada. Semua sel yang valid disimpan sekaligus
   * dalam SATU request (lihat PUT bulk di route.ts) supaya tidak spam puluhan request terpisah. */
  async function handlePaste(e: React.ClipboardEvent<HTMLInputElement>, row: number, col: number) {
    const text = e.clipboardData.getData("text/plain");
    if (!text || (!text.includes("\t") && !text.includes("\n"))) return; // paste satu sel biasa — biarkan default
    e.preventDefault();
    if (!data) return;

    const rows = text.replace(/\r/g, "").split("\n").filter((_, i, arr) => !(i === arr.length - 1 && arr[i] === ""));
    const updates: { studentId: string; subject: string; score: number }[] = [];
    const newScores: Record<string, Record<string, number>> = {};
    let skipped = 0;

    rows.forEach((line, ri) => {
      const cells = line.split("\t");
      cells.forEach((raw, ci) => {
        const r = row + ri, c = col + ci;
        if (r >= data.students.length || c >= data.subjects.length) return;
        const trimmed = raw.trim().replace(",", "."); // excel lokal ID kadang pakai koma desimal
        if (trimmed === "") return;
        const score = Number(trimmed);
        if (isNaN(score) || score < 0 || score > 100) { skipped++; return; }
        const studentId = data.students[r].id;
        const subject = data.subjects[c];
        updates.push({ studentId, subject, score });
        newScores[studentId] = { ...newScores[studentId], [subject]: score };
      });
    });

    if (updates.length === 0) { toast.error("Tidak ada nilai valid (0-100) yang bisa ditempel."); return; }

    setPasting(true);
    const res = await fetch(`/api/teacher/dkn/${classId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ semester, updates }),
    });
    setPasting(false);
    if (!res.ok) { const d = await res.json(); toast.error(d.error || "Gagal menyimpan tempelan nilai"); return; }

    setData(prev => {
      if (!prev) return prev;
      const merged = { ...prev.scores };
      const oto = { ...prev.otomatis };
      for (const sid of Object.keys(newScores)) {
        merged[sid] = { ...merged[sid], ...newScores[sid] };
        oto[sid] = Object.fromEntries(Object.entries(oto[sid] ?? {}).filter(([k]) => !(k in newScores[sid]))); // tempelan = nilai ketikan
      }
      return { ...prev, scores: merged, otomatis: oto };
    });
    toast.success(`${updates.length} nilai tersimpan dari tempelan.${skipped ? ` (${skipped} dilewati krn bukan 0-100)` : ""}`);
  }

  function rowAverage(studentId: string): number | null {
    if (!data) return null;
    const vals = data.subjects.map(s => data.scores[studentId]?.[s] ?? null).filter((v): v is number => v !== null);
    return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 : null;
  }

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0">
      <style>{"@page { size: A4 landscape; margin: 1cm; }"}</style>

      <PageHeader icon={<ClipboardList size={22} />} title="DKN — Daftar Kumpulan Nilai"
        description={data ? `${data.class.name} · ${data.class.major?.name ?? "—"}` : "Memuat..."} printHidden />
      <div className="flex flex-wrap items-center gap-2 mb-5 print:hidden">
        <Link href={backHref} className="btn-modal-cancel">
          <ArrowLeft size={18} /> Kembali
        </Link>
        <div className="w-56">
          <Select value={semester} onChange={setSemester} options={SEMESTERS.map(s => ({ value: s, label: s }))} />
        </div>
        <span className="text-xs text-gray-400 flex items-center gap-1.5">
          <ClipboardPaste size={13} className="shrink-0" />
          Klik nilai untuk mengubah, panah/Enter utk pindah sel — bisa tempel (paste) blok nilai langsung dari Excel.
        </span>
        {pasting && <span className="text-xs text-primary-700 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Menyimpan tempelan...</span>}
        <div className="sm:ml-auto"><PrintButton /></div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" size={28} /></div>
      ) : !data || data.students.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Belum Ada Siswa" description="Kelas ini belum punya siswa aktif." />
      ) : (
        <div className="print-doc">
          <div className="print:block hidden">
            <PrintKop title="Daftar Kumpulan Nilai (DKN)" subtitle="SMK Al Munawwir IIBS" logoUrl={logoUrl} edgeClassName="-mx-6 print:-mx-2" />
          </div>
          <div className="bg-gray-50 rounded-xl p-4 mb-5 grid grid-cols-3 gap-2 text-sm print:bg-transparent print:border print:border-gray-300 print:rounded-none">
            <div><span className="text-gray-500">Kelas</span><span className="mx-2">:</span><strong>{data.class.name}</strong></div>
            <div><span className="text-gray-500">Jurusan</span><span className="mx-2">:</span><strong>{data.class.major?.name ?? "—"}</strong></div>
            <div><span className="text-gray-500">Semester</span><span className="mx-2">:</span><strong>{semester}</strong></div>
          </div>

          {data.subjects.length === 0 ? (
            <EmptyState icon={ClipboardList} title="Belum Ada Mata Pelajaran" description="Belum ada Penugasan Mengajar untuk kelas ini." />
          ) : (
            <div className="overflow-x-auto bg-white rounded-2xl border border-gray-100 shadow-sm print:border-0 print:shadow-none print:rounded-none">
              <table ref={tableRef} className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 print:bg-gray-100">
                    <th className="border border-gray-200 px-2 py-2 text-center w-10">No</th>
                    <th className="border border-gray-200 px-3 py-2 text-left min-w-[160px]">Nama Siswa</th>
                    <th className="border border-gray-200 px-2 py-2 text-center w-24">NIS</th>
                    {data.subjects.map(s => (
                      <th key={s} title={s} className="border border-gray-200 px-2 py-2 text-center text-xs whitespace-nowrap">{labelMapel(s, data.singkatan)}</th>
                    ))}
                    <th className="border border-gray-200 px-2 py-2 text-center w-20">Rata-rata</th>
                  </tr>
                </thead>
                <tbody>
                  {data.students.map((st, i) => {
                    const avg = rowAverage(st.id);
                    return (
                      <tr key={st.id} className="hover:bg-primary-50/30 print:hover:bg-transparent">
                        <td className="border border-gray-200 px-2 py-1.5 text-center text-gray-400">{i + 1}</td>
                        <td className="border border-gray-200 px-3 py-1.5 font-medium text-primary-900">{st.name}</td>
                        <td className="border border-gray-200 px-2 py-1.5 text-center font-mono text-xs text-gray-500">{st.nis}</td>
                        {data.subjects.map((subject, ci) => {
                          const key = `${st.id}::${subject}`;
                          const cell = data.scores[st.id]?.[subject] ?? null;
                          const displayVal = edits[key] ?? (cell ?? "");
                          return (
                            <td key={subject} className="border border-gray-200 p-0.5 text-center">
                              <input
                                type="number" min={0} max={100} value={displayVal}
                                data-row={i} data-col={ci}
                                onChange={e => setEdits(p => ({ ...p, [key]: e.target.value }))}
                                onBlur={e => handleSave(st.id, subject, e.target.value)}
                                onKeyDown={e => handleCellKeyDown(e, i, ci)}
                                onPaste={e => handlePaste(e, i, ci)}
                                disabled={savingKey === key || pasting}
                                placeholder="—"
                                className={`w-14 text-center text-sm py-1 border-0 focus:ring-1 focus:ring-primary-500 rounded outline-none print:appearance-none ${
                                  cell !== null && cell < 75 ? "text-red-600" : "text-gray-700"
                                } ${data.otomatis?.[st.id]?.[subject] ? "italic !text-gray-500 print:!text-gray-900 print:not-italic" : ""} ${savingKey === key ? "opacity-40" : ""}`}
                                title={data.otomatis?.[st.id]?.[subject] === "rapor" ? "Otomatis dari nilai rapor gabungan (Form Nilai Rapor) — ketik untuk menimpa"
                                  : data.otomatis?.[st.id]?.[subject] === "bagian" ? "Rata-rata nilai DKN bagian yang lama — ketik untuk menimpa" : undefined}
                              />
                            </td>
                          );
                        })}
                        <td className="border border-gray-200 px-2 py-1.5 text-center font-semibold text-primary-900">{avg ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!!data.gabungan?.length && (
            <p className="text-xs text-gray-600 mt-3 print:hidden">
              <span className="font-semibold">{data.gabungan.join(" & ")}</span> = satu kolom untuk semua bagiannya, terisi otomatis
              (<i className="text-gray-500">miring</i>) dari nilai rapor gabungan di Form Nilai Rapor. Ketik untuk menimpa; kosongkan sel untuk kembali ke nilai otomatis.
            </p>
          )}
          {keteranganSingkatan(data.subjects, data.singkatan) && (
            <p className="text-xs text-gray-600 mt-3 print:text-[9pt]"><span className="font-semibold">Keterangan:</span> {keteranganSingkatan(data.subjects, data.singkatan)}</p>
          )}
          <p className="text-[11px] text-gray-400 mt-3 print:hidden">
            Nilai bertanda merah &lt; 75. DKN murni input manual wali kelas — kolom kosong berarti memang belum diisi, tidak dihitung otomatis dari nilai manapun.
          </p>
        </div>
      )}
    </div>
  );
}
