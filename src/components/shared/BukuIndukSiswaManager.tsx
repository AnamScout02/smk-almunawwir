"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Download, Table2, Pencil, Search, History } from "lucide-react";
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
/** Urut dari NOMOR INDUK TERBESAR ke terkecil = angkatan terbaru muncul lebih dulu (keputusan
 * user 2026-09-12: "prioritaskan membuka angkatan terbaru"). Sejak alumni 2014-2023 ikut masuk
 * sistem, urutan menaik membuat halaman pertama berisi angkatan 2014 — padahal yang paling sering
 * dibuka justru siswa yang masih aktif. Filter angkatan tetap tersedia untuk menelusuri ke belakang. */
function sortByNis(list: Student[]): Student[] {
  return [...list].sort((a, b) => {
    const na = parseInt(a.nis, 10), nb = parseInt(b.nis, 10);
    if (isNaN(na) || isNaN(nb)) return b.nis.localeCompare(a.nis);
    return nb - na;
  });
}

/** Tabel lengkap Buku Induk Siswa — dipakai admin (semua siswa, lewat /api/admin/buku-induk/siswa
 * yang di-scope server-side ke "ALL") MAUPUN wali kelas/Operator Sekolah di portal guru (endpoint
 * yang SAMA, tapi di-scope server-side ke kelas walinya kalau bukan Operator — lihat
 * assertBukuIndukSiswaScope() di src/lib/buku-induk-access.ts). Komponen ini TIDAK PERLU tahu
 * scope-nya sendiri — filter kelas/export/dsb otomatis cuma berisi data yang memang boleh
 * diakses, karena API-nya sudah scoped, bukan komponen ini yang membatasi. */
export default function BukuIndukSiswaManager({ backHref, canManageAccount = true, riwayatBase, hanyaBaca = false }: {
  backHref: string;
  canManageAccount?: boolean;
  /** Wali kelas: lihat & unduh data kelasnya saja, tanpa tombol ubah (permintaan user 17 Sep 2026; server juga menolak ubah). */
  hanyaBaca?: boolean;
  /** Prefix URL halaman riwayat perubahan, mis. "/dashboard/admin/buku-induk/siswa".
   * Sengaja opsional: halaman riwayat hanya ada di portal admin, jadi wrapper portal guru
   * tidak mengirimnya dan tombolnya otomatis tidak muncul (bukan tautan yang berujung 404). */
  riwayatBase?: string;
}) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState("ALL");
  const [angkatanFilter, setAngkatanFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Student | null>(null);
  const [page, setPage] = useState(1);
  // 50 baris/halaman: dgn 124 kolom, tiap baris = 125 sel. 100 baris (12.500 sel) masih menahan
  // tampilan ±2,7 detik; 50 baris memangkasnya jadi separuh tanpa membuat jumlah halaman jadi
  // tidak masuk akal (terukur 2026-09-12).
  const PAGE_SIZE = 50;

  const fetchStudents = useCallback(() => {
    fetch("/api/admin/buku-induk/siswa").then(r => r.json()).then(d => { setStudents(sortByNis(Array.isArray(d) ? d : [])); setLoading(false); }).catch(() => { setLoading(false); });
  }, []);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  const classOptions = Array.from(new Map(students.filter(s => s.class).map(s => [s.class!.id, s.class!])).values())
    .sort((a, b) => a.grade - b.grade || a.name.localeCompare(b.name));
  const angkatanOptions = Array.from(new Set(students.map(s => s.enrollYear).filter(Boolean))).sort((a, b) => (b ?? 0) - (a ?? 0));

  // Teks pencarian tiap siswa dipra-hitung sekali, TAPI hanya kalau kotak cari memang dipakai.
  // Menyusunnya butuh 1.156 siswa x 124 kolom = ±143.000 pemanggilan accessor; kalau dibangun
  // saat halaman dimuat, itu menahan tampilan ±3 detik padahal mayoritas kunjungan cuma melihat
  // tabel tanpa mencari (temuan user 2026-09-12: "lama sekali data keluarnya").
  const sedangMencari = search.trim().length > 0;
  const searchIndex = useMemo(() => {
    if (!sedangMencari) return null;
    const m = new Map<string, string>();
    for (const s of students) {
      m.set(s.id, (NAMA_COL.get(s) + " " + COLUMNS.map(c => c.get(s)).join(" ")).toLowerCase());
    }
    return m;
  }, [students, sedangMencari]);

  const filtered = useMemo(() => students.filter(s => {
    if (classFilter !== "ALL" && s.class?.id !== classFilter) return false;
    if (angkatanFilter !== "ALL" && String(s.enrollYear ?? "") !== angkatanFilter) return false;
    if (statusFilter !== "ALL" && (s.studentStatus ?? "AKTIF") !== statusFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      // Cari di SEMUA kolom (nama, NIS, nama ayah/ibu, kota, sekolah asal, dll) — bukan cuma
      // nama+NIS, karena Buku Induk punya puluhan kolom (section A-M) yang masing2 sudah punya
      // accessor .get() sendiri, jadi tinggal digabung jadi satu string pencarian per baris.
      if (!(searchIndex?.get(s.id) ?? "").includes(q)) return false;
    }
    return true;
  }), [students, classFilter, angkatanFilter, statusFilter, search, searchIndex]);

  // Paginasi WAJIB di tabel ini: 124 kolom x seluruh siswa = ratusan ribu sel kalau dirender
  // sekaligus (16 detik sampai tabel muncul saat data mencapai 1.156 siswa). Filter & pencarian
  // tetap bekerja atas SELURUH data, cuma tampilannya yang dipotong per halaman.
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [classFilter, angkatanFilter, statusFilter, search]);

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
        description="Semua data dalam satu tabel — angkatan terbaru di halaman pertama, bisa difilter per kelas, angkatan, atau status"
      />

      {/* Aksi & filter di baris terpisah (bukan di actions PageHeader) — header cukup ikon+judul+keterangan saja. */}
      <div className="flex flex-wrap items-center gap-2.5 mb-5">
        <Link href={backHref} className="btn-modal-cancel">
          <ArrowLeft size={18} /> Kembali
        </Link>
        <div className="relative w-full sm:w-56">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama, NIS, nama ortu, kota, dll..."
            className="input-field pl-10" />
        </div>
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
          className="btn-modal-cancel whitespace-nowrap sm:ml-auto">
          <Download size={15} /> Export Excel
        </a>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-primary-500" /></div>
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
                {pageRows.map((s, i) => (
                  <tr key={s.id} className="border-b border-gray-200 hover:bg-primary-50/40 transition-colors">
                    <td className="sticky left-0 z-10 w-10 bg-white px-3 py-2 text-center text-gray-400 border-r border-gray-200">{(pageSafe - 1) * PAGE_SIZE + i + 1}</td>
                    <td className="sticky left-10 z-10 w-48 bg-white px-2 py-2 text-gray-900 font-semibold border-r border-gray-200 whitespace-nowrap shadow-[2px_0_4px_rgba(0,0,0,0.04)]">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="truncate">{NAMA_COL.get(s)}</span>
                        <span className="shrink-0 flex items-center">
                          {riwayatBase && (
                            <Link href={`${riwayatBase}/${s.id}/riwayat`} title="Riwayat perubahan data siswa ini"
                              className="p-1 text-gray-300 hover:text-primary-700 hover:bg-primary-50 rounded transition-colors">
                              <History size={12} />
                            </Link>
                          )}
                          {!hanyaBaca && (<button onClick={() => setEditing(s)} title="Edit data siswa ini"
                            className="p-1 text-gray-300 hover:text-primary-700 hover:bg-primary-50 rounded transition-colors">
                            <Pencil size={12} />
                          </button>)}
                        </span>
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
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              Menampilkan {pageRows.length ? (pageSafe - 1) * PAGE_SIZE + 1 : 0}–{(pageSafe - 1) * PAGE_SIZE + pageRows.length} dari {filtered.length} siswa
              {filtered.length !== students.length && ` (tersaring dari ${students.length})`}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-400 text-xs">Halaman {pageSafe} dari {totalPages}</span>
                <button disabled={pageSafe <= 1} onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50">
                  Sebelumnya
                </button>
                <button disabled={pageSafe >= totalPages} onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50">
                  Berikutnya
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <BukuIndukSiswaModal
        student={editing}
        isNew={false}
        canManageAccount={canManageAccount}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); fetchStudents(); }}
      />
    </div>
  );
}
