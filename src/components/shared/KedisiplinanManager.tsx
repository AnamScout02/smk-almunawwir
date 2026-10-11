"use client";
import { useEffect, useState } from "react";
import { BadgeCheck, Loader2, Plus, Trash2, Save, CheckCircle2, Clock, XCircle, CalendarClock, CheckSquare, Coins, Search, ScanLine } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import Modal from "@/components/admin/Modal";
import Select from "@/components/admin/Select";
import StatTile from "@/components/admin/StatTile";
import DatePicker from "@/components/shared/DatePicker";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { useToast } from "@/components/shared/ToastProvider";
import { PageSkeleton } from "@/components/shared/Skeleton";
import { groupConsecutiveSchedules } from "@/lib/schedule-grouping";

interface TeacherOption { id: string; nip: string; user: { name: string } }
interface DailyRecord { id: string; date: string; status: string; notes: string | null; teacher: { nip: string; user: { name: string } } }
interface SlotRecord {
  id: string; date: string; status: string; hasTugas: boolean | null; notes: string | null;
  schedule: { subject: string; startTime: string; endTime: string; class: { name: string }; teacher: { nip: string; user: { name: string } } | null };
}
interface DutyRecord {
  id: string; date: string; status: string; notes: string | null;
  user: { name: string; role: string; teacher: { nip: string } | null };
}
// Baris tergabung untuk tabel rekap — daily (TeacherDiscipline) vs slot (TeacherScheduleAttendance)
// vs duty (DutyAttendance, kehadiran petugas piket itu sendiri) dibedakan lewat `kind`, dirender
// dalam satu tabel yang sama, diurutkan bareng berdasar tanggal.
// "slot" dikelompokkan per BLOK (JP berurutan, kelas+mapel+guru+status sama) — BUKAN 1 baris per
// jam pelajaran mentah, supaya 1 kali "masuk kelas" (misal 4 JP berurutan) tampil sebagai 1 baris,
// bukan 4 baris terpisah (dulu bug: StatTile & rekap ikut menghitung 4x untuk 1 kejadian yang sama).
type CombinedRow =
  | { kind: "daily"; id: string; ids: string[]; date: string; status: string; hasTugas: boolean | null; notes: string | null; teacherName: string; teacherNip: string; detail: string }
  | { kind: "slot"; id: string; ids: string[]; date: string; status: string; hasTugas: boolean | null; notes: string | null; teacherName: string; teacherNip: string; detail: string }
  | { kind: "duty"; id: string; ids: string[]; date: string; status: string; hasTugas: boolean | null; notes: string | null; teacherName: string; teacherNip: string; detail: string };

// Baris tabel "Buku Piket" — SEMUA kelas+jam+guru pada satu tanggal (kelas X & XI saja), langsung
// bisa dicentang statusnya per baris tanpa perlu pilih guru satu-satu dulu. `scheduleIds` bisa
// berisi LEBIH dari 1 id kalau guru itu ngajar beberapa JP berurutan di kelas+mapel yang sama —
// API sudah menggabungkannya jadi 1 blok/1 baris, disimpan sebagai 1 status untuk semua JP itu.
interface DaySlotItem {
  scheduleIds: string[]; className: string; subject: string; startTime: string; endTime: string; room: string | null;
  startPeriod: number | null; endPeriod: number | null;
  teacherId: string | null; teacherName: string; teacherNip: string;
  status: string; hasTugas: boolean | null; notes: string; tugasTitipan?: string; periodCount: number;
  /** Presensi harian dari TU (Presensi Pegawai) pada tanggal itu — PETUNJUK saja, tidak pernah
   *  mengisi status sendiri. Kalau TU sudah mencatat izin/sakit/dinas/cuti (artinya ada surat),
   *  petugas piket bisa menerapkannya ke semua jam guru itu sekali klik. */
  statusHarian: string | null; keteranganHarian: string | null;
}

function jamKeLabel(s: { startPeriod: number | null; endPeriod: number | null; startTime: string; endTime: string }) {
  if (s.startPeriod === null || s.endPeriod === null) return `${s.startTime}–${s.endTime}`;
  return s.startPeriod === s.endPeriod ? `Jam ke-${s.startPeriod}` : `Jam ke-${s.startPeriod} s/d ${s.endPeriod}`;
}

interface SlotItem {
  scheduleIds: string[]; className: string; subject: string; startTime: string; endTime: string; room: string | null;
  status: string; hasTugas: boolean | null; notes: string; tugasTitipan?: string; periodCount: number;
}

// Kehadiran petugas piket ITU SENDIRI (bukan absensi mengajar) — siapa yang terjadwal piket di
// tanggal itu (dari Jadwal Piket), status Hadir/Izin/Sakit/Alpha-nya.
interface DutyAttendanceItem {
  userId: string; userName: string; userRole: string; userNip: string | null; status: string; notes: string;
}
/** Satu baris petugas imam sholat pada tanggal itu (dari /api/imam/presensi). */
interface ImamItem {
  userId: string; nama: string; sesi: string; slot: string; status: string; catatan: string;
}
/** PresensiImam hanya mengenal 4 status (tanpa TERLAMBAT) — lihat STATUS di src/lib/imam-sholat.ts.
 *  Mengirim TERLAMBAT ke sana akan ditolak diam-diam oleh penyaringnya, jadi jangan disamakan
 *  dengan pilihan status guru piket. */
const STATUS_OPTIONS_IMAM = [
  { value: "", label: "— Pilih —" },
  { value: "HADIR", label: "Hadir" },
  { value: "IZIN", label: "Izin" },
  { value: "SAKIT", label: "Sakit" },
  { value: "ALPHA", label: "Alpha" },
];
const LABEL_TUGAS_IMAM: Record<string, string> = {
  "DUHA|-": "Imam Duha", "DZUHUR|L": "Imam Dzuhur (Putra)", "DZUHUR|P": "Imam Dzuhur (Putri)",
};

const STATUS_OPTIONS = [
  { value: "HADIR", label: "Hadir" },
  { value: "TERLAMBAT", label: "Terlambat" },
  { value: "IZIN", label: "Izin" },
  { value: "SAKIT", label: "Sakit" },
  { value: "ALPHA", label: "Alpha" },
];
const TUGAS_OPTIONS = [
  { value: "", label: "-" },
  { value: "ya", label: "Ada Tugas" },
  { value: "tidak", label: "Tidak Ada Tugas" },
];
const STATUS_BADGE: Record<string, string> = {
  "": "bg-gray-50 text-gray-400 border border-gray-200",
  HADIR: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  TERLAMBAT: "bg-amber-50 text-amber-700 border border-amber-200",
  IZIN: "bg-blue-50 text-blue-600 border border-blue-200",
  SAKIT: "bg-blue-50 text-blue-600 border border-blue-200",
  ALPHA: "bg-red-50 text-red-600 border border-red-200",
};
// Dipakai khusus dropdown PER BARIS (per guru/per blok jam) — SENGAJA ada opsi kosong di depan
// supaya status TIDAK otomatis kelihatan "Hadir" sebelum benar2 dipilih Wakasek/Guru Piket (dulu
// defaultnya diam2 "Hadir", jadi seperti sudah dicek padahal belum — resiko data kehadiran palsu).
const STATUS_OPTIONS_ROW = [{ value: "", label: "— Pilih —" }, ...STATUS_OPTIONS];
const EMPTY_FORM = { teacherId: "", date: new Date().toISOString().slice(0, 10), status: "", notes: "" };

function fmt(d: string) {
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}
function tugasLabel(v: boolean | null) {
  return v === true ? "Ada Tugas" : v === false ? "Tidak Ada Tugas" : "-";
}
function groupKey(ids: string[]) {
  return ids.join(",");
}

export default function KedisiplinanManager() {
  const confirmDialog = useConfirm();
  const toast = useToast();

  // ===== Tabel "Buku Piket" (utama) — per tanggal, semua kelas & guru sekaligus =====
  const today = new Date().toISOString().slice(0, 10);
  const [viewDate, setViewDate] = useState(today);
  const [daySlots, setDaySlots] = useState<DaySlotItem[]>([]);
  const [loadingDay, setLoadingDay] = useState(true);
  const [savingDay, setSavingDay] = useState(false);
  const [dayBulkStatus, setDayBulkStatus] = useState("");
  const [daySaved, setDaySaved] = useState(false);
  // Baris yang BENAR-BENAR diubah di sesi browser ini — cuma baris ini yang dikirim saat Simpan.
  // Tanpa ini, kalau guru piket lain sudah lebih dulu menyimpan perubahan di baris LAIN sementara
  // browser ini masih membuka data lama, klik "Simpan Semua" bisa menimpa balik perubahan mereka
  // dengan data basi (race condition nyata — 2 guru piket bisa mengisi Buku Piket di waktu
  // berdekatan tanpa saling tahu).
  const [dirtyDayKeys, setDirtyDayKeys] = useState<Set<string>>(new Set());

  // ===== Kehadiran petugas piket & IMAM SHOLAT (bukan absensi mengajar) — pakai viewDate yang sama.
  // Presensi imam digabung ke sini atas permintaan user 30 September 2026 ("biar jadi 1"): dua
  // tabel yang dicek petugas yang sama pada tanggal yang sama tidak perlu dua halaman. Jadwal
  // imamnya tetap disusun Kesiswaan di halaman Jadwal Imam Sholat; yang pindah hanya presensinya.
  const [dutyAttendance, setDutyAttendance] = useState<DutyAttendanceItem[]>([]);
  const [imam, setImam] = useState<ImamItem[]>([]);
  const [imamLibur, setImamLibur] = useState<string | null>(null);
  const [loadingDuty, setLoadingDuty] = useState(true);
  const [savingDuty, setSavingDuty] = useState(false);
  const [dutySaved, setDutySaved] = useState(false);
  const [dirtyDutyUserIds, setDirtyDutyUserIds] = useState<Set<string>>(new Set());
  /** Kunci baris imam = userId|sesi (satu guru bisa jadi imam Duha DAN Dzuhur di hari yang sama). */
  const [dirtyImamKeys, setDirtyImamKeys] = useState<Set<string>>(new Set());

  function loadDutyAttendance() {
    setLoadingDuty(true);
    setDirtyDutyUserIds(new Set());
    setDirtyImamKeys(new Set());
    Promise.all([
      fetch(`/api/teacher/wakasek/penjamin-mutu/kedisiplinan/duty-attendance?date=${viewDate}`)
        .then(r => r.json()).catch(() => []),
      // 403 mungkin (bukan pengelola jadwal imam & tidak piket hari ini) — bagian imam cukup kosong,
      // jangan menggagalkan seluruh panel kehadiran piket karena itu.
      fetch(`/api/imam/presensi?tanggal=${viewDate}`).then(r => r.json()).catch(() => null),
    ]).then(([d, im]) => {
      setDutyAttendance(Array.isArray(d) ? d : []);
      setImam(Array.isArray(im?.petugas) ? im.petugas.map((p: ImamItem) => ({ ...p, status: p.status ?? "", catatan: "" })) : []);
      setImamLibur(im?.libur ?? null);
    }).catch(() => {}).finally(() => setLoadingDuty(false));
  }
  useEffect(() => { loadDutyAttendance(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [viewDate]);

  function setDutyField(userId: string, field: "status" | "notes", value: string) {
    setDutyAttendance(prev => prev.map(d => d.userId === userId ? { ...d, [field]: value } : d));
    setDirtyDutyUserIds(prev => new Set(prev).add(userId));
    setDutySaved(false);
  }

  function setImamField(kunci: string, field: "status" | "catatan", value: string) {
    setImam(prev => prev.map(i => `${i.userId}|${i.sesi}` === kunci ? { ...i, [field]: value } : i));
    setDirtyImamKeys(prev => new Set(prev).add(kunci));
    setDutySaved(false);
  }

  async function handleSaveDuty() {
    // Status kosong (belum dipilih) tidak boleh ikut tersimpan — cuma kirim baris yg statusnya
    // benar2 sudah dipilih Wakasek/Guru Piket.
    const changed = dutyAttendance.filter(d => dirtyDutyUserIds.has(d.userId) && d.status !== "");
    const imamChanged = imam.filter(i => dirtyImamKeys.has(`${i.userId}|${i.sesi}`) && i.status !== "");
    if (changed.length === 0 && imamChanged.length === 0) return;
    setSavingDuty(true);
    // Dua tabel berbeda (DutyAttendance unik per userId+date, PresensiImam per userId+date+sesi),
    // jadi dua permintaan — tapi satu tombol Simpan. Kegagalan salah satu dilaporkan sendiri
    // supaya petugas tahu bagian mana yang belum masuk.
    const [resDuty, resImam] = await Promise.all([
      changed.length
        ? fetch("/api/teacher/wakasek/penjamin-mutu/kedisiplinan/duty-attendance", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ date: viewDate, records: changed.map(d => ({ userId: d.userId, status: d.status, notes: d.notes })) }),
          }).catch(() => null)
        : Promise.resolve(null),
      imamChanged.length
        ? fetch("/api/imam/presensi", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tanggal: viewDate, baris: imamChanged.map(i => ({ userId: i.userId, sesi: i.sesi, status: i.status, catatan: i.catatan })) }),
          }).catch(() => null)
        : Promise.resolve(null),
    ]);
    setSavingDuty(false);
    const gagalDuty = changed.length > 0 && !resDuty?.ok;
    const gagalImam = imamChanged.length > 0 && !resImam?.ok;
    if (gagalDuty) toast.error("Kehadiran guru piket gagal disimpan.");
    if (gagalImam) {
      const d = await resImam?.json().catch(() => null);
      toast.error(d?.error ?? "Kehadiran imam sholat gagal disimpan.");
    }
    if (!gagalDuty) setDirtyDutyUserIds(new Set());
    if (!gagalImam) setDirtyImamKeys(new Set());
    if (!gagalDuty && !gagalImam) {
      setDutySaved(true);
      setTimeout(() => setDutySaved(false), 3000);
    }
  }

  // ===== Scan Kartu Tanda — auto-catat HADIR petugas piket yang scan kartu hari ini =====
  const [scanDutyInput, setScanDutyInput] = useState("");
  async function handleScanDuty(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const code = scanDutyInput.trim();
    setScanDutyInput("");
    if (!code) return;
    const res = await fetch("/api/teacher/wakasek/penjamin-mutu/kedisiplinan/duty-attendance/scan", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }),
    });
    const d = await res.json();
    if (res.ok) { toast.success(`Piket tercatat: ${d.name}`); loadDutyAttendance(); }
    else toast.error(d.error || "Gagal mencatat kehadiran");
  }

  function loadDay() {
    setLoadingDay(true);
    setDirtyDayKeys(new Set());
    fetch(`/api/teacher/wakasek/penjamin-mutu/kedisiplinan/slots?date=${viewDate}`)
      .then(r => r.json()).then(d => setDaySlots(Array.isArray(d) ? d : []))
      .catch(() => {}).finally(() => setLoadingDay(false));
  }
  useEffect(() => { loadDay(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [viewDate]);

  function setDaySlotField(key: string, field: "status" | "hasTugas" | "notes" | "tugasTitipan", value: string | boolean | null) {
    setDaySlots(prev => prev.map(s => {
      if (groupKey(s.scheduleIds) !== key) return s;
      const next = { ...s, [field]: value };
      if (field === "status" && value === "HADIR") next.hasTugas = null; // Ada Tugas cuma relevan kalau tidak Hadir
      return next;
    }));
    setDirtyDayKeys(prev => new Set(prev).add(key));
    setDaySaved(false);
  }
  /** Terapkan status harian TU ke SEMUA blok jam guru tersebut pada tanggal ini. Dipicu manual
   *  oleh petugas piket (bukan otomatis) — ia tetap melihat & menyetujui apa yang diisikan. Blok
   *  yang jamnya belum tiba sengaja dilewati, sama seperti "Terapkan ke Semua". */
  function terapkanStatusHarian(teacherId: string | null, status: string) {
    if (!teacherId || !status) return;
    const kena = new Set<string>();
    setDaySlots(prev => prev.map(s2 => {
      if (s2.teacherId !== teacherId || isFutureSlot(s2)) return s2;
      kena.add(groupKey(s2.scheduleIds));
      return { ...s2, status, hasTugas: s2.hasTugas };
    }));
    setDirtyDayKeys(prev => { const n = new Set(prev); kena.forEach(k => n.add(k)); return n; });
    setDaySaved(false);
  }

  // Jam yang BELUM MULAI (kalau viewDate = hari ini) tidak boleh dinilai kehadirannya — guru
  // piket belum bisa tahu guru itu masuk atau tidak kalau jamnya saja belum tiba. Baris begini
  // dikunci (tidak bisa diedit, tidak ikut kena "Terapkan ke Semua") sampai jamnya benar tiba.
  function isFutureSlot(s: DaySlotItem) {
    if (viewDate !== today) return false;
    const nowHHMM = new Date().toTimeString().slice(0, 5);
    return s.startTime > nowHHMM;
  }
  function applyDayBulkStatus() {
    setDaySlots(prev => prev.map(s => isFutureSlot(s) ? s : { ...s, status: dayBulkStatus, hasTugas: dayBulkStatus === "HADIR" ? null : s.hasTugas }));
    setDirtyDayKeys(new Set(daySlots.filter(s => !isFutureSlot(s)).map(s => groupKey(s.scheduleIds))));
    setDaySaved(false);
  }
  async function handleSaveDay() {
    // Status kosong (belum dipilih) tidak boleh ikut tersimpan — cuma kirim blok yg statusnya
    // benar2 sudah dipilih.
    const changed = daySlots.filter(s => dirtyDayKeys.has(groupKey(s.scheduleIds)) && s.status !== "");
    if (changed.length === 0) return;
    setSavingDay(true);
    const res = await fetch("/api/teacher/wakasek/penjamin-mutu/kedisiplinan/slots", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: viewDate,
        records: changed.map(s => ({ scheduleIds: s.scheduleIds, status: s.status, hasTugas: s.hasTugas, notes: s.notes, tugasTitipan: s.tugasTitipan ?? "" })),
      }),
    });
    setSavingDay(false);
    if (res.ok) {
      setDaySaved(true);
      setTimeout(() => setDaySaved(false), 3000);
      setDirtyDayKeys(new Set());
      load();
      loadDay(); // sinkron ulang dgn server — kalau ada perubahan dari guru piket lain, ikut ke-refresh
    }
  }

  // ===== Rekap histori (semua tanggal) + form manual (guru tanpa jadwal di tanggal itu) =====
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [scheduleAttendance, setScheduleAttendance] = useState<SlotRecord[]>([]);
  const [dutyHistory, setDutyHistory] = useState<DutyRecord[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [bulkStatus, setBulkStatus] = useState("");
  const [dirtySlotKeys, setDirtySlotKeys] = useState<Set<string>>(new Set()); // sama alasannya dgn dirtyDayKeys di atas
  const [historySearch, setHistorySearch] = useState("");

  // ===== Pengaturan Poin (leaderboard kedisiplinan) — cuma ADMIN/Wakasek Penjamin Mutu/Kurikulum.
  // Tidak ada prop server-side utk deteksi jabatan (komponen ini dipakai lintas portal tanpa
  // prop drilling) — cukup coba GET, kalau 403 (FORBIDDEN) berarti tidak berwenang, section
  // disembunyikan total. Guru piket harian yang cuma bertugas hari itu TIDAK boleh ubah bobot poin
  // sekolah (lihat guard `assertPointConfigAccess` di point-config/route.ts).
  const [pointConfig, setPointConfig] = useState<Record<string, number> | null>(null);
  const [canEditPoints, setCanEditPoints] = useState(false);
  const [savingPoints, setSavingPoints] = useState(false);
  const [pointsSaved, setPointsSaved] = useState(false);

  useEffect(() => {
    fetch("/api/admin/kedisiplinan/point-config").then(async r => {
      if (!r.ok) { setCanEditPoints(false); return; }
      const d = await r.json();
      setPointConfig(d);
      setCanEditPoints(true);
    }).catch(() => {});
  }, []);

  function setPointField(key: string, value: string) {
    setPointConfig(prev => prev ? { ...prev, [key]: value === "" ? 0 : parseInt(value, 10) || 0 } : prev);
    setPointsSaved(false);
  }

  async function handleSavePoints() {
    if (!pointConfig) return;
    setSavingPoints(true);
    const res = await fetch("/api/admin/kedisiplinan/point-config", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pointConfig),
    });
    setSavingPoints(false);
    if (res.ok) { setPointsSaved(true); setTimeout(() => setPointsSaved(false), 3000); }
  }

  function load() {
    setLoading(true);
    setError("");
    fetch("/api/teacher/wakasek/penjamin-mutu/kedisiplinan").then(async r => {
      if (!r.ok) { const d = await r.json(); setError(d.error || "Gagal memuat data"); setLoading(false); return; }
      const d = await r.json();
      setRecords(d.records ?? []);
      setScheduleAttendance(d.scheduleAttendance ?? []);
      setDutyHistory(d.dutyAttendance ?? []);
      setTeachers(d.teachers ?? []);
      setLoading(false);
    }).catch(() => { setError("Gagal memuat data"); setLoading(false); });
  }
  useEffect(() => { load(); }, []);

  function openAdd() { setForm(EMPTY_FORM); setFormError(""); setSlots([]); setModal(true); }

  useEffect(() => {
    if (!modal || !form.teacherId || !form.date) { setSlots([]); return; }
    setLoadingSlots(true);
    setDirtySlotKeys(new Set());
    fetch(`/api/teacher/wakasek/penjamin-mutu/kedisiplinan/slots?teacherId=${form.teacherId}&date=${form.date}`)
      .then(r => r.json()).then(d => { setSlots(Array.isArray(d) ? d : []); setLoadingSlots(false); })
      .catch(() => setLoadingSlots(false));
  }, [modal, form.teacherId, form.date]);

  function setSlotField(key: string, field: "status" | "hasTugas" | "notes" | "tugasTitipan", value: string | boolean | null) {
    setSlots(prev => prev.map(s => {
      if (groupKey(s.scheduleIds) !== key) return s;
      const next = { ...s, [field]: value };
      if (field === "status" && value === "HADIR") next.hasTugas = null;
      return next;
    }));
    setDirtySlotKeys(prev => new Set(prev).add(key));
  }
  function applyBulkStatus() {
    setSlots(prev => prev.map(s => ({ ...s, status: bulkStatus, hasTugas: bulkStatus === "HADIR" ? null : s.hasTugas })));
    setDirtySlotKeys(new Set(slots.map(s => groupKey(s.scheduleIds))));
  }

  async function handleSave() {
    if (!form.teacherId) { setFormError("Pilih guru terlebih dahulu."); return; }
    // Guru punya jadwal di tanggal ini → simpan PER BLOK JAM PELAJARAN (TeacherScheduleAttendance).
    // Tidak ada jadwal (mis. libur/tidak mengajar) → tetap simpan 1 status sepanjang hari
    // (TeacherDiscipline), sama seperti alur lama.
    if (slots.length === 0 && !form.status) { setFormError("Pilih status kehadiran terlebih dahulu."); return; }
    const changedSlots = slots.filter(s => dirtySlotKeys.has(groupKey(s.scheduleIds)));
    // Status kosong (belum dipilih) JANGAN pernah ikut terkirim — baik dari blok yg baru diubah
    // maupun dari fallback "kirim semua apa adanya" di bawah.
    const toSend = (changedSlots.length > 0 ? changedSlots : slots).filter(s => s.status !== "");
    if (slots.length > 0 && toSend.length === 0) { setFormError("Pilih status kehadiran utk minimal 1 blok jam terlebih dahulu."); return; }
    setSaving(true);
    const res = slots.length > 0
      ? await fetch("/api/teacher/wakasek/penjamin-mutu/kedisiplinan/slots", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: form.date,
            records: toSend.map(s => ({ scheduleIds: s.scheduleIds, status: s.status, hasTugas: s.hasTugas, notes: s.notes, tugasTitipan: s.tugasTitipan ?? "" })),
          }),
        })
      : await fetch("/api/teacher/wakasek/penjamin-mutu/kedisiplinan", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
        });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setFormError(d.error || "Gagal menyimpan"); return; }
    setModal(false);
    load();
    if (form.date === viewDate) loadDay();
  }

  async function handleDeleteDaily(r: DailyRecord) {
    if (!(await confirmDialog(`Hapus catatan kedisiplinan ${r.teacher.user.name} tanggal ${fmt(r.date)}?`))) return;
    await fetch(`/api/teacher/wakasek/penjamin-mutu/kedisiplinan/${r.id}`, { method: "DELETE" });
    load();
  }
  async function handleDeleteSlotBlock(row: Extract<CombinedRow, { kind: "slot" }>) {
    if (!(await confirmDialog(`Hapus catatan absensi ${row.teacherName} — ${row.detail} tanggal ${fmt(row.date)}?`))) return;
    await Promise.all(row.ids.map(id => fetch(`/api/teacher/wakasek/penjamin-mutu/kedisiplinan/slots/${id}`, { method: "DELETE" }))).catch(() => {});
    load();
    loadDay();
  }
  async function handleDeleteDutyRecord(row: Extract<CombinedRow, { kind: "duty" }>) {
    if (!(await confirmDialog(`Hapus catatan piket ${row.teacherName} tanggal ${fmt(row.date)}?`))) return;
    await fetch(`/api/teacher/wakasek/penjamin-mutu/kedisiplinan/duty-attendance/${row.id}`, { method: "DELETE" });
    load();
    loadDutyAttendance();
  }

  if (error) {
    return (
      <div className="p-6 lg:p-8 pt-16 lg:pt-8">
        <div className="bg-red-50 border border-red-100 text-red-600 rounded-xl p-4 text-sm">{error}</div>
      </div>
    );
  }

  // Gabungkan JP berurutan (kelas+mapel+guru+status+adaTugas sama, di tanggal sama) jadi 1 blok —
  // key menyertakan `date`/`status`/`hasTugas` supaya blok TIDAK tergabung lintas tanggal atau
  // lintas status berbeda (kalau sebagian JP diedit manual jadi status lain, tetap kepisah).
  const scheduleBlocks = groupConsecutiveSchedules(
    scheduleAttendance.map(r => ({ ...r, startTime: r.schedule.startTime, endTime: r.schedule.endTime })),
    r => `${r.date}|${r.schedule.teacher?.nip ?? "-"}|${r.schedule.class.name}|${r.schedule.subject}|${r.status}|${r.hasTugas}`,
  );

  const combined: CombinedRow[] = [
    ...records.map((r): CombinedRow => ({
      kind: "daily", id: r.id, ids: [r.id], date: r.date, status: r.status, hasTugas: null, notes: r.notes,
      teacherName: r.teacher.user.name, teacherNip: r.teacher.nip, detail: "Sepanjang hari",
    })),
    ...scheduleBlocks.map(({ items, first, last }): CombinedRow => ({
      kind: "slot", id: first.id, ids: items.map(i => i.id), date: first.date, status: first.status, hasTugas: first.hasTugas, notes: first.notes,
      teacherName: first.schedule.teacher?.user.name ?? "-", teacherNip: first.schedule.teacher?.nip ?? "-",
      detail: `Kelas ${first.schedule.class.name} · ${first.schedule.subject} · ${first.schedule.startTime}–${last.schedule.endTime}`,
    })),
    ...dutyHistory.map((r): CombinedRow => ({
      kind: "duty", id: r.id, ids: [r.id], date: r.date, status: r.status, hasTugas: null, notes: r.notes,
      teacherName: r.user.name, teacherNip: r.user.teacher?.nip ?? r.user.role, detail: "Piket",
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const hadir = combined.filter(r => r.status === "HADIR").length;
  const terlambat = combined.filter(r => r.status === "TERLAMBAT").length;
  const alpha = combined.filter(r => r.status === "ALPHA").length;
  const hq = historySearch.toLowerCase();
  const filteredCombined = combined.filter(r =>
    !hq || r.teacherName.toLowerCase().includes(hq) || r.teacherNip.toLowerCase().includes(hq) || r.detail.toLowerCase().includes(hq)
  );

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<BadgeCheck size={22} />}
        title="Kedisiplinan Guru"
        description="Buku piket digital (kelas X & XI) — kehadiran guru per blok jam pelajaran, dicatat Wakil Kepala Penjamin Mutu atau Guru Piket"
      />

      <div className="alat-aksi justify-end mb-5">
        <button onClick={openAdd} className="btn-modal-save">
          <Plus size={15} /> Tambah Manual
        </button>
      </div>

      {/* ===== Buku Piket — tabel semua kelas & guru per tanggal ===== */}
      <div className="panel p-5 mb-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center [&>*]:max-w-full justify-between gap-4 mb-4">
          <div className="flex w-full min-w-0 items-center gap-3 sm:w-auto">
            <label className="label-field mb-0 whitespace-nowrap">Tanggal:</label>
            <div className="min-w-0 flex-1"><DatePicker value={viewDate} onChange={setViewDate} /></div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={dayBulkStatus} onChange={setDayBulkStatus} options={STATUS_OPTIONS} placeholder="Pilih Status" />
            <button onClick={applyDayBulkStatus} disabled={daySlots.length === 0 || !dayBulkStatus}
              className="btn-modal-cancel px-3 text-xs whitespace-nowrap">
              Terapkan ke Semua
            </button>
          </div>
        </div>

        {loadingDay ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-400"><Loader2 size={18} className="animate-spin" /> Memuat jadwal hari ini...</div>
        ) : daySlots.length === 0 ? (
          <EmptyState icon={CalendarClock} title="Tidak Ada Jadwal" description="Tidak ada jadwal mengajar kelas X/XI pada tanggal ini (libur/akhir pekan)." />
        ) : (
          <>
            {/* Dikelompokkan PER KELAS (bukan tabel flat diurut jam) — samakan dengan format
                "Daftar Kehadiran Guru" manual yang sudah dipakai sekolah lewat WhatsApp. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {Object.entries(
                daySlots.reduce<Record<string, DaySlotItem[]>>((acc, s) => {
                  (acc[s.className] ??= []).push(s);
                  return acc;
                }, {})
              ).sort(([a], [b]) => a.localeCompare(b)).map(([className, items]) => (
                <div key={className} className="bg-gray-50/60 rounded-xl border border-gray-100 overflow-hidden">
                  <div className="px-3 py-2 border-b border-gray-100 bg-[#f5f6fa] text-primary-900 text-xs font-bold">{className}</div>
                  <div className="divide-y divide-gray-100">
                    {items.map(s => {
                      const key = groupKey(s.scheduleIds);
                      const locked = isFutureSlot(s);
                      if (locked) {
                        return (
                          <div key={key} className="p-3 space-y-1 opacity-60">
                            <p className="text-xs font-semibold text-primary-900">{jamKeLabel(s)} · {s.subject}</p>
                            <p className="text-xs text-gray-500 -mt-1">{s.teacherName}</p>
                            <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium pt-1">
                              <Clock size={11} /> Belum waktunya — mulai jam {s.startTime}
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div key={key} className="p-3 space-y-2">
                          <p className="text-xs font-semibold text-primary-900">{jamKeLabel(s)} · {s.subject}</p>
                          <p className="text-xs text-gray-500 -mt-1">{s.teacherName}</p>
                          {s.statusHarian && s.statusHarian !== "HADIR" && (
                            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5">
                              <span className="text-xs font-semibold text-blue-700">
                                Catatan TU: {s.statusHarian.replace("_", " ")}
                              </span>
                              {s.keteranganHarian && <span className="text-xs text-blue-600/80">· {s.keteranganHarian}</span>}
                              {s.status !== s.statusHarian && (
                                <button type="button" onClick={() => terapkanStatusHarian(s.teacherId, s.statusHarian!)}
                                  className="ml-auto rounded-lg bg-blue-600 px-2 py-1 text-xs font-semibold text-white transition hover:bg-blue-700">
                                  Terapkan ke semua jam
                                </button>
                              )}
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-2">
                            <Select value={s.status} onChange={v => setDaySlotField(key, "status", v)}
                              options={STATUS_OPTIONS_ROW}
                              buttonClassName={`w-full flex items-center justify-between gap-1 text-xs font-semibold rounded-lg border px-2 py-1.5 cursor-pointer ${STATUS_BADGE[s.status]}`} />
                            <Select value={s.hasTugas === null ? "" : s.hasTugas ? "ya" : "tidak"}
                              disabled={s.status === "HADIR"}
                              onChange={v => setDaySlotField(key, "hasTugas", v === "" ? null : v === "ya")}
                              options={TUGAS_OPTIONS}
                              buttonClassName="w-full flex items-center justify-between gap-1 text-xs rounded-lg border border-gray-200 px-2 py-1.5 disabled:opacity-40 disabled:bg-white bg-white cursor-pointer disabled:cursor-not-allowed" />
                          </div>
                          {s.hasTugas === true && (
                            <textarea value={s.tugasTitipan ?? ""} onChange={e => setDaySlotField(key, "tugasTitipan", e.target.value)} rows={2} maxLength={500}
                              className="input-field text-xs py-1.5 w-full" placeholder="Tugas untuk kelas — tampil di HP siswa & TV kelas (mis. Kerjakan LKS hal. 24 no. 1–5)" />
                          )}
                          <input value={s.notes} onChange={e => setDaySlotField(key, "notes", e.target.value)}
                            className="input-field text-xs py-1.5 w-full" placeholder="Catatan (opsional)" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-4 mt-4">
              {daySaved && <p className="text-emerald-600 text-sm font-semibold">✓ Tersimpan!</p>}
              {!daySaved && dirtyDayKeys.size > 0 && (
                <p className="text-amber-600 text-xs font-medium">{dirtyDayKeys.size} baris belum disimpan</p>
              )}
              <button onClick={handleSaveDay} disabled={savingDay || dirtyDayKeys.size === 0} className="btn-modal-save disabled:opacity-40 disabled:cursor-not-allowed">
                {savingDay ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Simpan Semua
              </button>
            </div>
          </>
        )}
      </div>

      {/* ===== Kehadiran Guru Piket — petugas piket ITU SENDIRI, bukan absensi mengajar ===== */}
      <div className="panel p-5 mb-5">
        <h3 className="font-heading font-semibold text-primary-900 mb-1 flex items-center gap-2">
          <CalendarClock size={16} className="text-primary-700" /> Kehadiran Guru Piket &amp; Imam Sholat
        </h3>
        <p className="text-xs text-gray-400 mb-4">Apakah petugas yang terjadwal piket dan imam sholat tanggal ini benar-benar hadir menjalankan tugasnya.</p>
        <div className="flex items-center gap-2 bg-primary-50/60 border border-primary-100 rounded-xl px-3 py-2.5 mb-4">
          <ScanLine size={16} className="text-primary-700 shrink-0" />
          <input value={scanDutyInput} onChange={e => setScanDutyInput(e.target.value)} onKeyDown={handleScanDuty}
            placeholder="Scan Kartu Tanda petugas piket lalu Enter — otomatis tercatat Hadir hari ini..."
            className="flex-1 bg-transparent border-0 outline-none text-sm placeholder:text-gray-400" />
        </div>
        {loadingDuty ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-400"><Loader2 size={18} className="animate-spin" /> Memuat...</div>
        ) : dutyAttendance.length === 0 && imam.length === 0 ? (
          <p className="text-sm text-gray-400 py-4">
            Tidak ada guru/staf yang terjadwal piket atau menjadi imam sholat pada tanggal ini.
            {imamLibur ? ` Tanggal ini libur (${imamLibur}).` : ""}
          </p>
        ) : (
          <>
            <p className="label-kecil mb-2 text-gray-400">Petugas Piket</p>
            {dutyAttendance.length === 0 ? (
              <p className="text-sm text-gray-400">Tidak ada guru/staf yang terjadwal piket pada tanggal ini.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {dutyAttendance.map(d => (
                  <div key={d.userId} className="bg-gray-50/60 rounded-xl border border-gray-100 p-3 space-y-2">
                    <div>
                      <p className="text-xs font-semibold text-primary-900">{d.userName}</p>
                      <p className="text-xs text-gray-400">{d.userNip ?? d.userRole}</p>
                    </div>
                    <Select value={d.status} onChange={v => setDutyField(d.userId, "status", v)}
                      options={STATUS_OPTIONS_ROW}
                      buttonClassName={`w-full flex items-center justify-between gap-1 text-xs font-semibold rounded-lg border px-2 py-1.5 cursor-pointer ${STATUS_BADGE[d.status]}`} />
                    <input value={d.notes} onChange={e => setDutyField(d.userId, "notes", e.target.value)}
                      className="input-field text-xs py-1.5 w-full" placeholder="Catatan (opsional)" />
                  </div>
                ))}
              </div>
            )}

            <p className="label-kecil mb-2 mt-5 text-gray-400">Imam Sholat</p>
            {imam.length === 0 ? (
              <p className="text-sm text-gray-400">
                {imamLibur
                  ? `Tanggal ini libur (${imamLibur}) — tidak ada jadwal imam.`
                  : "Belum ada jadwal imam sholat untuk hari ini. Jadwalnya disusun di menu Jadwal Imam Sholat."}
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {imam.map(i => {
                  const kunci = `${i.userId}|${i.sesi}`;
                  return (
                    <div key={`${kunci}|${i.slot}`} className="bg-gray-50/60 rounded-xl border border-gray-100 p-3 space-y-2">
                      <div>
                        <p className="text-xs font-semibold text-primary-900">{i.nama}</p>
                        <p className="text-xs text-gray-400">{LABEL_TUGAS_IMAM[`${i.sesi}|${i.slot}`] ?? i.sesi}</p>
                      </div>
                      <Select value={i.status} onChange={v => setImamField(kunci, "status", v)}
                        options={STATUS_OPTIONS_IMAM}
                        buttonClassName={`w-full flex items-center justify-between gap-1 text-xs font-semibold rounded-lg border px-2 py-1.5 cursor-pointer ${STATUS_BADGE[i.status]}`} />
                      <input value={i.catatan} onChange={e => setImamField(kunci, "catatan", e.target.value)}
                        className="input-field text-xs py-1.5 w-full" placeholder="Catatan (opsional)" />
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-end gap-4 mt-4">
              {dutySaved && <p className="text-emerald-600 text-sm font-semibold">✓ Tersimpan!</p>}
              {!dutySaved && dirtyDutyUserIds.size + dirtyImamKeys.size > 0 && (
                <p className="text-amber-600 text-xs font-medium">{dirtyDutyUserIds.size + dirtyImamKeys.size} belum disimpan</p>
              )}
              <button onClick={handleSaveDuty} disabled={savingDuty || dirtyDutyUserIds.size + dirtyImamKeys.size === 0}
                className="btn-modal-save disabled:opacity-40 disabled:cursor-not-allowed">
                {savingDuty ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Simpan
              </button>
            </div>
          </>
        )}
      </div>

      {/* ===== Rekap histori ===== */}
      {loading ? (
        <PageSkeleton />
      ) : (
        <>
          <div className="kisi-kartu kisi-kartu-3 mb-5">
            <StatTile color="emerald" value={hadir} label="Hadir" icon={CheckCircle2} />
            <StatTile color="amber" value={terlambat} label="Terlambat" icon={Clock} />
            <StatTile color="red" value={alpha} label="Alpha" icon={XCircle} />
          </div>
          {combined.length > 0 && (
            <div className="relative max-w-sm mb-4">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={historySearch} onChange={e => setHistorySearch(e.target.value)}
                placeholder="Cari nama guru, NIP, atau kelas..." className="input-field pl-10" />
            </div>
          )}
          {combined.length === 0 ? (
            <EmptyState icon={BadgeCheck} title="Belum Ada Catatan" description="Catat kehadiran & kedisiplinan guru di sini." />
          ) : filteredCombined.length === 0 ? (
            <EmptyState icon={Search} title="Tidak Ditemukan" description="Tidak ada catatan yang cocok dengan pencarian." />
          ) : (
            <div className="panel overflow-hidden">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      {["Guru", "Tanggal", "Kelas / Jam", "Status", "Ada Tugas", "Catatan", ""].map(h => (
                        <th key={h} className="whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCombined.map(r => (
                      <tr key={`${r.kind}-${r.id}`}>
                        <td>
                          <p className="font-semibold text-primary-900">{r.teacherName}</p>
                          <p className="text-gray-400 text-xs font-mono">{r.teacherNip}</p>
                        </td>
                        <td className="text-gray-500 text-xs whitespace-nowrap">{fmt(r.date)}</td>
                        <td className="text-gray-500 text-xs whitespace-nowrap">{r.detail}</td>
                        <td>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_BADGE[r.status]}`}>
                            {STATUS_OPTIONS.find(s => s.value === r.status)?.label}
                          </span>
                        </td>
                        <td className="text-gray-500 text-xs whitespace-nowrap">{r.kind === "slot" ? tugasLabel(r.hasTugas) : "-"}</td>
                        <td className="text-gray-500 text-xs">{r.notes || "-"}</td>
                        <td className="text-right whitespace-nowrap">
                          <button
                            onClick={() => {
                              if (r.kind === "daily") handleDeleteDaily(records.find(x => x.id === r.id)!);
                              else if (r.kind === "slot") handleDeleteSlotBlock(r);
                              else handleDeleteDutyRecord(r);
                            }}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition" title="Hapus">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ===== Pengaturan Poin — cuma tampil kalau berwenang (ADMIN / Wakasek Penjamin Mutu / Kurikulum) ===== */}
      {canEditPoints && pointConfig && (
        <div className="panel p-5 mt-6">
          <h3 className="font-heading font-semibold text-primary-900 mb-1 flex items-center gap-2">
            <Coins size={16} className="text-primary-700" /> Pengaturan Poin Kedisiplinan
          </h3>
          <p className="text-xs text-gray-400 mb-4">Bobot poin per status ini dipakai untuk menghitung Papan Peringkat Kedisiplinan Guru — bisa diedit kapan saja.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              { key: "pointHadir", label: "Hadir" },
              { key: "pointTerlambat", label: "Terlambat" },
              { key: "pointIzinAdaTugas", label: "Izin (Ada Tugas)" },
              { key: "pointIzinTanpaTugas", label: "Izin (Tanpa Tugas)" },
              { key: "pointSakitAdaTugas", label: "Sakit (Ada Tugas)" },
              { key: "pointSakitTanpaTugas", label: "Sakit (Tanpa Tugas)" },
              { key: "pointAlpha", label: "Alpha" },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="label-field">{label}</label>
                <input type="number" className="input-field" value={pointConfig[key] ?? 0}
                  onChange={e => setPointField(key, e.target.value)} />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleSavePoints} disabled={savingPoints} className="btn-modal-save disabled:opacity-40">
              {savingPoints ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Simpan Poin
            </button>
            {pointsSaved && <span className="text-emerald-600 text-xs font-semibold">Tersimpan.</span>}
          </div>
        </div>
      )}

      <Modal scrollBody
        open={modal}
        onClose={() => setModal(false)}
        title="Tambah Manual — Guru Tanpa Jadwal"
        footer={
          <>
            <button type="button" onClick={() => setModal(false)} className="btn-modal-cancel flex-1">Batal</button>
            <button type="button" onClick={handleSave} disabled={saving} className="btn-modal-save flex-1">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan
            </button>
          </>
        }
      >
        {formError && <p className="error-msg mb-3">{formError}</p>}
        <div className="space-y-3">
          <p className="text-xs text-gray-400 flex items-center gap-1.5">
            <CheckSquare size={13} /> Untuk kasus khusus: guru yang tidak muncul di tabel Buku Piket (tidak ada jadwal di tanggal itu) tapi tetap perlu dicatat izin/sakit.
          </p>
          <div>
            <label className="label-field">Guru</label>
            <Select value={form.teacherId} onChange={v => setForm(p => ({ ...p, teacherId: v }))}
              options={teachers.map(t => ({ value: t.id, label: `${t.user.name} (${t.nip})` }))} placeholder="— Pilih Guru —" />
          </div>
          <div>
            <label className="label-field">Tanggal</label>
            <DatePicker value={form.date} onChange={v => setForm(p => ({ ...p, date: v }))} />
          </div>

          {form.teacherId && form.date && (
            loadingSlots ? (
              <p className="text-xs text-gray-400">Memuat jadwal...</p>
            ) : slots.length > 0 ? (
              <div className="bg-primary-50 border border-primary-100 rounded-xl p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-primary-700 flex items-center gap-1.5">
                    <CalendarClock size={13} /> Guru ini ternyata ADA jadwal — isi per blok jam pelajaran
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={bulkStatus} onChange={setBulkStatus} options={STATUS_OPTIONS} placeholder="Pilih Status" />
                  <button type="button" onClick={applyBulkStatus} disabled={!bulkStatus}
                    className="btn-modal-cancel px-3 text-xs whitespace-nowrap">
                    Terapkan ke Semua Jam
                  </button>
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {slots.map(s => {
                    const key = groupKey(s.scheduleIds);
                    return (
                      <div key={key} className="bg-white rounded-lg border border-gray-100 p-2.5 space-y-2">
                        <p className="text-xs font-semibold text-primary-900">
                          {s.startTime}–{s.endTime}{s.periodCount > 1 && ` (${s.periodCount} JP)`} · {s.subject} · Kelas {s.className}{s.room && ` · ${s.room}`}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <Select value={s.status} onChange={v => setSlotField(key, "status", v)} options={STATUS_OPTIONS} />
                          <Select value={s.hasTugas === null ? "" : s.hasTugas ? "ya" : "tidak"}
                            onChange={v => setSlotField(key, "hasTugas", v === "" ? null : v === "ya")}
                            options={TUGAS_OPTIONS} />
                        </div>
                        {s.hasTugas === true && (
                          <textarea value={s.tugasTitipan ?? ""} onChange={e => setSlotField(key, "tugasTitipan", e.target.value)} rows={2} maxLength={500}
                            className="input-field text-xs" placeholder="Tugas untuk kelas — tampil di HP siswa & TV kelas" />
                        )}
                        <input value={s.notes} onChange={e => setSlotField(key, "notes", e.target.value)}
                          className="input-field text-xs" placeholder="Catatan (opsional)" />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <>
                <div className="bg-primary-50 border border-primary-100 rounded-xl p-3">
                  <p className="text-xs text-gray-500 flex items-center gap-1.5">
                    <CalendarClock size={13} /> Guru ini tidak ada jadwal mengajar pada tanggal ini — catatan disimpan untuk sepanjang hari.
                  </p>
                </div>
                <div>
                  <label className="label-field">Status</label>
                  <Select value={form.status} onChange={v => setForm(p => ({ ...p, status: v }))} options={STATUS_OPTIONS} placeholder="Pilih Status" />
                </div>
                <div>
                  <label className="label-field">Catatan (opsional)</label>
                  <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="input-field resize-none" />
                </div>
              </>
            )
          )}
        </div>
      </Modal>
    </div>
  );
}
