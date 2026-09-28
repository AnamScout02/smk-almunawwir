"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  FileQuestion, Loader2, Plus, Trash2, Users2, ChevronRight, KeyRound, BookMarked, LayoutDashboard,
  BarChart3, PlayCircle, CalendarClock, Trophy, TrendingUp, Upload, Download, Pencil, AlertTriangle, CheckCircle2, Search, Share2 } from "lucide-react";
import Select from "@/components/admin/Select";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import StatTile from "@/components/admin/StatTile";
import Modal from "@/components/admin/Modal";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { useToast } from "@/components/shared/ToastProvider";
import SoalEditor, { BUTIR_KOSONG, type ButirForm } from "@/components/ujian/SoalEditor";
import { TIPE_SOAL, labelTipe, type Opsi, type Kunci } from "@/lib/soal";
import { salinTeks } from "@/lib/salin-teks";
import { useTokenLangsung } from "@/lib/use-token-langsung";

interface TeachClass { classId: string; className: string; grade: number; subjectId: string; subjectName: string }
interface BankItem {
  id: string; subject: string; tipe: string; pertanyaan: string; opsi: Opsi[]; kunci: Kunci | null; skor: number; kd: string | null; materi?: string | null; indikator?: string | null; levelKognitif?: string | null;
  pembahasan: string | null; stimulusId: string | null; stimulus: { id: string; judul: string } | null; createdAt: string;
  /** Bank soal bersama (18 Sep 2026): milik guru lain hanya bisa disalin, tidak diubah. */
  dibagikan?: boolean; milikSaya?: boolean; teacher?: { user: { name: string } };
}
interface ExamItem {
  id: string; title: string; subject: string; token: string; duration: number; startTime: string; endTime: string; isPublished: boolean;
  class: { name: string }; teacher: { user: { name: string } }; _count: { questions: number; attempts: number };
  /** Semua kelas peserta (ujian boleh diikuti banyak kelas). */
  kelasNama?: string[];
  kegiatan: { id: string; nama: string; singkatan: string; token?: string | null } | null;
  attempts: { score: number | null }[];
}
interface ButirImpor extends ButirForm { nomor: number; peringatan: string[]; lockN?: number | null; grouping?: number | null }
interface HasilImpor {
  butir: ButirImpor[]; kepala: { mapel?: string; kelas?: string; guru?: string; judul?: string };
  pola: string; gambar: number; catatan: string[]; pengaturan: unknown;
}

const TABS = ["ringkasan", "ujian", "bank", "hasil"] as const;
type Tab = typeof TABS[number];
const TAB_LABEL: Record<Tab, string> = { ringkasan: "Ringkasan", ujian: "Daftar Ujian", bank: "Bank Soal", hasil: "Hasil & Analitik" };
const TAB_ICON: Record<Tab, React.ElementType> = { ringkasan: LayoutDashboard, ujian: FileQuestion, bank: BookMarked, hasil: BarChart3 };

const fmtDateTime = (d: string) => new Date(d).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const teksPolos = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
function examStatus(e: ExamItem): "AKAN_DATANG" | "BERLANGSUNG" | "SELESAI" {
  const now = Date.now(), s = new Date(e.startTime).getTime(), t = new Date(e.endTime).getTime();
  return now < s ? "AKAN_DATANG" : now > t ? "SELESAI" : "BERLANGSUNG";
}
/** "X AK 1" untuk satu kelas; "X AK 1, X ATU 1 +3 kelas" untuk ujian banyak kelas. */
const labelKelas = (e: ExamItem) => {
  const k = e.kelasNama?.length ? e.kelasNama : [e.class.name];
  return k.length <= 2 ? k.join(", ") : `${k.slice(0, 2).join(", ")} +${k.length - 2} kelas`;
};
const examScores = (e: ExamItem) => e.attempts.map(a => a.score).filter((s): s is number => s !== null);

export default function UjianManager({ basePath }: { basePath: string }) {
  const router = useRouter();
  const confirmDialog = useConfirm();
  const toast = useToast();
  const [classes, setClasses] = useState<TeachClass[]>([]);
  const [classKey, setClassKey] = useState("");
  const [tab, setTab] = useState<Tab>("ringkasan");
  const [bankItems, setBankItems] = useState<BankItem[]>([]);
  const [exams, setExams] = useState<ExamItem[]>([]);
  // Ringkasan memakai SELURUH ujian dalam cakupan pengguna — bukan hanya kelas & mapel yang
  // sedang dipilih. Dulu ikut tersaring, sehingga ujian yang sedang berlangsung di kelas lain
  // tampil sebagai 0 (temuan user 13 September 2026).
  const [semuaUjian, setSemuaUjian] = useState<ExamItem[]>([]);
  const [jumlahBankSemua, setJumlahBankSemua] = useState(0);
  const [tampilBersama, setTampilBersama] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [filterTipe, setFilterTipe] = useState("");
  const [cari, setCari] = useState("");
  /** Saringan Daftar Ujian (permintaan user 20 September 2026) — daftar kini memuat semua mapel. */
  const [cariUjian, setCariUjian] = useState("");
  const [statusUjian, setStatusUjian] = useState("");

  // formulir satu butir
  const [formBuka, setFormBuka] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [butir, setButir] = useState<ButirForm>(BUTIR_KOSONG);
  const [saving, setSaving] = useState(false);

  // impor Word/Excel
  const [imporBuka, setImporBuka] = useState(false);
  const [wordFile, setWordFile] = useState<File | null>(null);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [membaca, setMembaca] = useState(false);
  const [hasilImpor, setHasilImpor] = useState<HasilImpor | null>(null);
  const [pilihImpor, setPilihImpor] = useState<Set<number>>(new Set());
  const [menyimpanImpor, setMenyimpanImpor] = useState(false);
  const wordRef = useRef<HTMLInputElement>(null);
  const excelRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Sengaja TIDAK memilih kelas pertama otomatis (20 September 2026): daftar ujian kini tampil
    // lengkap tanpa harus memilih kelas & mapel dulu — pilihan itu hanya SARINGAN.
    fetch("/api/teacher/journal-classes").then(r => r.json()).then((d: TeachClass[]) => setClasses(d)).catch(() => {});
  }, []);

  const selected = useMemo(() => {
    const [classId, subjectName] = classKey.split("::");
    return classes.find(c => c.classId === classId && c.subjectName === subjectName) ?? null;
  }, [classKey, classes]);

  function loadSemua() {
    fetch("/api/teacher/exams").then(r => r.json()).then(d => setSemuaUjian(Array.isArray(d) ? d : [])).catch(() => {});
    fetch("/api/teacher/exam-bank").then(r => r.json()).then(d => setJumlahBankSemua(Array.isArray(d) ? d.length : 0)).catch(() => {});
  }
  useEffect(() => { loadSemua(); const t = setInterval(loadSemua, 30_000); return () => clearInterval(t); }, []);

  function loadList() {
    loadSemua();
    setLoadingList(true);
    // Tanpa saringan = seluruh ujian & bank soal dalam cakupan pengguna.
    const qBank = selected ? `?subject=${encodeURIComponent(selected.subjectName)}&bersama=1` : "?bersama=1";
    const qUjian = selected ? `?classId=${selected.classId}&subject=${encodeURIComponent(selected.subjectName)}` : "";
    Promise.all([
      fetch(`/api/teacher/exam-bank${qBank}`).then(r => r.json()).catch(() => []),
      fetch(`/api/teacher/exams${qUjian}`).then(r => r.json()).catch(() => []),
    ]).then(([bank, ex]) => {
      setBankItems(Array.isArray(bank) ? bank : []);
      setExams(Array.isArray(ex) ? ex : []);
    }).finally(() => setLoadingList(false));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadList(); }, [selected]);

  /* ------------------------------ bank soal ------------------------------ */

  /** Bagikan/tarik soal dari bank bersama (18 Sep 2026). */
  async function bagikanButir(b: BankItem) {
    const r = await fetch(`/api/teacher/exam-bank/${b.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dibagikan: !b.dibagikan }) }).catch(() => null);
    if (!r?.ok) { toast.error("Gagal mengubah status berbagi."); return; }
    setBankItems(items => items.map(x => (x.id === b.id ? { ...x, dibagikan: !b.dibagikan } : x)));
    toast.success(b.dibagikan ? "Soal ditarik dari bank bersama." : "Soal dibagikan ke guru mapel yang sama.");
  }

  /** Salin soal guru lain ke bank soal sendiri. */
  async function salinKeBankSaya(b: BankItem) {
    const r = await fetch("/api/teacher/exam-bank", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: selected?.subjectName, tipe: b.tipe, pertanyaan: b.pertanyaan, opsi: b.opsi, kunci: b.kunci, skor: b.skor, kd: b.kd, pembahasan: b.pembahasan, materi: b.materi, indikator: b.indikator, levelKognitif: b.levelKognitif }),
    }).catch(() => null);
    if (!r?.ok) { toast.error("Gagal menyalin soal."); return; }
    toast.success("Soal disalin ke bank soal Anda.");
    loadList();
  }
  /** Mapel butir baru: ikut saringan bila ada, kalau tidak dipilih di dalam formulir. */
  const [mapelButir, setMapelButir] = useState("");
  const daftarMapel = useMemo(() => [...new Set(classes.map(c => c.subjectName))].sort(), [classes]);
  function bukaTambah() {
    setEditId(null); setButir(BUTIR_KOSONG);
    setMapelButir(selected?.subjectName ?? (daftarMapel.length === 1 ? daftarMapel[0] : ""));
    setFormBuka(true);
  }
  function bukaEdit(b: BankItem) {
    setEditId(b.id);
    setButir({ tipe: b.tipe, pertanyaan: b.pertanyaan, opsi: b.opsi ?? [], kunci: b.kunci, skor: b.skor, kd: b.kd ?? "", materi: b.materi ?? "", indikator: b.indikator ?? "", levelKognitif: b.levelKognitif ?? "", pembahasan: b.pembahasan ?? "", stimulusId: b.stimulusId });
    setMapelButir(b.subject ?? selected?.subjectName ?? "");
    setFormBuka(true);
  }
  async function simpanButir() {
    const mapel = mapelButir || selected?.subjectName || "";
    if (!mapel) return toast.error("Pilih mata pelajaran soal ini dulu.");
    setSaving(true);
    const res = await fetch(editId ? `/api/teacher/exam-bank/${editId}` : "/api/teacher/exam-bank", {
      method: editId ? "PUT" : "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: mapel, ...butir }),
    }).catch(() => null);
    setSaving(false);
    const d = await res?.json().catch(() => null);
    if (!res?.ok) return toast.error(d?.error ?? "Gagal menyimpan soal.");
    toast.success(editId ? "Soal diperbarui." : "Soal ditambahkan ke bank.");
    setFormBuka(false); loadList();
  }
  async function hapusButir(id: string) {
    if (!(await confirmDialog("Hapus soal ini dari bank soal?"))) return;
    await fetch(`/api/teacher/exam-bank/${id}`, { method: "DELETE" });
    loadList();
  }

  async function bacaImpor() {
    if (!wordFile) return toast.error("Pilih berkas Word (.docx) dulu.");
    setMembaca(true); setHasilImpor(null);
    const fd = new FormData();
    fd.append("word", wordFile); if (excelFile) fd.append("excel", excelFile);
    if (selected) fd.append("mapel", selected.subjectName); // dicocokkan dengan Mata Pelajaran/Kode Test
    const res = await fetch("/api/teacher/exam-bank/impor", { method: "POST", body: fd }).catch(() => null);
    setMembaca(false);
    const d = await res?.json().catch(() => null);
    if (!res?.ok) return toast.error(d?.error ?? "Gagal membaca berkas.");
    setHasilImpor(d);
    setPilihImpor(new Set((d.butir as ButirImpor[]).map((_, i) => i)));
  }
  /** Naskah yang sudah dibaca langsung dibawa ke penyusun ujian — tidak perlu lewat bank soal
   *  dulu (permintaan user 20 September 2026: "saat upload word dan excel langsung terbuat daftar
   *  ujiannya"). Soal dititipkan di sessionStorage, bukan URL: naskah bisa ratusan kilobyte.
   *  Jadwal & kelas tetap ditanyakan di penyusun — satu tempat untuk semua pengaturan ujian. */
  function buatUjianDariNaskah() {
    if (!hasilImpor) return;
    const dipilih = hasilImpor.butir.filter((_, i) => pilihImpor.has(i));
    if (!dipilih.length) return toast.error("Tidak ada soal yang dipilih.");
    const mapel = selected?.subjectName || hasilImpor.kepala?.mapel || "";
    try {
      sessionStorage.setItem("impor-ujian", JSON.stringify({
        subject: mapel,
        judul: hasilImpor.kepala?.judul ?? "",
        butir: dipilih.map(b => ({ ...b, skor: b.skor ?? 1, kd: b.kd ?? "", pembahasan: "", stimulusId: null })),
      }));
    } catch { toast.error("Naskah terlalu besar untuk dibawa. Simpan ke bank soal dulu."); return; }
    router.push(`${basePath}/new`);
  }

  async function simpanImpor() {
    if (!hasilImpor || !selected) return;
    const dipilih = hasilImpor.butir.filter((_, i) => pilihImpor.has(i));
    if (!dipilih.length) return toast.error("Tidak ada soal yang dipilih.");
    setMenyimpanImpor(true);
    const res = await fetch("/api/teacher/exam-bank/simpan-banyak", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: selected.subjectName, butir: dipilih.map(b => ({ ...b, skor: b.skor ?? 1, kd: b.kd ?? "", pembahasan: "", stimulusId: null })) }),
    }).catch(() => null);
    setMenyimpanImpor(false);
    const d = await res?.json().catch(() => null);
    if (!res?.ok) return toast.error(d?.error ?? "Gagal menyimpan.");
    toast.success(`${d.masuk} soal masuk ke bank${d.dilewati?.length ? `, ${d.dilewati.length} dilewati` : ""}.`);
    if (d.dilewati?.length) toast.warning(d.dilewati.slice(0, 3).map((x: { nomor: number; alasan: string }) => `No ${x.nomor}: ${x.alasan}`).join(" · "));
    setImporBuka(false); setHasilImpor(null); setWordFile(null); setExcelFile(null); loadList();
  }
  function ubahButirImpor(i: number, patch: Partial<ButirImpor>) {
    if (!hasilImpor) return;
    setHasilImpor({ ...hasilImpor, butir: hasilImpor.butir.map((b, k) => (k === i ? { ...b, ...patch } : b)) });
  }

  /* ------------------------------ ujian ------------------------------ */
  async function hapusUjian(id: string, title: string) {
    if (!(await confirmDialog(`Hapus ujian "${title}" beserta semua hasil pengerjaan siswa?`))) return;
    await fetch(`/api/teacher/exams/${id}`, { method: "DELETE" });
    loadList();
  }
  const salinToken = async (t: string) => { if (await salinTeks(t)) toast.success(`Token ${t} disalin`); else toast.error(`Tidak bisa menyalin otomatis. Token: ${t}`); };

  const LABEL_STATUS: Record<string, string> = { BERLANGSUNG: "Berlangsung", AKAN_DATANG: "Terjadwal", SELESAI: "Selesai" };
  const ujianTampil = exams.filter(e => {
    const q = cariUjian.trim().toLowerCase();
    const st = e.isPublished === false ? "Draf" : LABEL_STATUS[examStatus(e)];
    return (!statusUjian || st === statusUjian)
      && (!q || [e.title, e.subject, labelKelas(e), e.teacher.user.name].some(x => (x ?? "").toLowerCase().includes(q)));
  });
  // Token terkini — diperbarui berkala (token berjangka berganti sendiri; dulu daftar ini tetap menampilkan token
  // lama sampai halaman dimuat ulang). Ujian yang sudah selesai tidak perlu dipantau.
  const tokenLangsung = useTokenLangsung(exams.filter(e => e.isPublished && examStatus(e) !== "SELESAI").slice(0, 100).map(e => e.id));
  const tokenDari = (e: ExamItem) => {
    const tk = tokenLangsung[e.id];
    return tk ? { token: tk.token, bersama: tk.tokenBersama } : { token: e.kegiatan?.token ?? e.token, bersama: !!e.kegiatan?.token };
  };
  const bankTampil = bankItems.filter(b => (!filterTipe || b.tipe === filterTipe) && (!cari || teksPolos(b.pertanyaan).toLowerCase().includes(cari.toLowerCase())) && (tampilBersama || b.milikSaya !== false));
  const berlangsung = semuaUjian.filter(e => e.isPublished && examStatus(e) === "BERLANGSUNG");
  const akanDatang = semuaUjian.filter(e => e.isPublished && examStatus(e) === "AKAN_DATANG").sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  const allScores = semuaUjian.flatMap(examScores);
  const avgScoreAll = allScores.length ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : null;
  const totalPeserta = semuaUjian.reduce((sum, e) => sum + e._count.attempts, 0);
  const tplQ = selected ? `mapel=${encodeURIComponent(selected.subjectName)}&kelas=${encodeURIComponent(selected.className)}` : "";

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<FileQuestion size={22} />} title="Daftar Ujian"
        description="Bank soal 8 jenis, naskah dari Word & kunci dari Excel, pengacakan per siswa, papan pantau pengawas, dan analisis butir" />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="w-full sm:w-80">
          <Select value={classKey} onChange={setClassKey} placeholder="Semua kelas & mapel"
            options={[
              { value: "", label: "Semua kelas & mapel" },
              ...classes.map(c => ({ value: `${c.classId}::${c.subjectName}`, label: `${c.className} - ${c.subjectName}` })),
            ]} />
        </div>
        {/* w-full + min-w-0 di HP: tanpa ini lebar baris ini = lebar kotak tab (tidak bisa dilipat), jadi max-w-full
            kotak tab tidak pernah menahan apa pun dan halaman bisa digeser ke samping. */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto min-w-0">
        <div className="flex gap-1 bg-white rounded-xl border border-gray-100 p-1 max-w-full overflow-x-auto scrollbar-hide">
          {/* max-w-full + overflow: di HP tab bergeser di dalam kotaknya sendiri, bukan melebarkan halaman (gulir samping 1px) */}
          {TABS.map(t => { const Icon = TAB_ICON[t]; return (
            <button key={t} onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${tab === t ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
              <Icon size={14} /> {TAB_LABEL[t]}
            </button>
          ); })}
        </div>
        </div>
      </div>

      {/* TIDAK ADA LAGI gerbang "pilih dulu" di tab mana pun (20 September 2026, keputusan user:
          "membingungkan, buat yang simpel"). Dropdown di atas murni SARINGAN. Hak akses tetap
          dijaga server (filterDaftarUjian & cakupan bank soal), bukan oleh pilihan di layar ini. */}
      {loadingList && tab !== "ringkasan" ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
      ) : (
        <>
          {/* ============ RINGKASAN ============ */}
          {tab === "ringkasan" && (
            <div className="space-y-5">
              <p className="text-xs text-gray-400 -mt-2">Ringkasan seluruh ujian yang Anda kelola — semua kelas & mata pelajaran, tidak tergantung pilihan kelas di atas.</p>
              <div className="kisi-kartu kisi-kartu-4">
                <StatTile value={semuaUjian.length} label="Ujian Dibuat" icon={FileQuestion} color="primary" />
                <StatTile value={jumlahBankSemua} label="Soal di Bank" icon={BookMarked} color="blue" />
                <StatTile value={totalPeserta} label="Total Pengerjaan" icon={Users2} color="emerald" />
                <StatTile value={avgScoreAll ?? "-"} label="Rerata Nilai" icon={TrendingUp} color="amber" />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="page-card p-5">
                  <h3 className="font-heading font-semibold text-primary-900 flex items-center gap-2 mb-3"><PlayCircle size={16} className="text-emerald-600" /> Sedang Berlangsung</h3>
                  {berlangsung.length === 0 ? <p className="text-sm text-gray-400">Tidak ada ujian yang sedang berjalan.</p> : berlangsung.map(e => (
                    <Link key={e.id} href={`${basePath}/${e.id}?tab=pantau`} className="flex items-center justify-between gap-3 py-2 border-b border-gray-50 last:border-0 hover:text-primary-700">
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5">
                          {e.kegiatan && <span className="badge badge-gold shrink-0" title={e.kegiatan.nama}>{e.kegiatan.singkatan}</span>}
                          <span className="text-sm font-medium truncate">{e.title}</span>
                        </span>
                        <span className="block text-xs text-gray-400">{labelKelas(e)} · {e.subject} · tutup {new Date(e.endTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>
                      </span>
                      <span className="text-xs text-gray-400 shrink-0">{e._count.attempts} peserta <ChevronRight size={14} className="inline" /></span>
                    </Link>
                  ))}
                </div>
                <div className="page-card p-5">
                  <h3 className="font-heading font-semibold text-primary-900 flex items-center gap-2 mb-3"><CalendarClock size={16} className="text-blue-600" /> Akan Datang</h3>
                  {akanDatang.length === 0 ? <p className="text-sm text-gray-400">Belum ada jadwal ujian berikutnya.</p> : akanDatang.slice(0, 5).map(e => (
                    <Link key={e.id} href={`${basePath}/${e.id}`} className="flex items-center justify-between gap-3 py-2 border-b border-gray-50 last:border-0 hover:text-primary-700">
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5">
                          {e.kegiatan && <span className="badge badge-gold shrink-0" title={e.kegiatan.nama}>{e.kegiatan.singkatan}</span>}
                          <span className="text-sm font-medium truncate">{e.title}</span>
                        </span>
                        <span className="block text-xs text-gray-400">{labelKelas(e)} · {e.subject}</span>
                      </span>
                      <span className="text-xs text-gray-400 shrink-0">{fmtDateTime(e.startTime)}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ============ DAFTAR UJIAN ============ */}
          {tab === "ujian" && (
            <>
              <div className="baris-alat mb-5">
                <div className="alat-cari">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={cariUjian} onChange={e => setCariUjian(e.target.value)}
                    placeholder="Cari judul, mapel, kelas, atau guru..." className="input-field pl-10 w-full" />
                </div>
                <div className="alat-saring">
                  <Select value={statusUjian} onChange={setStatusUjian}
                    options={[{ value: "", label: `Semua status (${exams.length})` },
                      ...["Berlangsung", "Terjadwal", "Selesai", "Draf"].map(v => ({ value: v, label: v }))]} />
                </div>
                {(cariUjian || statusUjian) && (
                  <span className="text-xs text-gray-400">{ujianTampil.length} dari {exams.length} ujian</span>
                )}
              </div>
              <div className="alat-aksi justify-end mb-5">
                {/* Membuat ujian tetap butuh kelas & mapel (ujian selalu milik salah satunya) —
                    tapi MELIHAT daftar tidak lagi ditahan (20 September 2026). */}
                {/* Tidak lagi menunggu pilihan di atas: kelas & mapel ditanyakan di dalam formulir
                    (permintaan user 20 September 2026). Saringan yang aktif tetap ikut sebagai
                    isian awal supaya guru yang sudah memilih tidak perlu memilih dua kali. */}
                <Link href={selected ? `${basePath}/new?classId=${selected.classId}&subject=${encodeURIComponent(selected.subjectName)}` : `${basePath}/new`}
                  className="btn-modal-save">
                  <Plus size={16} /> Buat Ujian
                </Link>
              </div>
              {exams.length === 0 ? (
                <EmptyState icon={FileQuestion} title="Belum Ada Ujian"
                  description={selected ? "Buat ujian pertama untuk kelas & mapel ini." : "Belum ada ujian dalam cakupan Anda."} />
              ) : (
                <div className="page-card overflow-hidden">
                  <div className="overflow-x-auto"><table className="data-table">
                    <thead><tr><th>Judul</th><th>Jadwal</th><th>Token</th><th>Soal</th><th>Peserta</th><th>Status</th><th>Aksi</th></tr></thead>
                    <tbody>
                      {ujianTampil.map(e => { const st = examStatus(e); return (
                        <tr key={e.id}>
                          <td>{e.kegiatan && <span className="badge badge-gold mr-1.5" title={e.kegiatan.nama}>{e.kegiatan.singkatan}</span>}<Link href={`${basePath}/${e.id}`} className="font-medium text-primary-900 hover:underline">{e.title}</Link>
                            {/* Mapel & kelas ikut di judul (permintaan user 20 September 2026):
                                daftar ini kini menampilkan SEMUA mapel sekaligus, jadi judul saja
                                tidak cukup membedakan "Sumatif Tengah Semester" milik siapa. */}
                            <span className="block text-xs text-gray-500">{e.subject} · {labelKelas(e)}</span>
                            <span className="block text-xs text-gray-400">{e.duration} menit · oleh {e.teacher.user.name}</span></td>
                          <td className="text-xs whitespace-nowrap">{fmtDateTime(e.startTime)}<br />s.d. {fmtDateTime(e.endTime)}</td>
                          <td>
                            {/* Satu token saja: token bersama kegiatan bila ada, selain itu token ujian ini. */}
                            <button onClick={() => salinToken(tokenDari(e).token)}
                              className={`font-mono font-bold flex items-center gap-1 ${tokenDari(e).bersama ? "text-gold-dark" : "text-primary-700"}`}
                              title={tokenDari(e).bersama ? `Token bersama ${e.kegiatan?.singkatan ?? "kegiatan"} — berlaku untuk semua mapel di kegiatan ini` : "Salin token"}>
                              <KeyRound size={12} /> {tokenDari(e).token}
                            </button>
                          </td>
                          <td className="text-center">{e._count.questions}</td>
                          <td className="text-center">{e._count.attempts}</td>
                          <td>
                            <span className={`px-2 py-0.5 rounded-full border text-xs font-semibold ${
                              !e.isPublished ? "bg-gray-50 text-gray-600 border-gray-200" : st === "BERLANGSUNG" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : st === "AKAN_DATANG" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                              {!e.isPublished ? "Draft" : st === "BERLANGSUNG" ? "Berlangsung" : st === "AKAN_DATANG" ? "Terjadwal" : "Selesai"}
                            </span>
                          </td>
                          <td><div className="flex items-center gap-1">
                            <Link href={`${basePath}/${e.id}`} title="Buka" className="p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg"><Pencil size={14} /></Link>
                            <button onClick={() => hapusUjian(e.id, e.title)} title="Hapus" className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"><Trash2 size={14} /></button>
                          </div></td>
                        </tr>
                      ); })}
                    </tbody>
                  </table></div>
                </div>
              )}
            </>
          )}

          {/* ============ BANK SOAL ============ */}
          {tab === "bank" && (
            <>
              <div className="page-card p-4 mb-4 baris-alat">
                <div className="alat-cari">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari teks soal..." className="input-field pl-10 w-full" />
                </div>
                <div className="alat-saring">
                  <Select value={filterTipe} onChange={setFilterTipe} placeholder="Semua jenis"
                    options={[{ value: "", label: `Semua jenis (${bankItems.length})` }, ...TIPE_SOAL.map(t => ({ value: t.value, label: `${t.label} (${bankItems.filter(b => b.tipe === t.value).length})` }))]} />
                </div>
                <div className="alat-saring">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={tampilBersama} onChange={e => setTampilBersama(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
                    Tampilkan soal guru lain
                  </label>
                </div>
                <div className="alat-aksi">
                  <a href={`/api/teacher/exam-bank/template?jenis=word&${tplQ}`} className="btn-modal-cancel btn-teks"><Download size={15} /> Template Word</a>
                  <a href={`/api/teacher/exam-bank/template?jenis=excel&${tplQ}`} className="btn-modal-cancel btn-teks"><Download size={15} /> Template Excel</a>
                  <button onClick={() => { setImporBuka(true); setHasilImpor(null); }} className="btn-modal-cancel"><Upload size={15} /> Impor dari Word</button>
                  <button onClick={bukaTambah} className="btn-modal-save"><Plus size={16} /> Tambah Soal</button>
                </div>
              </div>
              {bankTampil.length === 0 ? (
                <EmptyState icon={BookMarked} title="Bank Soal Kosong" description="Tambah soal satu per satu, atau impor sekaligus dari naskah Word." />
              ) : (
                <div className="space-y-2">
                  {bankTampil.map((b, i) => (
                    <div key={b.id} className="page-card p-4 flex items-start gap-3">
                      <span className="w-7 h-7 rounded-lg bg-primary-50 text-primary-900 text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="badge badge-navy">{labelTipe(b.tipe)}</span>
                          {b.subject && <span className="badge badge-gold">{b.subject}</span>}
                          <span className="text-xs text-gray-400">{b.skor} poin{b.kd ? ` · KD ${b.kd}` : ""}{b.stimulus ? ` · ${b.stimulus.judul}` : ""}</span>
                          {b.milikSaya === false && <span className="badge badge-gold">Dibagikan {b.teacher?.user.name ?? "guru lain"}</span>}
                        </div>
                        <p className="text-sm text-primary-900 line-clamp-2">{teksPolos(b.pertanyaan) || "(soal bergambar)"}</p>
                        {(b.tipe === "PG" || b.tipe === "PG_KOMPLEKS") && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                            {b.opsi.map(o => `${o.benar ? "✓" : ""}${o.kode}. ${teksPolos(o.teks)}`).join("   ")}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {b.milikSaya === false ? (
                          <button onClick={() => salinKeBankSaya(b)} title="Salin ke bank soal saya" className="btn-modal-cancel px-2.5 text-xs"><Plus size={13} /> Salin</button>
                        ) : (
                          <>
                            <button onClick={() => bagikanButir(b)} title={b.dibagikan ? "Tarik dari bank bersama" : "Bagikan ke guru mapel yang sama"}
                              className={`p-1.5 rounded-lg ${b.dibagikan ? "text-emerald-700 hover:bg-emerald-50" : "text-gray-400 hover:bg-gray-50"}`}><Share2 size={14} /></button>
                            <button onClick={() => bukaEdit(b)} title="Edit" className="p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg"><Pencil size={14} /></button>
                            <button onClick={() => hapusButir(b.id)} title="Hapus" className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"><Trash2 size={14} /></button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ============ HASIL ============ */}
          {tab === "hasil" && (
            exams.filter(e => e._count.attempts > 0).length === 0 ? (
              <EmptyState icon={Trophy} title="Belum Ada Hasil" description="Hasil muncul setelah ada siswa yang mengumpulkan ujian." />
            ) : (
              <div className="page-card overflow-hidden">
                <div className="overflow-x-auto"><table className="data-table">
                  <thead><tr><th>Ujian</th><th>Peserta</th><th>Rerata</th><th>Tertinggi</th><th>Terendah</th><th>Aksi</th></tr></thead>
                  <tbody>
                    {exams.filter(e => e._count.attempts > 0).map(e => { const s = examScores(e); return (
                      <tr key={e.id}>
                        <td className="font-medium">{e.title}<span className="block text-xs text-gray-400">{fmtDateTime(e.startTime)}</span></td>
                        <td className="text-center">{e._count.attempts}</td>
                        <td className="text-center angka font-bold text-primary-900">{s.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length) : "-"}</td>
                        <td className="text-center angka text-emerald-700">{s.length ? Math.max(...s) : "-"}</td>
                        <td className="text-center angka text-red-600">{s.length ? Math.min(...s) : "-"}</td>
                        <td><div className="flex items-center gap-2">
                          <Link href={`${basePath}/${e.id}?tab=hasil`} className="text-xs font-semibold text-primary-700 hover:underline">Rincian & analisis</Link>
                          <a href={`/api/teacher/exams/${e.id}/hasil?format=xlsx`} className="p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg" title="Unduh Excel"><Download size={14} /></a>
                        </div></td>
                      </tr>
                    ); })}
                  </tbody>
                </table></div>
              </div>
            )
          )}
        </>
      )}

      {/* ============ MODAL: satu butir ============ */}
      <Modal open={formBuka} onClose={() => setFormBuka(false)} title={editId ? "Edit Soal" : "Tambah Soal ke Bank"} size="xl" scrollBody
        description={mapelButir || undefined}
        footer={<>
          <button onClick={() => setFormBuka(false)} className="btn-modal-cancel">Batal</button>
          <button onClick={simpanButir} disabled={saving} className="btn-modal-save">{saving ? "Menyimpan..." : "Simpan"}</button>
        </>}>
        {/* Mapel ditanyakan DI SINI, bukan sebagai syarat sebelum halaman terbuka — guru tinggal
            menambah soal lalu memilih mapelnya, tidak perlu memahami dropdown di kepala halaman. */}
        {daftarMapel.length > 1 && (
          <div className="mb-4">
            <label className="label-field">Mata pelajaran</label>
            <Select value={mapelButir} onChange={setMapelButir} placeholder="Pilih mata pelajaran"
              options={daftarMapel.map(m => ({ value: m, label: m }))} />
          </div>
        )}
        <SoalEditor nilai={butir} onChange={setButir} />
      </Modal>

      {/* ============ MODAL: impor Word/Excel ============ */}
      <Modal open={imporBuka} onClose={() => setImporBuka(false)} title="Impor Soal dari Word" size="xl" scrollBody
        description="Naskah Word apa adanya (template sekolah, daftar bernomor, tabel) - hasil bacaannya ditampilkan dulu untuk diperiksa sebelum masuk bank."
        footer={<>
          <button onClick={() => setImporBuka(false)} className="btn-modal-cancel">Tutup</button>
          {hasilImpor && hasilImpor.butir.length > 0 && (
            <button onClick={buatUjianDariNaskah} className="btn-modal-cancel btn-teks">
              <FileQuestion size={15} /> Jadikan Ujian ({pilihImpor.size} soal)
            </button>
          )}
          {hasilImpor && hasilImpor.butir.length > 0 && (
            <button onClick={simpanImpor} disabled={menyimpanImpor} className="btn-modal-save">
              {menyimpanImpor ? "Menyimpan..." : `Simpan ${pilihImpor.size} soal ke bank`}
            </button>
          )}
        </>}>
        {!hasilImpor ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border-2 border-dashed border-primary-100 p-4 text-center">
                <input ref={wordRef} type="file" accept=".docx,.docm" className="hidden" onChange={e => setWordFile(e.target.files?.[0] ?? null)} />
                <p className="text-sm font-semibold text-primary-900 mb-1">1. Naskah soal (Word)</p>
                <p className="text-xs text-gray-400 mb-3">.docx / .docm - wajib</p>
                <button onClick={() => wordRef.current?.click()} className="btn-modal-cancel">{wordFile ? wordFile.name : "Pilih berkas"}</button>
              </div>
              <div className="rounded-xl border-2 border-dashed border-gray-200 p-4 text-center">
                <input ref={excelRef} type="file" accept=".xlsx,.xlsm,.xls" className="hidden" onChange={e => setExcelFile(e.target.files?.[0] ?? null)} />
                <p className="text-sm font-semibold text-primary-900 mb-1">2. Kunci & pengaturan (Excel)</p>
                <p className="text-xs text-gray-400 mb-3">opsional - kunci, skor, KD, grouping, LockN</p>
                <button onClick={() => excelRef.current?.click()} className="btn-modal-cancel">{excelFile ? excelFile.name : "Pilih berkas"}</button>
              </div>
            </div>
            <button onClick={bacaImpor} disabled={membaca || !wordFile} className="btn-modal-save w-full">
              {membaca ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} {membaca ? "Membaca naskah..." : "Baca & Pratinjau"}
            </button>
            <p className="text-xs text-gray-400">Berkas .doc lama: buka di Word lalu Save As .docx. Gambar dan pangkat (x<sup>2</sup>) ikut terbaca.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl bg-primary-50 p-3 text-xs text-primary-900">
              <b>{hasilImpor.butir.length} soal terbaca</b> (pola: {hasilImpor.pola}, {hasilImpor.gambar} gambar)
              {hasilImpor.kepala.mapel ? ` · ${hasilImpor.kepala.mapel}` : ""}{hasilImpor.kepala.guru ? ` · ${hasilImpor.kepala.guru}` : ""}
              {hasilImpor.catatan.map((c, i) => <span key={i} className="block text-amber-700 mt-0.5">{c}</span>)}
              <span className="block mt-1 text-gray-500">Periksa tiap soal: pilih kunci yang benar, ubah jenis bila keliru, hapus centang yang tidak mau disimpan.</span>
            </div>
            {hasilImpor.butir.map((b, i) => (
              <div key={i} className={`rounded-xl border p-3 ${pilihImpor.has(i) ? "border-gray-200" : "border-gray-100 opacity-50"}`}>
                <div className="flex items-start gap-2">
                  <input type="checkbox" checked={pilihImpor.has(i)} onChange={() => setPilihImpor(p => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n; })} className="mt-1 w-4 h-4 accent-[#1B2B6B]" />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-primary-900">No {b.nomor}</span>
                      <div className="w-48"><Select value={b.tipe} onChange={v => ubahButirImpor(i, { tipe: v })} options={TIPE_SOAL.map(t => ({ value: t.value, label: t.label }))} /></div>
                      <span className="text-xs text-gray-400">skor <input type="number" value={b.skor ?? 1} onChange={e => ubahButirImpor(i, { skor: Number(e.target.value) })} className="w-14 border border-gray-200 rounded px-1" /></span>
                      {b.peringatan.length > 0 && <span className="text-xs text-amber-700 flex items-center gap-1"><AlertTriangle size={11} /> {b.peringatan.join("; ")}</span>}
                      {b.peringatan.length === 0 && <CheckCircle2 size={12} className="text-emerald-600" />}
                    </div>
                    <div className="text-sm text-gray-800 prose prose-sm max-w-none [&_img]:max-w-[12rem]" dangerouslySetInnerHTML={{ __html: b.pertanyaan }} />
                    {(b.tipe === "PG" || b.tipe === "PG_KOMPLEKS") && (
                      <div className="mt-2 grid sm:grid-cols-2 gap-1">
                        {b.opsi.map((o, k) => (
                          <label key={o.kode} className={`flex items-start gap-2 text-xs rounded-lg px-2 py-1 border cursor-pointer ${o.benar ? "border-emerald-300 bg-emerald-50" : "border-gray-100"}`}>
                            <input type={b.tipe === "PG" ? "radio" : "checkbox"} name={`kunci-${i}`} checked={!!o.benar}
                              onChange={() => ubahButirImpor(i, { opsi: b.opsi.map((x, j) => ({ ...x, benar: b.tipe === "PG" ? j === k : (j === k ? !x.benar : x.benar) })) })}
                              className="mt-0.5 accent-[#1B2B6B]" />
                            <span className="font-bold">{o.kode}.</span>
                            <span className="prose prose-sm max-w-none [&_img]:max-w-[6rem]" dangerouslySetInnerHTML={{ __html: o.teks }} />
                          </label>
                        ))}
                      </div>
                    )}
                    {b.tipe === "ISIAN_SINGKAT" && (
                      <input value={(b.kunci?.jawaban ?? []).join(" | ")} onChange={e => ubahButirImpor(i, { kunci: { ...(b.kunci ?? {}), jawaban: e.target.value.split("|").map(x => x.trim()) } })}
                        placeholder="kunci jawaban, pisahkan alternatif dengan |" className="input-field mt-2 text-xs" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
