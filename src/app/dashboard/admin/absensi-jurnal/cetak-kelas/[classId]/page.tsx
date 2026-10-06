"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Printer, ArrowLeft, Loader2, ClipboardCheck, Pencil } from "lucide-react";
import Select from "@/components/admin/Select";
import PrintKop from "@/components/shared/PrintKop";
import MonthPicker from "@/components/shared/MonthPicker";
import { CoverTemplate, COVER_TEMPLATE_KEY, resolveCoverText, DEFAULT_WIDTH_PCT } from "@/lib/cover-template";
import { usePrintTitle } from "@/lib/usePrintTitle";
import { buildPrintFilename } from "@/lib/print-filename";

const TAB_LABEL: Record<Tab, string> = { cover: "Cover", absensi: "Absensi", jurnal: "Jurnal", rekap: "Rekap" };

const MM_PX = 3.7795275591;

// margin cetak: [atas, kanan, bawah, kiri] dalam cm
const ABSENSI_MARGIN = { top: 1, right: 1, bottom: 1, left: 2.5 };
const JURNAL_MARGIN = { top: 2.5, right: 1, bottom: 1, left: 1 };
const REKAP_MARGIN = ABSENSI_MARGIN;
const COVER_MARGIN = { top: 0, right: 0, bottom: 0, left: 0 };

function pageMarginCss(m: { top: number; right: number; bottom: number; left: number }) {
  return `${m.top}cm ${m.right}cm ${m.bottom}cm ${m.left}cm`;
}
function printableHeightMm(pageHeightMm: number, m: { top: number; bottom: number }) {
  return pageHeightMm - (m.top + m.bottom) * 10;
}

const ABSENSI_H_MM = printableHeightMm(297, ABSENSI_MARGIN);
const JURNAL_H_MM = printableHeightMm(210, JURNAL_MARGIN);
const REKAP_H_MM = printableHeightMm(297, REKAP_MARGIN);
const COVER_H_MM = printableHeightMm(297, COVER_MARGIN);

function useFitScale(maxHeightPx: number, deps: React.DependencyList) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const natural = el.scrollHeight;
    setScale(natural > maxHeightPx ? Math.max(0.5, maxHeightPx / natural) : 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { ref, scale };
}

interface RosterStudent {
  id: string; nis: string; nisn: string | null; gender: string | null;
  user: { name: string };
}
interface ClassInfo {
  id: string; name: string; grade: number;
  major: { name: string };
  homeroom: { user: { name: string } } | null;
  ttdWali?: string | null;
  students: RosterStudent[];
}

const BULAN_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

type Tab = "cover" | "absensi" | "jurnal" | "rekap";

export default function CetakAbsensiJurnalPage() {
  const { classId } = useParams<{ classId: string }>();
  const router = useRouter();
  const [cls, setCls] = useState<ClassInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("absensi");
  const [logoUrl, setLogoUrl] = useState("");
  const [coverTemplate, setCoverTemplate] = useState<CoverTemplate | null>(null);

  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const defaultSemester = now.getMonth() + 1 >= 7 ? "GANJIL" : "GENAP";
  const [monthValue, setMonthValue] = useState(defaultMonth);
  const [semester, setSemester] = useState<"GANJIL" | "GENAP">(defaultSemester);
  const [jumlahHari, setJumlahHari] = useState(30);
  const [totalBarisSiswa, setTotalBarisSiswa] = useState(35);
  const [totalBarisGuru, setTotalBarisGuru] = useState(10);

  usePrintTitle(cls ? buildPrintFilename("ABSENSI_JURNAL", cls.name, TAB_LABEL[tab], monthValue) : null);

  useEffect(() => {
    fetch(`/api/admin/classes/${classId}/roster`)
      .then(r => { if (!r.ok) return null; return r.json(); })
      .then(d => { setCls(d); setLoading(false); }).catch(() => { setLoading(false); });
    fetch("/api/settings/logos").then(r => r.json()).then(d => setLogoUrl(d.fullWhite ?? "")).catch(() => {});
    fetch("/api/admin/content").then(r => r.json())
      .then((rows: { key: string; value: string }[]) => {
        const row = rows.find(r => r.key === COVER_TEMPLATE_KEY);
        if (row) { try { setCoverTemplate(JSON.parse(row.value)); } catch { /* ignore corrupt value */ } }
      }).catch(() => {});
  }, [classId]);

  if (loading) return <div className="p-6 lg:p-8 pt-16 lg:pt-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;
  if (!cls) return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 flex flex-col items-center justify-center gap-3 min-h-[60vh] text-gray-400">
      <p>Data kelas tidak ditemukan</p>
      <button onClick={() => router.back()} className="text-primary-700 hover:underline text-sm">Kembali</button>
    </div>
  );

  const [year, month] = monthValue.split("-").map(Number);
  const monthLabel = `${BULAN_ID[month - 1]} ${year}`;
  const tahunPelajaran = month >= 7 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
  const homeroomName = cls.homeroom?.user.name ?? "";
  const isLandscape = tab === "jurnal";
  const pageMargin = tab === "jurnal" ? JURNAL_MARGIN : tab === "rekap" ? REKAP_MARGIN : tab === "cover" ? COVER_MARGIN : ABSENSI_MARGIN;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0 print:pt-0">
      <style>{`@page { size: A4 ${isLandscape ? "landscape" : "portrait"}; margin: ${pageMarginCss(pageMargin)}; }`}</style>

      {/* Print controls — hidden on print */}
      <div className="print:hidden sticky top-0 lg:top-0 z-10 bg-white border border-gray-200 rounded-2xl px-6 py-3 shadow-sm mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 shrink-0">
            <ArrowLeft size={16} /> Kembali
          </button>
          <h1 className="text-sm font-semibold text-gray-700 shrink-0">
            Absensi & Jurnal — {cls.name} ({cls.students.length} siswa)
          </h1>
          <button onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-primary-700 text-white rounded-lg text-sm hover:bg-primary-900 shrink-0">
            <Printer size={15} /> Cetak / Simpan PDF
          </button>
        </div>
        <div className="flex items-center gap-3 flex-wrap mt-3">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            {([["cover", "Cover"], ["absensi", "Absensi Siswa"], ["jurnal", "Jurnal Mengajar"], ["rekap", "Rekap Bulanan"]] as [Tab, string][]).map(([v, label]) => (
              <button key={v} onClick={() => setTab(v)}
                className={`px-3 py-1.5 font-medium transition-colors ${tab === v ? "bg-primary-700 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}>
                {label}
              </button>
            ))}
          </div>
          <MonthPicker value={monthValue} onChange={setMonthValue} className="w-40" />
          <div className="w-32">
            <Select value={semester} onChange={v => setSemester(v as "GANJIL" | "GENAP")}
              options={[{ value: "GANJIL", label: "Ganjil" }, { value: "GENAP", label: "Genap" }]} />
          </div>
          {tab === "cover" && (
            <Link href="/dashboard/admin/absensi-jurnal/cover-editor"
              className="flex items-center gap-1.5 text-xs text-primary-700 hover:text-primary-900 font-semibold">
              <Pencil size={13} /> Edit Desain Cover
            </Link>
          )}
          {tab !== "rekap" && tab !== "cover" && (
            <label className="flex items-center gap-2 text-xs text-gray-500">
              Jumlah lembar
              <input type="number" min={1} max={31} value={jumlahHari} onChange={e => setJumlahHari(Number(e.target.value) || 1)}
                className="input-field !w-16 text-sm" />
            </label>
          )}
          {tab === "jurnal" ? (
            <label className="flex items-center gap-2 text-xs text-gray-500">
              Baris guru
              <input type="number" min={cls.students.length} max={60} value={totalBarisGuru} onChange={e => setTotalBarisGuru(Number(e.target.value) || 1)}
                className="input-field !w-16 text-sm" />
            </label>
          ) : tab !== "cover" ? (
            <label className="flex items-center gap-2 text-xs text-gray-500">
              Baris siswa
              <input type="number" min={cls.students.length} max={60} value={totalBarisSiswa} onChange={e => setTotalBarisSiswa(Number(e.target.value) || 1)}
                className="input-field !w-16 text-sm" />
            </label>
          ) : null}
        </div>
      </div>

      {/* Print container — TTD wali kelas lewat konteks supaya tidak dioper ke tiap lembar */}
      <TtdWaliKonteks.Provider value={cls.ttdWali ?? null}>
      <div className={`print-doc py-8 print:py-0 px-4 print:px-0 mx-auto print:mx-0 space-y-8 print:space-y-0 ${isLandscape ? "max-w-[1150px]" : "max-w-[850px]"}`}>
        {tab === "cover" && (
          <div className="shadow-lg print:shadow-none">
            <CoverSheet cls={cls} monthLabel={monthLabel} tahunPelajaran={tahunPelajaran} semester={semester}
              homeroomName={homeroomName} logoUrl={logoUrl} template={coverTemplate} last />
          </div>
        )}
        {tab === "absensi" && Array.from({ length: jumlahHari }).map((_, i) => (
          <div key={i} className="shadow-lg print:shadow-none">
            <AbsensiSheet cls={cls} monthLabel={monthLabel} tahunPelajaran={tahunPelajaran} semester={semester}
              homeroomName={homeroomName} totalBaris={totalBarisSiswa} last={i === jumlahHari - 1} />
          </div>
        ))}
        {tab === "jurnal" && Array.from({ length: jumlahHari }).map((_, i) => (
          <div key={i} className="shadow-lg print:shadow-none">
            <JurnalSheet cls={cls} monthLabel={monthLabel} tahunPelajaran={tahunPelajaran} semester={semester}
              homeroomName={homeroomName} totalBaris={totalBarisGuru} last={i === jumlahHari - 1} />
          </div>
        ))}
        {tab === "rekap" && (
          <div className="shadow-lg print:shadow-none">
            <RekapSheet cls={cls} monthLabel={monthLabel} tahunPelajaran={tahunPelajaran} semester={semester}
              homeroomName={homeroomName} totalBaris={totalBarisSiswa} last />
          </div>
        )}
      </div>
      </TtdWaliKonteks.Provider>
    </div>
  );
}

function SheetShell({ heightMm, last, contentRef, scale, children }: {
  heightMm: number; last?: boolean; contentRef: React.RefObject<HTMLDivElement | null>; scale: number; children: React.ReactNode;
}) {
  return (
    <div className={`relative w-full bg-white overflow-hidden ${last ? "" : "break-after-page"}`} style={{ height: `${heightMm}mm` }}>
      <div
        ref={contentRef}
        className="p-8 print:p-0 h-full flex flex-col"
        style={scale < 1 ? { transform: `scale(${scale})`, transformOrigin: "top left", width: `${100 / scale}%` } : undefined}
      >
        {children}
      </div>
    </div>
  );
}

function SheetTitle({ lines }: { lines: string[] }) {
  return (
    <div className="text-center mb-2">
      {lines.map((l, i) => (
        <p key={i} className={`font-bold leading-tight ${i === 0 ? "text-sm" : "text-xs"} text-primary-900`}>{l}</p>
      ))}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex text-xs text-primary-700">
      <span className="w-40 shrink-0">{label}</span>
      <span>: {value}</span>
    </div>
  );
}

function genderCounts(students: RosterStudent[]) {
  const L = students.filter(s => s.gender === "L").length;
  const P = students.filter(s => s.gender === "P").length;
  return { L, P, total: L + P };
}

const TtdWaliKonteks = createContext<string | null>(null);

function SignatureBlock({ monthLabel, homeroomName }: { monthLabel: string; homeroomName: string }) {
  const ttd = useContext(TtdWaliKonteks);
  return (
    <div className="text-xs text-primary-700 ml-auto text-center mt-2">
      <p>Singojuruh, {monthLabel}</p>
      <p>Wali Kelas</p>
      {/* eslint-disable-next-line @next/next/no-img-element -- data URL TTD */}
      {ttd ? <img src={ttd} alt="" className="mx-auto h-12 object-contain" /> : <div className="h-12" />}
      <p className="font-bold underline text-primary-900">{homeroomName || "—"}</p>
    </div>
  );
}

/* ── 0. Cover (sampul, dicetak 1x) ─────────────────────────────────────── */
function CoverSheet({ cls, monthLabel, tahunPelajaran, semester, homeroomName, logoUrl, template, last }: {
  cls: ClassInfo; monthLabel: string; tahunPelajaran: string; semester: string; homeroomName: string; logoUrl: string; template: CoverTemplate | null; last: boolean;
}) {
  const contentRef = useRef<HTMLDivElement>(null);

  if (template && template.imageUrl) {
    const ctx = {
      kelas: cls.name,
      kompetensi: cls.major.name,
      waliKelas: homeroomName || "—",
      tahunSemester: `${tahunPelajaran} · ${semester === "GANJIL" ? "Ganjil" : "Genap"}`,
      tahunPelajaran: `Tahun Pelajaran ${tahunPelajaran}`,
      semester: `Semester ${semester === "GANJIL" ? "Ganjil" : "Genap"}`,
      bulan: monthLabel,
    };
    return (
      <div className={`relative w-full bg-white overflow-hidden ${last ? "" : "break-after-page"}`} style={{ height: `${COVER_H_MM}mm` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={template.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        {template.texts.map(box => (
          <div key={box.id} className="absolute" style={{
            left: `${box.xPct}%`, top: `${box.yPct}%`, transform: "translate(-50%, -50%)",
            fontSize: `${box.fontSize}px`, color: box.color, fontWeight: box.bold ? 700 : 400,
            textAlign: box.align, whiteSpace: "pre-wrap", width: `${box.widthPct ?? DEFAULT_WIDTH_PCT}%`,
            fontFamily: "\"Arial Narrow\", Arial, sans-serif",
          }}>
            {resolveCoverText(box, ctx)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <SheetShell heightMm={COVER_H_MM} last={last} contentRef={contentRef} scale={1}>
      <PrintKop title="Buku Absensi Kehadiran & Jurnal Mengajar" subtitle="SMK Al Munawwir IIBS" logoUrl={logoUrl} />
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
        <div className="w-24 h-24 rounded-3xl flex items-center justify-center mb-8 shadow-lg"
          style={{ background: "linear-gradient(135deg, #0A1030 0%, #0F1A45 40%, #1B2B6B 100%)" }}>
          <ClipboardCheck size={44} className="text-gold" />
        </div>
        <p className="text-xs tracking-[0.3em] text-primary-500 font-semibold uppercase mb-2">Kelas</p>
        <h1 className="font-heading font-black text-primary-900 mb-8" style={{ fontSize: "4rem", lineHeight: 1 }}>{cls.name}</h1>
        <div className="w-24 h-1 rounded-full mb-8" style={{ background: "linear-gradient(90deg, #C9A227, #E8C766)" }} />
        <div className="space-y-3 text-sm">
          <p><span className="text-gray-400">Kompetensi Keahlian</span><br /><span className="font-bold text-primary-900 text-base">{cls.major.name}</span></p>
          <p><span className="text-gray-400">Wali Kelas</span><br /><span className="font-bold text-primary-900 text-base">{homeroomName || "—"}</span></p>
          <p><span className="text-gray-400">Tahun Pelajaran / Semester</span><br /><span className="font-bold text-primary-900 text-base">{tahunPelajaran} · {semester === "GANJIL" ? "Ganjil" : "Genap"}</span></p>
        </div>
      </div>
      <div className="h-2.5 rounded-full mb-3" style={{ background: "linear-gradient(90deg, #0A1030 0%, #1B2B6B 50%, #0A1030 100%)" }} />
      <p className="text-center text-[10px] text-gray-400">Singojuruh, Banyuwangi, Jawa Timur · NPSN 69896523</p>
    </SheetShell>
  );
}

/* ── 1. Absensi Siswa (harian, potrait, dicetak berulang) ─────────────── */
function AbsensiSheet({ cls, monthLabel, tahunPelajaran, semester, homeroomName, totalBaris, last }: {
  cls: ClassInfo; monthLabel: string; tahunPelajaran: string; semester: string; homeroomName: string; totalBaris: number; last: boolean;
}) {
  const students = cls.students;
  const rows = Math.max(totalBaris, students.length);
  const JAM = 12;
  const TTD_SLOTS = 10;
  // bagi rata rows ke tepat TTD_SLOTS kelompok (sisa baris didistribusi ke kelompok pertama)
  const actualSlots = Math.min(TTD_SLOTS, rows);
  const baseSize = Math.floor(rows / actualSlots);
  const extra = rows % actualSlots;
  const slotSizes = Array.from({ length: actualSlots }, (_, idx) => baseSize + (idx < extra ? 1 : 0));
  const slotOfRow: number[] = [];
  const slotStartRow: number[] = [];
  {
    let acc = 0;
    slotSizes.forEach((size, idx) => {
      slotStartRow.push(acc);
      for (let k = 0; k < size; k++) slotOfRow.push(idx);
      acc += size;
    });
  }
  const { L, P, total } = genderCounts(students);
  const { ref: contentRef, scale } = useFitScale(ABSENSI_H_MM * MM_PX, [rows, students.length, monthLabel, tahunPelajaran, semester, homeroomName]);

  return (
    <SheetShell heightMm={ABSENSI_H_MM} last={last} contentRef={contentRef} scale={scale}>
      <SheetTitle lines={[
        "ABSENSI SISWA SMK AL MUNAWWIR IIBS",
        `TAHUN PELAJARAN ${tahunPelajaran}`,
        `SEMESTER ${semester}`,
      ]} />
      <div className="mb-2 space-y-0">
        <InfoRow label="Kelas" value={cls.name} />
        <InfoRow label="Kompetensi Keahlian" value={cls.major.name} />
        <InfoRow label="Hari/Tanggal" value={`.......................... ${monthLabel}`} />
      </div>
      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr className="bg-primary-900 text-white">
            <th rowSpan={2} className="border border-primary-900 px-1 py-1 w-6">No</th>
            <th rowSpan={2} className="border border-primary-900 px-1 py-1 w-16">NIS</th>
            <th rowSpan={2} className="border border-primary-900 px-1 py-1 w-36">Nama</th>
            <th rowSpan={2} className="border border-primary-900 px-1 py-1 w-6">L/P</th>
            <th colSpan={JAM} className="border border-primary-900 px-1 py-1">Jam Pelajaran</th>
            <th rowSpan={2} className="border border-primary-900 px-1 py-1 w-16">TTD Guru Mapel</th>
          </tr>
          <tr className="bg-primary-900 text-white">
            {Array.from({ length: JAM }).map((_, j) => <th key={j} className="border border-primary-900 w-5">{j + 1}</th>)}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => {
            const s = students[i];
            const slotIdx = slotOfRow[i];
            const showSlot = i === slotStartRow[slotIdx];
            return (
              <tr key={i}>
                <td className="border border-gray-300 text-center h-5">{i + 1}</td>
                <td className="border border-gray-300 px-1 font-mono text-primary-700 whitespace-nowrap text-[8px]">{s?.nis ?? ""}</td>
                <td className="border border-gray-300 px-1 font-semibold text-gray-800 whitespace-nowrap overflow-hidden text-ellipsis max-w-0">{s?.user.name ?? ""}</td>
                <td className="border border-gray-300 text-center">{s?.gender ?? ""}</td>
                {Array.from({ length: JAM }).map((_, j) => <td key={j} className="border border-gray-300" />)}
                {showSlot && (
                  <td rowSpan={slotSizes[slotIdx]} className="border border-gray-300 text-left align-top pl-1 pt-0.5 text-primary-700">
                    {slotIdx + 1}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="flex items-start justify-between mt-3 text-[10px] text-primary-700">
        <div>
          <p className="font-semibold">Ket:</p>
          <p>Laki-Laki : {L}</p>
          <p>Perempuan : {P}</p>
          <p>Jumlah : {total}</p>
          <p className="mt-1">S = Sakit &nbsp; I = Izin &nbsp; A = Alfa &nbsp; T = Terlambat &nbsp; C = Cabut/Tidak mengikuti Pelajaran Tanpa Izin</p>
        </div>
        <SignatureBlock monthLabel={monthLabel} homeroomName={homeroomName} />
      </div>
    </SheetShell>
  );
}

/* ── 2. Jurnal Mengajar (harian, landscape, dicetak berulang) ─────────── */
function JurnalSheet({ cls, monthLabel, tahunPelajaran, semester, homeroomName, totalBaris, last }: {
  cls: ClassInfo; monthLabel: string; tahunPelajaran: string; semester: string; homeroomName: string; totalBaris: number; last: boolean;
}) {
  const rows = totalBaris;
  const { ref: contentRef, scale } = useFitScale(JURNAL_H_MM * MM_PX, [rows, monthLabel, tahunPelajaran, semester, homeroomName]);
  return (
    <SheetShell heightMm={JURNAL_H_MM} last={last} contentRef={contentRef} scale={scale}>
      <SheetTitle lines={[
        "JURNAL MENGAJAR SMK AL MUNAWWIR IIBS",
        `TAHUN PELAJARAN ${tahunPelajaran}`,
        `SEMESTER ${semester}`,
      ]} />
      <div className="mb-2 space-y-0">
        <InfoRow label="Kelas" value={cls.name} />
        <InfoRow label="Hari/Tanggal" value={`.......................... ${monthLabel}`} />
      </div>
      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr className="bg-primary-900 text-white">
            <th rowSpan={2} className="border border-primary-900 px-1 py-1.5 w-6">No</th>
            <th rowSpan={2} className="border border-primary-900 px-1 py-1.5 w-40">Nama Guru</th>
            <th rowSpan={2} className="border border-primary-900 px-1 py-1.5 w-32">Mata Pelajaran</th>
            <th rowSpan={2} className="border border-primary-900 px-1 py-1.5">Materi Pembelajaran</th>
            <th rowSpan={2} className="border border-primary-900 px-1 py-1.5 w-24">TP</th>
            <th rowSpan={2} className="border border-primary-900 px-1 py-1.5 w-28">Catatan</th>
            <th colSpan={2} className="border border-primary-900 px-1 py-1.5 w-28">Tanda Tangan</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => {
            const showPair = i % 2 === 0;
            return (
              <tr key={i}>
                <td className="border border-gray-300 text-center h-7">{i + 1}</td>
                <td className="border border-gray-300" />
                <td className="border border-gray-300" />
                <td className="border border-gray-300" />
                <td className="border border-gray-300" />
                <td className="border border-gray-300" />
                {showPair && (
                  <>
                    <td rowSpan={Math.min(2, rows - i)} className="border border-gray-300 text-left align-top pl-1 pt-0.5 text-primary-700 w-14">{i + 1}</td>
                    <td rowSpan={Math.min(2, rows - i)} className="border border-gray-300 text-left align-top pl-1 pt-0.5 text-primary-700 w-14">{i + 2}</td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="flex justify-end mt-3">
        <SignatureBlock monthLabel={monthLabel} homeroomName={homeroomName} />
      </div>
    </SheetShell>
  );
}

/* ── 3. Rekap Absensi Bulanan (dicetak 1x di akhir bulan) ──────────────── */
function RekapSheet({ cls, monthLabel, tahunPelajaran, semester, homeroomName, totalBaris, last }: {
  cls: ClassInfo; monthLabel: string; tahunPelajaran: string; semester: string; homeroomName: string; totalBaris: number; last: boolean;
}) {
  const students = cls.students;
  const rows = Math.max(totalBaris, students.length);
  const { L, P, total } = genderCounts(students);
  const weeks = [1, 2, 3, 4, 5];
  const { ref: contentRef, scale } = useFitScale(REKAP_H_MM * MM_PX, [rows, students.length, monthLabel, tahunPelajaran, semester, homeroomName]);

  return (
    <SheetShell heightMm={REKAP_H_MM} last={last} contentRef={contentRef} scale={scale}>
      <SheetTitle lines={[
        "REKAP ABSENSI BULANAN SISWA SMK AL MUNAWWIR IIBS",
        `TAHUN PELAJARAN ${tahunPelajaran}`,
        `SEMESTER ${semester}`,
      ]} />
      <div className="mb-2 space-y-0">
        <InfoRow label="Kelas" value={cls.name} />
        <InfoRow label="Kompetensi Keahlian" value={cls.major.name} />
        <InfoRow label="Hari/Tanggal" value={monthLabel} />
      </div>
      <table className="w-full border-collapse text-[9px]">
        <thead>
          <tr className="bg-primary-900 text-white">
            <th rowSpan={2} className="border border-primary-900 px-1 py-1 w-6">No</th>
            <th rowSpan={2} className="border border-primary-900 px-1 py-1 w-16">NIS</th>
            <th rowSpan={2} className="border border-primary-900 px-1 py-1 w-32">Nama</th>
            <th rowSpan={2} className="border border-primary-900 px-1 py-1 w-6">L/P</th>
            {weeks.map(w => <th key={w} colSpan={3} className="border border-primary-900 px-1 py-1">Minggu {w}</th>)}
            <th colSpan={3} className="border border-primary-900 px-1 py-1 bg-purple-800">Jumlah</th>
          </tr>
          <tr className="bg-primary-900 text-white">
            {weeks.map(w => ["S", "I", "A"].map(l => <th key={`${w}-${l}`} className="border border-primary-900 w-4">{l}</th>))}
            {["S", "I", "A"].map(l => <th key={`t-${l}`} className="border border-primary-900 w-4 bg-purple-800">{l}</th>)}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => {
            const s = students[i];
            return (
              <tr key={i}>
                <td className="border border-gray-300 text-center h-5">{i + 1}</td>
                <td className="border border-gray-300 px-1 font-mono text-primary-700 whitespace-nowrap text-[8px]">{s?.nis ?? ""}</td>
                <td className="border border-gray-300 px-1 font-semibold text-gray-800 whitespace-nowrap overflow-hidden text-ellipsis max-w-0">{s?.user.name ?? ""}</td>
                <td className="border border-gray-300 text-center">{s?.gender ?? ""}</td>
                {weeks.map(w => ["S", "I", "A"].map(l => <td key={`${w}-${l}`} className="border border-gray-300" />))}
                {["S", "I", "A"].map(l => <td key={`t-${l}`} className="border border-gray-300 bg-purple-100" />)}
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="flex items-start justify-between mt-3 text-[10px] text-primary-700">
        <div>
          <p className="font-semibold">Ket:</p>
          <p>Laki-Laki : {L}</p>
          <p>Perempuan : {P}</p>
          <p>Jumlah : {total}</p>
        </div>
        <SignatureBlock monthLabel={monthLabel} homeroomName={homeroomName} />
      </div>
    </SheetShell>
  );
}
