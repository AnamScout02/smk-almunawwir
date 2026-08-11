export const dynamic = "force-dynamic";

import { Fragment } from "react";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import Link from "next/link";
import { ArrowLeft, BarChart3 } from "lucide-react";
import PrintButton from "@/components/shared/PrintButton";
import Image from "next/image";
import PageHeader from "@/components/admin/PageHeader";

const GRADES = [10, 11, 12] as const;
const GRADE_LABEL: Record<number, string> = { 10: "X", 11: "XI", 12: "XII" };
// Urutan jurusan mengikuti format rekap resmi sekolah
const MAJOR_ORDER = ["TKJ", "AK", "DKV", "ATU", "DPIB"];

function currentSemesterLabel(): string {
  const month = new Date().getMonth() + 1; // 1-12
  return month >= 7 || month <= 1 ? "Ganjil" : "Genap";
  // Catatan: Juli-Desember = Ganjil, Januari-Juni = Genap (kalender akademik Indonesia)
}

function rombelIndex(className: string): number {
  const m = className.match(/(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : 1;
}

/** #RRGGBB -> "r, g, b" supaya bisa dipakai dengan opacity lewat rgba() di inline style. */
function hexToRgb(hex: string): string {
  const m = hex.replace("#", "").match(/.{1,2}/g);
  if (!m || m.length < 3) return "27, 43, 107";
  return m.slice(0, 3).map(x => parseInt(x, 16)).join(", ");
}

/** Teks putih atau navy tergantung kegelapan warna latar, supaya selalu kontras & terbaca. */
function textColorFor(hex: string): string {
  const [r, g, b] = hexToRgb(hex).split(", ").map(Number);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#0F1A45" : "#FFFFFF";
}

/** Lambang jurusan selalu di atas latar solid warna jurusan — sebagian lambang memakai
 * elemen putih/terang yang jadi tak terlihat kalau ditaruh di atas latar putih. */
function CrestBadge({ url, code, color, size }: { url?: string | null; code: string; color: string; size: number }) {
  return (
    <div
      className="rounded-lg flex items-center justify-center shrink-0"
      style={{ backgroundColor: color, width: size, height: size }}
    >
      {url ? (
        <Image src={url} alt={code} width={size - 10} height={size - 10} className="object-contain" unoptimized />
      ) : (
        <span className="text-white font-bold" style={{ fontSize: size * 0.32 }}>{code.slice(0, 2)}</span>
      )}
    </div>
  );
}

export default async function RekapSiswaPage() {
  await verifyTasAccess();

  const [classes, activeYear, settings] = await Promise.all([
    prisma.class.findMany({
      include: {
        major: { select: { id: true, code: true, name: true, logoUrl: true, themeColor: true } },
        students: { where: { studentStatus: "AKTIF" }, select: { gender: true } },
      },
    }),
    prisma.academicYear.findFirst({ where: { isActive: true } }),
    getSettings(["school.name"]),
  ]);

  const majors = Array.from(new Map(classes.map(c => [c.major.id, c.major])).values())
    .sort((a, b) => {
      const ai = MAJOR_ORDER.indexOf(a.code), bi = MAJOR_ORDER.indexOf(b.code);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

  type Cell = { total: number; l: number; p: number } | null;
  function cellFor(majorId: string, grade: number, rombel: number): Cell {
    const cls = classes.find(c => c.major.id === majorId && c.grade === grade && rombelIndex(c.name) === rombel);
    if (!cls) return null;
    const l = cls.students.filter(s => s.gender === "L").length;
    const p = cls.students.filter(s => s.gender === "P").length;
    return { total: cls.students.length, l, p };
  }

  const majorRows = majors.map(major => {
    const majorClasses = classes.filter(c => c.major.id === major.id);
    const maxRombel = Math.max(1, ...majorClasses.map(c => rombelIndex(c.name)));
    const rows = Array.from({ length: maxRombel }, (_, i) => {
      const rombel = i + 1;
      const perGrade = GRADES.map(g => cellFor(major.id, g, rombel));
      const jml = perGrade.reduce((sum, c) => sum + (c?.total ?? 0), 0);
      return { rombel, perGrade, jml };
    });
    const totalL = majorClasses.reduce((s, c) => s + c.students.filter(st => st.gender === "L").length, 0);
    const totalP = majorClasses.reduce((s, c) => s + c.students.filter(st => st.gender === "P").length, 0);
    const perGradeTotal = GRADES.map(g => {
      const gc = majorClasses.filter(c => c.grade === g);
      const l = gc.reduce((s, c) => s + c.students.filter(st => st.gender === "L").length, 0);
      const p = gc.reduce((s, c) => s + c.students.filter(st => st.gender === "P").length, 0);
      return { l, p, jml: l + p };
    });
    const color = major.themeColor || "#1B2B6B";
    return { major, rows, totalL, totalP, total: totalL + totalP, perGradeTotal, color, textColor: textColorFor(color) };
  });

  const gradeTotals = GRADES.map(g => {
    const gc = classes.filter(c => c.grade === g);
    const l = gc.reduce((s, c) => s + c.students.filter(st => st.gender === "L").length, 0);
    const p = gc.reduce((s, c) => s + c.students.filter(st => st.gender === "P").length, 0);
    return { grade: g, l, p, jml: l + p };
  });
  const grandL = gradeTotals.reduce((s, g) => s + g.l, 0);
  const grandP = gradeTotals.reduce((s, g) => s + g.p, 0);
  const grandTotal = grandL + grandP;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0">
      <div className="print:hidden">
        <PageHeader
          icon={<BarChart3 size={22} />}
          title="Rekapitulasi Jumlah Siswa"
          description="Jumlah rombel dan peserta didik menurut jenis kelamin, per jurusan dan tingkat — hanya siswa berstatus Aktif"
        />
      </div>

      <div className="flex items-center gap-2 mb-5 print:hidden">
        <Link href="/dashboard/admin/reports" className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition">
          <ArrowLeft size={18} />
        </Link>
        <PrintButton />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 print:border-0 print:shadow-none print:rounded-none">
        {/* Kop */}
        <div className="text-center mb-6 pb-5 border-b-2 border-primary-900/10">
          <h2 className="font-heading font-bold text-lg text-primary-900 uppercase tracking-wide">Rekapitulasi Jumlah Siswa</h2>
          <h3 className="font-heading font-bold text-lg text-primary-900 uppercase">{settings["school.name"] || "SMK Al Munawwir IIBS"}</h3>
          <p className="font-heading font-semibold text-primary-700 text-sm mt-1">Tahun Pelajaran {activeYear?.name ?? "-"} · Semester {currentSemesterLabel()}</p>
        </div>

        {/* Ringkasan visual: grafik batang jumlah siswa per jurusan, tersegmentasi per tingkat */}
        <div className="mb-8">
          <h4 className="font-heading font-bold text-primary-900 mb-3">Jumlah Siswa per Konsentrasi Keahlian</h4>
          <div className="flex flex-col gap-4 bg-gray-50/60 rounded-xl border border-gray-100 p-4">
            {(() => {
              const maxTotal = Math.max(1, ...majorRows.map(m => m.total));
              const tintAlpha: Record<number, number> = { 10: 0.35, 11: 0.65, 12: 1 };
              return majorRows.map(({ major, total, totalL, totalP, perGradeTotal, color }) => (
                <div key={major.id} className="flex items-center gap-3">
                  <div className="flex items-center gap-2 w-56 shrink-0">
                    <CrestBadge url={major.logoUrl} code={major.code} color={color} size={30} />
                    <div className="min-w-0 text-xs font-bold text-primary-900 truncate">{major.name}</div>
                  </div>
                  <div className="flex-1 h-7 flex items-center">
                    <div
                      className="h-full flex items-center gap-[2px] rounded-md overflow-hidden"
                      style={{ width: `${Math.max((total / maxTotal) * 100, total > 0 ? 4 : 0)}%` }}
                    >
                      {GRADES.map((g, i) => perGradeTotal[i].jml > 0 && (
                        <div
                          key={g}
                          className="h-full flex items-center justify-center gap-1 px-1"
                          style={{
                            width: `${(perGradeTotal[i].jml / (total || 1)) * 100}%`,
                            backgroundColor: `rgba(${hexToRgb(color)}, ${tintAlpha[g]})`,
                          }}
                          title={`Kelas ${GRADE_LABEL[g]}: ${perGradeTotal[i].jml} siswa (L ${perGradeTotal[i].l} · P ${perGradeTotal[i].p})`}
                        >
                          {(perGradeTotal[i].jml / total) > 0.09 && (
                            <span className="text-[10px] font-bold whitespace-nowrap" style={{ color: textColorFor(color) }}>
                              {GRADE_LABEL[g]}&nbsp;{perGradeTotal[i].jml}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="w-28 text-right shrink-0">
                    <div className="font-heading font-bold text-primary-900 text-lg leading-none">{total}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">Total &middot; L {totalL} &middot; P {totalP}</div>
                  </div>
                </div>
              ));
            })()}
          </div>
          <p className="text-[11px] text-gray-400 mt-2">Panjang batang = jumlah siswa jurusan tsb; tiap batang dibagi per segmen tingkat (label pada segmen = tingkat &amp; jumlahnya, warna makin pekat = tingkat makin tinggi). Rincian L/P per tingkat ada di tabel di bawah.</p>
        </div>

        {/* Tabel 1: Rombel & Jenis Kelamin per Rombel */}
        <h4 className="font-heading font-bold text-primary-900 mb-3">Detail per Rombongan Belajar</h4>
        <div className="overflow-x-auto mb-8 rounded-xl border border-primary-900/15 shadow-sm">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th rowSpan={3} className="sticky left-0 z-20 border border-primary-900 bg-primary-900 text-white px-3 py-2.5 min-w-48">Konsentrasi Keahlian</th>
                <th rowSpan={3} className="sticky left-48 z-20 border border-primary-900 bg-primary-900 text-white px-2 py-2.5 min-w-20 shadow-[2px_0_4px_rgba(0,0,0,0.1)]">Rombel</th>
                <th colSpan={4} className="border border-primary-900 bg-primary-700 text-white px-3 py-2 uppercase tracking-wide text-xs font-bold">Jumlah Rombel Kelas</th>
                <th colSpan={9} className="border border-primary-900 bg-primary-700 text-white px-3 py-2 uppercase tracking-wide text-xs font-bold">Jumlah Peserta Didik Menurut Jenis Kelamin</th>
              </tr>
              <tr>
                <th className="border border-primary-900 bg-primary-500 text-white px-2 py-1.5 font-bold">X</th>
                <th className="border border-primary-900 bg-primary-500 text-white px-2 py-1.5 font-bold">XI</th>
                <th className="border border-primary-900 bg-primary-500 text-white px-2 py-1.5 font-bold">XII</th>
                <th rowSpan={2} className="border border-primary-900 bg-gold text-primary-900 px-2 py-1.5 font-bold">Jml</th>
                <th colSpan={3} className="border border-primary-900 bg-primary-500 text-white px-2 py-1.5 font-bold">X</th>
                <th colSpan={3} className="border border-primary-900 bg-primary-500 text-white px-2 py-1.5 font-bold">XI</th>
                <th colSpan={3} className="border border-primary-900 bg-primary-500 text-white px-2 py-1.5 font-bold">XII</th>
              </tr>
              <tr>
                {GRADES.map(g => (
                  <Fragment key={g}>
                    <th className="border border-primary-900 bg-primary-50 px-2 py-1.5 font-semibold text-primary-700">L</th>
                    <th className="border border-primary-900 bg-primary-50 px-2 py-1.5 font-semibold text-primary-700">P</th>
                    <th className="border border-primary-900 bg-gold/25 px-2 py-1.5 font-bold text-primary-900">Jml</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {majorRows.map(({ major, rows, color, textColor }, mi) => (
                rows.map((row, idx) => (
                  <tr key={`${major.id}-${row.rombel}`}
                    className="hover:brightness-95 transition-[filter]"
                    style={{ backgroundColor: `rgba(${hexToRgb(color)}, ${mi % 2 === 0 ? 0.05 : 0.1})` }}>
                    {idx === 0 && (
                      <td rowSpan={rows.length}
                        className="sticky left-0 z-10 border-r-4 border-y border-l border-gray-200 px-3 py-3 align-middle bg-white"
                        style={{ borderRightColor: color }}>
                        <div className="flex flex-col items-center gap-1.5 text-center">
                          <CrestBadge url={major.logoUrl} code={major.code} color={color} size={44} />
                          <span className="text-[11px] font-bold uppercase tracking-wide leading-tight px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: color, color: textColor }}>
                            {major.code}
                          </span>
                          <span className="text-[11px] font-semibold text-gray-600 leading-tight">{major.name}</span>
                        </div>
                      </td>
                    )}
                    <td className="sticky left-48 z-10 border border-gray-200 px-2 py-1.5 text-center text-gray-500 font-semibold bg-white shadow-[2px_0_4px_rgba(0,0,0,0.04)]">
                      {rows.length > 1 ? `R${row.rombel}` : "—"}
                    </td>
                    {row.perGrade.map((c, gi) => (
                      <td key={gi} className="border border-gray-200 px-2 py-2 text-center font-semibold text-primary-900">
                        {c?.total ?? <span className="text-gray-300">–</span>}
                      </td>
                    ))}
                    <td className="border border-gray-200 px-2 py-2 text-center font-bold text-primary-900 bg-gold/10">{row.jml || ""}</td>
                    {row.perGrade.map((c, gi) => (
                      <Fragment key={gi}>
                        <td className="border border-gray-200 px-2 py-2 text-center text-gray-600">{c?.l ?? ""}</td>
                        <td className="border border-gray-200 px-2 py-2 text-center text-gray-600">{c?.p ?? ""}</td>
                        <td className="border border-gray-200 px-2 py-2 text-center font-semibold text-primary-900 bg-primary-50/60">{c ? c.l + c.p : ""}</td>
                      </Fragment>
                    ))}
                  </tr>
                ))
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-primary-900 text-white font-bold">
                <td colSpan={2} className="sticky left-0 z-10 border border-primary-900 bg-primary-900 px-3 py-2.5 uppercase tracking-wide text-xs">Jumlah Keseluruhan</td>
                {gradeTotals.map(g => (
                  <td key={g.grade} className="border border-primary-900 px-2 py-2.5 text-center">{g.jml}</td>
                ))}
                <td className="border border-primary-900 px-2 py-2.5 text-center bg-gold text-primary-900">{grandTotal}</td>
                {gradeTotals.map(g => (
                  <Fragment key={g.grade}>
                    <td className="border border-primary-900 px-2 py-2.5 text-center">{g.l}</td>
                    <td className="border border-primary-900 px-2 py-2.5 text-center">{g.p}</td>
                    <td className="border border-primary-900 px-2 py-2.5 text-center bg-primary-700">{g.jml}</td>
                  </Fragment>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Total per tingkat */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          {gradeTotals.map(({ grade, l, p, jml }) => (
            <div key={grade} className="rounded-xl overflow-hidden border border-primary-900 text-center text-sm">
              <div className="bg-primary-900 text-white font-bold py-1.5">{GRADE_LABEL[grade]}</div>
              <div className="font-bold text-primary-900 py-1.5 border-b border-gray-100">{jml}</div>
              <div className="grid grid-cols-2 text-xs">
                <div className="border-r border-gray-100 py-1"><span className="text-gray-400">L</span> {l}</div>
                <div className="py-1"><span className="text-gray-400">P</span> {p}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Grand total */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="rounded-xl overflow-hidden border border-primary-900 text-center text-sm">
            <div className="bg-primary-900 text-white font-bold py-1.5">L</div>
            <div className="font-bold text-primary-900 py-2">{grandL}</div>
          </div>
          <div className="rounded-xl overflow-hidden border border-primary-900 text-center text-sm">
            <div className="bg-primary-900 text-white font-bold py-1.5">P</div>
            <div className="font-bold text-primary-900 py-2">{grandP}</div>
          </div>
        </div>
        <div className="rounded-xl overflow-hidden border border-primary-900 text-center text-sm mt-4">
          <div className="bg-primary-900 text-white font-bold py-2 uppercase tracking-wide">Jumlah Keseluruhan Peserta Didik</div>
          <div className="font-bold text-primary-900 text-lg py-3">{grandTotal}</div>
        </div>
      </div>
    </div>
  );
}
