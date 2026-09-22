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
import PrintKop from "@/components/shared/PrintKop";
import { buildPrintFilename } from "@/lib/print-filename";
import { bagianWib } from "@/lib/waktu-wib";

export async function generateMetadata() {
  const activeYear = await prisma.academicYear.findFirst({ where: { isActive: true } });
  return { title: { absolute: buildPrintFilename("Rekap_Siswa", activeYear?.name, currentSemesterLabel()) } };
}

const GRADES = [10, 11, 12] as const;
const GRADE_LABEL: Record<number, string> = { 10: "X", 11: "XI", 12: "XII" };
// Urutan jurusan mengikuti format rekap resmi sekolah
const MAJOR_ORDER = ["TKJ", "AK", "DKV", "ATU", "DPIB"];

function currentSemesterLabel(): string {
  const month = bagianWib().bulan; // 1-12, WIB
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

/** Label jurusan: lambang di KIRI, kode & nama di KANAN — mendatar, bukan bertumpuk.
 * Versi bertumpuk (lambang di atas, kode di tengah, nama di bawah) membuat tiap baris tabel
 * setinggi ±3 baris teks dan memboroskan tinggi halaman (temuan user 13 September 2026). */
function MajorLabel({ major, color, size = 26 }: {
  major: { code: string; name: string; logoUrl?: string | null }; color: string; size?: number;
}) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <CrestBadge url={major.logoUrl} code={major.code} color={color} size={size} />
      <div className="min-w-0 text-left">
        <div className="text-[11px] font-bold text-primary-900 leading-tight">{major.name}</div>
        <div className="text-[10px] text-gray-400 leading-tight">{major.code}</div>
      </div>
      <style>{`
        @media print {
          /* MENDATAR: satu tabel gabungan berisi 12 kolom angka tidak muat di A4 potret.
             Margin ditaruh sebagai padding wadah, bukan di @page — dropdown "Margins" di dialog
             cetak Chrome mengalahkan @page, jadi kalau petugas memilih "None" isinya menempel ke
             tepi kertas (temuan user 13 September 2026 pada Buku Mutasi). */
          @page { size: A4 landscape; margin: 0; }
          .lembar-rekap { padding: 1cm; }
        }
      `}</style>
    </div>
  );
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
        <Image src={url} alt={code} width={size - 10} height={size - 10} className="object-contain" />
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
    getSettings(["school.name", "logo.full_white"]),
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
    // Banyaknya ROMBEL (bukan jumlah siswa) per tingkat — inilah angka yang dijanjikan judul
    // kolom "Banyaknya Rombel" pada rekap resmi. Tabel lama menaruh jumlah SISWA di bawah judul
    // itu, jadi angkanya kembar persis dengan kolom "Jml" di sebelahnya (temuan 13 September 2026).
    const rombelPerGrade = GRADES.map(g => majorClasses.filter(c => c.grade === g).length);
    const rombelTotal = rombelPerGrade.reduce((a, b) => a + b, 0);
    const color = major.themeColor || "#1B2B6B";
    return {
      major, rows, totalL, totalP, total: totalL + totalP, perGradeTotal,
      rombelPerGrade, rombelTotal, color,
    };
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
      <PageHeader
        icon={<BarChart3 size={22} />}
        title="Rekapitulasi Jumlah Siswa"
        description="Jumlah rombel dan peserta didik menurut jenis kelamin, per jurusan dan tingkat — hanya siswa berstatus Aktif"
        printHidden
      />

      <div className="flex items-center gap-2 mb-5 print:hidden">
        <Link href="/dashboard/admin/reports" className="btn-modal-cancel">
          <ArrowLeft size={18} /> Kembali
        </Link>
        <PrintButton />
      </div>

      <div className="print-doc lembar-rekap bg-white rounded-2xl border border-gray-100 shadow-sm p-6 print:border-0 print:shadow-none print:rounded-none overflow-hidden">
        {/* Kop resmi — sama persis dengan halaman cetak lain (Buku Tamu, Ekspedisi, Jadwal).
            Sebelumnya cuma tiga baris teks tanpa lambang sekolah, jadi hasil cetaknya tidak
            kelihatan sebagai dokumen resmi (temuan user 13 September 2026). */}
        <PrintKop
          title="Rekapitulasi Jumlah Siswa"
          subtitle={`${settings["school.name"] || "SMK Al Munawwir IIBS"} — Tahun Pelajaran ${activeYear?.name ?? "-"} · Semester ${currentSemesterLabel()}`}
          logoUrl={settings["logo.full_white"]}
          edgeClassName="-mx-6 print:-mx-6"
        />

        {/* SATU tabel saja.
            Dulu terpisah dua (Ringkasan per jurusan + Detail per rombel), lalu digabung atas
            permintaan user 13 September 2026 ("kita gabung saja... maka kita buat landscape") —
            digabung berarti 12 kolom angka, yang memang tidak muat di A4 potret, jadi halaman ini
            dicetak MENDATAR.

            Banyaknya rombel TIDAK dijadikan kolom tersendiri: satuannya beda dengan kolom-kolom
            di sebelahnya (rombel vs siswa) dan justru itu yang dulu bikin salah baca. Angkanya
            ditaruh di baris subtotal tiap jurusan, menyatu dengan tulisannya. */}
        <h4 className="font-heading font-bold text-primary-900 mb-3">Jumlah Peserta Didik per Rombongan Belajar</h4>
        <div className="overflow-x-auto mb-6 rounded-xl border border-primary-900/15 shadow-sm print:shadow-none">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th rowSpan={2} className="sticky left-0 z-20 border border-primary-900 bg-primary-900 text-white px-3 py-2.5 min-w-52 text-left">Konsentrasi Keahlian</th>
                <th rowSpan={2} className="sticky left-52 z-20 border border-primary-900 bg-primary-900 text-white px-2 py-2.5 min-w-20 shadow-[2px_0_4px_rgba(0,0,0,0.1)]">Rombel ke-</th>
                {GRADES.map(g => (
                  <th key={g} colSpan={3} className="border border-primary-900 bg-primary-700 text-white px-3 py-2 uppercase tracking-wide text-xs font-bold">Kelas {GRADE_LABEL[g]}</th>
                ))}
                <th rowSpan={2} className="border border-primary-900 bg-gold text-primary-900 px-2 py-2.5 font-bold">Jumlah<br />Siswa</th>
              </tr>
              <tr>
                {GRADES.map(g => (
                  <Fragment key={g}>
                    <th className="border border-primary-900 bg-primary-50 px-2 py-1.5 font-semibold text-primary-700 w-12">L</th>
                    <th className="border border-primary-900 bg-primary-50 px-2 py-1.5 font-semibold text-primary-700 w-12">P</th>
                    <th className="border border-primary-900 bg-gold/25 px-2 py-1.5 font-bold text-primary-900 w-14">Jml</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {majorRows.map(({ major, rows, color, perGradeTotal, rombelPerGrade, rombelTotal, total }, mi) => (
                <Fragment key={major.id}>
                  {rows.map((row, idx) => (
                    <tr key={`${major.id}-${row.rombel}`}
                      style={{ backgroundColor: `rgba(${hexToRgb(color)}, ${mi % 2 === 0 ? 0.05 : 0.1})` }}>
                      {idx === 0 && (
                        <td rowSpan={rows.length}
                          className="sticky left-0 z-10 border-r-4 border-y border-l border-gray-200 px-3 py-2 align-middle bg-white"
                          style={{ borderRightColor: color }}>
                          <MajorLabel major={major} color={color} size={30} />
                        </td>
                      )}
                      <td className="sticky left-52 z-10 border border-gray-200 px-2 py-1.5 text-center text-gray-500 font-semibold bg-white shadow-[2px_0_4px_rgba(0,0,0,0.04)]">
                        {rows.length > 1 ? `R${row.rombel}` : "—"}
                      </td>
                      {row.perGrade.map((c, gi) => (
                        <Fragment key={gi}>
                          <td className="border border-gray-200 px-2 py-1.5 text-center text-gray-600">{c?.l ?? <span className="text-gray-300">–</span>}</td>
                          <td className="border border-gray-200 px-2 py-1.5 text-center text-gray-600">{c?.p ?? <span className="text-gray-300">–</span>}</td>
                          <td className="border border-gray-200 px-2 py-1.5 text-center font-semibold text-primary-900 bg-primary-50/60">{c ? c.l + c.p : <span className="text-gray-300">–</span>}</td>
                        </Fragment>
                      ))}
                      <td className="border border-gray-200 px-2 py-1.5 text-center font-bold text-primary-900 bg-gold/10">{row.jml || ""}</td>
                    </tr>
                  ))}
                  {/* Subtotal jurusan — sekaligus tempat banyaknya rombel disebutkan. */}
                  <tr className="bg-primary-700/10 font-semibold">
                    <td colSpan={2} className="sticky left-0 z-10 border border-primary-900/20 bg-primary-100/70 px-3 py-1.5 text-left text-primary-900 text-xs">
                      Jumlah {major.code}
                      <span className="font-normal text-primary-700"> — {rombelTotal} rombel (X {rombelPerGrade[0]} · XI {rombelPerGrade[1]} · XII {rombelPerGrade[2]})</span>
                    </td>
                    {perGradeTotal.map((g, gi) => (
                      <Fragment key={gi}>
                        <td className="border border-primary-900/20 px-2 py-1.5 text-center text-primary-900">{g.l}</td>
                        <td className="border border-primary-900/20 px-2 py-1.5 text-center text-primary-900">{g.p}</td>
                        <td className="border border-primary-900/20 px-2 py-1.5 text-center font-bold text-primary-900">{g.jml}</td>
                      </Fragment>
                    ))}
                    <td className="border border-primary-900/20 px-2 py-1.5 text-center font-bold text-primary-900 bg-gold/25">{total}</td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-primary-900 text-white font-bold">
                <td colSpan={2} className="sticky left-0 z-10 border border-primary-900 bg-primary-900 px-3 py-2.5 uppercase tracking-wide text-xs text-left">
                  Jumlah Keseluruhan
                  <span className="font-normal normal-case tracking-normal text-white/70"> — {majorRows.reduce((n, m) => n + m.rombelTotal, 0)} rombel</span>
                </td>
                {gradeTotals.map(g => (
                  <Fragment key={g.grade}>
                    <td className="border border-primary-900 px-2 py-2.5 text-center">{g.l}</td>
                    <td className="border border-primary-900 px-2 py-2.5 text-center">{g.p}</td>
                    <td className="border border-primary-900 px-2 py-2.5 text-center bg-primary-700">{g.jml}</td>
                  </Fragment>
                ))}
                <td className="border border-primary-900 px-2 py-2.5 text-center bg-gold text-primary-900">{grandTotal}</td>
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
