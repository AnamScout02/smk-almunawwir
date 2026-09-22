"use client";
import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookA, Loader2, Search, Printer, Users } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import Select from "@/components/admin/Select";

/** Bentuk baris mengikuti KlapperRow di src/lib/buku-klapper.ts (sumbernya di server). */
type HalfState = "isi" | "arsir" | "kosong";
interface GradeYear { top: number | null; bottom: number | null; topState: HalfState; bottomState: HalfState }

interface KlapperRow {
  id: string; name: string; nomorInduk: string; nisn: string | null;
  majorCode: string; majorName: string; enrollYear: number | null;
  gradeX: GradeYear; gradeXI: GradeYear; gradeXII: GradeYear;
  keluar: boolean; keterangan: string; status: string;
}

/** Arsiran diagonal — penanda "siswa sudah tidak di sekolah pada tahun ini" (meniru arsiran
 * tangan di buku fisik). */
const ARSIR = "repeating-linear-gradient(45deg, #cbd5e1 0 1px, transparent 1px 5px)";

function letterOf(name: string): string {
  const c = (name.trim()[0] ?? "#").toUpperCase();
  return c >= "A" && c <= "Z" ? c : "#";
}

function indukNumber(nomorInduk: string): number {
  const n = parseInt(nomorInduk.split("/")[0]?.replace(/\D/g, "") ?? "", 10);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}

/** Satu kotak tingkat = dua baris (tahun awal di atas, tahun akhir di bawah) persis seperti
 * buku fisik. Tiap setengah bisa terisi tahunnya, diarsir (sudah keluar), atau dibiarkan polos
 * (masih aktif, belum sampai situ). */
function Half({ year, state, border }: { year: number | null; state: HalfState; border?: boolean }) {
  return (
    <div className={`h-5 flex items-center justify-center text-[11px] leading-none ${border ? "border-b border-gray-200" : ""}`}
      style={state === "arsir" ? { backgroundImage: ARSIR } : undefined}>
      {state === "isi" && year != null ? year : ""}
    </div>
  );
}

function GradeCell({ g }: { g: GradeYear }) {
  return (
    <td className="!p-0 align-middle">
      <Half year={g.top} state={g.topState} border />
      <Half year={g.bottom} state={g.bottomState} />
    </td>
  );
}

export default function BukuKlapperManager() {
  const [rows, setRows] = useState<KlapperRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [majorFilter, setMajorFilter] = useState("");
  const [angkatanFilter, setAngkatanFilter] = useState("");
  // Default "induk" — meniru buku fisik: dalam satu huruf, siswa ditulis urut nomor induk
  // (kronologis masuk sekolah), bukan urut abjad nama (keputusan user 2026-09-12).
  const [sortMode, setSortMode] = useState<"abjad" | "induk">("induk");
  const [activeLetter, setActiveLetter] = useState("");

  useEffect(() => {
    fetch("/api/admin/buku-klapper")
      .then(r => r.json())
      .then(d => setRows(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const majorOptions = useMemo(() => {
    const set = new Map<string, string>();
    for (const r of rows) set.set(r.majorCode, r.majorName);
    return [{ value: "", label: "Semua Jurusan" }, ...[...set].map(([code, name]) => ({ value: code, label: `${code} — ${name}` }))];
  }, [rows]);

  const angkatanOptions = useMemo(() => {
    const set = new Set<number>();
    for (const r of rows) if (r.enrollYear) set.add(r.enrollYear);
    return [{ value: "", label: "Semua Angkatan" }, ...[...set].sort((a, b) => b - a).map(y => ({ value: String(y), label: String(y) }))];
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r =>
      (!q || r.name.toLowerCase().includes(q) || r.nomorInduk.toLowerCase().includes(q) || (r.nisn ?? "").toLowerCase().includes(q)) &&
      (!majorFilter || r.majorCode === majorFilter) &&
      (!angkatanFilter || String(r.enrollYear) === angkatanFilter) &&
      (!activeLetter || letterOf(r.name) === activeLetter)
    );
  }, [rows, search, majorFilter, angkatanFilter, activeLetter]);

  /** Kelompokkan per huruf, lalu urutkan isi tiap huruf sesuai mode:
   * - "induk": meniru buku fisik (kronologis masuk sekolah — lihat catatan di lib/buku-klapper.ts)
   * - "abjad": lebih enak untuk penelusuran manual di layar */
  const grouped = useMemo(() => {
    const map = new Map<string, KlapperRow[]>();
    for (const r of filtered) {
      const l = letterOf(r.name);
      if (!map.has(l)) map.set(l, []);
      map.get(l)!.push(r);
    }
    for (const items of map.values()) {
      items.sort((a, b) => sortMode === "induk"
        ? ((a.enrollYear ?? 9999) - (b.enrollYear ?? 9999) || indukNumber(a.nomorInduk) - indukNumber(b.nomorInduk) || a.name.localeCompare(b.name, "id"))
        : a.name.localeCompare(b.name, "id"));
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered, sortMode]);

  const lettersPresent = useMemo(() => new Set(rows.map(r => letterOf(r.name))), [rows]);

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<BookA size={22} />} title="Buku Klapper"
        description="Indeks alfabetis seluruh siswa lintas angkatan — lengkap dengan tahun ajaran tiap tingkat" />

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-primary-500" /></div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Users} title="Belum Ada Data Siswa" description="Data siswa akan otomatis muncul di sini." />
      ) : (
        <>
          <div className="page-card p-4 mb-5">
            <div className="mb-3 baris-alat">
              <div className="alat-cari">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Cari nama / nomor induk..." className="input-field pl-10 w-full" />
              </div>
              <div className="alat-saring">
                <Select value={majorFilter} onChange={setMajorFilter} options={majorOptions} placeholder="Semua Jurusan" />
              </div>
              <div className="alat-saring">
                <Select value={angkatanFilter} onChange={setAngkatanFilter} options={angkatanOptions} placeholder="Semua Angkatan" />
              </div>
              <div className="alat-saring">
                <Select value={sortMode} onChange={v => setSortMode(v as "abjad" | "induk")}
                  options={[
                    { value: "induk", label: "Urut: Nomor Induk (spt buku)" },
                    { value: "abjad", label: "Urut: Abjad Nama" },
                  ]} />
              </div>
              <div className="alat-aksi">
                <Link href={`/dashboard/admin/buku-klapper/cetak?urut=${sortMode}${activeLetter ? `&letter=${activeLetter}` : ""}`}
                  className="btn-modal-cancel">
                  <Printer size={16} /> Cetak {activeLetter ? `Huruf ${activeLetter}` : "Semua"}
                </Link>
              </div>
            </div>

            <div className="flex flex-wrap gap-1">
              {["#", ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i))].map(l => {
                const has = lettersPresent.has(l);
                const active = activeLetter === l;
                return (
                  <button key={l} disabled={!has} onClick={() => setActiveLetter(active ? "" : l)}
                    className={`w-7 h-7 rounded-lg text-xs font-semibold transition ${
                      active ? "bg-primary-700 text-white"
                        : has ? "bg-primary-50 text-primary-700 hover:bg-primary-100"
                          : "text-gray-300 cursor-not-allowed"}`}>
                    {l}
                  </button>
                );
              })}
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon={Search} title="Tidak Ditemukan" description="Tidak ada siswa yang cocok dengan filter." />
          ) : (
            <>
              <div className="page-card overflow-hidden">
                <div className="overflow-auto max-h-[70vh] scrollbar-visible">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th className="sticky top-0 z-20">Nama Siswa</th>
                        <th className="sticky top-0 z-20">Nomor Induk</th>
                        <th className="sticky top-0 z-20 text-center">X</th>
                        <th className="sticky top-0 z-20 text-center">XI</th>
                        <th className="sticky top-0 z-20 text-center">XII</th>
                        <th className="sticky top-0 z-20">Jurusan</th>
                        <th className="sticky top-0 z-20">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grouped.map(([letter, items]) => (
                        <Fragment key={`grp-${letter}`}>
                          <tr>
                            <td colSpan={7} className="bg-primary-50 font-heading font-bold text-primary-900 !py-1.5 text-sm">
                              {letter} <span className="font-normal text-gray-400 text-xs">({items.length} siswa)</span>
                            </td>
                          </tr>
                          {items.map(r => (
                            <tr key={r.id}>
                              <td>
                                {/* Tujuan WAJIB ".../cetak" — route /buku-induk/siswa/[id] TIDAK punya page.tsx sendiri
                                    (cuma folder cetak/), jadi tautan tanpa /cetak selalu 404. Semua tempat lain di app
                                    sudah pakai /cetak; ini sempat kelewat (temuan audit 2026-09-12). */}
                                <Link href={`/dashboard/admin/buku-induk/siswa/${r.id}/cetak`} className="font-medium text-primary-700 hover:underline">
                                  {r.name}
                                </Link>
                                {r.nisn && <span className="block text-xs text-gray-400">NISN {r.nisn}</span>}
                              </td>
                              <td className="whitespace-nowrap">{r.nomorInduk}</td>
                              <GradeCell g={r.gradeX} />
                              <GradeCell g={r.gradeXI} />
                              <GradeCell g={r.gradeXII} />
                              <td>{r.majorCode}</td>
                              <td className="text-xs text-gray-500">{r.keterangan || "—"}</td>
                            </tr>
                          ))}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-3">
                Menampilkan {filtered.length} dari {rows.length} siswa ({grouped.length} kelompok huruf).
                Tiap kotak tingkat berisi tahun ajaran (tahun awal di atas, tahun akhir di bawah).
                Bagian yang <span className="px-2 rounded" style={{ backgroundImage: ARSIR }}>diarsir</span> artinya
                siswa sudah keluar sebelum tahun itu; kotak polos berarti siswa masih aktif dan belum sampai tingkat tersebut.
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}
