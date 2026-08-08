"use client";
import { useEffect, useState } from "react";
import { Search, Users, Loader2, GraduationCap, Download, Eye, BookOpen, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import StatTile from "@/components/admin/StatTile";
import EmptyState from "@/components/admin/EmptyState";

interface Major { id: string; name: string; code: string }
interface ClassItem { id: string; name: string; grade: number; major: { code: string } }
interface Student {
  id: string;
  nis: string;
  nisn: string | null;
  user: { id: string; name: string; email: string };
  class: ClassItem | null;
  major: Major;
}

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterClass, setFilterClass] = useState("ALL");

  async function load() {
    setLoading(true);
    const [sRes, clsRes] = await Promise.all([
      fetch("/api/admin/students"),
      fetch("/api/admin/classes"),
    ]);
    if (sRes.ok) setStudents(await sRes.json());
    if (clsRes.ok) setClasses(await clsRes.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = students.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !q || s.user.name.toLowerCase().includes(q) || s.nis.includes(q) || (s.nisn ?? "").includes(q);
    const matchClass = filterClass === "ALL" || s.class?.id === filterClass || (filterClass === "NONE" && !s.class);
    return matchSearch && matchClass;
  });

  // group by class
  const grouped = classes
    .sort((a, b) => a.grade - b.grade || a.name.localeCompare(b.name))
    .map(cls => ({ cls, items: filtered.filter(s => s.class?.id === cls.id) }))
    .filter(g => g.items.length > 0);

  const unclassed = filtered.filter(s => !s.class);

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<Users size={22} />}
        title="Kelola Siswa"
        description="Atur NIS, jurusan, dan kelas setiap siswa"
      />

      <div className="flex justify-end mb-5">
        <a href="/api/admin/export/students"
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
          <Download size={15} />
          Export CSV
        </a>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <StatTile color="primary" icon={Users} value={students.length} label="Total Siswa" />
        <StatTile color="emerald" icon={CheckCircle2} value={students.filter(s => s.class).length} label="Sudah Berkelas" />
        <StatTile color="amber" icon={AlertCircle} value={students.filter(s => !s.class).length} label="Belum Berkelas" />
      </div>

      {/* Filter & Search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama, NIS, atau NISN..."
            className="input-field pl-10" />
        </div>
        <Select
          className="sm:w-48"
          value={filterClass}
          onChange={v => setFilterClass(v)}
          options={[
            { value: "ALL", label: "Semua Kelas" },
            ...classes.map(c => ({ value: c.id, label: c.name })),
            { value: "NONE", label: "Belum Ada Kelas" },
          ]}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-primary-500" /></div>
      ) : (
        <div className="space-y-6">
          {/* Per kelas */}
          {grouped.map(({ cls, items }) => (
            <div key={cls.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="relative px-5 py-3.5 flex items-center justify-between"
                style={{ background: "linear-gradient(135deg, #0F1A45 0%, #1B2B6B 100%)" }}>
                <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
                  style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "140px 140px", backgroundRepeat: "repeat", filter: "invert(1)" }} />
                <div className="relative flex items-center gap-2">
                  <GraduationCap size={15} className="text-gold" />
                  <span className="font-heading font-bold text-white text-sm">{cls.name}</span>
                  <span className="text-white/40 text-xs">· {cls.major.code}</span>
                </div>
                <span className="relative text-xs font-semibold text-gold bg-white/10 border border-white/20 px-2.5 py-1 rounded-full flex items-center gap-1">
                  <Users size={10} /> {items.length}
                </span>
              </div>
              <StudentTable items={items} />
            </div>
          ))}

          {/* Tanpa kelas */}
          {unclassed.length > 0 && (
            <div className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 bg-amber-500 flex items-center justify-between">
                <span className="font-heading font-bold text-white flex items-center gap-2 text-sm">
                  <Users size={15} /> Belum Ada Kelas
                </span>
                <span className="text-xs font-bold text-white bg-white/20 px-2.5 py-1 rounded-full">{unclassed.length}</span>
              </div>
              <StudentTable items={unclassed} />
            </div>
          )}

          {filtered.length === 0 && (
            <EmptyState icon={Users} title="Tidak ada siswa ditemukan" />
          )}
        </div>
      )}

    </div>
  );
}

function StudentTable({ items }: { items: Student[] }) {
  return (
    <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-primary-100"
          style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.05) 0%, rgba(27,43,107,0.03) 100%)" }}>
          <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 w-8">#</th>
          <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">NIS</th>
          <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Nama Siswa</th>
          <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 hidden md:table-cell">NISN</th>
          <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 hidden lg:table-cell">Jurusan</th>
          <th className="text-right px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Aksi</th>
        </tr>
      </thead>
      <tbody>
        {items.map((s, i) => (
          <tr key={s.id} className="border-b border-gray-50 last:border-0 hover:bg-primary-50/30 transition-colors">
            <td className="px-5 py-3.5 text-gray-300 text-xs">{i + 1}</td>
            <td className="px-5 py-3.5 font-mono text-xs text-gray-500 font-medium">{s.nis}</td>
            <td className="px-5 py-3.5 font-semibold text-primary-900">{s.user.name}</td>
            <td className="px-5 py-3.5 font-mono text-xs text-gray-400 hidden md:table-cell">{s.nisn ?? "—"}</td>
            <td className="px-5 py-3.5 text-xs hidden lg:table-cell">
              <span className="bg-primary-50 text-primary-600 border border-primary-100 font-semibold px-2 py-0.5 rounded-full">{s.major.code}</span>
            </td>
            <td className="px-5 py-3.5 text-right">
              <div className="flex items-center justify-end gap-1">
                <Link href={`/dashboard/admin/students/${s.id}`}
                  className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition" title="Lihat detail">
                  <Eye size={14} />
                </Link>
                <Link href={`/dashboard/admin/buku-induk/siswa?edit=${s.id}`}
                  className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition" title="Edit Biodata di Buku Induk">
                  <BookOpen size={14} />
                </Link>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}
