"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  Search, Download, Upload, ChevronDown, ChevronUp, X, Save,
  BookOpen, User, Home, Heart, GraduationCap, Users, Smile,
} from "lucide-react";

interface BukuIndukData {
  nik?: string; nickname?: string; citizenship?: string;
  childOrder?: string; siblingsCount?: string; halfSiblings?: string;
  adoptedSiblings?: string; orphanStatus?: string; dailyLanguage?: string;
  dusun?: string; rt?: string; rw?: string; desa?: string;
  kecamatan?: string; kabupaten?: string; studentPhone?: string;
  livesWith?: string; distanceToSchool?: string;
  bloodType?: string; diseases?: string; height?: string; weight?: string;
  prevSchoolAddress?: string; ijazahNo?: string; enrollDate?: string;
  fatherName?: string; fatherNik?: string; fatherBirthPlace?: string;
  fatherBirthDate?: string; fatherEducation?: string; fatherJob?: string;
  fatherIncome?: string; fatherStatus?: string;
  motherName?: string; motherNik?: string; motherBirthPlace?: string;
  motherBirthDate?: string; motherEducation?: string; motherJob?: string;
  motherIncome?: string; motherStatus?: string;
  guardianName?: string; guardianNik?: string; guardianJob?: string;
  guardianAddress?: string;
  hobbyArt?: string; hobbySport?: string; hobbyOrg?: string; hobbyOther?: string;
  pklStart?: string; pklEnd?: string; pklPlace?: string; pklSupervisor?: string; pklScore?: string;
  graduationDate?: string; graduationIjazahNo?: string; skhunNo?: string;
  avgReport?: string; avgExam?: string; continueStudy?: string; workPlan?: string;
  transferDate?: string; transferTo?: string; transferReason?: string;
}

interface Student {
  id: string;
  nis: string;
  nisn?: string;
  noInduk?: string;
  birthPlace?: string;
  birthDate?: string;
  gender?: string;
  religion?: string;
  address?: string;
  parentName?: string;
  parentPhone?: string;
  parentJob?: string;
  previousSchool?: string;
  enrollYear?: number;
  studentStatus?: string;
  exitDate?: string;
  studentNotes?: string;
  bukuIndukData?: BukuIndukData;
  user: { name: string; email: string };
  class?: { name: string };
  major: { name: string; code: string };
}

const STATUS_COLOR: Record<string, string> = {
  AKTIF: "bg-green-100 text-green-700",
  LULUS: "bg-blue-100 text-blue-700",
  KELUAR: "bg-red-100 text-red-700",
  PINDAH: "bg-yellow-100 text-yellow-700",
};

function Field({ label, value, onChange, type = "text", wide = false }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; wide?: boolean;
}) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {type === "textarea" ? (
        <textarea
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          rows={2}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          type={type}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

function Section({ title, icon: Icon, open, onToggle, children }: {
  title: string; icon: React.ElementType; open: boolean;
  onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
        onClick={onToggle}
      >
        <span className="flex items-center gap-2 font-semibold text-gray-700">
          <Icon size={16} className="text-blue-600" />
          {title}
        </span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && <div className="p-4 grid grid-cols-2 gap-3">{children}</div>}
    </div>
  );
}

export default function BukuIndukSiswaPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [filtered, setFiltered] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Student | null>(null);
  const [form, setForm] = useState<Partial<Student>>({});
  const [bukuForm, setBukuForm] = useState<BukuIndukData>({});
  const [sections, setSections] = useState<Record<string, boolean>>({ a: true });
  const [saving, setSaving] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; updated: number; errors: string[] } | null>(null);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/buku-induk/siswa");
    const data = await res.json();
    setStudents(data);
    setFiltered(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  useEffect(() => {
    let list = students;
    if (statusFilter !== "ALL") list = list.filter(s => s.studentStatus === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.user.name.toLowerCase().includes(q) ||
        s.nis.toLowerCase().includes(q) ||
        (s.noInduk ?? "").toLowerCase().includes(q)
      );
    }
    setFiltered(list);
  }, [students, search, statusFilter]);

  function openEdit(student: Student) {
    setSelected(student);
    setForm({
      noInduk: student.noInduk ?? "",
      nisn: student.nisn ?? "",
      birthPlace: student.birthPlace ?? "",
      birthDate: student.birthDate ? student.birthDate.slice(0, 10) : "",
      gender: student.gender ?? "",
      religion: student.religion ?? "",
      address: student.address ?? "",
      parentName: student.parentName ?? "",
      parentPhone: student.parentPhone ?? "",
      parentJob: student.parentJob ?? "",
      previousSchool: student.previousSchool ?? "",
      enrollYear: student.enrollYear ?? undefined,
      studentStatus: student.studentStatus ?? "AKTIF",
      studentNotes: student.studentNotes ?? "",
    });
    setBukuForm((student.bukuIndukData as BukuIndukData) ?? {});
    setSections({ a: true });
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    await fetch(`/api/admin/buku-induk/siswa/${selected.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, bukuIndukData: bukuForm }),
    });
    setSaving(false);
    setSelected(null);
    fetchStudents();
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    setImportResult(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/buku-induk/siswa/import", { method: "POST", body: fd });
    const data = await res.json();
    setImportResult(data);
    setImportLoading(false);
    fetchStudents();
    e.target.value = "";
  }

  function f(key: keyof BukuIndukData) {
    return String(bukuForm[key] ?? "");
  }
  function setF(key: keyof BukuIndukData) {
    return (v: string) => setBukuForm(prev => ({ ...prev, [key]: v }));
  }
  function toggleSection(key: string) {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <BookOpen className="text-blue-600" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Buku Induk Siswa</h1>
          <p className="text-sm text-gray-500">Data lengkap kependudukan siswa SMK Al-Munawwir IIBS</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Cari nama, NIS, atau No. Induk..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="ALL">Semua Status</option>
          <option value="AKTIF">Aktif</option>
          <option value="LULUS">Lulus</option>
          <option value="KELUAR">Keluar</option>
          <option value="PINDAH">Pindah</option>
        </select>
        <a
          href="/api/admin/buku-induk/siswa/template"
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors"
        >
          <Download size={16} /> Download Template
        </a>
        <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors cursor-pointer">
          <Upload size={16} />
          {importLoading ? "Mengimpor..." : "Import Excel"}
          <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} disabled={importLoading} />
        </label>
      </div>

      {/* Import result */}
      {importResult && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${importResult.errors.length > 0 ? "bg-yellow-50 border border-yellow-200" : "bg-green-50 border border-green-200"}`}>
          <p className="font-semibold">Hasil import: {importResult.created} dibuat, {importResult.updated} diperbarui</p>
          {importResult.errors.length > 0 && (
            <ul className="mt-1 text-red-600 text-xs list-disc list-inside">
              {importResult.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
              {importResult.errors.length > 5 && <li>...dan {importResult.errors.length - 5} error lainnya</li>}
            </ul>
          )}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">No. Induk</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">NIS</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Nama Siswa</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Kelas</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Jurusan</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">Memuat data...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">Tidak ada data siswa</td></tr>
              ) : (
                filtered.map((s, idx) => (
                  <tr key={s.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{s.noInduk || "-"}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-gray-700">{s.nis}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{s.user.name}</td>
                    <td className="px-4 py-3 text-gray-600">{s.class?.name ?? "-"}</td>
                    <td className="px-4 py-3 text-gray-600">{s.major.code}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLOR[s.studentStatus ?? "AKTIF"] ?? "bg-gray-100 text-gray-600"}`}>
                        {s.studentStatus ?? "AKTIF"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => openEdit(s)}
                        className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-medium"
                      >
                        Lihat/Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && (
          <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
            Menampilkan {filtered.length} dari {students.length} siswa
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Buku Induk Siswa</h2>
                <p className="text-sm text-gray-500">{selected.user.name} — NIS {selected.nis}</p>
              </div>
              <button onClick={() => setSelected(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            {/* Modal body - scrollable */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {/* A: Keterangan Siswa */}
              <Section title="A. Keterangan Siswa" icon={User} open={!!sections.a} onToggle={() => toggleSection("a")}>
                <Field label="No. Induk" value={String(form.noInduk ?? "")} onChange={v => setForm(p => ({...p, noInduk: v}))} />
                <Field label="NISN" value={String(form.nisn ?? "")} onChange={v => setForm(p => ({...p, nisn: v}))} />
                <Field label="NIK" value={f("nik")} onChange={setF("nik")} />
                <Field label="Nama Panggilan" value={f("nickname")} onChange={setF("nickname")} />
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Jenis Kelamin</label>
                  <select className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={String(form.gender ?? "")} onChange={e => setForm(p => ({...p, gender: e.target.value}))}>
                    <option value="">-- Pilih --</option>
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </select>
                </div>
                <Field label="Tempat Lahir" value={String(form.birthPlace ?? "")} onChange={v => setForm(p => ({...p, birthPlace: v}))} />
                <Field label="Tanggal Lahir" value={String(form.birthDate ?? "")} onChange={v => setForm(p => ({...p, birthDate: v}))} type="date" />
                <Field label="Agama" value={String(form.religion ?? "")} onChange={v => setForm(p => ({...p, religion: v}))} />
                <Field label="Kewarganegaraan" value={f("citizenship")} onChange={setF("citizenship")} />
                <Field label="Anak Ke" value={f("childOrder")} onChange={setF("childOrder")} />
                <Field label="Jml. Saudara Kandung" value={f("siblingsCount")} onChange={setF("siblingsCount")} />
                <Field label="Jml. Saudara Tiri" value={f("halfSiblings")} onChange={setF("halfSiblings")} />
                <Field label="Jml. Saudara Angkat" value={f("adoptedSiblings")} onChange={setF("adoptedSiblings")} />
                <Field label="Yatim/Piatu" value={f("orphanStatus")} onChange={setF("orphanStatus")} />
                <Field label="Bahasa Sehari-hari" value={f("dailyLanguage")} onChange={setF("dailyLanguage")} />
              </Section>

              {/* B: Tempat Tinggal */}
              <Section title="B. Tempat Tinggal Siswa" icon={Home} open={!!sections.b} onToggle={() => toggleSection("b")}>
                <Field label="Dusun/Lingkungan" value={f("dusun")} onChange={setF("dusun")} />
                <Field label="RT" value={f("rt")} onChange={setF("rt")} />
                <Field label="RW" value={f("rw")} onChange={setF("rw")} />
                <Field label="Desa/Kelurahan" value={f("desa")} onChange={setF("desa")} />
                <Field label="Kecamatan" value={f("kecamatan")} onChange={setF("kecamatan")} />
                <Field label="Kabupaten/Kota" value={f("kabupaten")} onChange={setF("kabupaten")} />
                <Field label="No. HP Siswa" value={f("studentPhone")} onChange={setF("studentPhone")} />
                <Field label="No. HP Orang Tua" value={String(form.parentPhone ?? "")} onChange={v => setForm(p => ({...p, parentPhone: v}))} />
                <Field label="Tinggal Dengan" value={f("livesWith")} onChange={setF("livesWith")} />
                <Field label="Jarak ke Sekolah" value={f("distanceToSchool")} onChange={setF("distanceToSchool")} />
              </Section>

              {/* C: Kesehatan */}
              <Section title="C. Keterangan Kesehatan" icon={Heart} open={!!sections.c} onToggle={() => toggleSection("c")}>
                <Field label="Golongan Darah" value={f("bloodType")} onChange={setF("bloodType")} />
                <Field label="Tinggi Badan (cm)" value={f("height")} onChange={setF("height")} />
                <Field label="Berat Badan (kg)" value={f("weight")} onChange={setF("weight")} />
                <Field label="Penyakit yang Pernah Diderita" value={f("diseases")} onChange={setF("diseases")} wide />
              </Section>

              {/* D: Asal Sekolah */}
              <Section title="D. Keterangan Pendidikan Sebelumnya" icon={GraduationCap} open={!!sections.d} onToggle={() => toggleSection("d")}>
                <Field label="Asal Sekolah (SMP/MTs)" value={String(form.previousSchool ?? "")} onChange={v => setForm(p => ({...p, previousSchool: v}))} wide />
                <Field label="Alamat Asal Sekolah" value={f("prevSchoolAddress")} onChange={setF("prevSchoolAddress")} wide />
                <Field label="Nomor Ijazah" value={f("ijazahNo")} onChange={setF("ijazahNo")} />
                <Field label="Tahun Masuk SMK" value={String(form.enrollYear ?? "")} onChange={v => setForm(p => ({...p, enrollYear: parseInt(v)||undefined}))} type="number" />
                <Field label="Tanggal Diterima" value={f("enrollDate")} onChange={setF("enrollDate")} />
              </Section>

              {/* E: Keterangan Ayah */}
              <Section title="E. Keterangan Ayah" icon={Users} open={!!sections.e} onToggle={() => toggleSection("e")}>
                <Field label="Nama Ayah" value={f("fatherName")} onChange={setF("fatherName")} wide />
                <Field label="NIK Ayah" value={f("fatherNik")} onChange={setF("fatherNik")} />
                <Field label="Tempat Lahir Ayah" value={f("fatherBirthPlace")} onChange={setF("fatherBirthPlace")} />
                <Field label="Tgl. Lahir Ayah (YYYY-MM-DD)" value={f("fatherBirthDate")} onChange={setF("fatherBirthDate")} />
                <Field label="Pendidikan Ayah" value={f("fatherEducation")} onChange={setF("fatherEducation")} />
                <Field label="Pekerjaan Ayah" value={f("fatherJob")} onChange={setF("fatherJob")} />
                <Field label="Penghasilan Ayah" value={f("fatherIncome")} onChange={setF("fatherIncome")} />
                <Field label="Status Ayah" value={f("fatherStatus")} onChange={setF("fatherStatus")} />
              </Section>

              {/* F: Keterangan Ibu */}
              <Section title="F. Keterangan Ibu" icon={Users} open={!!sections.f} onToggle={() => toggleSection("f")}>
                <Field label="Nama Ibu" value={f("motherName")} onChange={setF("motherName")} wide />
                <Field label="NIK Ibu" value={f("motherNik")} onChange={setF("motherNik")} />
                <Field label="Tempat Lahir Ibu" value={f("motherBirthPlace")} onChange={setF("motherBirthPlace")} />
                <Field label="Tgl. Lahir Ibu (YYYY-MM-DD)" value={f("motherBirthDate")} onChange={setF("motherBirthDate")} />
                <Field label="Pendidikan Ibu" value={f("motherEducation")} onChange={setF("motherEducation")} />
                <Field label="Pekerjaan Ibu" value={f("motherJob")} onChange={setF("motherJob")} />
                <Field label="Penghasilan Ibu" value={f("motherIncome")} onChange={setF("motherIncome")} />
                <Field label="Status Ibu" value={f("motherStatus")} onChange={setF("motherStatus")} />
              </Section>

              {/* G: Wali */}
              <Section title="G. Keterangan Wali" icon={Users} open={!!sections.g} onToggle={() => toggleSection("g")}>
                <Field label="Nama Wali" value={f("guardianName")} onChange={setF("guardianName")} wide />
                <Field label="NIK Wali" value={f("guardianNik")} onChange={setF("guardianNik")} />
                <Field label="Pekerjaan Wali" value={f("guardianJob")} onChange={setF("guardianJob")} />
                <Field label="Alamat Wali" value={f("guardianAddress")} onChange={setF("guardianAddress")} wide />
              </Section>

              {/* H: Kegemaran */}
              <Section title="H. Kegemaran Siswa" icon={Smile} open={!!sections.h} onToggle={() => toggleSection("h")}>
                <Field label="Kesenian" value={f("hobbyArt")} onChange={setF("hobbyArt")} />
                <Field label="Olahraga" value={f("hobbySport")} onChange={setF("hobbySport")} />
                <Field label="Organisasi" value={f("hobbyOrg")} onChange={setF("hobbyOrg")} />
                <Field label="Lainnya" value={f("hobbyOther")} onChange={setF("hobbyOther")} />
              </Section>

              {/* I: PKL */}
              <Section title="I. Praktik Kerja Lapangan (PKL)" icon={GraduationCap} open={!!sections.pkl} onToggle={() => toggleSection("pkl")}>
                <Field label="Tanggal Mulai PKL" value={f("pklStart")} onChange={setF("pklStart")} type="date" />
                <Field label="Tanggal Selesai PKL" value={f("pklEnd")} onChange={setF("pklEnd")} type="date" />
                <Field label="Tempat PKL" value={f("pklPlace")} onChange={setF("pklPlace")} wide />
                <Field label="Guru Pembimbing" value={f("pklSupervisor")} onChange={setF("pklSupervisor")} />
                <Field label="Rata-rata Nilai PKL" value={f("pklScore")} onChange={setF("pklScore")} />
              </Section>

              {/* J: Kelulusan */}
              <Section title="J. Keterangan Setelah Selesai Pendidikan" icon={GraduationCap} open={!!sections.lulus} onToggle={() => toggleSection("lulus")}>
                <Field label="Tanggal Lulus" value={f("graduationDate")} onChange={setF("graduationDate")} type="date" />
                <Field label="Nomor Ijazah Lulus" value={f("graduationIjazahNo")} onChange={setF("graduationIjazahNo")} />
                <Field label="Nomor SKHUN" value={f("skhunNo")} onChange={setF("skhunNo")} />
                <Field label="Nilai Rata-rata Rapor" value={f("avgReport")} onChange={setF("avgReport")} />
                <Field label="Nilai Rata-rata Ujian Sekolah" value={f("avgExam")} onChange={setF("avgExam")} />
                <Field label="Akan Melanjutkan Ke" value={f("continueStudy")} onChange={setF("continueStudy")} />
                <Field label="Akan Bekerja Ke" value={f("workPlan")} onChange={setF("workPlan")} />
              </Section>

              {/* K: Pindah/Keluar */}
              <Section title="K. Keterangan Pindah/Keluar" icon={Home} open={!!sections.keluar} onToggle={() => toggleSection("keluar")}>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                  <select className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                    value={String(form.studentStatus ?? "AKTIF")} onChange={e => setForm(p => ({...p, studentStatus: e.target.value}))}>
                    <option value="AKTIF">AKTIF</option>
                    <option value="LULUS">LULUS</option>
                    <option value="KELUAR">KELUAR</option>
                    <option value="PINDAH">PINDAH</option>
                  </select>
                </div>
                <Field label="Tanggal Keluar/Pindah" value={String(form.exitDate ?? "")} onChange={v => setForm(p => ({...p, exitDate: v}))} type="date" />
                <Field label="Pindah Ke" value={f("transferTo")} onChange={setF("transferTo")} />
                <Field label="Alasan Pindah" value={f("transferReason")} onChange={setF("transferReason")} />
                <Field label="Keterangan" value={String(form.studentNotes ?? "")} onChange={v => setForm(p => ({...p, studentNotes: v}))} type="textarea" wide />
              </Section>
            </div>

            {/* Modal footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <button onClick={() => setSelected(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                Batal
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                <Save size={16} />
                {saving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
