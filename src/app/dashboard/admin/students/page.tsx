"use client";
import { useEffect, useState } from "react";
import { Search, Users, Loader2, GraduationCap, Download, Eye, BookOpen, ArrowRightLeft, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import StatTile from "@/components/admin/StatTile";
import EmptyState from "@/components/admin/EmptyState";
import PindahKelasModal from "@/components/admin/PindahKelasModal";
import Paginasi from "@/components/shared/Paginasi";
import { usePaginasi } from "@/lib/use-paginasi";

interface Major { id: string; name: string; code: string }
interface ClassItem { id: string; name: string; grade: number; major: { id: string; code: string } }
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
  const [moveStudent, setMoveStudent] = useState<Student | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [sRes, clsRes] = await Promise.all([
        fetch("/api/admin/students"),
        fetch("/api/admin/classes"),
      ]);
      if (sRes.ok) setStudents(await sRes.json());
      if (clsRes.ok) setClasses(await clsRes.json());
    } catch {
      // biarkan state lama tetap tampil kalau gagal, jangan sampai spinner macet
    } finally {
      setLoading(false);
    }
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
  // Panjang halaman ini karena BANYAK KELAS (tiap tabel ≤ ±35 siswa) — yang dipaginasi kelompok kelasnya.
  const halKelas = usePaginasi(grouped, 6, `${search}|${filterClass}`);
  const halamanTerakhir = halKelas.halaman === halKelas.totalHalaman;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<Users size={22} />}
        title="Kelola Siswa"
        description="Atur NIS, jurusan, dan kelas setiap siswa"
      />

      {/* Stats */}
      <div className="kisi-kartu kisi-kartu-3 mb-5">
        <StatTile color="primary" icon={Users} value={students.length} label="Total Siswa" />
        <StatTile color="emerald" icon={CheckCircle2} value={students.filter(s => s.class).length} label="Sudah Berkelas" />
        <StatTile color="amber" icon={AlertCircle} value={students.filter(s => !s.class).length} label="Belum Berkelas" />
      </div>

      {/* Filter & Search */}
      <div className="baris-alat mb-5">
        <div className="alat-cari">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama, NIS, atau NISN..."
            className="input-field pl-10" />
        </div>
        <div className="alat-saring">
          <Select
            value={filterClass}
            onChange={v => setFilterClass(v)}
            options={[
              { value: "ALL", label: "Semua Kelas" },
              ...classes.map(c => ({ value: c.id, label: c.name })),
              { value: "NONE", label: "Belum Ada Kelas" },
            ]}
          />
        </div>
        <div className="alat-aksi">
          <a href="/api/admin/export/students"
            className="btn-modal-cancel">
            <Download size={15} />
            Unduh Excel
          </a>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
      ) : (
        <div id="daftar-siswa" className="space-y-6 scroll-mt-40">
          {/* Per kelas */}
          {halKelas.potongan.map(({ cls, items }) => (
            <div key={cls.id} className="panel overflow-hidden">
              <div className="px-5 py-3.5 flex items-center justify-between border-b border-gray-100 bg-white">
                <div className="flex items-center gap-2">
                  <GraduationCap size={15} className="text-primary-700" />
                  <span className="font-heading font-bold text-primary-900 text-sm">{cls.name}</span>
                  <span className="text-gray-500 text-xs">· {cls.major.code}</span>
                </div>
                <span className="text-xs font-semibold text-primary-700 bg-primary-50 border border-primary-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                  <Users size={10} /> {items.length}
                </span>
              </div>
              <StudentTable items={items} onMove={setMoveStudent} kunci={`${search}|${filterClass}`} />
            </div>
          ))}

          {/* Tanpa kelas */}
          {unclassed.length > 0 && halamanTerakhir && (
            <div className="panel border-amber-100 overflow-hidden">
              <div className="px-5 py-3.5 bg-amber-500 flex items-center justify-between">
                <span className="font-heading font-bold text-white flex items-center gap-2 text-sm">
                  <Users size={15} /> Belum Ada Kelas
                </span>
                <span className="text-xs font-bold text-white bg-white/20 px-2.5 py-1 rounded-full">{unclassed.length}</span>
              </div>
              <StudentTable items={unclassed} onMove={setMoveStudent} kunci={`${search}|${filterClass}`} />
            </div>
          )}

          <Paginasi hal={halKelas} satuan="kelas" idGulir="daftar-siswa" className="panel" />

          {filtered.length === 0 && (
            <EmptyState icon={Users} title="Tidak ada siswa ditemukan" />
          )}
        </div>
      )}

      <PindahKelasModal
        student={moveStudent}
        classes={classes}
        onClose={() => setMoveStudent(null)}
        onMoved={() => { setMoveStudent(null); load(); }}
      />
    </div>
  );
}

function StudentTable({ items, onMove, kunci }: { items: Student[]; onMove: (s: Student) => void; kunci?: string }) {
  const hal = usePaginasi(items, 50, kunci);
  return (
    <div>
    <div className="overflow-x-auto">
    <table className="data-table">
      <thead>
        <tr>
          <th className="w-8">#</th>
          <th>NIS</th>
          <th>Nama Siswa</th>
          <th className="hidden md:table-cell">NISN</th>
          <th className="hidden lg:table-cell">Jurusan</th>
          <th className="text-right">Aksi</th>
        </tr>
      </thead>
      <tbody>
        {hal.potongan.map((s, i) => (
          <tr key={s.id}>
            <td className="text-gray-300 text-xs">{hal.awal + i}</td>
            <td className="font-mono text-xs text-gray-500 font-medium">{s.nis}</td>
            <td className="font-semibold text-primary-900">{s.user.name}</td>
            <td className="font-mono text-xs text-gray-400 hidden md:table-cell">{s.nisn ?? "—"}</td>
            <td className="text-xs hidden lg:table-cell">
              <span className="bg-primary-50 text-primary-700 border border-primary-100 font-semibold px-2 py-0.5 rounded-full">{s.major.code}</span>
            </td>
            <td className="text-right">
              <div className="flex items-center justify-end gap-1">
                <Link href={`/dashboard/admin/students/${s.id}`}
                  className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition" title="Lihat detail">
                  <Eye size={14} />
                </Link>
                <Link href={`/dashboard/admin/buku-induk/siswa?edit=${s.id}`}
                  className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition" title="Edit Biodata di Buku Induk">
                  <BookOpen size={14} />
                </Link>
                <button onClick={() => onMove(s)} title="Pindah Kelas"
                  className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 transition">
                  <ArrowRightLeft size={14} />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
    <Paginasi hal={hal} satuan="siswa" className="border-t border-gray-100" />
    </div>
  );
}
