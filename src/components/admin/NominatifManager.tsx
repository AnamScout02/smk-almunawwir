"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileSpreadsheet, Loader2, Save, UserCog, Hash, Printer, ClipboardList, Users2, Search, CheckCircle2, AlertTriangle } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import EmptyState from "@/components/admin/EmptyState";
import { useToast } from "@/components/shared/ToastProvider";

interface AcademicYear { id: string; name: string; isActive: boolean }
interface MajorOverview { majorId: string; name: string; code: string; jumlahCalon: number }
interface MajorPagu { majorId: string; code: string; akreditasi: string | null; pagu: number | null; paguOtomatis: number }
interface RosterRow {
  id: string; name: string; className: string; majorName: string; gender: string; nis: string; enrollYear: number | null;
  birthPlace: string; birthDate: string | null; address: string; parentName: string;
  previousSchool: string; ijazahNo: string; ijazahYear: string;
}

// Field yang WAJIB terisi utk dokumen Nominatif resmi — dipakai tandai baris "belum lengkap" di
// tabel data siswa (keputusan eksplisit user 2026-09-11: "tampilkan semua data yang dibutuhkan
// ... agar kelihatan data mana yang belum lengkap"). NIS/gender/nama tidak dicek — field wajib
// sistem, praktis selalu terisi.
function missingFieldsOf(r: RosterRow): string[] {
  const missing: string[] = [];
  if (!r.birthPlace || !r.birthDate) missing.push("Tempat/Tgl Lahir");
  if (!r.address) missing.push("Alamat");
  if (!r.parentName) missing.push("Nama Orangtua");
  if (!r.previousSchool) missing.push("Asal Sekolah");
  if (!r.ijazahNo) missing.push("No Ijazah");
  if (!r.ijazahYear) missing.push("Tahun Ijazah");
  return missing;
}
function fmtTgl(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

const AKREDITASI_OPTIONS = [
  { value: "", label: "— Belum diisi —" },
  { value: "SUDAH", label: "Sudah Terakreditasi" },
  { value: "BELUM", label: "Belum Terakreditasi" },
];

const EMPTY_SETTINGS: Record<string, string> = {
  "nominatif.pengawasNama": "", "nominatif.pengawasNip": "",
  "nominatif.dinasNama": "", "nominatif.dinasNip": "", "nominatif.dinasPangkat": "", "nominatif.dinasWilayah": "",
  "nominatif.nss": "", "nominatif.npsn": "", "nominatif.kdProp": "", "nominatif.kdRayon": "", "nominatif.kdSekolah": "",
  "nominatif.statusAkreditasiSekolah": "",
  "nominatif.kecamatan": "", "nominatif.kabKota": "", "nominatif.kodePos": "",
  "nominatif.jumlahServerUtama": "1", "nominatif.jumlahServerCadangan": "1", "nominatif.tempatUjian": "",
};

/** Halaman Nominatif Kelas XII (UKK/USP) — landing untuk 3 dokumen resmi ke Dinas Pendidikan
 * (Nominatif per jurusan, Rekap Calon per jurusan, Rekap Peserta Didik). Semua ANGKA dihitung
 * live dari data siswa/kelas/PPDB (lihat halaman cetak masing-masing) — HANYA 2 hal yang
 * genuinely tidak bisa dihitung dan diedit langsung di sini: (1) data pejabat penandatangan +
 * kode sekolah resmi Dinas, (2) Pagu PPDB & status akreditasi per jurusan (per tahun ajaran).
 * Keputusan eksplisit user 2026-09-11 — jangan pindahkan ke Konten Halaman terpisah. */
export default function NominatifManager() {
  const toast = useToast();
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [academicYearId, setAcademicYearId] = useState("");
  const [overview, setOverview] = useState<MajorOverview[]>([]);
  const [pagu, setPagu] = useState<MajorPagu[]>([]);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [loadingRoster, setLoadingRoster] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingMajor, setSavingMajor] = useState<string | null>(null);
  const [classFilter, setClassFilter] = useState("ALL");
  const [angkatanFilter, setAngkatanFilter] = useState("ALL");
  const [rosterSearch, setRosterSearch] = useState("");
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);
  // Pemeriksaan kesiapan sebelum cetak: berapa siswa Kelas XII yang kolom wajibnya masih kosong.
  // Angkanya datang dari Pemeriksa Data (satu sumber aturan), bukan aturan kedua yang bisa beda.
  const [belumSiap, setBelumSiap] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/admin/pemeriksa-data")
      .then(r => r.json())
      .then((d: { temuan?: { id: string; jumlah: number }[] }) =>
        setBelumSiap(d.temuan?.find(t => t.id === "nominatif-belum-lengkap")?.jumlah ?? 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/tahun-ajaran").then(r => r.json()).catch(() => []),
      fetch("/api/admin/nominatif/settings").then(r => r.json()).catch(() => ({})),
    ]).then(([y, s]) => {
      const list: AcademicYear[] = Array.isArray(y) ? y : [];
      setYears(list);
      setAcademicYearId(list.find(a => a.isActive)?.id ?? list[0]?.id ?? "");
      setSettings(prev => ({ ...prev, ...s }));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!academicYearId) return;
    Promise.all([
      fetch(`/api/admin/nominatif/overview?academicYearId=${academicYearId}`).then(r => r.json()).catch(() => []),
      fetch(`/api/admin/nominatif/pagu?academicYearId=${academicYearId}`).then(r => r.json()).catch(() => []),
    ]).then(([ov, pg]) => {
      setOverview(Array.isArray(ov) ? ov : []);
      setPagu(Array.isArray(pg) ? pg : []);
    }).catch(() => {});

    setLoadingRoster(true);
    setClassFilter("ALL");
    fetch(`/api/admin/nominatif/roster?academicYearId=${academicYearId}`).then(r => r.json())
      .then(d => setRoster(Array.isArray(d) ? d : []))
      .catch(() => {}).finally(() => setLoadingRoster(false));
  }, [academicYearId]);

  const classOptions = useMemo(() => Array.from(new Set(roster.map(r => r.className))).sort(), [roster]);
  const angkatanOptions = useMemo(() => Array.from(new Set(roster.map(r => r.enrollYear).filter((y): y is number => y !== null))).sort((a, b) => b - a), [roster]);
  const incompleteCount = useMemo(() => roster.filter(r => missingFieldsOf(r).length > 0).length, [roster]);
  const filteredRoster = useMemo(() => {
    const q = rosterSearch.trim().toLowerCase();
    return roster.filter(r =>
      (classFilter === "ALL" || r.className === classFilter) &&
      (angkatanFilter === "ALL" || String(r.enrollYear ?? "") === angkatanFilter) &&
      (!onlyIncomplete || missingFieldsOf(r).length > 0) &&
      (!q || r.name.toLowerCase().includes(q) || r.nis.includes(q))
    );
  }, [roster, classFilter, angkatanFilter, onlyIncomplete, rosterSearch]);

  function setField(key: string, value: string) {
    setSettings(prev => ({ ...prev, [key]: value }));
  }

  async function handleSaveSettings() {
    setSavingSettings(true);
    try {
      const res = await fetch("/api/admin/nominatif/settings", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings),
      });
      if (!res.ok) { toast.error("Gagal menyimpan."); return; }
      toast.success("Data penandatangan & kode sekolah tersimpan.");
    } catch {
      toast.error("Koneksi bermasalah, coba lagi.");
    } finally {
      setSavingSettings(false);
    }
  }

  function updateMajorField(majorId: string, patch: Partial<MajorPagu>) {
    setPagu(prev => prev.map(m => (m.majorId === majorId ? { ...m, ...patch } : m)));
  }

  async function handleSaveMajor(m: MajorPagu) {
    setSavingMajor(m.majorId);
    try {
      // `pagu` cuma dikirim kalau admin benar-benar mengetik override (m.pagu tidak null) — kalau
      // masih menampilkan angka otomatis apa adanya (belum disentuh), JANGAN kirim, supaya tidak
      // menimpa hitungan otomatis dengan 0 atau nilai lama yang salah.
      const body: Record<string, unknown> = { academicYearId, majorId: m.majorId, akreditasi: m.akreditasi ?? "" };
      if (m.pagu !== null) body.pagu = m.pagu;
      const res = await fetch("/api/admin/nominatif/pagu", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) { toast.error("Gagal menyimpan."); return; }
      toast.success("Tersimpan.");
    } catch {
      toast.error("Koneksi bermasalah, coba lagi.");
    } finally {
      setSavingMajor(null);
    }
  }

  const yearQuery = academicYearId ? `?academicYearId=${academicYearId}` : "";

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<FileSpreadsheet size={22} />} title="Nominatif Kelas XII"
        description="Dokumen UKK/USP untuk Dinas Pendidikan — Nominatif, Rekap Calon, dan Rekap Peserta Didik per jurusan" />

      {belumSiap !== null && (
        <div className={`rounded-2xl border p-4 mb-6 flex items-start gap-3 ${
          belumSiap === 0 ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
          {belumSiap === 0
            ? <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
            : <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />}
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${belumSiap === 0 ? "text-emerald-800" : "text-amber-800"}`}>
              {belumSiap === 0 ? "Data Kelas XII siap dicetak" : `${belumSiap} siswa Kelas XII datanya belum lengkap`}
            </p>
            <p className={`text-xs mt-0.5 ${belumSiap === 0 ? "text-emerald-700" : "text-amber-700"}`}>
              {belumSiap === 0
                ? "Semua kolom wajib Nominatif (tempat/tgl lahir, alamat, orang tua, asal sekolah, no ijazah, NISN) sudah terisi."
                : "Kolom wajib Nominatif masih ada yang kosong. Dokumen tetap bisa dicetak, tapi bagian itu akan tampil kosong di berkas yang dikirim ke Dinas."}
            </p>
          </div>
          {belumSiap > 0 && (
            <Link href="/dashboard/admin/pemeriksa-data"
              className="shrink-0 text-xs font-semibold text-amber-800 underline hover:no-underline whitespace-nowrap mt-0.5">
              Lihat daftarnya
            </Link>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
      ) : (
        <>
          <div className="panel p-5 mb-6">
            <label className="label-field">Tahun Ajaran</label>
            <Select value={academicYearId} onChange={setAcademicYearId}
              options={years.map(y => ({ value: y.id, label: y.isActive ? `${y.name} (Aktif)` : y.name }))}
              placeholder="Pilih tahun ajaran..." />
            {years.length === 0 && <p className="text-sm text-gray-400 mt-2">Belum ada Tahun Ajaran — tambahkan dulu di menu Tahun Ajaran.</p>}
          </div>

          <div className="panel p-5 mb-6">
            <h3 className="font-heading font-semibold text-navy text-sm mb-1 flex items-center gap-2">
              <UserCog size={15} className="text-primary-500" /> Data Penandatangan & Kode Sekolah
            </h3>
            <p className="text-xs text-gray-400 mb-4">Dipakai di blok tanda tangan &amp; kop semua dokumen cetak di bawah — sekali isi, dipakai ulang tiap cetak.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Pengawas SMK</p>
                <div className="space-y-2">
                  <div><label className="label-field">Nama</label><input className="input-field" value={settings["nominatif.pengawasNama"]} onChange={e => setField("nominatif.pengawasNama", e.target.value)} /></div>
                  <div><label className="label-field">NIP</label><input className="input-field" value={settings["nominatif.pengawasNip"]} onChange={e => setField("nominatif.pengawasNip", e.target.value)} /></div>
                </div>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Kepala Cabang Dinas Pendidikan</p>
                <div className="space-y-2">
                  <div><label className="label-field">Nama</label><input className="input-field" value={settings["nominatif.dinasNama"]} onChange={e => setField("nominatif.dinasNama", e.target.value)} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="label-field">NIP</label><input className="input-field" value={settings["nominatif.dinasNip"]} onChange={e => setField("nominatif.dinasNip", e.target.value)} /></div>
                    <div><label className="label-field">Pangkat</label><input className="input-field" value={settings["nominatif.dinasPangkat"]} onChange={e => setField("nominatif.dinasPangkat", e.target.value)} /></div>
                  </div>
                  <div><label className="label-field">Wilayah</label><input className="input-field" placeholder="cth: Wilayah Kab Banyuwangi" value={settings["nominatif.dinasWilayah"]} onChange={e => setField("nominatif.dinasWilayah", e.target.value)} /></div>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 mt-4 pt-4">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2 flex items-center gap-1.5"><Hash size={12} /> Kode Sekolah Resmi</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {([
                  ["nominatif.nss", "NSS"], ["nominatif.npsn", "NPSN"], ["nominatif.kdProp", "Kd Prop"],
                  ["nominatif.kdRayon", "Kd Rayon"], ["nominatif.kdSekolah", "Kd Sekolah"],
                  ["nominatif.kecamatan", "Kecamatan"], ["nominatif.kabKota", "Kab/Kota"], ["nominatif.kodePos", "Kode Pos"],
                ] as const).map(([key, label]) => (
                  <div key={key}><label className="label-field">{label}</label><input className="input-field" value={settings[key]} onChange={e => setField(key, e.target.value)} /></div>
                ))}
                <div>
                  <label className="label-field">Akreditasi Sekolah</label>
                  <input className="input-field" placeholder="cth: TERAKREDITASI" value={settings["nominatif.statusAkreditasiSekolah"]} onChange={e => setField("nominatif.statusAkreditasiSekolah", e.target.value)} />
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 mt-4 pt-4">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Info Server &amp; Tempat Ujian</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div><label className="label-field">Jumlah Server Utama</label><input type="number" min={0} className="input-field" value={settings["nominatif.jumlahServerUtama"]} onChange={e => setField("nominatif.jumlahServerUtama", e.target.value)} /></div>
                <div><label className="label-field">Jumlah Server Cadangan</label><input type="number" min={0} className="input-field" value={settings["nominatif.jumlahServerCadangan"]} onChange={e => setField("nominatif.jumlahServerCadangan", e.target.value)} /></div>
                <div className="col-span-2 sm:col-span-1"><label className="label-field">Tempat Pelaksanaan Ujian</label><input className="input-field" value={settings["nominatif.tempatUjian"]} onChange={e => setField("nominatif.tempatUjian", e.target.value)} /></div>
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <button onClick={handleSaveSettings} disabled={savingSettings} className="btn-modal-save">
                {savingSettings ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan
              </button>
            </div>
          </div>

          <div className="panel overflow-hidden mb-6">
            <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between">
              <h3 className="font-heading font-semibold text-navy text-sm flex items-center gap-2"><Users2 size={15} className="text-primary-500" /> Ringkasan per Jurusan</h3>
              <div className="flex flex-wrap items-center gap-4">
                <Link href={`/dashboard/admin/nominatif/berita-acara-verval${yearQuery}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 hover:text-primary-900">
                  <Printer size={13} /> Cetak Berita Acara Verval
                </Link>
                <Link href={`/dashboard/admin/nominatif/rekap-peserta-didik${yearQuery}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 hover:text-primary-900">
                  <Printer size={13} /> Cetak Rekap Peserta Didik
                </Link>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Jurusan</th><th className="text-center">Calon Peserta</th>
                    <th>Pagu (Angkatan, termasuk Mutasi)</th><th>Akreditasi</th><th className="text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.map(ov => {
                    const p = pagu.find(x => x.majorId === ov.majorId);
                    return (
                      <tr key={ov.majorId}>
                        <td className="font-semibold text-primary-900">{ov.name}</td>
                        <td className="text-center">{ov.jumlahCalon}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <input type="number" min={0} className="input-field w-24" value={p?.pagu ?? p?.paguOtomatis ?? ""}
                              onChange={e => updateMajorField(ov.majorId, { pagu: e.target.value === "" ? null : Number(e.target.value) })} />
                            {p && p.pagu === null && <span className="text-xs text-gray-400">(otomatis)</span>}
                          </div>
                        </td>
                        <td className="w-48">
                          <Select value={p?.akreditasi ?? ""} onChange={v => updateMajorField(ov.majorId, { akreditasi: v })} options={AKREDITASI_OPTIONS} />
                        </td>
                        <td>
                          <div className="flex items-center justify-end gap-2 flex-wrap">
                            <button onClick={() => p && handleSaveMajor(p)} disabled={savingMajor === ov.majorId}
                              className="text-xs font-semibold text-primary-700 hover:text-primary-900 flex items-center gap-1 shrink-0">
                              {savingMajor === ov.majorId ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Simpan
                            </button>
                            <Link href={`/dashboard/admin/nominatif/${ov.majorId}/cetak${yearQuery}`} title="Cetak Nominatif"
                              className="btn-modal-cancel px-3 text-xs">
                              <Printer size={12} /> Nominatif
                            </Link>
                            <Link href={`/dashboard/admin/nominatif/${ov.majorId}/rekap-calon${yearQuery}`} title="Cetak Rekap Calon"
                              className="btn-modal-cancel px-3 text-xs">
                              <ClipboardList size={12} /> Rekap Calon
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tabel siswa Kelas XII — pola PERSIS "Tabel Lengkap Buku Induk Siswa"
              (src/components/shared/BukuIndukSiswaManager.tsx): header navy sticky, kolom
              No+Nama dibekukan (sticky left), body scroll dgn tinggi maks, caption jumlah di
              footer. Dicontek atas permintaan eksplisit user 2026-09-11. */}
          <h3 className="font-heading font-semibold text-navy text-sm mb-1 flex items-center gap-2">
            <Users2 size={15} className="text-primary-500" /> Data Siswa Kelas XII
          </h3>
          <p className="text-xs text-gray-400 mb-3">
            Semua kolom yang dibutuhkan dokumen Nominatif ditampilkan di sini — sel kosong ditandai <span className="text-red-500 font-semibold">Kosong</span> supaya kelihatan data siapa yang perlu dilengkapi dulu di Buku Induk sebelum dicetak resmi.
          </p>

          {incompleteCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 flex items-center justify-between flex-wrap gap-3">
              <p className="text-sm text-amber-800"><strong>{incompleteCount}</strong> dari {roster.length} siswa punya data belum lengkap untuk Nominatif.</p>
              <button onClick={() => setOnlyIncomplete(v => !v)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${onlyIncomplete ? "bg-amber-600 text-white" : "bg-white border border-amber-300 text-amber-700 hover:bg-amber-100"}`}>
                {onlyIncomplete ? "Tampilkan Semua" : "Tampilkan yang Belum Lengkap Saja"}
              </button>
            </div>
          )}

          <div className="baris-alat mb-5">
            <div className="alat-cari">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={rosterSearch} onChange={e => setRosterSearch(e.target.value)} placeholder="Cari nama atau NIS..." className="input-field pl-10" />
            </div>
            <Select className="sm:w-56" value={classFilter} onChange={setClassFilter}
              options={[{ value: "ALL", label: "Semua Kelas" }, ...classOptions.map(c => ({ value: c, label: c }))]} />
            <Select className="sm:w-48" value={angkatanFilter} onChange={setAngkatanFilter}
              options={[{ value: "ALL", label: "Semua Angkatan" }, ...angkatanOptions.map(y => ({ value: String(y), label: `Angkatan ${y}` }))]} />
          </div>

          {loadingRoster ? (
            <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
          ) : filteredRoster.length === 0 ? (
            <EmptyState icon={Users2} title="Tidak Ada Siswa" description="Tidak ada siswa Kelas XII yang cocok dengan filter." />
          ) : (
            <div className="panel overflow-hidden">
              <div className="overflow-auto max-h-[75vh] scrollbar-visible">
                <table className="text-xs border-collapse w-full">
                  <thead className="sticky top-0 z-20">
                    <tr>
                      <th className="sticky left-0 z-30 w-10 bg-primary-900 text-white px-3 py-2 text-center border-r border-white/10">#</th>
                      <th className="sticky left-10 z-30 w-48 bg-primary-900 text-white px-3 py-2 text-left border-r border-white/10 whitespace-nowrap shadow-[2px_0_4px_rgba(0,0,0,0.08)]">Nama</th>
                      {/* Alamat sengaja dikasih lebar minimum besar — isinya alamat lengkap
                          (dusun/RT/RW/desa/kecamatan/kabupaten/provinsi) yang kalau dibiarkan
                          ikut lebar otomatis jadi terpecah 6-7 baris & bikin baris tabel
                          menjulang (temuan user 2026-09-12). Tabel ini memang bisa digeser
                          horizontal, jadi aman diperlebar. */}
                      {["Kelas", "Jurusan", "L/P", "NIS", "Angkatan", "Tempat, Tgl Lahir", "Alamat", "Nama Orangtua", "Asal Sekolah", "No Ijazah", "Th Ijazah", "Kelengkapan"].map(h => (
                        <th key={h} className={`bg-primary-900 text-white px-3 py-2 text-center border-r border-white/10 whitespace-nowrap last:border-r-0 ${h === "Alamat" ? "min-w-[26rem]" : ""}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRoster.map((r, i) => {
                      const missing = missingFieldsOf(r);
                      const cell = (v: string) => v ? v : <span className="text-red-500 font-semibold">Kosong</span>;
                      return (
                        <tr key={r.id} className="border-b border-gray-200 hover:bg-primary-50/40 transition-colors">
                          <td className="sticky left-0 z-10 w-10 bg-white px-3 py-2 text-center text-gray-400 border-r border-gray-200">{i + 1}</td>
                          <td className="sticky left-10 z-10 w-48 bg-white px-3 py-2 text-gray-900 font-semibold border-r border-gray-200 whitespace-nowrap shadow-[2px_0_4px_rgba(0,0,0,0.04)]">{r.name}</td>
                          <td className="px-3 py-2 text-center text-gray-700 border-r border-gray-200 whitespace-nowrap">{r.className}</td>
                          <td className="px-3 py-2 text-center text-gray-700 border-r border-gray-200 whitespace-nowrap">{r.majorName}</td>
                          <td className="px-3 py-2 text-center text-gray-700 border-r border-gray-200">{r.gender}</td>
                          <td className="px-3 py-2 text-center text-gray-700 border-r border-gray-200 whitespace-nowrap">{r.nis}</td>
                          <td className="px-3 py-2 text-center text-gray-700 border-r border-gray-200 whitespace-nowrap">{r.enrollYear ?? "—"}</td>
                          <td className="px-3 py-2 text-center border-r border-gray-200 whitespace-nowrap">{cell(r.birthPlace && r.birthDate ? `${r.birthPlace}, ${fmtTgl(r.birthDate)}` : "")}</td>
                          <td className="px-3 py-2 text-left border-r border-gray-200 min-w-[26rem]">{cell(r.address)}</td>
                          <td className="px-3 py-2 text-center border-r border-gray-200 whitespace-nowrap">{cell(r.parentName)}</td>
                          <td className="px-3 py-2 text-center border-r border-gray-200 whitespace-nowrap">{cell(r.previousSchool)}</td>
                          <td className="px-3 py-2 text-center border-r border-gray-200 whitespace-nowrap">{cell(r.ijazahNo)}</td>
                          <td className="px-3 py-2 text-center border-r border-gray-200 whitespace-nowrap">{cell(r.ijazahYear)}</td>
                          <td className="px-3 py-2 text-center whitespace-nowrap">
                            {missing.length === 0 ? (
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Lengkap</span>
                            ) : (
                              <span title={missing.join(", ")} className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">{missing.length} kosong</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="px-4 py-3 text-xs text-gray-400 border-t border-gray-100">Menampilkan {filteredRoster.length} dari {roster.length} siswa</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
