"use client";
import { useState, useEffect, useCallback, type ChangeEvent } from "react";
import {
  Search, Download, Upload, Loader2,
  BookOpen, User, GraduationCap, Users, Plus, Table2, Printer, ArrowRightLeft,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import Alert from "@/components/admin/Alert";
import GroupedSection from "@/components/admin/GroupedSection";
import EmptyState from "@/components/admin/EmptyState";
import BukuIndukSiswaModal, { type BukuIndukData } from "@/components/admin/BukuIndukSiswaModal";
import PindahKelasModal from "@/components/admin/PindahKelasModal";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Student {
  id: string; nis: string; nisn?: string;
  birthPlace?: string; birthDate?: string; gender?: string; religion?: string;
  address?: string; parentName?: string; parentPhone?: string; parentJob?: string;
  previousSchool?: string; enrollYear?: number; studentStatus?: string;
  exitDate?: string; studentNotes?: string; bukuIndukData?: BukuIndukData;
  user: { name: string; email: string }; class?: { id: string; name: string };
  major: { id: string; name: string; code: string };
}

interface ClassOption { id: string; name: string; grade: number; major: { id: string; code: string } }

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  AKTIF: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  LULUS: "bg-blue-50 text-blue-700 border border-blue-200",
  KELUAR: "bg-red-50 text-red-600 border border-red-200",
  PINDAH: "bg-amber-50 text-amber-700 border border-amber-200",
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BukuIndukSiswaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [students, setStudents] = useState<Student[]>([]);
  const [filtered, setFiltered] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [classFilter, setClassFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Student | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; updated: number; foto?: number; errors: string[] } | null>(null);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [moveStudent, setMoveStudent] = useState<Student | null>(null);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/buku-induk/siswa");
    const data = await res.json();
    setStudents(data); setFiltered(data); setLoading(false);
  }, []);

  useEffect(() => {
    fetchStudents();
    fetch("/api/admin/classes").then(r => r.json()).then(d => setClasses(Array.isArray(d) ? d : [])).catch(() => {});
  }, [fetchStudents]);

  useEffect(() => {
    let list = students;
    if (statusFilter !== "ALL") list = list.filter(s => s.studentStatus === statusFilter);
    if (classFilter === "UNCLASSED") list = list.filter(s => !s.class);
    else if (classFilter !== "ALL") list = list.filter(s => s.class?.id === classFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.user.name.toLowerCase().includes(q) ||
        s.nis.toLowerCase().includes(q)
      );
    }
    setFiltered(list);
  }, [students, search, statusFilter, classFilter]);

  function openCreate() {
    setIsNew(true);
    setSelected(null);
  }

  function openEdit(student: Student) {
    setIsNew(false);
    setSelected(student);
  }

  function closeModal() {
    setIsNew(false);
    setSelected(null);
  }

  function handleSaved() {
    closeModal();
    fetchStudents();
  }

  // Deep link dari halaman /students: buka modal edit siswa tertentu otomatis lewat ?edit=<id>
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId || students.length === 0) return;
    const target = students.find(s => s.id === editId);
    if (target) openEdit(target);
    router.replace("/dashboard/admin/buku-induk/siswa");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, searchParams]);

  async function handleImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setImportLoading(true); setImportResult(null);
    const fd = new FormData(); fd.append("file", file);
    const res = await fetch("/api/admin/buku-induk/siswa/import", { method: "POST", body: fd });
    const data = await res.json();
    setImportResult(data); setImportLoading(false); fetchStudents(); e.target.value = "";
  }

  const groupedByClass = Array.from(new Set(filtered.filter(s => s.class).map(s => s.class!.name)))
    .sort()
    .map(name => ({
      name,
      items: filtered.filter(s => s.class?.name === name),
      classId: classes.find(c => c.name === name)?.id,
    }));
  const unclassed = filtered.filter(s => !s.class);

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<BookOpen size={22} />}
        title="Buku Induk Siswa"
        description="Data lengkap kependudukan siswa SMK Al Munawwir IIBS"
      />

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input-field pl-10"
            placeholder="Cari nama atau NIS..." value={search}
            onChange={e => setSearch(e.target.value)} />
        </div>
        <Select
          className="sm:w-44"
          value={statusFilter}
          onChange={v => setStatusFilter(v)}
          options={[
            { value: "ALL", label: "Semua Status" },
            { value: "AKTIF", label: "Aktif" },
            { value: "LULUS", label: "Lulus" },
            { value: "KELUAR", label: "Keluar" },
            { value: "PINDAH", label: "Pindah" },
          ]}
        />
        <Select
          className="sm:w-48"
          value={classFilter}
          onChange={v => setClassFilter(v)}
          options={[
            { value: "ALL", label: "Semua Kelas" },
            ...classes.slice().sort((a, b) => a.grade - b.grade || a.name.localeCompare(b.name))
              .map(c => ({ value: c.id, label: c.name })),
            { value: "UNCLASSED", label: "Belum Ada Kelas" },
          ]}
        />
        <button onClick={openCreate} className="btn-modal-save">
          <Plus size={15} /> Tambah Siswa
        </button>
        <a href="/dashboard/admin/buku-induk/siswa/tabel"
          className="btn-modal-cancel">
          <Table2 size={15} /> Tabel Lengkap
        </a>
        <a href="/api/admin/buku-induk/siswa/template"
          className="btn-modal-cancel">
          <Download size={15} /> Template
        </a>
        <label className="flex items-center gap-2 px-4 py-2.5 bg-primary-700 hover:bg-primary-900 text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer">
          <Upload size={15} />
          {importLoading ? "Mengimpor..." : "Import Excel"}
          <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} disabled={importLoading} />
        </label>
      </div>

      <p className="text-xs text-gray-400 -mt-1 mb-4">
        Impor memakai berkas Template di atas. Foto yang ditempel di lembar pertama berkas Excel
        ikut terbaca otomatis dan dipasangkan ke baris siswanya — foto yang sudah ada di sistem tidak ditimpa.
      </p>

      {importResult && (
        <Alert variant={importResult.errors.length > 0 ? "warning" : "success"} className="mb-4"
          title={`Hasil import: ${importResult.created} dibuat, ${importResult.updated} diperbarui${importResult.foto ? `, ${importResult.foto} foto ikut terbaca dari berkas` : ""}`}>
          {importResult.errors.length > 0 && (
            <ul className="mt-1 text-red-600 text-xs list-disc list-inside">
              {importResult.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
              {importResult.errors.length > 5 && <li>...dan {importResult.errors.length - 5} error lainnya</li>}
            </ul>
          )}
        </Alert>
      )}

      {/* Tabel */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-primary-500" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={User} title="Tidak ada data siswa" />
      ) : (
        <div className="space-y-6">
          {groupedByClass.map(({ name, items, classId }) => (
            <GroupedSection key={name} title={name} count={items.length} icon={GraduationCap}
              headerActions={classId && (
                <a href={`/dashboard/admin/buku-induk/siswa/cetak-kelas/${classId}`}
                  title="Cetak Buku Induk Sekelas"
                  className="btn-modal-cancel px-3 text-xs">
                  <Printer size={12} /> Cetak Kelas
                </a>
              )}>
              <BukuIndukSiswaTable items={items} onEdit={openEdit} onMove={setMoveStudent} />
            </GroupedSection>
          ))}
          {unclassed.length > 0 && (
            <GroupedSection title="Belum Ada Kelas" count={unclassed.length} icon={Users} variant="warning">
              <BukuIndukSiswaTable items={unclassed} onEdit={openEdit} onMove={setMoveStudent} />
            </GroupedSection>
          )}
          <p className="text-xs text-gray-400">Menampilkan {filtered.length} dari {students.length} siswa</p>
        </div>
      )}

      <BukuIndukSiswaModal
        student={selected}
        isNew={isNew}
        onClose={closeModal}
        onSaved={handleSaved}
      />

      <PindahKelasModal
        student={moveStudent}
        classes={classes}
        onClose={() => setMoveStudent(null)}
        onMoved={() => { setMoveStudent(null); fetchStudents(); }}
      />
    </div>
  );
}

function BukuIndukSiswaTable({ items, onEdit, onMove }: { items: Student[]; onEdit: (s: Student) => void; onMove: (s: Student) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>NIS</th>
            <th>Nama Siswa</th>
            <th>Jurusan</th>
            <th>Status</th>
            <th className="text-right">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {items.map((s) => (
            <tr key={s.id}>
              <td className="font-mono font-semibold text-gray-600">{s.nis}</td>
              <td className="font-semibold text-primary-900">{s.user.name}</td>
              <td className="text-xs">
                <span className="bg-gray-50 text-gray-600 font-semibold px-2 py-0.5 rounded-full border border-gray-200">{s.major.code}</span>
              </td>
              <td>
                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${STATUS_COLOR[s.studentStatus ?? "AKTIF"] ?? "bg-gray-100 text-gray-600 border border-gray-200"}`}>
                  {s.studentStatus ?? "AKTIF"}
                </span>
              </td>
              <td className="text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <a href={`/dashboard/admin/buku-induk/siswa/${s.id}/cetak`}
                    title="Cetak Buku Induk"
                    className="p-1.5 text-gray-400 hover:text-primary-700 hover:bg-primary-50 rounded-lg border border-transparent hover:border-primary-100 transition-colors">
                    <Printer size={14} />
                  </a>
                  <button onClick={() => onEdit(s)}
                    className="px-3 py-1.5 text-xs bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 border border-primary-100 font-semibold transition-colors">
                    Lihat/Edit
                  </button>
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
  );
}
