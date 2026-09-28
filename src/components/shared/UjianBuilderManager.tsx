"use client";
import { TeksRumus } from "@/components/ujian/HtmlSoal";
import TimePicker from "@/components/shared/TimePicker";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, FileQuestion, Loader2, Plus, Save, Trash2, Eye, EyeOff, KeyRound, BookMarked, Users2, Lock, Upload,
  Download, Settings2, Radio, ClipboardCheck, BarChart3, ChevronUp, ChevronDown, Pencil, RefreshCw, Wifi, WifiOff,
  CheckCircle2, Clock, AlertTriangle, ShieldCheck, Search,
} from "lucide-react";
import EmptyState from "@/components/admin/EmptyState";
import PageHeader from "@/components/admin/PageHeader";
import Modal from "@/components/admin/Modal";
import StatTile from "@/components/admin/StatTile";
import DatePicker from "@/components/shared/DatePicker";
import PilihKelasPeserta, { type OpsiKelasPeserta } from "@/components/ujian/PilihKelasPeserta";
import PesanPesertaPanel from "@/components/ujian/PesanPesertaPanel";
import { saranSkor, sorotJawaban } from "@/lib/saran-skor";
import { teksTambahanWaktu, judulTambahanWaktu } from "@/lib/durasi-teks";
import { CONTOH_VARIABEL, butirBerparameter, isiButirParameter } from "@/lib/soal-parameter";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { useToast } from "@/components/shared/ToastProvider";
import SoalEditor, { BUTIR_KOSONG, type ButirForm } from "@/components/ujian/SoalEditor";
import SoalTampil from "@/components/ujian/SoalTampil";
import { labelTipe, type Opsi, type Kunci, type Jawaban } from "@/lib/soal";
import Select from "@/components/admin/Select";
import type { KegiatanRingkas } from "@/lib/kegiatan-ujian";
import AksiPesertaUjian, { LABEL_STATUS_PESERTA, GAYA_STATUS_PESERTA, type StatusPeserta } from "@/components/ujian/AksiPesertaUjian";
import { salinTeks } from "@/lib/salin-teks";
import { useTokenLangsung } from "@/lib/use-token-langsung";
import { usePantauLangsung } from "@/lib/use-pantau-langsung";
import TurunanUjianPanel from "@/components/ujian/TurunanUjianPanel";
import TombolKembali from "@/components/shared/TombolKembali";

interface SoalUjian extends ButirForm { id?: string; stimulus?: { id: string; judul: string; konten: string } | null }
interface BankItem { id: string; tipe: string; pertanyaan: string; opsi: Opsi[]; kunci: Kunci | null; skor: number; kd: string | null; materi?: string | null; indikator?: string | null; levelKognitif?: string | null; pembahasan: string | null; stimulusId: string | null }
interface Detail {
  id: string; title: string; description: string | null; subject: string; token: string; duration: number;
  startTime: string; endTime: string; isPublished: boolean;
  jadwalKelas?: Record<string, { mulai: string; selesai: string }> | null;
  paketDenah?: number;
  acakSoal: boolean; acakOpsi: boolean; satuSoalPerHalaman: boolean; tampilkanNilai: boolean;
  examkey: string | null; batasPindahTab: number; jumlahDikerjakan: number | null;
  kegiatan?: { id: string; nama: string; singkatan: string; token?: string | null } | null;
  kegiatanId: string | null; tokenOtomatisMenit: number; batasPutarAudio: number; izinKalkulator: boolean; izinCoretan: boolean; wajibSeb?: boolean; wajibAplikasi?: boolean;
  class: { id: string; name: string }; teacher: { user: { name: string } };
  /** Semua kelas peserta + jumlah siswa aktifnya; `bolehUbah` = pembuat/Admin/Kurikulum (bukan sekadar pengampu). */
  kelasIds: string[]; kelas: { id: string; name: string; jumlahSiswa: number }[]; bolehUbah: boolean;
  questions: (SoalUjian & { id: string; order: number; posisiKunci: number | null })[];
  attemptCount: number; jumlahSiswa: number;
}
interface BarisPantau {
  /** Alasan penahanan panitia (belum menyelesaikan administrasi) — src/lib/peserta-ditahan.ts. */
  ditahan?: string | null;
  student: { id: string; nis: string; user: { name: string }; class?: { name: string } | null };
  status: StatusPeserta;
  terjawab: number; ragu: number; total: number; pelanggaran: number; tambahanMenit: number; perangkat: boolean; alasanKunci: string | null; menunggu: number; lastSeenAt: string | null; startedAt: string | null; submittedAt: string | null; score: number | null; sisaDetik: number | null;
  paket?: string | null;
}
interface Pantau { baris: BarisPantau[]; ringkas: { belum: number; mengerjakan: number; terputus: number; selesai: number; waktuHabis: number; terkunci: number }; jumlahSoal: number; diperbarui: string; token: string; tokenOtomatisMenit: number; tokenBerganti: string | null }
interface Koreksi { daftar: { attemptId: string; student: { id: string; nis: string; user: { name: string } }; score: number | null; butir: { questionId: string; nomorAsli: number; tipe: string; pertanyaan: string; skorMaks: number; rubrik: string | null; acuan: string | null; templat?: { pertanyaan: string; acuan: string | null; rubrik: string | null } | null; jawaban: Jawaban; skor: number | null }[] }[]; jumlahButirManual: number }
interface HasilKemiripan {
  pasangan: { a: { nama: string; nis: string; kelas: string | null }; b: { nama: string; nis: string; kelas: string | null };
    bersama: number; salahBersama: number; salahSama: number; indeks: number; nomor: number[];
    posisi: { jenis: string; ruang: string; sesi: number; kursiA: number; kursiB: number } | null; korelasiWaktu: number | null; risiko: number }[];
  diperiksa: number; butirDibandingkan: number; adaDenah: boolean; ambang: { salahSamaMin: number; indeksMin: number };
  cepat: { nama: string; nis: string; kelas: string | null; durasiMenit: number; medianMenit: number; detikPerSoal: number | null; nilai: number | null; alasan: string }[];
}
const LABEL_POSISI_DUDUK: Record<string, string> = { BERSEBELAHAN: "Bersebelahan", DEPAN_BELAKANG: "Depan-belakang", DIAGONAL: "Diagonal", SERUANG: "Satu ruang" };
interface Hasil {
  exam: { title: string; kelas?: string };
  statistik: { peserta: number; selesai: number; rerata: number | null; tertinggi: number | null; terendah: number | null; menungguKoreksi: number };
  analisis: { questionId: string; nomor: number; tipe: string; kd: string | null; skor: number; kunci: string; peserta: number; benar: number; kesukaran: number | null; kategoriKesukaran: string; dayaBeda: number | null; kategoriDayaBeda: string;
    sebaran: { kode: string; teks: string; benar: boolean; dipilih: number; persen: number; berfungsi: boolean | null }[]; kosong: number; pengecohMati: number;
    rataWaktu: number | null; rataUbah: number | null; perluRevisi?: boolean; alasanRevisi?: string[] }[];
  rekap: { student: { nis: string; user: { name: string }; class?: { name: string } | null }; score: number | null; submittedAt: string | null; pelanggaran: number; menunggu: number }[];
}

const TABS = ["susun", "pantau", "koreksi", "hasil"] as const;
type Tab = typeof TABS[number];
const TAB_LABEL: Record<Tab, string> = { susun: "Soal & Pengaturan", pantau: "Papan Pantau", koreksi: "Koreksi Uraian", hasil: "Hasil & Analisis" };
const TAB_ICON: Record<Tab, React.ElementType> = { susun: Settings2, pantau: Radio, koreksi: ClipboardCheck, hasil: BarChart3 };

const toDate = (d: Date) => d.toLocaleDateString("sv-SE");
const toTime = (d: Date) => d.toTimeString().slice(0, 5);
const teksPolos = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const fmtJam = (d: string | null) => d ? new Date(d).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-";
const fmtSisa = (s: number | null) => s === null ? "-" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Pegangan guru saat mengoreksi uraian: JAWABAN ACUAN + PEDOMAN PENSKORAN (21 September 2026). Dulu hanya satu baris
 * "Rubrik:" abu-abu kecil yang mudah terlewat. Isinya dari kolom Kunci Jawaban & Pedoman Penskoran Excel / penyunting soal. */
function PeganganKoreksi({ acuan, rubrik, className = "" }: { acuan: string | null; rubrik: string | null; className?: string }) {
  if (!acuan?.trim() && !rubrik?.trim()) {
    return <p className={`text-xs text-gray-400 ${className}`}>Belum ada jawaban acuan & pedoman penskoran — isi lewat penyunting soal atau kolom Excel.</p>;
  }
  return (
    <div className={`grid gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm sm:grid-cols-2 ${className}`}>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-blue-800">Jawaban acuan</p>
        {/\$/.test(acuan ?? "") ? <TeksRumus teks={acuan!.trim()} className="text-blue-700" /> : <p className="whitespace-pre-wrap text-blue-700">{acuan?.trim() || "—"}</p>}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-blue-800">Pedoman penskoran</p>
        {/\$/.test(rubrik ?? "") ? <TeksRumus teks={rubrik!.trim()} className="text-blue-700" /> : <p className="whitespace-pre-wrap text-blue-700">{rubrik?.trim() || "—"}</p>}
      </div>
    </div>
  );
}

export default function UjianBuilderManager({ basePath }: { basePath: string }) {
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";
  const router = useRouter();
  const searchParams = useSearchParams();
  const confirmDialog = useConfirm();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>((searchParams.get("tab") as Tab) || "susun");
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const bolehUbahUjian = !!detail?.bolehUbah;
  const [bank, setBank] = useState<BankItem[]>([]);
  const [stimulus, setStimulus] = useState<{ id: string; judul: string }[]>([]);
  const [bankBuka, setBankBuka] = useState(false);
  const [editBuka, setEditBuka] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editButir, setEditButir] = useState<ButirForm>(BUTIR_KOSONG);
  const [pratinjauIdx, setPratinjauIdx] = useState<number | null>(null);

  // pengaturan
  const now = new Date();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("60");
  const [startDate, setStartDate] = useState(toDate(now));
  const [startTimeStr, setStartTimeStr] = useState(toTime(now));
  const [endDate, setEndDate] = useState(toDate(now));
  const [endTimeStr, setEndTimeStr] = useState(toTime(new Date(now.getTime() + 3 * 3600000)));
  // Jam per kelas (21 September 2026): satu ujian, tiap kelas di jam berbeda — kegiatan per kelas seperti STS.
  const [jamPerKelas, setJamPerKelas] = useState(false);
  const [jadwalKelas, setJadwalKelas] = useState<Record<string, { tanggal: string; mulai: string; selesai: string }>>({});
  const [acakSoal, setAcakSoal] = useState(true);
  const [acakOpsi, setAcakOpsi] = useState(true);
  const [paketDenah, setPaketDenah] = useState("0");
  const [satuSoal, setSatuSoal] = useState(true);
  const [tampilkanNilai, setTampilkanNilai] = useState(false);
  const [examkey, setExamkey] = useState("");
  const [wajibSeb, setWajibSeb] = useState(false);
  const [wajibAplikasi, setWajibAplikasi] = useState(false);
  const [batasTab, setBatasTab] = useState("0");
  const [jumlahDikerjakan, setJumlahDikerjakan] = useState("");
  const [kegiatanId, setKegiatanId] = useState("");
  const [tokenOtomatis, setTokenOtomatis] = useState("0");
  const [batasAudio, setBatasAudio] = useState("0");
  const [izinKalkulator, setIzinKalkulator] = useState(false);
  const [izinCoretan, setIzinCoretan] = useState(true);
  const [daftarKegiatan, setDaftarKegiatan] = useState<KegiatanRingkas[]>([]);
  /** Kegiatan terpilih BILA ia memakai token bersama — token itulah yang dibacakan ke peserta. */
  const tokenKegiatan = daftarKegiatan.find(k => k.id === kegiatanId && k.token) ?? null;
  // edit soal live (ujian sudah dikerjakan peserta)
  const [tambahLive, setTambahLive] = useState(false);
  const [menyimpanTambah, setMenyimpanTambah] = useState(false);
  const [liveIdx, setLiveIdx] = useState<number | null>(null);
  const [liveButir, setLiveButir] = useState<ButirForm>(BUTIR_KOSONG);
  const [liveSimpan, setLiveSimpan] = useState(false);
  const [liveError, setLiveError] = useState("");
  const [bankLiveBuka, setBankLiveBuka] = useState(false);
  const [questions, setQuestions] = useState<SoalUjian[]>([]);

  // pantau / koreksi / hasil
  const [koreksi, setKoreksi] = useState<Koreksi | null>(null);
  /** Saringan papan pantau: kelas (hanya bila ujian diikuti >1 kelas) & kata cari nama/NIS.
   *  Permintaan user 20 September 2026 — satu ujian bisa diikuti puluhan siswa dari beberapa kelas,
   *  dan pengawas biasanya hanya mengurus satu ruang. */
  const [pantauKelas, setPantauKelas] = useState("");
  const [pantauCari, setPantauCari] = useState("");
  /** Cari siswa di Koreksi Uraian (mode per siswa) dan di Rekap Nilai — daftar yang sama panjangnya. */
  const [koreksiCari, setKoreksiCari] = useState("");
  const [rekapCari, setRekapCari] = useState("");

  /** Pasangan pengerjaan yang pola salahnya mirip — untuk diperiksa pengawas, bukan tuduhan. */
  const [kemiripan, setKemiripan] = useState<HasilKemiripan | null>(null);
  const [muatKemiripan, setMuatKemiripan] = useState(false);

  /** Cara mengoreksi uraian: "soal" (dianjurkan — satu pertanyaan untuk semua siswa, standar
   *  penilaian konsisten) atau "siswa" (semua uraian satu anak). Permintaan user 20 Sep 2026. */
  const [modeKoreksi, setModeKoreksi] = useState<"soal" | "siswa">("soal");
  // Koreksi Per Soal = akordeon (permintaan user 22 Sep 2026): semua soal tertutup; membuka satu soal menutup yang lain.
  const [soalTerbuka, setSoalTerbuka] = useState<string | null>(null);
  const [hasil, setHasil] = useState<Hasil | null>(null);
  // Simpan soal ujian ke bank soal (17 Sep 2026) — dari tab Hasil, per soal atau semua yang layak.
  const [menyimpanBank, setMenyimpanBank] = useState(false);
  async function simpanKeBank(questionIds: string[]) {
    if (!questionIds.length) { toast.warning("Tidak ada soal layak untuk disimpan."); return; }
    setMenyimpanBank(true);
    const r = await fetch(`/api/teacher/exams/${id}/ke-bank`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionIds }),
    }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setMenyimpanBank(false);
    if (!r?.ok) { toast.error(d?.error ?? "Gagal menyimpan ke bank soal."); return; }
    toast.success(`${d.disimpan} soal masuk bank soal${d.dilewati ? ` · ${d.dilewati} sudah ada sebelumnya` : ""}.`);
  }
  const [skorDraft, setSkorDraft] = useState<Record<string, string>>({});
  const excelRef = useRef<HTMLInputElement>(null);
  const [imporExcel, setImporExcel] = useState(false);
  // kelas peserta — satu ujian boleh diikuti banyak kelas (mis. PJOK seluruh kelas X)
  const [kelasIds, setKelasIds] = useState<string[]>([]);
  const [opsiKelas, setOpsiKelas] = useState<OpsiKelasPeserta[]>([]);

  // Mapel & kelas TIDAK LAGI wajib dipilih di halaman sebelumnya (permintaan user 20 September
  // 2026) — keduanya ditanyakan DI DALAM formulir ini. Parameter URL tetap dihormati supaya
  // tautan lama dari Daftar Ujian masih bekerja.
  const [mapelPilihan, setMapelPilihan] = useState("");
  const [mapelSaya, setMapelSaya] = useState<string[]>([]);
  const subject = searchParams.get("subject") ?? detail?.subject ?? mapelPilihan;
  // Tanpa classId di URL, kelas utama diambil dari kelas peserta pertama yang dipilih guru.
  const classId = searchParams.get("classId") ?? detail?.class.id ?? kelasIds[0] ?? "";
  const terkunci = !isNew && (detail?.attemptCount ?? 0) > 0;
  /** Token yang DIBACAKAN ke peserta: token bersama kegiatan bila ada, selain itu token ujian ini.
   *  Harus sama persis dengan yang tampil di Ruang Kendali (lihat src/lib/pantau-ujian.ts). */
  const tokenLangsung = useTokenLangsung(!isNew && detail?.id ? [detail.id] : []);
  // Diperbarui berkala lewat useTokenLangsung — dulu diambil sekali saat halaman dibuka, jadi setelah token berjangka
  // berganti, kepala halaman tetap menampilkan token lama sampai dimuat ulang (temuan user 21 Sep 2026).
  const tokenTerkini = tokenLangsung[detail?.id ?? ""];
  const tokenTampil = tokenTerkini?.token ?? detail?.kegiatan?.token ?? detail?.token ?? "";
  const tokenBersama = tokenTerkini ? tokenTerkini.tokenBersama : !!detail?.kegiatan?.token;

  /** Jawaban uraian dikelompokkan PER SOAL (dibalik dari bentuk API yang per siswa). */
  const perSoal = useMemo(() => {
    const peta = new Map<string, {
      questionId: string; nomorAsli: number; tipe: string; pertanyaan: string; skorMaks: number; rubrik: string | null; acuan: string | null;
      berparameter: boolean;
      jawaban: { attemptId: string; nama: string; nis: string; jawaban: Jawaban; skor: number | null; acuan: string | null; rubrik: string | null; pertanyaan: string }[];
    }>();
    for (const s of koreksi?.daftar ?? []) {
      for (const b of s.butir) {
        const ada = peta.get(b.questionId) ?? {
          questionId: b.questionId, nomorAsli: b.nomorAsli, tipe: b.tipe,
          // Soal berparameter: kepala soal memakai TEMPLAT; acuan versi tiap siswa dibawa per jawaban.
          pertanyaan: b.templat?.pertanyaan ?? b.pertanyaan, skorMaks: b.skorMaks,
          rubrik: b.templat ? b.templat.rubrik : b.rubrik, acuan: b.templat ? b.templat.acuan : (b.acuan ?? null),
          berparameter: !!b.templat, jawaban: [],
        };
        ada.jawaban.push({ attemptId: s.attemptId, nama: s.student.user.name, nis: s.student.nis, jawaban: b.jawaban, skor: b.skor, acuan: b.acuan ?? null, rubrik: b.rubrik, pertanyaan: b.pertanyaan });
        peta.set(b.questionId, ada);
      }
    }
    return [...peta.values()].sort((a, b) => a.nomorAsli - b.nomorAsli);
  }, [koreksi]);

  const sisaKoreksi = useMemo(
    () => (koreksi?.daftar ?? []).reduce((n, s) => n + s.butir.filter(b => b.skor === null).length, 0),
    [koreksi],
  );

  /** Kotak jawaban + isian skor — dipakai kedua cara koreksi supaya perilakunya persis sama. */
  const kotakJawaban = (attemptId: string, b: {
    questionId: string; tipe: string; skorMaks: number; jawaban: Jawaban; skor: number | null;
    acuan?: string | null; rubrik?: string | null; pertanyaan?: string;
  }) => {
    const k = `${attemptId}:${b.questionId}`;
    // SARAN SKOR (21 September 2026): kecocokan kata dengan jawaban acuan — hanya saran, guru yang menyimpan.
    const saran = b.tipe === "URAIAN" ? saranSkor({ jawaban: b.jawaban, acuan: b.acuan, rubrik: b.rubrik, pertanyaan: b.pertanyaan, skorMaks: b.skorMaks }) : null;
    return (
      <>
        <div className="rounded-lg bg-gray-50 p-3 text-sm whitespace-pre-wrap">
          {b.tipe === "LISAN" && typeof b.jawaban === "string" && b.jawaban
            ? <audio controls preload="none" src={b.jawaban} className="w-full" />
            : b.tipe === "UNGGAH" && typeof b.jawaban === "string" && b.jawaban
            ? <a href={b.jawaban} target="_blank" rel="noreferrer" className="text-primary-700 underline">Buka berkas jawaban</a>
            : typeof b.jawaban === "string" && b.jawaban
              ? (saran ? sorotJawaban(b.jawaban, saran.cocok).map((x, i) => x.kena ? <mark key={i} className="rounded bg-emerald-100 px-0.5 text-emerald-900">{x.teks}</mark> : <span key={i}>{x.teks}</span>) : b.jawaban)
              : <span className="text-gray-400">(tidak dijawab)</span>}
        </div>
        {/* Jawaban berisi rumus (Palet Rumus siswa, 22 Sep 2026) → tampilkan juga sebagai rumus. */}
        {b.tipe !== "UNGGAH" && b.tipe !== "LISAN" && typeof b.jawaban === "string" && /\$/.test(b.jawaban) && (
          <div className="mt-1 rounded-lg border border-gray-100 bg-white p-3">
            <p className="label-kecil mb-1">Tampilan rumus</p>
            <TeksRumus teks={b.jawaban} className="text-sm text-gray-800" />
          </div>
        )}
        {saran && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="font-semibold text-emerald-800">Saran: {saran.skor} / {b.skorMaks} ({saran.persen}%)</span>
            <span className="flex flex-wrap gap-1">
              {saran.poin.map((p, i) => (
                <span key={i} title={p.teks}
                  className={`rounded-full border px-1.5 ${p.cakupan >= 0.75 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : p.cakupan > 0 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-gray-200 bg-white text-gray-400"}`}>
                  poin {i + 1}: {Math.round(p.cakupan * 100)}%
                </span>
              ))}
            </span>
            <button type="button" onClick={() => setSkorDraft(p => ({ ...p, [k]: String(saran.skor) }))}
              className="font-semibold text-primary-700 hover:underline">Pakai saran</button>
          </div>
        )}
        <div className="flex items-center gap-2 mt-2">
          <input type="number" min={0} max={b.skorMaks} step={0.5} value={skorDraft[k] ?? (b.skor ?? "")}
            onChange={e => setSkorDraft(p => ({ ...p, [k]: e.target.value }))} className="input-field w-24 py-1.5" placeholder="skor" />
          <span className="text-xs text-gray-400">/ {b.skorMaks}</span>
          <button onClick={() => simpanSkor(attemptId, b.questionId)} className="btn-modal-save text-xs py-1.5">Simpan</button>
          {b.skor !== null && <CheckCircle2 size={14} className="text-emerald-600" />}
        </div>
      </>
    );
  };
  const multiKelas = (detail?.kelasIds?.length ?? kelasIds.length) > 1;

  /** Naskah hasil impor Word/Excel yang dititipkan halaman Daftar Ujian (sessionStorage) —
   *  langsung menjadi soal ujian baru tanpa harus lewat bank soal dulu. Dibaca sekali lalu
   *  dihapus supaya tidak terpakai ulang saat membuat ujian berikutnya. */
  useEffect(() => {
    if (!isNew) return;
    let titipan: string | null = null;
    try { titipan = sessionStorage.getItem("impor-ujian"); sessionStorage.removeItem("impor-ujian"); } catch { return; }
    if (!titipan) return;
    try {
      const d = JSON.parse(titipan) as { subject?: string; judul?: string; butir?: SoalUjian[] };
      // Ditunda satu microtask supaya tidak menyetel state serentak di dalam efek.
      queueMicrotask(() => {
      if (Array.isArray(d.butir) && d.butir.length) {
        setQuestions(d.butir.map(b => ({
          ...b, opsi: b.opsi ?? [], kunci: b.kunci ?? null, skor: b.skor ?? 1,
          kd: b.kd ?? "", materi: b.materi ?? "", indikator: b.indikator ?? "", levelKognitif: b.levelKognitif ?? "",
          pembahasan: b.pembahasan ?? "", stimulusId: b.stimulusId ?? null, posisiKunci: null,
        })));
      }
      if (d.subject) setMapelPilihan(v => v || d.subject!);
      if (d.judul) setTitle(v => v || d.judul!);
      });
    } catch { /* titipan rusak — abaikan, guru tetap bisa menyusun manual */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew]);

  // Daftar mapel yang diampu — dipakai pemilih di dalam formulir bila belum ditentukan dari URL.
  useEffect(() => {
    if (!isNew || searchParams.get("subject")) return;
    fetch("/api/teacher/journal-classes").then(r => r.json())
      .then((d: { subjectName: string }[]) => {
        const daftar = [...new Set((Array.isArray(d) ? d : []).map(x => x.subjectName))].sort();
        setMapelSaya(daftar);
        if (daftar.length === 1) setMapelPilihan(v => v || daftar[0]);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew]);

  useEffect(() => {
    if (isNew && classId) setKelasIds(k => (k.length ? k : [classId]));
  }, [isNew, classId]);
  useEffect(() => {
    if (!subject) return;
    // Penugasan Mengajar mapel ini: guru = kelas yang ia ampu; Admin/TAS = semua kelas + nama guru.
    fetch("/api/teacher/journal-classes").then(r => r.json())
      .then((d: (OpsiKelasPeserta & { subjectName: string })[]) => setOpsiKelas(Array.isArray(d) ? d.filter(k => k.subjectName === subject) : []))
      .catch(() => {});
  }, [subject]);

  /* ------------------------------ muat ------------------------------ */
  useEffect(() => {
    if (!subject) return;
    fetch(`/api/teacher/exam-bank?subject=${encodeURIComponent(subject)}`).then(r => r.json()).then(d => setBank(Array.isArray(d) ? d : [])).catch(() => {});
    fetch("/api/teacher/exam-stimulus").then(r => r.json()).then(d => setStimulus(Array.isArray(d) ? d : [])).catch(() => {});
  }, [subject]);

  useEffect(() => {
    fetch("/api/teacher/kegiatan-ujian").then(r => r.json()).then(d => {
      const daftar: KegiatanRingkas[] = Array.isArray(d?.daftar) ? d.daftar : [];
      setDaftarKegiatan(daftar);
      // Ujian baru: pilih otomatis kegiatan aktif yang sedang/akan berlangsung paling dekat.
      if (isNew) {
        const hariIni = new Date().toLocaleDateString("sv-SE");
        const aktif = daftar.filter(k => k.aktif);
        const pas = aktif.find(k => k.tanggalMulai && k.tanggalSelesai && hariIni <= k.tanggalSelesai)
          ?? (aktif.length === 1 ? aktif[0] : undefined);
        if (pas) {
          setKegiatanId(v => v || pas.id);
          // Judul ikut terisi nama kegiatan yang sedang aktif (permintaan user 20 September 2026:
          // "saat buat ujian baru langsung muncul saja ujian yang sedang aktif apa"). Hanya kalau
          // judulnya masih kosong — ketikan guru tidak pernah ditimpa.
          setTitle(v => v || pas.nama);
        }
      }
    }).catch(() => {});
    if (isNew) {
      // Nilai bawaan dari Pengaturan Ujian — hanya untuk ujian BARU, ujian lama tidak disentuh.
      fetch("/api/teacher/pengaturan-ujian").then(r => r.json()).then(a => {
        if (a?.error) return;
        if (a["ujian.durasiBawaan"]) setDuration(a["ujian.durasiBawaan"]);
        if (a["ujian.batasPindahTab"] !== undefined) setBatasTab(a["ujian.batasPindahTab"]);
        setAcakSoal(a["ujian.acakSoal"] !== "0"); setAcakOpsi(a["ujian.acakOpsi"] !== "0");
        setSatuSoal(a["ujian.satuSoalPerHalaman"] !== "0"); setTampilkanNilai(a["ujian.tampilkanNilai"] === "1");
        if (a["ujian.tokenOtomatisMenit"] !== undefined) setTokenOtomatis(a["ujian.tokenOtomatisMenit"]);
        if (a["ujian.batasPutarAudio"] !== undefined) setBatasAudio(a["ujian.batasPutarAudio"]);
        setIzinKalkulator(a["ujian.izinKalkulator"] === "1"); setIzinCoretan(a["ujian.izinCoretan"] !== "0");
      }).catch(() => {});
    }
  }, [isNew]);

  const muatDetail = useCallback(async () => {
    const r = await fetch(`/api/teacher/exams/${id}`);
    if (!r.ok) { setError("Ujian tidak ditemukan"); setLoading(false); return; }
    const d: Detail = await r.json();
    setDetail(d);
    setTitle(d.title); setKelasIds(d.kelasIds?.length ? d.kelasIds : [d.class.id]); setDescription(d.description ?? ""); setDuration(String(d.duration));
    const st = new Date(d.startTime), et = new Date(d.endTime);
    setStartDate(toDate(st)); setStartTimeStr(toTime(st)); setEndDate(toDate(et)); setEndTimeStr(toTime(et));
    const jk = d.jadwalKelas && typeof d.jadwalKelas === "object" ? d.jadwalKelas : {};
    setJamPerKelas(Object.keys(jk).length > 0);
    setJadwalKelas(Object.fromEntries(Object.entries(jk).map(([k, v]) => [k, { tanggal: toDate(new Date(v.mulai)), mulai: toTime(new Date(v.mulai)), selesai: toTime(new Date(v.selesai)) }])));
    setAcakSoal(d.acakSoal); setAcakOpsi(d.acakOpsi); setPaketDenah(String(d.paketDenah ?? 0)); setSatuSoal(d.satuSoalPerHalaman); setTampilkanNilai(d.tampilkanNilai);
    setKegiatanId(d.kegiatanId ?? ""); setTokenOtomatis(String(d.tokenOtomatisMenit ?? 0)); setBatasAudio(String(d.batasPutarAudio ?? 0));
    setIzinKalkulator(!!d.izinKalkulator); setIzinCoretan(d.izinCoretan !== false);
    setExamkey(d.examkey ?? ""); setWajibSeb(!!d.wajibSeb); setWajibAplikasi(!!d.wajibAplikasi); setBatasTab(String(d.batasPindahTab)); setJumlahDikerjakan(d.jumlahDikerjakan ? String(d.jumlahDikerjakan) : "");
    setQuestions(d.questions.map(q => ({ ...q, kd: q.kd ?? "", materi: q.materi ?? "", indikator: q.indikator ?? "", levelKognitif: q.levelKognitif ?? "", pembahasan: q.pembahasan ?? "", opsi: q.opsi ?? [], kunci: q.kunci ?? null })));
    setLoading(false);
  }, [id]);
  useEffect(() => { if (!isNew) muatDetail().catch(() => { setError("Gagal memuat ujian"); setLoading(false); }); }, [isNew, muatDetail]);

  // Papan pantau langsung (SSE) selama tab Pantau terbuka; otomatis kembali ke polling 5 detik bila perlu.
  const pantauLangsung = usePantauLangsung<Pantau>(isNew || !id ? null : id, tab === "pantau");
  const pantau = pantauLangsung.data;

  const kelasPantau = useMemo(
    () => [...new Set((pantau?.baris ?? []).map(b => b.student.class?.name).filter((x): x is string => !!x))].sort(),
    [pantau],
  );
  const barisPantau = useMemo(() => {
    const q = pantauCari.trim().toLowerCase();
    return (pantau?.baris ?? []).filter(b =>
      (!pantauKelas || b.student.class?.name === pantauKelas)
      && (!q || b.student.user.name.toLowerCase().includes(q) || b.student.nis.toLowerCase().includes(q)));
  }, [pantau, pantauKelas, pantauCari]);

  const muatPantau = pantauLangsung.muatUlang;
  const muatKoreksi = useCallback(() => {
    if (isNew) return;
    fetch(`/api/teacher/exams/${id}/koreksi`).then(r => (r.ok ? r.json() : null)).then(d => d && setKoreksi(d)).catch(() => {});
  }, [id, isNew]);
  const muatHasil = useCallback(() => {
    if (isNew) return;
    fetch(`/api/teacher/exams/${id}/hasil`).then(r => (r.ok ? r.json() : null)).then(d => d && setHasil(d)).catch(() => {});
  }, [id, isNew]);

  useEffect(() => {
    if (tab === "koreksi") muatKoreksi();
    if (tab === "hasil") muatHasil();
  }, [tab, muatKoreksi, muatHasil]);

  /* ------------------------------ soal ------------------------------ */
  function tambahDariBank(b: BankItem) {
    setQuestions(qs => [...qs, { tipe: b.tipe, pertanyaan: b.pertanyaan, opsi: b.opsi ?? [], kunci: b.kunci, skor: b.skor, kd: b.kd ?? "", materi: b.materi ?? "", indikator: b.indikator ?? "", levelKognitif: b.levelKognitif ?? "", pembahasan: b.pembahasan ?? "", stimulusId: b.stimulusId, posisiKunci: null }]);
    toast.success("Soal ditambahkan");
  }
  function bukaEdit(i: number | null, live = false) {
    setTambahLive(live);
    setEditIdx(i);
    setEditButir(i === null ? BUTIR_KOSONG : questions[i]);
    setEditBuka(true);
  }
  /** TAMBAH SOAL SAAT UJIAN BERJALAN (23 September 2026): soal diletakkan di UJUNG naskah dan disambungkan ke
   *  pengerjaan yang masih jalan (server: /tambah-soal). Yang sudah mengumpulkan tidak terpengaruh nilainya. */
  async function simpanTambahLive() {
    setMenyimpanTambah(true);
    try {
      const r = await fetch(`/api/teacher/exams/${id}/tambah-soal`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questions: [editButir] }),
      });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error ?? "Gagal menambah soal."); return; }
      toast.success(`Soal nomor ${d.nomorMulai} ditambahkan · ${d.pengerjaanDiperbarui} peserta yang sedang mengerjakan ikut menerimanya`);
      setEditBuka(false); setEditIdx(null); setEditButir(BUTIR_KOSONG); setTambahLive(false);
      await muatDetail();
    } catch { toast.error("Koneksi bermasalah."); }
    finally { setMenyimpanTambah(false); }
  }
  function simpanEdit() {
    if (tambahLive) { simpanTambahLive(); return; }
    if (editIdx === null) setQuestions(qs => [...qs, { ...editButir }]);
    else setQuestions(qs => qs.map((q, k) => (k === editIdx ? { ...q, ...editButir } : q)));
    setEditBuka(false); setEditIdx(null); setEditButir(BUTIR_KOSONG);
  }
  function bukaLive(i: number) {
    setLiveIdx(i); setLiveButir(questions[i]); setLiveError("");
  }
  /** Isi soal diganti dari BANK SOAL saat ujian berjalan — guru tidak perlu mengetik ulang.
   *  Hanya butir dengan JENIS SAMA yang ditawarkan, dan untuk pilihan ganda JUMLAH PILIHANNYA
   *  harus sama: jawaban peserta terikat pada kode pilihan (A, B, C…), jadi jumlah yang berbeda
   *  akan ditolak server. Batasan itu memang yang melindungi pekerjaan peserta. */
  const bankUntukLive = useMemo(() => {
    if (liveIdx === null) return [];
    const q = questions[liveIdx];
    if (!q) return [];
    return bank.filter(b => b.tipe === q.tipe && (b.opsi?.length ?? 0) === (q.opsi?.length ?? 0));
  }, [liveIdx, questions, bank]);

  function ambilBankKeLive(b: BankItem) {
    setLiveButir(p => ({
      ...p, pertanyaan: b.pertanyaan, opsi: b.opsi ?? p.opsi, kunci: b.kunci ?? p.kunci,
      kd: b.kd ?? p.kd, pembahasan: b.pembahasan ?? "",
    }));
    setBankLiveBuka(false);
  }

  /** Batalkan penilaian satu soal saat ujian berjalan — soal tetap ada (urutan & jawaban peserta
   *  tidak boleh bergeser), tetapi tidak dihitung; nilai semua peserta diperbarui. */
  async function batalkanSoalLive() {
    if (liveIdx === null) return;
    const q = questions[liveIdx];
    if (!q?.id) return;
    if (!(await confirmDialog(
      `Batalkan penilaian soal nomor ${liveIdx + 1}? Soal tetap terlihat peserta, tetapi TIDAK dihitung — nilai semua peserta langsung diperbarui. Cocok untuk soal yang ternyata cacat atau salah kunci.`,
    ))) return;
    setLiveSimpan(true); setLiveError("");
    const r = await fetch(`/api/teacher/exams/${id}/soal-live`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aksi: "batalkan", questionId: q.id }),
    }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setLiveSimpan(false);
    if (!r?.ok) { setLiveError(d?.error ?? "Gagal membatalkan soal."); return; }
    toast.success(d?.pesan ?? "Soal dibatalkan.");
    setLiveIdx(null);
    muatDetail();
  }

  async function simpanLive() {
    if (liveIdx === null) return;
    const q = questions[liveIdx];
    if (!q.id) return;
    setLiveSimpan(true); setLiveError("");
    try {
      const r = await fetch(`/api/teacher/exams/${id}/soal-live`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: q.id, pertanyaan: liveButir.pertanyaan, opsi: liveButir.opsi, kunci: liveButir.kunci, skor: liveButir.skor, kd: liveButir.kd, pembahasan: liveButir.pembahasan }),
      });
      const d = await r.json();
      if (!r.ok) { setLiveError(d.error ?? "Gagal memperbaiki soal."); return; }
      toast.success(d.pesan ?? "Soal diperbaiki");
      setLiveIdx(null);
      muatDetail();
    } catch { setLiveError("Koneksi bermasalah, coba lagi."); }
    finally { setLiveSimpan(false); }
  }

  const geser = (i: number, arah: -1 | 1) => setQuestions(qs => {
    const j = i + arah; if (j < 0 || j >= qs.length) return qs;
    const a = [...qs]; [a[i], a[j]] = [a[j], a[i]]; return a;
  });

  /* ------------------------------ simpan ------------------------------ */
  async function handleSave(lalu?: "terbit") {
    if (!title.trim()) return setError("Judul ujian wajib diisi.");
    if (!questions.length && !terkunci) return setError("Minimal 1 soal.");
    const pakaiJamKelas = jamPerKelas && kelasIds.length > 1;
    if (pakaiJamKelas) {
      for (const k of kelasIds) {
        const j = jadwalKelas[k];
        if (!j?.tanggal || !j.mulai || !j.selesai) return setError("Jam tiap kelas belum lengkap.");
        if (j.mulai >= j.selesai) return setError("Jam mulai tiap kelas harus sebelum jam selesainya.");
      }
    }
    setError(""); setSaving(true);
    const body = {
      jadwalKelas: pakaiJamKelas ? Object.fromEntries(kelasIds.map(k => [k, {
        mulai: new Date(`${jadwalKelas[k].tanggal}T${jadwalKelas[k].mulai}:00`).toISOString(),
        selesai: new Date(`${jadwalKelas[k].tanggal}T${jadwalKelas[k].selesai}:00`).toISOString(),
      }])) : {},
      classId, kelasIds: kelasIds.length ? kelasIds : [classId], subject, title, description, duration: Number(duration),
      startTime: new Date(`${startDate}T${startTimeStr}:00`).toISOString(), endTime: new Date(`${endDate}T${endTimeStr}:00`).toISOString(),
      acakSoal, acakOpsi, paketDenah: Number(paketDenah) || 0, satuSoalPerHalaman: satuSoal, tampilkanNilai, examkey: examkey || null, wajibSeb, wajibAplikasi, kegiatanId: kegiatanId || null,
      tokenOtomatisMenit: Number(tokenOtomatis) || 0, batasPutarAudio: Number(batasAudio) || 0, izinKalkulator, izinCoretan,
      batasPindahTab: Number(batasTab) || 0, jumlahDikerjakan: jumlahDikerjakan ? Number(jumlahDikerjakan) : null,
      ...(terkunci ? {} : { questions }),
    };
    try {
      const res = await fetch(isNew ? "/api/teacher/exams" : `/api/teacher/exams/${id}`, {
        method: isNew ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || "Gagal menyimpan"); return; }
      toast.success("Ujian tersimpan");
      if (lalu === "terbit") await fetch(`/api/teacher/exams/${d.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isPublished: true }) });
      if (isNew) { router.push(`${basePath}/${d.id}`); router.refresh(); } else muatDetail();
    } catch { setError("Koneksi bermasalah, coba lagi."); }
    finally { setSaving(false); }
  }
  async function toggleTerbit() {
    if (!detail) return;
    const res = await fetch(`/api/teacher/exams/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isPublished: !detail.isPublished }) });
    if (res.ok) { setDetail(d => (d ? { ...d, isPublished: !d.isPublished } : d)); toast.success(!detail.isPublished ? "Ujian diterbitkan - token bisa dibagikan" : "Ujian ditarik dari siswa"); }
  }
  async function hapusUjian() {
    if (!(await confirmDialog("Hapus ujian ini beserta semua hasil pengerjaan siswa?"))) return;
    await fetch(`/api/teacher/exams/${id}`, { method: "DELETE" });
    router.push(basePath);
  }
  async function unggahExcel(file: File) {
    setImporExcel(true);
    const fd = new FormData(); fd.append("excel", file);
    const r = await fetch(`/api/teacher/exams/${id}/impor-excel`, { method: "POST", body: fd }).catch(() => null);
    setImporExcel(false);
    const d = await r?.json().catch(() => null);
    if (!r?.ok) return toast.error(d?.error ?? "Gagal menerapkan Excel.");
    toast.success(`${d.cocok}/${d.total} soal diterapkan kuncinya${d.laporan?.length ? `, ${d.laporan.length} catatan` : ""}.`);
    if (d.laporan?.length) toast.warning(d.laporan.slice(0, 3).join(" · "));
    muatDetail();
  }
  const [simpanSemuaSibuk, setSimpanSemuaSibuk] = useState(false);

  /** Simpan SELURUH skor yang sudah diketik sekaligus (permintaan user 21 September 2026 —
   *  menekan Simpan tiap butir terlalu lama untuk ratusan jawaban). Yang dikirim hanya butir yang
   *  BERUBAH dari nilai tersimpan, jadi menekan tombol ini dua kali tidak menghitung ulang percuma. */
  async function simpanSemuaSkor() {
    const tersimpan = new Map<string, number | null>();
    for (const sis of koreksi?.daftar ?? []) for (const b of sis.butir) tersimpan.set(`${sis.attemptId}:${b.questionId}`, b.skor);
    const butir = Object.entries(skorDraft)
      .filter(([k, v]) => v !== "" && Number(v) !== (tersimpan.get(k) ?? null))
      .map(([k, v]) => { const [attemptId, questionId] = k.split(":"); return { attemptId, questionId, skor: Number(v) }; });
    if (!butir.length) { toast.info("Tidak ada skor baru yang perlu disimpan."); return; }
    setSimpanSemuaSibuk(true);
    const r = await fetch(`/api/teacher/exams/${id}/koreksi`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ butir }),
    }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setSimpanSemuaSibuk(false);
    if (!r?.ok) { toast.error(d?.error ?? "Gagal menyimpan koreksi."); return; }
    toast.success(`${d.tersimpan} skor tersimpan · nilai ${d.peserta} peserta diperbarui.`);
    muatKoreksi();
  }

  async function simpanSkor(attemptId: string, questionId: string) {
    const v = skorDraft[`${attemptId}:${questionId}`];
    if (v === undefined) return;
    const r = await fetch(`/api/teacher/exams/${id}/koreksi`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ attemptId, questionId, skor: Number(v) }) }).catch(() => null);
    if (!r?.ok) return toast.error("Gagal menyimpan skor.");
    toast.success("Skor tersimpan"); muatKoreksi();
  }

  const totalSkor = useMemo(() => questions.reduce((n, q) => n + (q.tipe === "SURVEI" ? 0 : Number(q.skor) || 0), 0), [questions]);
  const salinToken = async () => {
    if (!detail) return;
    if (await salinTeks(tokenTampil)) toast.success(`Token ${tokenTampil} disalin`);
    else toast.error(`Tidak bisa menyalin otomatis. Token: ${tokenTampil}`);
  };

  if (loading) return <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<FileQuestion size={22} />} title={isNew ? "Buat Ujian Baru" : detail?.title ?? "Ujian"}
        description={detail ? `${detail.subject} · ${detail.kelas?.length ? detail.kelas.map(k => k.name).join(", ") : detail.class.name} · ${detail.teacher.user.name}` : `${subject}`} />

      {detail && !detail.bolehUbah && (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-700">
          Anda <strong>guru pengampu</strong> di ujian ini (dibuat {detail.teacher.user.name}) — bisa memantau, mengoreksi, dan melihat hasil.
          Soal & pengaturan hanya bisa diubah pembuatnya atau Admin/Kurikulum.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <TombolKembali href={basePath} />
        {detail && (
          <>
            <button onClick={salinToken}
              title={tokenBersama ? `Token bersama ${detail.kegiatan?.singkatan ?? "kegiatan"} — berlaku untuk semua mapel di kegiatan ini` : "Salin token"}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono font-bold ${tokenBersama ? "bg-gold/15 border border-gold/40 text-gold-dark" : "bg-primary-50 border border-primary-100 text-primary-700"}`}>
              <KeyRound size={14} /> {tokenTampil}
            </button>
            <button onClick={toggleTerbit} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border ${detail.isPublished ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-50 text-gray-600 border-gray-200"}`}>
              {detail.isPublished ? <Eye size={14} /> : <EyeOff size={14} />} {detail.isPublished ? "Diterbitkan" : "Draft"}
            </button>
            {terkunci && <span className="flex items-center gap-1 text-xs text-amber-700" title="Susunan soal (tambah/hapus/urutan) dikunci. Isi soal tetap bisa diperbaiki lewat tombol pensil oranye."><Lock size={12} /> susunan soal terkunci ({detail.attemptCount} siswa sudah mengerjakan) · perbaikan isi soal tetap bisa</span>}
          </>
        )}
        {!isNew && (
          <div className="ml-auto flex max-w-full gap-1 overflow-x-auto scrollbar-hide bg-white rounded-xl border border-gray-100 p-1">
            {TABS.map(t => { const Icon = TAB_ICON[t]; return (
              <button key={t} onClick={() => setTab(t)} className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-semibold ${tab === t ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}><Icon size={14} /> {TAB_LABEL[t]}</button>
            ); })}
          </div>
        )}
      </div>

      {error && <p className="error-msg mb-4">{error}</p>}

      {/* ============================ SUSUN ============================ */}
      {tab === "susun" && (
        <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-heading font-semibold text-primary-900">Soal <span className="text-gray-400 font-normal text-sm">({questions.length} butir · {totalSkor} poin)</span></h3>
              {terkunci && (
                <button onClick={() => bukaEdit(null, true)} className="btn-modal-cancel text-xs"
                  title="Soal baru diletakkan di ujung naskah dan langsung diterima peserta yang masih mengerjakan. Yang sudah mengumpulkan tidak terpengaruh.">
                  <Plus size={14} /> Tambah soal di ujung
                </button>
              )}
              {!terkunci && (
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setBankBuka(true)} className="btn-modal-cancel text-xs"><BookMarked size={14} /> Dari bank ({bank.length})</button>
                  <button onClick={() => bukaEdit(null)} className="btn-modal-cancel text-xs"><Plus size={14} /> Soal baru</button>
                  {!isNew && (
                    <>
                      <input ref={excelRef} type="file" accept=".xlsx,.xlsm,.xls" className="hidden" onChange={e => e.target.files?.[0] && unggahExcel(e.target.files[0])} />
                      <button onClick={() => excelRef.current?.click()} disabled={imporExcel || !questions.length} className="btn-modal-cancel text-xs disabled:opacity-40" title="Terapkan kunci, skor, KD, grouping & LockN dari Excel">
                        {imporExcel ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Kunci dari Excel
                      </button>
                    </>
                  )}
                  <a href={`/api/teacher/exam-bank/template?jenis=excel&mapel=${encodeURIComponent(subject)}&jumlah=${questions.length || 30}`} className="btn-modal-cancel text-xs"><Download size={14} /> Template Excel</a>
                </div>
              )}
            </div>
            {questions.length === 0 ? (
              <EmptyState icon={FileQuestion} title="Belum ada soal" description="Ambil dari bank soal atau tulis soal baru." />
            ) : (
              <div className="space-y-2">
                {questions.map((q, i) => (
                  <div key={i} className="page-card p-3 flex items-start gap-3">
                    <div className="flex flex-col items-center gap-0.5 shrink-0">
                      <span className="w-7 h-7 rounded-lg bg-primary-900 text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
                      {!terkunci && <>
                        <button onClick={() => geser(i, -1)} disabled={i === 0} className="text-gray-300 hover:text-primary-700 disabled:opacity-20"><ChevronUp size={14} /></button>
                        <button onClick={() => geser(i, 1)} disabled={i === questions.length - 1} className="text-gray-300 hover:text-primary-700 disabled:opacity-20"><ChevronDown size={14} /></button>
                      </>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1 text-xs">
                        <span className="badge badge-navy">{labelTipe(q.tipe)}</span>
                        <span className="text-gray-400">{q.skor} poin{q.kd ? ` · KD ${q.kd}` : ""}{q.posisiKunci ? ` · kunci posisi ${q.posisiKunci}` : ""}{q.stimulusId ? " · wacana" : ""}</span>
                        {(q.tipe === "PG" || q.tipe === "PG_KOMPLEKS") && !q.opsi.some(o => o.benar) && <span className="text-amber-700 flex items-center gap-1"><AlertTriangle size={11} /> kunci belum ditandai</span>}
                      </div>
                      <p className="text-sm text-primary-900 line-clamp-2">{teksPolos(q.pertanyaan) || "(soal bergambar)"}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => setPratinjauIdx(i)} title="Pratinjau" className="p-1.5 text-gray-400 hover:text-primary-700 rounded-lg"><Eye size={14} /></button>
                      {terkunci && q.id && (
                        <button onClick={() => bukaLive(i)} title="Perbaiki soal (live) — aman untuk peserta yang sedang mengerjakan" className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg"><Pencil size={14} /></button>
                      )}
                      {!terkunci && <>
                        <button onClick={() => bukaEdit(i)} title="Edit" className="p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg"><Pencil size={14} /></button>
                        <button onClick={() => setQuestions(qs => qs.filter((_, k) => k !== i))} title="Hapus" className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg"><Trash2 size={14} /></button>
                      </>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* pengaturan */}
          <div className="space-y-4">
            <div className="page-card p-4 space-y-3">
              <h3 className="font-heading font-semibold text-primary-900 text-sm">Identitas & Jadwal</h3>
              <div>
                <label className="label-field">Kegiatan ujian</label>
                <Select value={kegiatanId} placeholder="Tanpa kegiatan (ujian lepas)"
                  onChange={v => {
                    setKegiatanId(v);
                    const k = daftarKegiatan.find(x => x.id === v);
                    if (k && isNew && !title.trim()) setTitle(`${k.nama} — ${subject}`);
                  }}
                  options={[{ value: "", label: "Tanpa kegiatan (ujian lepas)" },
                    ...daftarKegiatan.filter(k => k.aktif || k.id === kegiatanId).map(k => ({ value: k.id, label: `${k.singkatan} — ${k.nama}${k.tahunAjaran ? ` ${k.tahunAjaran}` : ""}` }))]} />
                <p className="text-xs text-gray-400 mt-1">Nama kegiatan tampil di layar peserta. Daftarnya diatur di <Link href={`${basePath}/pengaturan`} className="text-primary-700 hover:underline">Pengaturan Ujian</Link>.</p>
              </div>
              {/* Mapel ditanyakan DI SINI bila tidak dibawa dari tautan — ujian baru tidak lagi
                  mensyaratkan memilih kelas & mapel di halaman Daftar Ujian lebih dulu. */}
              {isNew && !searchParams.get("subject") && mapelSaya.length > 1 && (
                <div>
                  <label className="label-field">Mata pelajaran</label>
                  <Select value={mapelPilihan} onChange={v => { setMapelPilihan(v); setKelasIds([]); }}
                    placeholder="Pilih mata pelajaran" options={mapelSaya.map(m => ({ value: m, label: m }))} />
                  <p className="text-xs text-gray-400 mt-1">Menentukan kelas mana yang bisa dipilih dan bank soal mana yang dipakai.</p>
                </div>
              )}
              <div>
                <label className="label-field">Kelas peserta</label>
                {subject ? (
                  <PilihKelasPeserta opsi={opsiKelas} terpilih={kelasIds} tambahan={detail?.kelas ?? []}
                    onChange={setKelasIds} dikunci={!!detail && !detail.bolehUbah} />
                ) : (
                  <p className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                    Pilih mata pelajaran dulu — daftar kelas menyesuaikan mapel yang Anda ampu.
                  </p>
                )}
              </div>
              <div><label className="label-field">Judul</label><input value={title} onChange={e => setTitle(e.target.value)} className="input-field w-full" placeholder="Sumatif Tengah Semester Ganjil" /></div>
              <div><label className="label-field">Petunjuk (opsional)</label><textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="input-field w-full" /></div>
              {kelasIds.length > 1 && (
                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="checkbox" checked={jamPerKelas} className="mt-0.5 w-4 h-4"
                    onChange={e => {
                      const on = e.target.checked;
                      setJamPerKelas(on);
                      // Isi awal tiap kelas = jam umum, tinggal digeser per kelas.
                      if (on) setJadwalKelas(j => Object.fromEntries(kelasIds.map(k => [k, j[k] ?? { tanggal: startDate, mulai: startTimeStr, selesai: endTimeStr }])));
                    }} />
                  <span className="text-sm text-gray-700">
                    Jam berbeda untuk tiap kelas
                    <span className="block text-xs text-gray-400">Untuk ujian per kelas (mis. STS): soal sama, tiap kelas masuk pada jamnya sendiri. Bisa juga diatur Wakakur di Administrasi → Pengawas.</span>
                  </span>
                </label>
              )}
              {jamPerKelas && kelasIds.length > 1 ? (
                <div className="space-y-2">
                  {kelasIds.map(k => {
                    const nama = detail?.kelas.find(x => x.id === k)?.name ?? opsiKelas.find(o => o.classId === k)?.className ?? "Kelas";
                    const j = jadwalKelas[k] ?? { tanggal: startDate, mulai: startTimeStr, selesai: endTimeStr };
                    const ubahJ = (patch: Partial<typeof j>) => setJadwalKelas(x => ({ ...x, [k]: { ...j, ...patch } }));
                    return (
                      <div key={k} className="rounded-xl border border-gray-100 p-2">
                        <p className="text-xs font-semibold text-gray-700 mb-1">{nama}</p>
                        <DatePicker value={j.tanggal} onChange={v => ubahJ({ tanggal: v })} />
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          <TimePicker value={j.mulai} onChange={v => ubahJ({ mulai: v })} aria-label={`Jam mulai ${nama}`} className="w-full" ringkas />
                          <TimePicker value={j.selesai} onChange={v => ubahJ({ selesai: v })} aria-label={`Jam selesai ${nama}`} className="w-full" ringkas />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="label-field">Mulai</label><DatePicker value={startDate} onChange={setStartDate} /><TimePicker value={startTimeStr} onChange={v => setStartTimeStr(v)} className="w-full mt-2" /></div>
                  <div><label className="label-field">Tutup</label><DatePicker value={endDate} onChange={setEndDate} /><TimePicker value={endTimeStr} onChange={v => setEndTimeStr(v)} className="w-full mt-2" /></div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div><label className="label-field">Durasi (menit)</label><input type="number" min={1} value={duration} onChange={e => setDuration(e.target.value)} className="input-field w-full" /></div>
                <div><label className="label-field">Dikerjakan (dari {questions.length})</label><input type="number" min={1} max={questions.length || undefined} value={jumlahDikerjakan} onChange={e => setJumlahDikerjakan(e.target.value)} className="input-field w-full" placeholder="semua" /></div>
              </div>
            </div>
            <div className="page-card p-4 space-y-2">
              <h3 className="font-heading font-semibold text-primary-900 text-sm flex items-center gap-1.5"><ShieldCheck size={14} /> Pengamanan</h3>
              {[
                [acakSoal, setAcakSoal, "Acak urutan soal per siswa", "Wacana & posisi terkunci tetap dihormati"],
                [acakOpsi, setAcakOpsi, "Acak urutan pilihan", "Tidak berlaku untuk Benar/Salah & Menjodohkan"],
                [satuSoal, setSatuSoal, "Satu soal per halaman", "Naskah tidak bisa disalin utuh sekali jalan"],
                [tampilkanNilai, setTampilkanNilai, "Siswa boleh melihat nilainya", "Hanya angka nilai di beranda — soal, jawaban & kunci tidak pernah ditampilkan"],
                [izinKalkulator, setIzinKalkulator, "Kalkulator ilmiah di layar peserta", "Untuk mapel hitungan"],
                [izinCoretan, setIzinCoretan, "Kertas coretan digital", "Pengganti kertas buram, tidak dinilai"],
              ].map(([v, set, label, ket], i) => (
                <label key={i} className="flex items-start gap-2 cursor-pointer">
                  <input type="checkbox" checked={v as boolean} onChange={e => (set as (b: boolean) => void)(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#1B2B6B]" />
                  <span className="text-sm"><span className="font-medium">{label as string}</span><span className="block text-xs text-gray-400">{ket as string}</span></span>
                </label>
              ))}
              <div className="pt-1">
                <label className="label-field">Paket soal menurut denah</label>
                <Select value={paketDenah} onChange={setPaketDenah} options={[
                  { value: "0", label: "Tidak — acak per siswa" },
                  { value: "2", label: "2 paket (A–B)" },
                  { value: "3", label: "3 paket (A–C)" },
                  { value: "4", label: "4 paket (A–D) — diagonal juga beda" },
                ]} />
                <p className="text-xs text-gray-400 mt-1">
                  Siswa yang duduk berdekatan di Denah Ruang mendapat paket (urutan soal & pilihan) berbeda. Butuh pembagian ruang
                  di kegiatan ini; siswa tanpa kursi tetap diacak per siswa.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div><label className="label-field">Batas pindah tab</label><input type="number" min={0} value={batasTab} onChange={e => setBatasTab(e.target.value)} className="input-field w-full" /><p className="text-xs text-gray-400">0 = hanya dicatat</p></div>
                <div><label className="label-field">Examkey</label><input value={examkey} onChange={e => setExamkey(e.target.value)} className="input-field w-full" placeholder="kosong = bebas" /><p className="text-xs text-gray-400">URL: /ujian-online?examkey=...</p></div>
                <div className="sm:col-span-2">
                  <label className="flex items-start gap-2.5 text-sm text-gray-700 sentuh">
                    <input type="checkbox" checked={wajibSeb} onChange={e => setWajibSeb(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-700 focus:ring-primary-500" />
                    <span>
                      Wajib Safe Exam Browser
                      <span className="block text-xs text-gray-400">
                        Satu-satunya cara mengunci perangkat sungguhan — Alt-Tab, tombol Home, dan aplikasi lain ikut mati.
                        Kunci SEB diisi Administrator di Pengaturan Ujian; selama belum diisi, ujian TIDAK dikunci supaya
                        sekolah tidak kehilangan akses.
                      </span>
                    </span>
                  </label>
                  <label className="mt-2 flex items-start gap-2.5 text-sm text-gray-700 sentuh">
                    <input type="checkbox" checked={wajibAplikasi} onChange={e => setWajibAplikasi(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-700 focus:ring-primary-500" />
                    <span>
                      HP Android wajib memakai Aplikasi Ujian
                      <span className="block text-xs text-gray-400">
                        Peserta yang membuka dari browser HP Android ditolak saat memasukkan token dan diarahkan mengunduh Aplikasi Ujian
                        (layar terkunci, tangkapan layar diblokir). Komputer & iPhone tidak terpengaruh.
                      </span>
                    </span>
                  </label>
                </div>
                <div>
                  <label className="label-field">Token berganti tiap</label>
                  <input type="number" min={0} max={240} value={tokenOtomatis} onChange={e => setTokenOtomatis(e.target.value)} className="input-field w-full" />
                  {/* Kegiatan bertoken bersama: yang dibacakan ke peserta adalah token KEGIATAN, jadi angka di sini tidak
                      berlaku — temuan user 23 Sep 2026 (diisi 240, token tetap berganti tiap 5 menit). */}
                  {tokenKegiatan
                    ? <p className="text-xs text-amber-700">Tidak dipakai — kegiatan ini memakai <b>token bersama</b> (berganti tiap {tokenKegiatan.tokenOtomatisMenit || 0} menit). Ubah di Pengaturan Ujian → Kegiatan Ujian.</p>
                    : <p className="text-xs text-gray-400">menit · 0 = tetap</p>}
                </div>
                <div><label className="label-field">Batas putar audio</label><input type="number" min={0} value={batasAudio} onChange={e => setBatasAudio(e.target.value)} className="input-field w-full" /><p className="text-xs text-gray-400">kali · 0 = bebas</p></div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={() => handleSave()} disabled={saving} className="btn-modal-save"><Save size={14} /> {saving ? "Menyimpan..." : "Simpan"}</button>
              {isNew && <button onClick={() => handleSave("terbit")} disabled={saving} className="btn-modal-save"><Eye size={14} /> Simpan & Terbitkan</button>}
              {!isNew && <button onClick={hapusUjian} className="text-xs text-red-600 hover:underline flex items-center justify-center gap-1"><Trash2 size={12} /> Hapus ujian</button>}
            </div>
          </div>
        </div>
      )}

      {/* ============================ PANTAU ============================ */}
      {tab === "pantau" && (
        !pantau ? <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-gray-400" /></div> : (
          <>
            <div className="kisi-kartu kisi-kartu-6 mb-5">
              <StatTile value={pantau.ringkas.belum} label="Belum Mulai" icon={Clock} color="gray" size="md" />
              <StatTile value={pantau.ringkas.mengerjakan} label="Mengerjakan" icon={Wifi} color="emerald" size="md" />
              <StatTile value={pantau.ringkas.terputus} label="Terputus" icon={WifiOff} color="amber" size="md" />
              <StatTile value={pantau.ringkas.terkunci} label="Terkunci" icon={Lock} color="purple" size="md" />
              <StatTile value={pantau.ringkas.waktuHabis} label="Waktu Habis" icon={AlertTriangle} color="red" size="md" />
              <StatTile value={pantau.ringkas.selesai} label="Selesai" icon={CheckCircle2} color="primary" size="md" />
            </div>
            {id && (
              <PesanPesertaPanel examId={id} />
            )}
            <div className="flex items-center justify-between mb-2 text-xs text-gray-400">
              <span>
                {pantauLangsung.mode === "langsung" ? <><span className="live-dot text-emerald-500 mr-1" />Langsung</> : pantauLangsung.mode === "menyambung" ? "Menyambung…" : "Diperbarui tiap 5 detik"} · {new Date(pantau.diperbarui).toLocaleTimeString("id-ID")}
                <span className="ml-2 font-mono font-bold text-primary-700">token {pantau.token}</span>
                {pantau.tokenBerganti && <span className="ml-1">· berganti pukul {new Date(pantau.tokenBerganti).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>}
              </span>
              <button onClick={muatPantau} className="flex items-center gap-1 hover:text-primary-700"><RefreshCw size={12} /> segarkan</button>
            </div>
            <div className="baris-alat mb-5">
              <div className="alat-cari">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={pantauCari} onChange={e => setPantauCari(e.target.value)}
                  placeholder="Cari nama atau NIS..." className="input-field pl-10 w-full" />
              </div>
              {kelasPantau.length > 1 && (
                <div className="alat-saring">
                  <Select value={pantauKelas} onChange={setPantauKelas}
                    options={[{ value: "", label: `Semua kelas (${pantau.baris.length})` },
                      ...kelasPantau.map(k => ({ value: k, label: `${k} (${pantau.baris.filter(b => b.student.class?.name === k).length})` }))]} />
                </div>
              )}
              {(pantauKelas || pantauCari) && (
                <span className="text-xs text-gray-400">{barisPantau.length} dari {pantau.baris.length} peserta</span>
              )}
            </div>
            <div className="page-card overflow-hidden"><div className="overflow-auto scrollbar-visible">
              <table className="data-table">
                <thead><tr><th>Siswa</th><th>Status</th><th>Kemajuan</th><th>Ragu</th><th>Sisa Waktu</th><th>Pelanggaran</th><th>Terakhir Aktif</th><th>Nilai</th><th>Tindakan</th></tr></thead>
                <tbody>
                  {barisPantau.length === 0 && (
                    <tr><td colSpan={9} className="text-center text-sm text-gray-400 py-6">Tidak ada peserta yang cocok dengan saringan.</td></tr>
                  )}
                  {barisPantau.map(b => (
                    <tr key={b.student.id} className={b.pelanggaran >= 3 ? "bg-red-50/40" : ""}>
                      <td>
                        <span className="font-medium">{b.student.user.name}</span>{multiKelas && b.student.class?.name && <span className="ml-1.5 text-xs text-gray-400">{b.student.class.name}</span>}
                        {b.paket && <span className="ml-1.5 rounded-md border border-primary-100 bg-primary-50 px-1.5 text-xs font-semibold text-primary-700" title="Paket soal menurut denah">Paket {b.paket}</span>}
                        <span className="block text-xs text-gray-400">{b.student.nis}{b.perangkat ? " · perangkat terkunci" : ""}</span>
                      </td>
                      <td>{b.ditahan
                        ? <span title={b.ditahan} className="px-2 py-0.5 rounded-full border text-xs font-semibold whitespace-nowrap bg-rose-50 text-rose-700 border-rose-200">Ditahan<span className="block font-normal max-w-[10rem] whitespace-normal">{b.ditahan}</span></span>
                        : <span className={`px-2 py-0.5 rounded-full border text-xs font-semibold whitespace-nowrap ${GAYA_STATUS_PESERTA[b.status]}`}>{LABEL_STATUS_PESERTA[b.status]}</span>}</td>
                      <td>
                        <div className="flex items-center gap-2"><div className="w-24 h-2 rounded-full bg-gray-100 overflow-hidden"><div className="h-full bg-primary-700" style={{ width: `${b.total ? (b.terjawab / b.total) * 100 : 0}%` }} /></div><span className="text-xs">{b.terjawab}/{b.total}</span></div>
                      </td>
                      <td className="text-center">{b.ragu > 0 ? <span className="font-bold text-amber-600">{b.ragu}</span> : <span className="text-gray-300">0</span>}</td>
                      <td className="font-mono text-sm whitespace-nowrap">
                        {b.status === "MENGERJAKAN" || b.status === "TERPUTUS" || b.status === "TERKUNCI" ? fmtSisa(pantauLangsung.sisa(b.sisaDetik)) : "-"}
                        {b.tambahanMenit > 0 && <span className="ml-1 text-xs font-sans font-semibold text-emerald-600" title={judulTambahanWaktu(b.tambahanMenit)}>{teksTambahanWaktu(b.tambahanMenit)}</span>}
                      </td>
                      <td className="text-center">{b.pelanggaran > 0 ? <span className={`font-bold ${b.pelanggaran >= 3 ? "text-red-600" : "text-amber-700"}`}>{b.pelanggaran}</span> : <span className="text-gray-300">0</span>}</td>
                      <td className="text-xs text-gray-500">{fmtJam(b.lastSeenAt)}</td>
                      <td className="text-center font-bold text-primary-900">{b.score ?? "-"}{b.menunggu > 0 && <span className="block text-xs font-semibold text-amber-600" title={`${b.menunggu} soal uraian/unggah belum dikoreksi`}>sementara</span>}</td>
                      <td><AksiPesertaUjian examId={id} studentId={b.student.id} nama={b.student.user.name} status={b.status} alasanKunci={b.alasanKunci} onSelesai={muatPantau} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div></div>
          </>
        )
      )}

      {/* ============================ KOREKSI ============================ */}
      {tab === "koreksi" && (
        !koreksi ? <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
        : koreksi.jumlahButirManual === 0 ? <EmptyState icon={ClipboardCheck} title="Tidak ada soal uraian" description="Semua soal dinilai otomatis." />
        : koreksi.daftar.length === 0 ? <EmptyState icon={ClipboardCheck} title="Belum ada yang mengumpulkan" description="Jawaban uraian muncul di sini setelah siswa mengumpulkan." />
        : (
          <div className="space-y-4">
            {/* DUA CARA MENGOREKSI (permintaan user 20 September 2026). "Per soal" adalah cara yang
                lebih dianjurkan: guru menilai satu pertanyaan berturut-turut untuk semua siswa,
                sehingga standar penilaiannya konsisten — bukan berpindah-pindah antar pertanyaan. */}
            <div className="baris-alat">
              <div className="alat-tab flex gap-1 rounded-xl border border-gray-100 bg-white p-1">
                {([["soal", "Per Soal"], ["siswa", "Per Siswa"]] as const).map(([v, l]) => (
                  <button key={v} onClick={() => setModeKoreksi(v)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${modeKoreksi === v ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>{l}</button>
                ))}
              </div>
              {modeKoreksi === "siswa" && (
                <div className="alat-cari">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={koreksiCari} onChange={e => setKoreksiCari(e.target.value)}
                    placeholder="Cari nama atau NIS..." className="input-field pl-10 w-full" />
                </div>
              )}
              <span className="text-xs text-gray-400">
                {sisaKoreksi > 0 ? `${sisaKoreksi} jawaban belum dikoreksi` : "Semua jawaban sudah dikoreksi"}
              </span>
              <div className="alat-aksi alat-teks">
                <button type="button" onClick={simpanSemuaSkor} disabled={simpanSemuaSibuk} className="btn-modal-save">
                  {simpanSemuaSibuk ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Simpan Semua Skor
                </button>
              </div>
            </div>

            {modeKoreksi === "siswa" ? koreksi.daftar
              .filter(s => { const q = koreksiCari.trim().toLowerCase(); return !q || s.student.user.name.toLowerCase().includes(q) || s.student.nis.toLowerCase().includes(q); })
              .map(s => (
              <div key={s.attemptId} className="page-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-heading font-bold text-primary-900">{s.student.user.name} <span className="text-xs text-gray-400 font-normal">{s.student.nis}</span></p>
                  <span className="text-sm"><span className="font-bold text-primary-900">Nilai {s.score ?? "-"}</span>{s.butir.some(b => b.skor === null) && <span className="ml-2 text-amber-700 text-xs">sementara · {s.butir.filter(b => b.skor === null).length} belum dikoreksi</span>}</span>
                </div>
                <div className="space-y-3">
                  {s.butir.map(b => (
                    <div key={b.questionId} className="rounded-xl border border-gray-100 p-3">
                      <p className="text-xs text-gray-400 mb-1">Soal {b.nomorAsli} · {labelTipe(b.tipe)} · maks {b.skorMaks}</p>
                      <div className="text-sm text-gray-700 mb-2 line-clamp-2" dangerouslySetInnerHTML={{ __html: b.pertanyaan }} />
                      <PeganganKoreksi acuan={b.acuan} rubrik={b.rubrik} className="mb-2" />
                      {kotakJawaban(s.attemptId, b)}
                    </div>
                  ))}
                </div>
              </div>
            )) : perSoal.map(q => {
              const buka = soalTerbuka === q.questionId;
              const belum = q.jawaban.filter(j => j.skor === null).length; // skor TERSIMPAN — draf belum dihitung sampai Simpan
              return (
              <div key={q.questionId} id={`koreksi-${q.questionId}`} className="page-card overflow-hidden scroll-mt-36">
                <button type="button" aria-expanded={buka}
                  onClick={() => {
                    setSoalTerbuka(buka ? null : q.questionId);
                    // Soal lain yang tertutup di atasnya menggeser layar — bawa kepala soal yang dibuka ke atas.
                    if (!buka) requestAnimationFrame(() => document.getElementById(`koreksi-${q.questionId}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition ${buka ? "bg-primary-50/60 border-b border-gray-100" : "hover:bg-gray-50"}`}>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-900 text-sm font-bold text-white">{q.nomorAsli}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-gray-400">Soal {q.nomorAsli} · {labelTipe(q.tipe)} · maks {q.skorMaks}</span>
                    {!buka && <span className="block text-sm text-gray-700 line-clamp-1" dangerouslySetInnerHTML={{ __html: q.pertanyaan.replace(/<[^>]+>/g, " ") }} />}
                  </span>
                  <span className={`shrink-0 status-badge ${belum ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
                    {belum ? `${belum} / ${q.jawaban.length} belum` : "Selesai"}
                  </span>
                  <ChevronDown size={18} className={`shrink-0 text-gray-400 transition-transform ${buka ? "rotate-180" : ""}`} />
                </button>
                {buka && (
                <div className="p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div className="text-sm text-gray-700" dangerouslySetInnerHTML={{ __html: q.pertanyaan }} />
                    {q.berparameter && <p className="mt-2 text-xs font-semibold text-amber-700">Soal berparameter — jawaban acuan tiap siswa ditampilkan di atas jawabannya.</p>}
                    <PeganganKoreksi acuan={q.acuan} rubrik={q.rubrik} className="mt-2" />
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1.5">
                    {q.tipe === "URAIAN" && q.acuan?.trim() && q.jawaban.some(j => j.skor === null) && (
                      <button type="button" className="btn-modal-cancel btn-teks text-xs"
                        title="Mengisi kotak skor yang masih kosong dengan saran — belum tersimpan sampai Simpan Semua Skor"
                        onClick={() => {
                          const isi: Record<string, string> = {};
                          for (const j of q.jawaban) {
                            const kunci = `${j.attemptId}:${q.questionId}`;
                            if (j.skor !== null || skorDraft[kunci] !== undefined) continue;
                            const sr = saranSkor({ jawaban: j.jawaban, acuan: j.acuan, rubrik: j.rubrik, pertanyaan: j.pertanyaan, skorMaks: q.skorMaks });
                            if (sr) isi[kunci] = String(sr.skor);
                          }
                          setSkorDraft(p => ({ ...p, ...isi }));
                          toast.success(`${Object.keys(isi).length} saran skor diisikan — periksa, lalu tekan Simpan Semua Skor.`);
                        }}>Isi dengan Saran</button>
                    )}
                  </div>
                </div>
                <div className="space-y-3">
                  {q.jawaban.map(j => (
                    <div key={j.attemptId} className="rounded-xl border border-gray-100 p-3">
                      <p className="text-xs font-semibold text-primary-900 mb-1.5">{j.nama} <span className="text-gray-400 font-normal">{j.nis}</span></p>
                      {q.berparameter && <PeganganKoreksi acuan={j.acuan} rubrik={j.rubrik} className="mb-2" />}
                      {kotakJawaban(j.attemptId, { ...q, jawaban: j.jawaban, skor: j.skor, acuan: j.acuan, rubrik: j.rubrik, pertanyaan: j.pertanyaan })}
                    </div>
                  ))}
                </div>
                </div>
                )}
              </div>
              );
            })}
          </div>
        )
      )}

      {/* ============================ HASIL ============================ */}
      {tab === "hasil" && (
        !hasil ? <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-gray-400" /></div> : (
          <div className="space-y-5">
            <div className="kisi-kartu kisi-kartu-5">
              <StatTile value={hasil.statistik.selesai} label={`Selesai dari ${hasil.statistik.peserta}`} icon={Users2} color="primary" size="md" />
              <StatTile value={hasil.statistik.rerata ?? "-"} label="Rerata" icon={BarChart3} color="blue" size="md" />
              <StatTile value={hasil.statistik.tertinggi ?? "-"} label="Tertinggi" icon={ChevronUp} color="emerald" size="md" />
              <StatTile value={hasil.statistik.terendah ?? "-"} label="Terendah" icon={ChevronDown} color="red" size="md" />
              <StatTile value={hasil.statistik.menungguKoreksi} label="Menunggu Koreksi" icon={ClipboardCheck} color="amber" size="md" />
            </div>
            <TurunanUjianPanel examId={id} basePath={basePath} bolehUbah={bolehUbahUjian} />
            <div className="baris-alat">
              <p className="alat-saring text-sm text-gray-600">
                {hasil.analisis.filter(a => a.perluRevisi).length > 0
                  ? <><strong className="text-red-600">{hasil.analisis.filter(a => a.perluRevisi).length} soal perlu direvisi</strong> menurut analisis butir.</>
                  : "Belum ada soal yang ditandai perlu revisi."}
              </p>
              <div className="alat-aksi">
                <button type="button" onClick={() => simpanKeBank(hasil.analisis.filter(a => !a.perluRevisi).map(a => a.questionId))} disabled={menyimpanBank} className="btn-modal-cancel">
                  {menyimpanBank ? <Loader2 size={15} className="animate-spin" /> : <BookMarked size={15} />} Simpan Soal Layak ke Bank Soal
                </button>
                <a href={`/api/teacher/exams/${id}/hasil?format=xlsx`} className="btn-modal-cancel"><Download size={15} /> Unduh Excel</a>
              </div>
            </div>
            {/* KEMIRIPAN JAWABAN — dihitung saat diminta, bukan otomatis: ini alat bantu periksa,
                dan angkanya tidak boleh terbaca seperti vonis yang muncul sendiri. */}
            <div className="page-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-heading font-bold text-primary-900 text-sm">Kemiripan Jawaban</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Mencari pasangan siswa yang SALAH di butir yang sama dengan pilihan yang sama persis, lalu memperhitungkan
                    posisi duduk (Denah Ruang) dan kemiripan pola waktu per soal. Diurutkan menurut skor risiko.
                  </p>
                </div>
                <button type="button" disabled={muatKemiripan}
                  onClick={async () => {
                    setMuatKemiripan(true);
                    const r = await fetch(`/api/teacher/exams/${id}/kemiripan`).catch(() => null);
                    const d = await r?.json().catch(() => null);
                    setMuatKemiripan(false);
                    if (!r?.ok || !d) { toast.error(d?.error ?? "Gagal memeriksa kemiripan."); return; }
                    setKemiripan(d);
                  }}
                  className="btn-modal-cancel btn-teks shrink-0">
                  {muatKemiripan ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Periksa Kemiripan
                </button>
              </div>
              {kemiripan && !kemiripan.adaDenah && (
                <p className="mt-2 text-xs text-gray-400">Kegiatan ini belum memakai Denah Ruang — posisi duduk tidak ikut diperhitungkan.</p>
              )}
              {kemiripan && (
                kemiripan.pasangan.length === 0 ? (
                  <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                    Tidak ada pasangan yang melewati ambang ({kemiripan.ambang.salahSamaMin} butir salah-sama
                    dan kemiripan ≥ {Math.round(kemiripan.ambang.indeksMin * 100)}%) dari {kemiripan.diperiksa} pengerjaan.
                  </p>
                ) : (
                  <>
                    <p className="mt-3 text-xs text-amber-700">
                      {kemiripan.pasangan.length} pasangan perlu diperiksa dari {kemiripan.diperiksa} pengerjaan
                      ({kemiripan.butirDibandingkan} butir dinilai otomatis). Ini <strong>bukan bukti mencontek</strong> —
                      periksa tempat duduk dan jawabannya sebelum mengambil kesimpulan.
                    </p>
                    <div className="mt-2 overflow-x-auto">
                      <table className="data-table">
                        <thead><tr><th>Risiko</th><th>Siswa A</th><th>Siswa B</th><th>Salah sama</th><th>Kemiripan</th><th>Posisi duduk</th><th>Pola waktu</th><th>Nomor soal</th></tr></thead>
                        <tbody>
                          {kemiripan.pasangan.map((x, i) => (
                            <tr key={i}>
                              <td>
                                <span className={`status-badge ${x.risiko >= 70 ? "bg-red-50 text-red-700 border-red-200" : x.risiko >= 45 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-gray-50 text-gray-600 border-gray-200"}`}>
                                  {x.risiko >= 70 ? "Tinggi" : x.risiko >= 45 ? "Sedang" : "Rendah"} · {x.risiko}
                                </span>
                              </td>
                              <td>{x.a.nama}<span className="block text-xs text-gray-400">{x.a.kelas ?? x.a.nis}</span></td>
                              <td>{x.b.nama}<span className="block text-xs text-gray-400">{x.b.kelas ?? x.b.nis}</span></td>
                              <td className="angka">{x.salahSama} dari {x.salahBersama}</td>
                              <td className="angka">{Math.round(x.indeks * 100)}%</td>
                              <td className="text-xs">
                                {x.posisi ? <><span className={x.posisi.jenis === "SERUANG" ? "text-gray-600" : "font-semibold text-red-700"}>{LABEL_POSISI_DUDUK[x.posisi.jenis]}</span>
                                  <span className="block text-gray-400">{x.posisi.ruang} · sesi {x.posisi.sesi} · kursi {x.posisi.kursiA} &amp; {x.posisi.kursiB}</span></> : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="text-xs angka">
                                {x.korelasiWaktu === null ? <span className="text-gray-300">—</span>
                                  : <span className={x.korelasiWaktu >= 0.8 ? "font-semibold text-red-700" : "text-gray-600"}>r = {x.korelasiWaktu}</span>}
                              </td>
                              <td className="text-xs text-gray-500">{x.nomor.join(", ")}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )
              )}
              {kemiripan && kemiripan.cepat.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-gray-700 mb-1">Selesai jauh lebih cepat dari teman-temannya ({kemiripan.cepat.length})</p>
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead><tr><th>Siswa</th><th>Durasi</th><th>Detik/soal</th><th>Nilai</th><th>Catatan</th></tr></thead>
                      <tbody>
                        {kemiripan.cepat.map((c, i) => (
                          <tr key={i}>
                            <td>{c.nama}<span className="block text-xs text-gray-400">{c.kelas ?? c.nis}</span></td>
                            <td className="angka">{c.durasiMenit} menit</td>
                            <td className="angka">{c.detikPerSoal ?? "—"}</td>
                            <td className="angka">{c.nilai ?? "—"}</td>
                            <td className="text-xs text-gray-500">{c.alasan}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              <div className="page-card overflow-hidden">
                <div className="page-card-header px-4 py-3"><span className="font-heading font-bold text-primary-900 text-sm">Rekap Nilai</span></div>
                <div className="overflow-auto max-h-[28rem] scrollbar-visible"><table className="data-table">
                  <thead><tr><th>Siswa</th><th>Nilai</th><th>Pelanggaran</th><th>Dikumpulkan</th></tr></thead>
                  <tbody>{hasil.rekap.map(r => (
                    <tr key={r.student.nis}><td><span className="font-medium">{r.student.user.name}</span><span className="block text-xs text-gray-400">{r.student.nis}{multiKelas && r.student.class?.name ? ` · ${r.student.class.name}` : ""}</span></td>
                      <td className="text-center font-bold text-primary-900">{r.score ?? "-"}{r.menunggu > 0 && <span className="block text-xs font-semibold text-amber-600" title={`${r.menunggu} soal belum dikoreksi`}>sementara</span>}</td>
                      <td className="text-center">{r.pelanggaran || <span className="text-gray-300">0</span>}</td>
                      <td className="text-xs text-gray-500">{r.submittedAt ? new Date(r.submittedAt).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" }) : "-"}</td></tr>
                  ))}</tbody>
                </table></div>
              </div>
              <div className="page-card overflow-hidden">
                <div className="page-card-header px-4 py-3"><span className="font-heading font-bold text-primary-900 text-sm">Analisis Butir</span><span className="text-xs text-gray-400">kesukaran = proporsi benar · daya beda = atas 27% - bawah 27% · waktu = rata-rata lama di soal · ganti = rata-rata ganti jawaban</span></div>
                <div className="overflow-auto max-h-[28rem] scrollbar-visible"><table className="data-table">
                  <thead><tr><th className="w-10">No</th><th>Jenis</th><th>KD</th><th>Benar</th><th>Kesukaran</th><th>Daya Beda</th><th>Waktu</th><th>Ganti</th><th>Kualitas</th></tr></thead>
                  <tbody>{hasil.analisis.map(a => (
                    <tr key={a.questionId}><td className="angka font-bold">{a.nomor}</td><td className="text-xs">{labelTipe(a.tipe)}</td><td className="text-xs">{a.kd ?? "-"}</td>
                      <td className="text-center text-xs">{a.benar}/{a.peserta}</td>
                      <td><span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${a.kategoriKesukaran === "Mudah" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : a.kategoriKesukaran === "Sukar" ? "bg-red-50 text-red-600 border-red-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>{a.kategoriKesukaran}{a.kesukaran !== null ? ` ${Math.round(a.kesukaran * 100)}%` : ""}</span></td>
                      <td><span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${a.kategoriDayaBeda === "Baik" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : a.kategoriDayaBeda === "Terbalik" ? "bg-red-50 text-red-600 border-red-200" : "bg-gray-50 text-gray-600 border-gray-200"}`}>{a.kategoriDayaBeda}{a.dayaBeda !== null ? ` ${a.dayaBeda.toFixed(2)}` : ""}</span></td>
                      <td className="text-xs whitespace-nowrap tabular-nums">{a.rataWaktu === null ? "-" : a.rataWaktu >= 60 ? `${Math.floor(a.rataWaktu / 60)}m ${a.rataWaktu % 60}d` : `${a.rataWaktu}d`}</td>
                      <td className={`text-xs text-center tabular-nums ${(a.rataUbah ?? 0) >= 1 ? "font-bold text-amber-700" : ""}`} title="Rata-rata berapa kali jawaban diganti — tinggi berarti banyak siswa ragu/menebak">{a.rataUbah ?? "-"}</td>
                      <td className="min-w-[10rem]">
                        {a.perluRevisi
                          ? <span className="status-badge bg-red-50 text-red-600 border-red-200" title={a.alasanRevisi?.join("; ")}>Perlu revisi</span>
                          : a.peserta >= 10 ? <span className="status-badge bg-emerald-50 text-emerald-700 border-emerald-200">Layak</span> : <span className="text-xs text-gray-400">peserta &lt; 10</span>}
                        {a.perluRevisi && <span className="mt-1 block text-xs text-red-600">{a.alasanRevisi?.join("; ")}</span>}
                        <button type="button" onClick={() => simpanKeBank([a.questionId])} className="mt-1 block text-xs font-semibold text-primary-700 hover:underline">Simpan ke bank</button>
                      </td></tr>
                  ))}</tbody>
                </table></div>
              </div>
            </div>
            {hasil.analisis.some(a => a.sebaran.length > 0) && (
              <div className="page-card overflow-hidden">
                <div className="page-card-header px-4 py-3">
                  <span className="font-heading font-bold text-primary-900 text-sm">Analisis Pengecoh</span>
                  <span className="text-xs text-gray-400">hijau = kunci · kuning = pengecoh tidak berfungsi (dipilih &lt; 5% peserta)</span>
                </div>
                <div className="p-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {hasil.analisis.filter(a => a.sebaran.length > 0).map(a => (
                    <div key={a.questionId} className="rounded-xl border border-gray-100 p-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-heading font-bold text-sm text-primary-900">Soal {a.nomor}</span>
                        {a.peserta === 0 ? <span className="text-xs text-gray-400">belum ada peserta</span>
                          : a.pengecohMati > 0 ? <span className="text-xs font-semibold text-amber-700">{a.pengecohMati} pengecoh tidak berfungsi</span>
                          : <span className="text-xs font-semibold text-emerald-600">semua pengecoh berfungsi</span>}
                      </div>
                      <div className="space-y-1.5">
                        {a.sebaran.map(o => (
                          <div key={o.kode} className="flex items-center gap-2 text-xs" title={o.teks}>
                            <span className={`w-4 font-bold ${o.benar ? "text-emerald-700" : "text-gray-500"}`}>{o.kode}</span>
                            <div className="flex-1 h-2.5 rounded-full bg-gray-100 overflow-hidden">
                              <div className={`h-full rounded-full ${o.benar ? "bg-emerald-500" : o.berfungsi === false ? "bg-amber-400" : "bg-primary-300"}`} style={{ width: `${o.persen}%` }} />
                            </div>
                            <span className="w-16 text-right text-gray-500 tabular-nums">{o.dipilih} · {o.persen}%</span>
                          </div>
                        ))}
                        {a.kosong > 0 && <p className="text-xs text-gray-400 pt-0.5">{a.kosong} peserta tidak menjawab</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      )}

      {/* ============================ MODAL: bank ============================ */}
      <Modal open={bankBuka} onClose={() => setBankBuka(false)} title="Ambil dari Bank Soal" size="xl" scrollBody description={`${bank.length} soal tersedia untuk ${subject}`}
        footer={<button onClick={() => setBankBuka(false)} className="btn-modal-cancel">Selesai</button>}>
        {bank.length === 0 ? <p className="text-sm text-gray-400">Bank soal masih kosong. Isi lewat Pusat Ujian - Bank Soal (impor dari Word).</p> : (
          <div className="space-y-2">
            {bank.map(b => (
              <div key={b.id} className="flex items-start gap-3 rounded-xl border border-gray-100 p-3">
                <div className="flex-1 min-w-0"><span className="badge badge-navy mr-2">{labelTipe(b.tipe)}</span><span className="text-sm text-gray-700">{teksPolos(b.pertanyaan).slice(0, 160) || "(soal bergambar)"}</span></div>
                <button onClick={() => tambahDariBank(b)} className="btn-modal-cancel text-xs gap-1 shrink-0"><Plus size={12} /> Tambah</button>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* ============================ MODAL: soal baru / edit ============================ */}
      <Modal open={editBuka} onClose={() => setEditBuka(false)} title={editIdx === null ? "Soal Baru" : `Edit Soal ${editIdx + 1}`} size="xl" scrollBody
        footer={<><button onClick={() => setEditBuka(false)} className="btn-modal-cancel">Batal</button><button onClick={simpanEdit} disabled={menyimpanTambah} className="btn-modal-save disabled:opacity-60">{menyimpanTambah ? <Loader2 size={14} className="animate-spin" /> : null}{tambahLive ? (menyimpanTambah ? "Menambahkan..." : "Tambahkan ke ujian berjalan") : editIdx === null ? "Tambahkan" : "Terapkan"}</button></>}>
        {tambahLive && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 mb-4">
            Ujian sedang berjalan. Soal ini diletakkan <b>di ujung naskah</b> (nomor {questions.length + 1}) dan langsung diterima
            peserta yang masih mengerjakan. Peserta yang <b>sudah mengumpulkan tidak terpengaruh</b> — nilainya tetap dihitung
            dari soal yang benar-benar mereka kerjakan.
          </div>
        )}
        <SoalEditor nilai={editButir} onChange={setEditButir} stimulusDaftar={stimulus} tampilPosisiKunci={!tambahLive} />
      </Modal>

      {/* ============================ MODAL: pratinjau ============================ */}
      <Modal open={liveIdx !== null} onClose={() => setLiveIdx(null)} title={`Perbaiki Soal ${liveIdx !== null ? liveIdx + 1 : ""} (Live)`} size="xl" scrollBody
        description="Perubahan langsung berlaku tanpa mengganggu peserta yang sedang mengerjakan"
        footer={<>
          <button type="button" onClick={batalkanSoalLive} disabled={liveSimpan} className="btn-hapus btn-teks">
            <Trash2 size={15} /> Batalkan Soal
          </button>
          <button type="button" onClick={() => setLiveIdx(null)} className="btn-modal-cancel flex-1">Batal</button>
          <button type="button" onClick={simpanLive} disabled={liveSimpan} className="btn-modal-save flex-1">
            {liveSimpan ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Terapkan Perbaikan
          </button>
        </>}>
        {liveError && <p className="error-msg mb-3">{liveError}</p>}
        {liveIdx !== null && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
            <span className="text-xs text-gray-500">Tidak perlu mengetik ulang:</span>
            <button type="button" onClick={() => setBankLiveBuka(true)} disabled={bankUntukLive.length === 0}
              className="btn-modal-cancel btn-teks text-xs py-1.5 disabled:opacity-40">
              <BookMarked size={14} /> Ambil isi dari Bank Soal ({bankUntukLive.length})
            </button>
            {bankUntukLive.length === 0 && (
              <span className="text-xs text-gray-400">Tidak ada butir bank berjenis sama dengan jumlah pilihan yang sama.</span>
            )}
          </div>
        )}
        {liveIdx !== null && <SoalEditor nilai={liveButir} onChange={setLiveButir} modeLive />}
      </Modal>

      <Modal open={bankLiveBuka} onClose={() => setBankLiveBuka(false)} title="Ambil Isi dari Bank Soal" size="lg" scrollBody
        description="Hanya butir berjenis sama dengan jumlah pilihan yang sama — batasan ini yang menjaga jawaban peserta tetap sah"
        footer={<button onClick={() => setBankLiveBuka(false)} className="btn-modal-cancel">Tutup</button>}>
        {bankUntukLive.length === 0 ? (
          <p className="text-sm text-gray-400">Tidak ada butir yang cocok di bank soal mapel ini.</p>
        ) : (
          <div className="space-y-2">
            {bankUntukLive.map(b => (
              <div key={b.id} className="flex items-start gap-3 rounded-xl border border-gray-100 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-400 mb-1">{labelTipe(b.tipe)} · {b.skor} poin{b.kd ? ` · KD ${b.kd}` : ""}</p>
                  <p className="text-sm text-primary-900 line-clamp-3">{teksPolos(b.pertanyaan) || "(soal bergambar)"}</p>
                </div>
                <button onClick={() => ambilBankKeLive(b)} className="btn-modal-cancel text-xs gap-1 shrink-0"><Plus size={12} /> Pakai</button>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal open={pratinjauIdx !== null} onClose={() => setPratinjauIdx(null)} title="Pratinjau Soal" size="lg" scrollBody description="Tampil persis seperti yang dilihat siswa"
        footer={<button onClick={() => setPratinjauIdx(null)} className="btn-modal-cancel">Tutup</button>}>
        {pratinjauIdx !== null && questions[pratinjauIdx] && (() => {
          // Soal berparameter dipratinjau dengan nilai siswa contoh (src/lib/soal-parameter.ts).
          const q = isiButirParameter(questions[pratinjauIdx], CONTOH_VARIABEL);
          return (
            <>
              {butirBerparameter(questions[pratinjauIdx]) && (
                <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Soal berparameter — ditampilkan untuk siswa contoh (ABSEN {CONTOH_VARIABEL.ABSEN}, NIS2 {CONTOH_VARIABEL.NIS2}, ACAK {CONTOH_VARIABEL.ACAK}). Tiap siswa melihat angkanya sendiri.
                </p>
              )}
              <SoalTampil tinjau soal={{
                id: "p", nomor: pratinjauIdx + 1, tipe: q.tipe, pertanyaan: q.pertanyaan,
                opsi: q.opsi, kanan: q.kunci?.kanan, skor: q.skor,
                opsiBenar: q.opsi.filter(o => o.benar).map(o => o.kode), kunci: q.kunci,
                gambar: q.kunci?.gambar, jumlahTitik: q.kunci?.area?.length,
              }} jawaban={null} />
            </>
          );
        })()}
      </Modal>
    </div>
  );
}
