"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Download, Table2, Pencil } from "lucide-react";
import Select from "@/components/admin/Select";
import PageHeader from "@/components/admin/PageHeader";
import { SISWA_COLUMNS as ALL_COLUMNS, type StudentRow } from "@/lib/buku-induk-siswa-columns";
import BukuIndukSiswaModal from "@/components/admin/BukuIndukSiswaModal";

interface Student extends StudentRow {
  id: string;
  user: { name: string; email: string };
  class?: { id: string; name: string; grade: number } | null;
  major: { name: string; code: string };
}

// Nama dipisah jadi kolom beku (freeze) tersendiri di samping "#", sisanya tetap bisa digeser
const NAMA_COL = ALL_COLUMNS.find(c => c.key === "nama")!;
const COLUMNS = ALL_COLUMNS.filter(c => c.key !== "nama");

/** Urutkan berdasarkan angka di depan NIS (mis. "953/009.1.4.1" -> 953), bukan alfabetis nama. */
function sortByNis(list: Student[]): Student[] {
  return [...list].sort((a, b) => {
    const na = parseInt(a.nis, 10), nb = parseInt(b.nis, 10);
    if (isNaN(na) || isNaN(nb)) return a.nis.localeCompare(b.nis);
    return na - nb;
  });
}

export default function TabelBukuIndukSiswaPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState("ALL");
  const [angkatanFilter, setAngkatanFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [editing, setEditing] = useState<Student | null>(null);

  const fetchStudents = useCallback(() => {
    fetch("/api/admin/buku-induk/siswa").then(r => r.json()).then(d => { setStudents(sortByNis(d)); setLoading(false); });
  }, []);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  const classOptions = Array.from(new Map(students.filter(s => s.class).map(s => [s.class!.id, s.class!])).values())
    .sort((a, b) => a.grade - b.grade || a.name.localeCompare(b.name));
  const angkatanOptions = Array.from(new Set(students.map(s => s.enrollYear).filter(Boolean))).sort((a, b) => (b ?? 0) - (a ?? 0));

  const filtered = students.filter(s => {
    if (classFilter !== "ALL" && s.class?.id !== classFilter) return false;
    if (angkatanFilter !== "ALL" && String(s.enrollYear ?? "") !== angkatanFilter) return false;
    if (statusFilter !== "ALL" && (s.studentStatus ?? "AKTIF") !== statusFilter) return false;
    return true;
  });

  const exportHref = `/api/admin/export/buku-induk-siswa?${new URLSearchParams({
    ...(classFilter !== "ALL" ? { classId: classFilter } : {}),
    ...(angkatanFilter !== "ALL" ? { enrollYear: angkatanFilter } : {}),
    ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
  }).toString()}`;

  // grup kolom berurutan untuk header 2 baris (nama grup membentang, lalu label kolom) — tidak termasuk kolom Nama yang dibekukan
  const groups: { name: string; cols: typeof COLUMNS }[] = [];
  for (const col of COLUMNS) {
    const last = groups[groups.length - 1];
    if (last && last.name === col.group) last.cols.push(col);
    else groups.push({ name: col.group, cols: [col] });
  }

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<Table2 size={22} />}
        title="Tabel Lengkap Buku Induk Siswa"
        description="Semua data dalam satu tabel — bisa difilter per kelas atau angkatan, diurutkan berdasarkan NIS"
      />

      {/* Aksi & filter di baris terpisah (bukan di actions PageHeader) — header cukup ikon+judul+keterangan saja. */}
      <div className="flex flex-wrap items-center gap-2.5 mb-5">
        <Link href="/dashboard/admin/buku-induk/siswa" className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition">
          <ArrowLeft size={18} />
        </Link>
        <Select className="sm:w-56" value={classFilter} onChange={setClassFilter}
          options={[{ value: "ALL", label: "Semua Kelas" }, ...classOptions.map(c => ({ value: c.id, label: c.name }))]} />
        <Select className="sm:w-44" value={angkatanFilter} onChange={setAngkatanFilter}
          options={[{ value: "ALL", label: "Semua Angkatan" }, ...angkatanOptions.map(y => ({ value: String(y), label: `Angkatan ${y}` }))]} />
        <Select className="sm:w-40" value={statusFilter} onChange={setStatusFilter}
          options={[
            { value: "ALL", label: "Semua Status" },
            { value: "AKTIF", label: "Aktif Saja" },
            { value: "LULUS", label: "Lulus Saja" },
            { value: "KELUAR", label: "Keluar Saja" },
            { value: "PINDAH", label: "Pindah Saja" },
          ]} />
        <a href={exportHref}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors whitespace-nowrap sm:ml-auto">
          <Download size={15} /> Export Excel
        </a>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-primary-500" /></div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-auto max-h-[75vh] scrollbar-visible">
            <table className="text-xs border-collapse">
              <thead className="sticky top-0 z-20">
                <tr>
                  <th rowSpan={2} className="sticky left-0 z-30 w-10 bg-primary-900 text-white px-3 py-2 text-center border-r border-white/10">#</th>
                  <th rowSpan={2} className="sticky left-10 z-30 w-48 bg-primary-900 text-white px-3 py-2 text-center border-r border-white/10 whitespace-nowrap shadow-[2px_0_4px_rgba(0,0,0,0.08)]">
                    {NAMA_COL.label}
                  </th>
                  {groups.map(g => (
                    <th key={g.name} colSpan={g.cols.length}
                      className="bg-primary-900 text-gold px-3 py-1.5 text-center font-bold uppercase tracking-wide border-r border-white/10 whitespace-nowrap">
                      {g.name}
                    </th>
                  ))}
                </tr>
                <tr>
                  {COLUMNS.map(col => (
                    <th key={col.key}
                      className="bg-primary-700 text-white px-3 py-2 text-center font-semibold border-r border-white/10 whitespace-nowrap">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr key={s.id} className="border-b border-gray-200 hover:bg-primary-50/40 transition-colors">
                    <td className="sticky left-0 z-10 w-10 bg-white px-3 py-2 text-center text-gray-400 border-r border-gray-200">{i + 1}</td>
                    <td className="sticky left-10 z-10 w-48 bg-white px-2 py-2 text-gray-900 font-semibold border-r border-gray-200 whitespace-nowrap shadow-[2px_0_4px_rgba(0,0,0,0.04)]">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="truncate">{NAMA_COL.get(s)}</span>
                        <button onClick={() => setEditing(s)} title="Edit data siswa ini"
                          className="shrink-0 p-1 text-gray-300 hover:text-primary-700 hover:bg-primary-50 rounded transition-colors">
                          <Pencil size={12} />
                        </button>
                      </div>
                    </td>
                    {COLUMNS.map(col => (
                      <td key={col.key} className="px-3 py-2 text-center text-gray-700 border-r border-gray-200 whitespace-nowrap">
                        {col.get(s) || <span className="text-gray-300">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-3 text-xs text-gray-400 border-t border-gray-100">Menampilkan {filtered.length} dari {students.length} siswa</p>
        </div>
      )}

      <BukuIndukSiswaModal
        student={editing}
        isNew={false}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); fetchStudents(); }}
      />
    </div>
  );
}
