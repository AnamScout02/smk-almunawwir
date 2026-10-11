"use client";
import { kirimAtauAntre } from "@/lib/antrean-kirim";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { NotebookPen, Loader2, Save, Printer, Users, Pencil, FileSpreadsheet, Download, Upload } from "lucide-react";
import Modal from "@/components/admin/Modal";
import Select from "@/components/admin/Select";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import { useToast } from "@/components/shared/ToastProvider";
import DatePicker from "@/components/shared/DatePicker";
import JurnalCepat from "@/components/shared/JurnalCepat";

interface TeachClass {
  classId: string; className: string; grade: number; subjectId: string; subjectName: string;
}
interface JournalRow {
  studentId: string; nis: string; name: string;
  attendanceStatus: string; scorePengetahuan: number | null; scoreKeterampilan: number | null; catatan: string;
}
interface BarisImpor { baris: number; nis: string; nama: string; p: number | null; k: number | null; catatan: string; galat: string | null }
interface HasilImpor { terbaca: number; siap: number; galat: number; jurnalAda: boolean; baris?: BarisImpor[] }

interface HistoryRow {
  id: string; date: string; classId: string; className: string; subject: string; materi: string; urutan?: number;
  hadir: number; izin: number; sakit: number; alpha: number;
  avgPengetahuan: number | null; avgKeterampilan: number | null; catatanCount: number;
}

const ATTENDANCE_OPTIONS = [
  { value: "HADIR", label: "Hadir" },
  { value: "IZIN", label: "Izin" },
  { value: "SAKIT", label: "Sakit" },
  { value: "ALPHA", label: "Alfa" },
];

function generateSemesters(): string[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const currentTahunAjaran = month >= 7 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
  const prevTahunAjaran = month >= 7 ? `${year - 1}/${year}` : `${year - 2}/${year - 1}`;
  return [`Ganjil ${prevTahunAjaran}`, `Genap ${prevTahunAjaran}`, `Ganjil ${currentTahunAjaran}`, `Genap ${currentTahunAjaran}`];
}
const SEMESTERS = generateSemesters();

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function TeacherJournalPage() {
  const toast = useToast();
  const formRef = useRef<HTMLDivElement>(null);
  const [classes, setClasses] = useState<TeachClass[]>([]);
  const [classKey, setClassKey] = useState(""); // `${classId}::${subjectName}`
  const [date, setDate] = useState(todayStr());
  const [semester, setSemester] = useState(SEMESTERS[2]);
  const [materi, setMateri] = useState("");
  // Beberapa MATERI dalam satu hari (10 Okt 2026): tiap materi punya nilainya sendiri; kehadiran diisi di materi pertama.
  const [urutan, setUrutan] = useState(1);
  const [daftarMateri, setDaftarMateri] = useState<{ urutan: number; materi: string }[]>([]);
  const [rows, setRows] = useState<JournalRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  // Kelas+mapel yg "ditarget" saat klik Edit dari Riwayat — dipakai sekali begitu daftar kelas
  // hari itu selesai dimuat, lalu dikosongkan lagi. Tanpa ini, effect di bawah selalu memaksa
  // classKey balik ke kelas pertama hari itu tiap tanggal berubah, menimpa pilihan dari Edit.
  const pendingClassKeyRef = useRef<string | null>(null);
  /** Tanggal yang dituju sasaran di atas — sasaran hanya dipakai oleh muatan daftar kelas TANGGAL ITU. */
  const pendingTanggalRef = useRef<string | null>(null);
  // Tautan dari kartu "Jurnal Hari Ini": ?kelas=&mapel=&tanggal= langsung membuka pertemuan itu.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search), kelas = q.get("kelas"), mapel = q.get("mapel"), tgl = q.get("tanggal");
    if (!kelas || !mapel) return;
    pendingClassKeyRef.current = `${kelas}::${mapel}`;
    const sah = !!tgl && /^\d{4}-\d{2}-\d{2}$/.test(tgl);
    pendingTanggalRef.current = sah ? tgl : date;
    const u = Math.round(Number(q.get("urutan")) || 1);
    if (u > 1 && u <= 20) urutanTujuRef.current = u;
    // Tanggal sama: muatan daftar kelas pertama (efek di bawah, pada render yang sama) sudah membawa sasaran ini —
    // memicu muatan KEDUA justru mengembalikan pilihan ke kelas pertama (temuan uji 10 Okt 2026).
    if (sah && tgl !== date) setDate(tgl as string);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [muatKelas, setMuatKelas] = useState(0);
  // Impor nilai dari Excel (17 Sep 2026).
  const [imporBuka, setImporBuka] = useState(false);
  const [berkasImpor, setBerkasImpor] = useState<File | null>(null);
  const [hasilImpor, setHasilImpor] = useState<HasilImpor | null>(null);
  const [memprosesImpor, setMemprosesImpor] = useState(false);
  const [muatKe, setMuatKe] = useState(0);

  // Daftar kelas+mapel di-refetch tiap tanggal berubah — cuma yang BENAR-BENAR terjadwal hari itu
  // (bukan semua Penugasan Mengajar guru) yang ditampilkan, biar tidak perlu scroll kelas yang
  // tidak relevan hari ini.
  useEffect(() => {
    fetch(`/api/teacher/journal-classes?date=${date}`).then(r => r.json()).then((d: TeachClass[]) => {
      setClasses(d);
      const tunggu = pendingTanggalRef.current !== null && pendingTanggalRef.current !== date;
      const pending = tunggu ? null : pendingClassKeyRef.current;
      if (!tunggu) { pendingClassKeyRef.current = null; pendingTanggalRef.current = null; }
      if (pending && d.some(c => `${c.classId}::${c.subjectName}` === pending)) {
        setUrutan(urutanTujuRef.current); urutanTujuRef.current = 1;
        setClassKey(pending);
      } else {
        setClassKey(d.length > 0 ? `${d[0].classId}::${d[0].subjectName}` : "");
      }
    }).catch(() => {});
  }, [date, muatKelas]);

  function editHistoryRow(h: HistoryRow) {
    const dateOnly = new Date(h.date).toISOString().slice(0, 10);
    pendingClassKeyRef.current = `${h.classId}::${h.subject}`;
    pendingTanggalRef.current = dateOnly;
    urutanTujuRef.current = h.urutan ?? 1;
    setDate(dateOnly);
    // Tanggal sama: efek [classKey, date] tidak selalu terpicu, jadi materinya dipilih langsung.
    if (dateOnly === date) {
      if (`${h.classId}::${h.subject}` === classKey) { pendingClassKeyRef.current = null; pendingTanggalRef.current = null; urutanTujuRef.current = 1; setUrutan(h.urutan ?? 1); }
      else setMuatKelas(n => n + 1);
    }
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const selected = useMemo(() => {
    const [classId, subjectName] = classKey.split("::");
    return classes.find(c => c.classId === classId && c.subjectName === subjectName) ?? null;
  }, [classKey, classes]);

  useEffect(() => {
    if (!selected) return;
    setLoadingRows(true);
    fetch(`/api/teacher/journal?classId=${selected.classId}&subject=${encodeURIComponent(selected.subjectName)}&date=${date}&urutan=${urutan}`)
      .then(r => r.json())
      .then(d => { setMateri(d.materi ?? ""); setRows(d.rows ?? []); setDaftarMateri(Array.isArray(d.daftarMateri) ? d.daftarMateri : []); })
      .catch(() => {})
      .finally(() => setLoadingRows(false));
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, date, muatKe, urutan]);
  // Ganti kelas/mapel/tanggal → kembali ke materi pertama.
  // Materi yang dituju tautan/riwayat. Kembali ke materi 1 dilakukan TEGAS saat pengguna mengganti tanggal/kelas
  // (`gantiTanggal`/`gantiKelas`), bukan lewat efek — efek [kelas, tanggal] menimpa materi yang baru saja dituju.
  const urutanTujuRef = useRef(1);
  const gantiTanggal = (v: string) => { setUrutan(1); setDate(v); };
  const gantiKelas = (v: string) => { setUrutan(1); setClassKey(v); };

  function bukaImpor() {
    setBerkasImpor(null);
    setHasilImpor(null);
    setImporBuka(true);
  }

  async function prosesImpor(simpan: boolean) {
    if (!selected || !berkasImpor) return;
    const fd = new FormData();
    fd.set("file", berkasImpor);
    fd.set("classId", selected.classId);
    fd.set("subject", selected.subjectName);
    fd.set("date", date);
    fd.set("semester", semester);
    fd.set("materi", materi.trim());
    fd.set("simpan", simpan ? "1" : "0");
    fd.set("urutan", String(urutan));
    setMemprosesImpor(true);
    const r = await fetch("/api/teacher/journal/impor-nilai", { method: "POST", body: fd }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setMemprosesImpor(false);
    if (d?.baris) setHasilImpor(d);
    if (!r?.ok) { toast.error(d?.error ?? "Impor gagal diproses."); return; }
    if (simpan) {
      toast.success(`Nilai ${d.siap} siswa tersimpan ke jurnal ${date}.`);
      setImporBuka(false);
      setMuatKe(n => n + 1);
    } else if (!d.baris) setHasilImpor(d);
  }

  function loadHistory() {
    if (!selected) return;
    fetch(`/api/teacher/journal/history?classId=${selected.classId}&subject=${encodeURIComponent(selected.subjectName)}&semester=${encodeURIComponent(semester)}`)
      .then(r => r.json()).then(d => setHistory(Array.isArray(d) ? d : [])).catch(() => {});
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadHistory(); }, [semester]);

  function updateRow(studentId: string, patch: Partial<JournalRow>) {
    setRows(rs => rs.map(r => r.studentId === studentId ? { ...r, ...patch } : r));
  }

  async function handleSave() {
    if (!selected) return;
    if (!materi.trim()) { toast.warning("Materi yang diajarkan wajib diisi."); return; }
    const missing = urutan === 1 ? rows.filter(r => !r.attendanceStatus) : [];
    if (missing.length > 0) {
      toast.warning(`${missing.length} siswa belum diisi status kehadirannya: ${missing.slice(0, 3).map(r => r.name).join(", ")}${missing.length > 3 ? ", dst." : ""}`);
      return;
    }
    setSaving(true);
    // Sinyal kelas sering hilang: kiriman yang tidak sampai disimpan di perangkat dan dikirim sendiri (src/lib/antrean-kirim.ts).
    const { antre, res } = await kirimAtauAntre({
      kunci: `jurnal|${selected.classId}|${selected.subjectName}|${date}|${urutan}`, url: "/api/teacher/journal",
      label: `Jurnal ${selected.className} ${date.split("-").reverse().join("/")}`,
      isi: { classId: selected.classId, subject: selected.subjectName, date, semester, materi, rows, urutan },
    });
    setSaving(false);
    if (antre) { toast.info("Sinyal terputus — jurnal disimpan di perangkat ini dan dikirim sendiri saat tersambung. Jangan keluar dari akun dulu."); return; }
    if (!res || !res.ok) { const d = await res?.json().catch(() => null); toast.error(d?.error || "Gagal menyimpan jurnal"); return; }
    loadHistory();
    setMuatKe(n => n + 1);
    toast.success(urutan > 1 ? `Materi ke-${urutan} tersimpan.` : "Jurnal pertemuan tersimpan.");
  }

  async function hapusMateri() {
    if (!selected || urutan < 2) return;
    const r = await fetch(`/api/teacher/journal?classId=${selected.classId}&subject=${encodeURIComponent(selected.subjectName)}&date=${date}&urutan=${urutan}`, { method: "DELETE" }).catch(() => null);
    const d = await r?.json().catch(() => null);
    if (!r?.ok) { toast.error(d?.error ?? "Materi gagal dihapus."); return; }
    toast.success(`Materi ke-${urutan} dihapus.`);
    setUrutan(urutan - 1); loadHistory();
  }
  const jumlahMateri = Math.max(1, ...daftarMateri.map(m => m.urutan));
  const materiTersimpan = daftarMateri.some(m => m.urutan === urutan);

  const printHref = selected
    ? `/dashboard/teacher/journal/cetak?classId=${selected.classId}&subject=${encodeURIComponent(selected.subjectName)}&semester=${encodeURIComponent(semester)}`
    : "#";

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<NotebookPen size={22} />}
        title="Jurnal Mengajar"
        description="Catat kehadiran, nilai, materi, dan catatan siswa setiap pertemuan"
      />

      <JurnalCepat className="mb-6" saatTersimpan={() => setMuatKe(n => n + 1)} />

      {/* Tanggal & Semester SELALU tampil di luar — supaya guru tetap bisa ganti tanggal walau
          hari yang lagi dipilih kebetulan tidak ada jadwal mengajar sama sekali. */}
      <div ref={formRef} className="panel p-5 mb-6 scroll-mt-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="label-field">Tanggal Pertemuan</label>
            <DatePicker value={date} onChange={gantiTanggal} />
          </div>
          {classes.length > 0 && (
            <div>
              <label className="label-field">Kelas & Mapel</label>
              <Select value={classKey} onChange={gantiKelas}
                options={classes.map(c => ({ value: `${c.classId}::${c.subjectName}`, label: `${c.className} — ${c.subjectName}` }))} />
            </div>
          )}
          <div>
            <label className="label-field">Semester</label>
            <Select value={semester} onChange={setSemester} options={SEMESTERS.map(s => ({ value: s, label: s }))} />
          </div>
        </div>
        {classes.length > 0 && selected && (daftarMateri.length > 0 || urutan > 1) && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-gray-100 bg-white p-1 scrollbar-hide">
              {Array.from({ length: Math.max(jumlahMateri, urutan) }, (_, i) => i + 1).map(n => (
                <button key={n} type="button" onClick={() => setUrutan(n)}
                  className={`sentuh whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition ${urutan === n ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>Materi {n}</button>
              ))}
            </div>
            {urutan === jumlahMateri && materiTersimpan && (
              <button type="button" onClick={() => setUrutan(jumlahMateri + 1)} className="btn-modal-cancel btn-teks px-3 text-xs">+ Materi lain hari ini</button>
            )}
            {urutan > 1 && urutan === jumlahMateri && materiTersimpan && (
              <button type="button" onClick={hapusMateri} className="btn-modal-cancel btn-teks px-3 text-xs text-red-600">Hapus materi {urutan}</button>
            )}
          </div>
        )}
        {classes.length > 0 && (
          <div className="mt-4">
            <label className="label-field">Materi yang Diajarkan{urutan > 1 ? ` — materi ke-${urutan}` : ""}</label>
            <textarea value={materi} onChange={e => setMateri(e.target.value)} rows={2}
              placeholder="Contoh: Jurnal Umum &amp; Buku Besar — latihan soal bab 3"
              className="input-field" />
          </div>
        )}
        {/* HP: keterangan satu baris penuh, tombol di bawahnya. `flex-wrap` saja tidak cukup — tombolnya
            lebar sehingga keterangan terjepit jadi satu kata per baris (temuan user 18 Sep 2026). */}
        {selected && (
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-gray-100 bg-[#f5f6fa] px-4 py-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <FileSpreadsheet size={18} className="mt-0.5 shrink-0 text-emerald-600" />
              <p className="min-w-0 text-sm text-gray-600">Nilai banyak siswa sekaligus? Isi di Excel lalu unggah ke pertemuan tanggal ini.</p>
            </div>
            <button type="button" onClick={bukaImpor} className="btn-modal-cancel w-full shrink-0 sm:w-auto">
              <Upload size={15} /> Impor Nilai dari Excel
            </button>
          </div>
        )}
      </div>

      {classes.length === 0 ? (
        <EmptyState icon={Users} title="Tidak Ada Jadwal Mengajar" description="Anda tidak terjadwal mengajar kelas manapun pada tanggal ini. Ganti tanggal di atas, atau hubungi admin kalau jadwal belum diatur." />
      ) : (
        <>
          {loadingRows ? (
            <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
          ) : (
            <div className="panel overflow-hidden mb-6">
              <div className="overflow-x-auto scrollbar-visible">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="w-10">#</th>
                      <th>Nama Siswa</th>
                      <th className="w-32">Kehadiran</th>
                      <th className="w-28">Pengetahuan</th>
                      <th className="w-28">Keterampilan</th>
                      <th>Catatan Siswa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.studentId}>
                        <td className="py-2 text-gray-400 text-xs">{i + 1}</td>
                        <td className="py-2 font-semibold text-primary-900">{r.name}</td>
                        <td className="py-2">
                          {urutan === 1
                            ? <Select value={r.attendanceStatus} onChange={v => updateRow(r.studentId, { attendanceStatus: v })} options={ATTENDANCE_OPTIONS} placeholder="Pilih" />
                            : <span className="text-sm text-gray-500">{ATTENDANCE_OPTIONS.find(o => o.value === r.attendanceStatus)?.label ?? "—"}</span>}
                        </td>
                        <td className="py-2">
                          <input type="number" min={0} max={100} value={r.scorePengetahuan ?? ""}
                            onChange={e => updateRow(r.studentId, { scorePengetahuan: e.target.value === "" ? null : Number(e.target.value) })}
                            className="input-field" placeholder="—" />
                        </td>
                        <td className="py-2">
                          <input type="number" min={0} max={100} value={r.scoreKeterampilan ?? ""}
                            onChange={e => updateRow(r.studentId, { scoreKeterampilan: e.target.value === "" ? null : Number(e.target.value) })}
                            className="input-field" placeholder="—" />
                        </td>
                        <td className="py-2">
                          <input value={r.catatan} onChange={e => updateRow(r.studentId, { catatan: e.target.value })}
                            className="input-field" placeholder="Catatan khusus (opsional)" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 border-t border-gray-50 flex justify-end">
                <button onClick={handleSave} disabled={saving} className="btn-modal-save">
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} {urutan > 1 ? `Simpan Materi ke-${urutan}` : "Simpan Jurnal Pertemuan"}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Riwayat tidak tergantung ada/tidaknya jadwal hari ini — guru tetap bisa lihat rekap
          semester walau hari yang lagi dipilih kosong. */}
      <div className="panel p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-heading font-semibold text-primary-900 text-sm">Riwayat Pertemuan — {semester}</h3>
          {selected && (
            <Link href={printHref} className="flex items-center gap-1.5 text-xs text-primary-700 hover:text-primary-900 font-semibold">
              <Printer size={13} /> Cetak Rekap
            </Link>
          )}
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-gray-400 py-10 text-center">Belum ada pertemuan tercatat untuk semester ini.</p>
        ) : (
          <div className="overflow-x-auto scrollbar-visible">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Materi</th>
                  <th>H/I/S/A</th>
                  <th>Rata Pengetahuan</th>
                  <th>Rata Keterampilan</th>
                  <th>Catatan</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {history.map(h => (
                  <tr key={h.id} className="transition-colors">
                    <td className="whitespace-nowrap">{new Date(h.date).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</td>
                    <td className="max-w-xs truncate">{(h.urutan ?? 1) > 1 && <span className="mr-1 text-xs text-gray-400">materi {h.urutan} ·</span>}{h.materi}</td>
                    <td className="whitespace-nowrap text-xs">{(h.urutan ?? 1) > 1 ? "—" : `${h.hadir}/${h.izin}/${h.sakit}/${h.alpha}`}</td>
                    <td>{h.avgPengetahuan ?? "—"}</td>
                    <td>{h.avgKeterampilan ?? "—"}</td>
                    <td className="text-xs text-gray-400">{h.catatanCount > 0 ? `${h.catatanCount} siswa` : "—"}</td>
                    <td className="text-right">
                      <button onClick={() => editHistoryRow(h)}
                        className="inline-flex items-center gap-1 text-xs text-primary-700 hover:text-primary-900 font-semibold">
                        <Pencil size={12} /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={imporBuka} onClose={() => !memprosesImpor && setImporBuka(false)} size="xl" scrollBody
        title="Impor Nilai dari Excel"
        description={selected ? `${selected.className} — ${selected.subjectName} · pertemuan ${date} · ${semester}` : undefined}
        footer={<>
          <button type="button" onClick={() => setImporBuka(false)} disabled={memprosesImpor} className="btn-modal-cancel">Batal</button>
          <button type="button" onClick={() => prosesImpor(false)} disabled={!berkasImpor || memprosesImpor} className="btn-modal-cancel">
            {memprosesImpor ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />} Periksa Berkas
          </button>
          <button type="button" onClick={() => prosesImpor(true)} disabled={!hasilImpor || hasilImpor.galat > 0 || !hasilImpor.siap || memprosesImpor} className="btn-modal-save">
            {memprosesImpor ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Simpan {hasilImpor?.siap ? `${hasilImpor.siap} Nilai` : "Nilai"}
          </button>
        </>}>
        {selected && (
          <div className="space-y-4">
            <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-600">
              <li>Unduh templat — daftar siswa kelas ini sudah terisi.</li>
              <li>Isi Nilai Pengetahuan dan/atau Keterampilan (0–100), lalu simpan berkasnya.</li>
              <li>Pilih berkas, tekan <strong>Periksa Berkas</strong>, lalu <strong>Simpan</strong>.</li>
            </ol>
            <a href={`/api/teacher/journal/impor-nilai?classId=${selected.classId}&subject=${encodeURIComponent(selected.subjectName)}`} className="btn-modal-cancel w-fit">
              <Download size={15} className="text-emerald-600" /> Unduh Templat Excel
            </a>
            <div>
              <label htmlFor="berkas-impor-nilai" className="label-field">Berkas Excel (.xlsx)</label>
              <input id="berkas-impor-nilai" type="file" accept=".xlsx,.xls"
                onChange={e => { setBerkasImpor(e.target.files?.[0] ?? null); setHasilImpor(null); }}
                className="input-field file:mr-3 file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-primary-700" />
            </div>
            {!materi.trim() && <p className="error-msg">Isi dulu &ldquo;Materi yang Diajarkan&rdquo; di halaman bila pertemuan tanggal ini belum punya jurnal.</p>}
            {hasilImpor && (
              <div className="space-y-2">
                <p className="text-sm">
                  <strong>{hasilImpor.siap}</strong> baris siap disimpan
                  {hasilImpor.galat > 0 && <> · <strong className="text-red-600">{hasilImpor.galat}</strong> bermasalah (perbaiki berkasnya lalu periksa lagi)</>}
                  {hasilImpor.jurnalAda ? " · jurnal tanggal ini sudah ada, nilai & catatan akan diperbarui (kehadiran tetap)." : " · jurnal baru akan dibuat."}
                </p>
                {hasilImpor.baris && hasilImpor.baris.length > 0 && (
                  <div className="max-h-72 overflow-auto rounded-xl border border-gray-100">
                    <table className="data-table">
                      <thead><tr><th>Baris</th><th>Nama</th><th className="text-right">Pengetahuan</th><th className="text-right">Keterampilan</th><th>Keterangan</th></tr></thead>
                      <tbody>
                        {hasilImpor.baris.map(b => (
                          <tr key={b.baris} className={b.galat ? "bg-red-50/60" : ""}>
                            <td className="tabular-nums text-gray-500">{b.baris}</td>
                            <td><p className="font-medium text-primary-900">{b.nama || "—"}</p><p className="text-xs text-gray-400">{b.nis}</p></td>
                            <td className="text-right tabular-nums">{b.p ?? "—"}</td>
                            <td className="text-right tabular-nums">{b.k ?? "—"}</td>
                            <td className="text-xs">{b.galat ? <span className="font-semibold text-red-600">{b.galat}</span> : b.catatan || <span className="text-emerald-600">OK</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
