"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Download, Table2, Search } from "lucide-react";
import Select from "@/components/admin/Select";
import PageHeader from "@/components/admin/PageHeader";
import { GURU_COLUMNS as ALL_COLUMNS, type TeacherRow } from "@/lib/buku-induk-guru-columns";
import TombolKembali from "@/components/shared/TombolKembali";

interface Teacher extends TeacherRow {
  id: string;
  user: { name: string; email: string };
}

// Nama dipisah jadi kolom beku (freeze) tersendiri di samping "#", sisanya tetap bisa digeser
const NAMA_COL = ALL_COLUMNS.find(c => c.key === "nama")!;
const COLUMNS = ALL_COLUMNS.filter(c => c.key !== "nama");

/** Urutkan berdasarkan angka di NIP (mis. "TMP-001" -> 1), bukan alfabetis nama. */
function sortByNip(list: Teacher[]): Teacher[] {
  return [...list].sort((a, b) => {
    const na = parseInt(a.nip.replace(/\D/g, ""), 10), nb = parseInt(b.nip.replace(/\D/g, ""), 10);
    if (isNaN(na) || isNaN(nb)) return a.nip.localeCompare(b.nip);
    return na - nb;
  });
}

export default function TabelBukuIndukGuru({ basePath = "/dashboard/admin/buku-induk/guru" }: { basePath?: string }) {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [waliFilter, setWaliFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/admin/buku-induk/guru").then(r => r.json()).then(d => { setTeachers(sortByNip(d)); setLoading(false); }).catch(() => { setLoading(false); });
  }, []);

  const filtered = teachers.filter(t => {
    if (statusFilter !== "ALL" && (t.teacherStatus ?? "AKTIF") !== statusFilter) return false;
    if (waliFilter === "WALI" && t.homeroomOf.length === 0) return false;
    if (waliFilter === "BUKAN" && t.homeroomOf.length > 0) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      // Cari di SEMUA kolom (nama, NIP, alamat, nama orang tua/pasangan, dll), bukan cuma nama+NIP.
      const haystack = (NAMA_COL.get(t) + " " + COLUMNS.map(c => c.get(t)).join(" ")).toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const exportHref = `/api/admin/export/buku-induk-guru?${new URLSearchParams({
    ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
  }).toString()}`;

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
        title="Tabel Lengkap Buku Induk Guru"
        description="Semua data dalam satu tabel — bisa difilter per status atau wali kelas, diurutkan berdasarkan NIP"
      />

      {/* Aksi & filter di baris terpisah (bukan di actions PageHeader) — header cukup ikon+judul+keterangan saja. */}
      <div className="baris-alat mb-5">
        <TombolKembali href={basePath} />
        <div className="alat-cari">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama, NIP, alamat, dll..."
            className="input-field pl-10" />
        </div>
        <Select className="sm:w-44" value={statusFilter} onChange={setStatusFilter}
          options={[
            { value: "ALL", label: "Semua Status" },
            { value: "AKTIF", label: "Aktif" },
            { value: "PENSIUN", label: "Pensiun" },
            { value: "KELUAR", label: "Keluar" },
          ]} />
        <Select className="sm:w-44" value={waliFilter} onChange={setWaliFilter}
          options={[
            { value: "ALL", label: "Semua Guru" },
            { value: "WALI", label: "Wali Kelas" },
            { value: "BUKAN", label: "Bukan Wali Kelas" },
          ]} />
        <a href={exportHref}
          className="btn-modal-cancel whitespace-nowrap sm:ml-auto">
          <Download size={15} /> Export Excel
        </a>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
      ) : (
        <div className="panel overflow-hidden">
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
                {filtered.map((t, i) => (
                  <tr key={t.id} className="border-b border-gray-200 hover:bg-primary-50/40 transition-colors">
                    <td className="sticky left-0 z-10 w-10 bg-white px-3 py-2 text-center text-gray-400 border-r border-gray-200">{i + 1}</td>
                    <td className="sticky left-10 z-10 w-48 bg-white px-3 py-2 text-left text-gray-900 font-semibold border-r border-gray-200 whitespace-nowrap shadow-[2px_0_4px_rgba(0,0,0,0.04)]">
                      {NAMA_COL.get(t)}
                    </td>
                    {COLUMNS.map(col => (
                      <td key={col.key} className="px-3 py-2 text-center text-gray-700 border-r border-gray-200 whitespace-nowrap">
                        {col.get(t) || <span className="text-gray-300">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-3 text-xs text-gray-400 border-t border-gray-100">Menampilkan {filtered.length} dari {teachers.length} guru</p>
        </div>
      )}
    </div>
  );
}
