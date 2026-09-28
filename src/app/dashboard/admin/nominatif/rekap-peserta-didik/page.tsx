export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft, Users2 } from "lucide-react";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";
import { getSettings, getPrincipalName } from "@/lib/site-settings";
import { getKelasXIIEnrollYears, computeAutoPagu } from "@/lib/nominatif-pagu";
import PageHeader from "@/components/admin/PageHeader";
import PrintButton from "@/components/shared/PrintButton";
import PrintKop from "@/components/shared/PrintKop";

/* SATU elemen ikon dipakai kedua cabang — halaman server tidak boleh membuat dua
   elemen lucide yang sama (CLAUDE.md #35). */
const ikonHalaman = <Users2 size={22} />;

interface YearRef { id: string; isActive: boolean }
interface GenderCount { L: number; P: number; jml: number }

const ZERO: GenderCount = { L: 0, P: 0, jml: 0 };

/** Jumlah siswa per jenjang(grade)+jurusan untuk satu tahun ajaran — tahun AKTIF dihitung live
 * dari Student (paling akurat "saat ini"), tahun LAMPAU dari StudentClassHistory (snapshot yang
 * dibuat sistem kenaikan kelas, lihat naik-kelas/route.ts). Data histori HANYA ada kalau admin
 * sudah import/generate untuk tahun itu — kosong = "0", bukan error. */
async function studentCountsByGrade(majorId: string, majorName: string, grade: number, year: YearRef): Promise<GenderCount> {
  if (year.isActive) {
    const rows = await prisma.student.groupBy({
      by: ["gender"], where: { majorId, studentStatus: "AKTIF", class: { grade } }, _count: { _all: true },
    });
    const L = rows.find(r => r.gender === "L")?._count._all ?? 0;
    const P = rows.find(r => r.gender === "P")?._count._all ?? 0;
    return { L, P, jml: L + P };
  }
  const rows = await prisma.studentClassHistory.findMany({
    where: { academicYearId: year.id, grade, majorName, status: { in: ["AKTIF", "LULUS"] } },
    select: { student: { select: { gender: true } } },
  });
  const L = rows.filter(r => r.student.gender === "L").length;
  const P = rows.filter(r => r.student.gender === "P").length;
  return { L, P, jml: L + P };
}

/** Jumlah ROMBEL (kelas) sungguhan per jenjang+jurusan — tahun aktif dari Class, tahun lampau
 * dari jumlah nama kelas unik di StudentClassHistory (Class baris yang sama dipakai ulang tiap
 * tahun ajaran lewat kenaikan kelas, jadi live Class TIDAK bisa dipakai utk tahun lampau). */
async function rombelCount(majorId: string, majorName: string, grade: number, year: YearRef): Promise<number> {
  if (year.isActive) return prisma.class.count({ where: { majorId, grade } });
  const rows = await prisma.studentClassHistory.findMany({
    where: { academicYearId: year.id, grade, majorName }, select: { className: true }, distinct: ["className"],
  });
  return rows.filter(r => r.className).length;
}

function add(a: GenderCount, b: GenderCount): GenderCount {
  return { L: a.L + b.L, P: a.P + b.P, jml: a.jml + b.jml };
}

export default async function RekapPesertaDidikCetakPage({ searchParams }: { searchParams: Promise<{ academicYearId?: string }> }) {
  await verifyTasAccess();
  const { academicYearId } = await searchParams;

  const [selectedYear, allYears, majors, settings] = await Promise.all([
    academicYearId ? prisma.academicYear.findUnique({ where: { id: academicYearId } }) : prisma.academicYear.findFirst({ where: { isActive: true } }),
    prisma.academicYear.findMany({ orderBy: { startDate: "asc" } }),
    prisma.major.findMany({ orderBy: { name: "asc" } }),
    getSettings([
      "logo.full_white", "school.structure", "contact.address",
      "nominatif.pagu",
      "nominatif.pengawasNama", "nominatif.pengawasNip",
      "nominatif.dinasNama", "nominatif.dinasNip", "nominatif.dinasPangkat", "nominatif.dinasWilayah",
    ]),
  ]);

  const principalName = getPrincipalName(settings["school.structure"]);
  const paguMap = (() => { try { return JSON.parse(settings["nominatif.pagu"] || "{}"); } catch { return {}; } })() as Record<string, Record<string, number>>;

  if (!selectedYear) {
    return (
      <div className="p-6 lg:p-8 pt-16 lg:pt-8">
        <PageHeader icon={ikonHalaman} title="Rekap Peserta Didik" description="Belum ada Tahun Ajaran" />
        <p className="text-sm text-gray-400">Tambahkan Tahun Ajaran dulu di menu Tahun Ajaran.</p>
      </div>
    );
  }

  const idx = allYears.findIndex(y => y.id === selectedYear.id);
  const prevYear = idx > 0 ? allYears[idx - 1] : null;
  const paguForYear = paguMap[selectedYear.name] ?? {};

  const rows = await Promise.all(majors.map(async (m) => {
    const [rombelX, rombelXI, rombelXII, siswaX, siswaXI, siswaXII, uspLalu, kelasXIIEnrollYears] = await Promise.all([
      rombelCount(m.id, m.name, 10, selectedYear),
      rombelCount(m.id, m.name, 11, selectedYear),
      rombelCount(m.id, m.name, 12, selectedYear),
      studentCountsByGrade(m.id, m.name, 10, selectedYear),
      studentCountsByGrade(m.id, m.name, 11, selectedYear),
      studentCountsByGrade(m.id, m.name, 12, selectedYear),
      prevYear ? studentCountsByGrade(m.id, m.name, 12, prevYear) : Promise.resolve(ZERO),
      getKelasXIIEnrollYears(m.id, m.name, selectedYear),
    ]);
    // Pagu = override manual kalau ada, else otomatis (computeAutoPagu sudah membulatkan ke atas
    // ke kelipatan 10 — lihat nominatif-pagu.ts). Pendaftar & Diterima TIDAK lagi dari Admission
    // (selalu 0 utk tahun lampau krn tidak ada datanya di sana) — disamakan dengan Pagu sesuai
    // keputusan eksplisit user 2026-09-12.
    const pagu = paguForYear[m.code] ?? await computeAutoPagu(m.id, kelasXIIEnrollYears);
    return {
      major: m, rombelX, rombelXI, rombelXII, rombelJml: rombelX + rombelXI + rombelXII,
      siswaX, siswaXI, siswaXII, uspIni: siswaXII, uspLalu,
      pagu, pendaftar: pagu, diterima: pagu,
    };
  }));

  const totals = rows.reduce((acc, r) => ({
    pagu: acc.pagu + r.pagu, pendaftar: acc.pendaftar + r.pendaftar, diterima: acc.diterima + r.diterima,
    rombelX: acc.rombelX + r.rombelX, rombelXI: acc.rombelXI + r.rombelXI, rombelXII: acc.rombelXII + r.rombelXII, rombelJml: acc.rombelJml + r.rombelJml,
    siswaX: add(acc.siswaX, r.siswaX), siswaXI: add(acc.siswaXI, r.siswaXI), siswaXII: add(acc.siswaXII, r.siswaXII),
    uspIni: add(acc.uspIni, r.uspIni), uspLalu: add(acc.uspLalu, r.uspLalu),
  }), { pagu: 0, pendaftar: 0, diterima: 0, rombelX: 0, rombelXI: 0, rombelXII: 0, rombelJml: 0, siswaX: ZERO, siswaXI: ZERO, siswaXII: ZERO, uspIni: ZERO, uspLalu: ZERO });

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0 min-h-dvh print:min-h-0 bg-white">
      {/* Margin 1,5cm (bukan 1cm) — dgn tabel 25 kolom selebar ini, 1cm bikin isi terasa
          menempel ke tepi kertas (terukur 9,7mm, temuan user 2026-09-12). */}
      <style>{"@page { size: A4 landscape; margin: 1.5cm; }"}</style>

      <PageHeader icon={ikonHalaman} title="Rekap Peserta Didik"
        description={`Tahun Pelajaran ${selectedYear.name}`} printHidden />

      <div className="flex items-center gap-2 mb-5 print:hidden">
        <Link href="/dashboard/admin/nominatif" className="btn-modal-cancel">
          <ArrowLeft size={18} /> Kembali
        </Link>
        <PrintButton />
      </div>

      <div className="print-doc bg-white">
        <PrintKop title="Rekapitulasi Data Peserta Didik" subtitle={`Kelas X, XI, XII — Tahun Pelajaran ${selectedYear.name} — Kurikulum 2013 Revisi`} logoUrl={settings["logo.full_white"]} />

        <div className="text-[11px] mb-4 px-1 space-y-0.5">
          <div className="grid grid-cols-[7rem_1fr]"><span className="font-semibold">NAMA SMK</span><span>: SMK AL MUNAWWIR IIBS</span></div>
          <div className="grid grid-cols-[7rem_1fr]"><span className="font-semibold">ALAMAT SEKOLAH</span><span>: {settings["contact.address"] || "—"}</span></div>
        </div>

        {/* Tabel resmi bergaris penuh, bukan .data-table — header 3-baris ber-rowSpan/colSpan
            butuh border per-sel eksplisit (lihat catatan di nominatif/[majorId]/cetak/page.tsx),
            kalau tidak `background` bawaan .data-table (dipasang di <tr>, bukan per <th>) bikin
            "lubang" warna persis di persimpangan rowSpan/colSpan. */}
        {(() => {
          const th = "border border-gray-800 bg-primary-900 text-white px-1.5 py-1 align-middle";
          const td = "border border-gray-800 px-1.5 py-1 text-center align-middle break-words";
          // Warna soft per kelompok kolom — supaya Kelas X/XI/XII & kelompok data lain langsung
          // kelihatan beda tanpa perlu baca judul kolom berulang-ulang (keputusan eksplisit user
          // 2026-09-11: "warnain dengan warna soft ... ada bedanya kelas X, XI, XII dan data
          // lainnya"). Header TETAP navy (konsisten dgn tabel lain di app) — cuma sel DATA yang
          // ditinting, jadi teks putih header tidak perlu ganti warna.
          // -100 (bukan -50) — sempat dicoba -50 tapi kelewat pudar, hampir tak kelihatan
          // bedanya (keputusan eksplisit user 2026-09-11: "warna terlalu soft").
          const tdPsb = `${td} bg-blue-100`;
          const tdRombel = `${td} bg-purple-100`;
          const tdX = `${td} bg-emerald-100`;
          const tdXI = `${td} bg-amber-100`;
          const tdXII = `${td} bg-orange-100`;
          const tdUspIni = `${td} bg-cyan-100`;
          const tdUspLalu = `${td} bg-pink-100`;
          return (
            <table className="w-full border-collapse text-[11px]" style={{ tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "2%" }} /><col style={{ width: "10.5%" }} /><col style={{ width: "6%" }} />
                <col style={{ width: "3.5%" }} /><col style={{ width: "5.25%" }} /><col style={{ width: "5.25%" }} />
                <col style={{ width: "3%" }} /><col style={{ width: "3%" }} /><col style={{ width: "3%" }} /><col style={{ width: "3.5%" }} />
                {Array.from({ length: 5 }).flatMap((_, i) => [
                  <col key={`l${i}`} style={{ width: "3.5%" }} />,
                  <col key={`p${i}`} style={{ width: "3.5%" }} />,
                  <col key={`j${i}`} style={{ width: "4%" }} />,
                ])}
              </colgroup>
              <thead>
                <tr>
                  <th rowSpan={3} className={th}>No</th>
                  <th rowSpan={3} className={th}>Kompetensi Keahlian</th>
                  <th rowSpan={3} className={th}>Status Akreditasi</th>
                  <th colSpan={3} className={th}>Penerimaan Siswa Baru</th>
                  <th colSpan={4} className={th}>Jumlah Rombel</th>
                  <th colSpan={3} className={th}>Kelas X</th>
                  <th colSpan={3} className={th}>Kelas XI</th>
                  <th colSpan={3} className={th}>Kelas XII</th>
                  <th colSpan={3} className={th}>USP {selectedYear.name}</th>
                  <th colSpan={3} className={th}>USP {prevYear?.name ?? "—"}</th>
                </tr>
                <tr>
                  <th rowSpan={2} className={th}>Pagu</th><th rowSpan={2} className={th}>Pendaftar</th><th rowSpan={2} className={th}>Diterima</th>
                  <th rowSpan={2} className={th}>X</th><th rowSpan={2} className={th}>XI</th><th rowSpan={2} className={th}>XII</th><th rowSpan={2} className={th}>Jml</th>
                  {Array.from({ length: 5 }).map((_, i) => <th key={i} colSpan={3} className={th}>L / P / Jml</th>)}
                </tr>
                <tr>{Array.from({ length: 5 }).flatMap((_, i) => [<th key={`l${i}`} className={th}>L</th>, <th key={`p${i}`} className={th}>P</th>, <th key={`j${i}`} className={th}>Jml</th>])}</tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.major.id}>
                    <td className={td}>{i + 1}</td>
                    <td className={td}>{r.major.name}</td>
                    <td className={td}>{r.major.akreditasi === "SUDAH" ? "SUDAH" : r.major.akreditasi === "BELUM" ? "BELUM" : "—"}</td>
                    <td className={tdPsb}>{r.pagu}</td><td className={tdPsb}>{r.pendaftar}</td><td className={tdPsb}>{r.diterima}</td>
                    <td className={tdRombel}>{r.rombelX}</td><td className={tdRombel}>{r.rombelXI}</td><td className={tdRombel}>{r.rombelXII}</td><td className={`${tdRombel} font-semibold`}>{r.rombelJml}</td>
                    <td className={tdX}>{r.siswaX.L}</td><td className={tdX}>{r.siswaX.P}</td><td className={`${tdX} font-semibold`}>{r.siswaX.jml}</td>
                    <td className={tdXI}>{r.siswaXI.L}</td><td className={tdXI}>{r.siswaXI.P}</td><td className={`${tdXI} font-semibold`}>{r.siswaXI.jml}</td>
                    <td className={tdXII}>{r.siswaXII.L}</td><td className={tdXII}>{r.siswaXII.P}</td><td className={`${tdXII} font-semibold`}>{r.siswaXII.jml}</td>
                    <td className={tdUspIni}>{r.uspIni.L}</td><td className={tdUspIni}>{r.uspIni.P}</td><td className={`${tdUspIni} font-semibold`}>{r.uspIni.jml}</td>
                    <td className={tdUspLalu}>{r.uspLalu.L}</td><td className={tdUspLalu}>{r.uspLalu.P}</td><td className={`${tdUspLalu} font-semibold`}>{r.uspLalu.jml}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  {/* Baris JUMLAH memakai warna yang SAMA dengan baris judul (navy, teks putih),
                      bukan warna lembut per-kelompok seperti baris data — supaya baris total
                      langsung terbaca sebagai penutup tabel, bukan seperti satu baris data lagi
                      (keputusan user 2026-09-12). */}
                  <td colSpan={3} className={th}>JUMLAH</td>
                  <td className={th}>{totals.pagu}</td><td className={th}>{totals.pendaftar}</td><td className={th}>{totals.diterima}</td>
                  <td className={th}>{totals.rombelX}</td><td className={th}>{totals.rombelXI}</td><td className={th}>{totals.rombelXII}</td><td className={th}>{totals.rombelJml}</td>
                  <td className={th}>{totals.siswaX.L}</td><td className={th}>{totals.siswaX.P}</td><td className={th}>{totals.siswaX.jml}</td>
                  <td className={th}>{totals.siswaXI.L}</td><td className={th}>{totals.siswaXI.P}</td><td className={th}>{totals.siswaXI.jml}</td>
                  <td className={th}>{totals.siswaXII.L}</td><td className={th}>{totals.siswaXII.P}</td><td className={th}>{totals.siswaXII.jml}</td>
                  <td className={th}>{totals.uspIni.L}</td><td className={th}>{totals.uspIni.P}</td><td className={th}>{totals.uspIni.jml}</td>
                  <td className={th}>{totals.uspLalu.L}</td><td className={th}>{totals.uspLalu.P}</td><td className={th}>{totals.uspLalu.jml}</td>
                </tr>
              </tbody>
            </table>
          );
        })()}

        <div className="grid grid-cols-3 gap-6 mt-3 text-xs max-w-3xl mx-auto text-center" style={{ breakInside: "avoid" }}>
          <div>
            <p>Mengetahui dan menyetujui</p>
            <p className="font-semibold">Kepala Cabang Dinas Pendidikan</p>
            <p>{settings["nominatif.dinasWilayah"] || ""}</p>
            <div className="h-10" />
            <p className="font-semibold underline">{settings["nominatif.dinasNama"] || "( _____________ )"}</p>
            {settings["nominatif.dinasPangkat"] && <p>{settings["nominatif.dinasPangkat"]}</p>}
            <p>NIP. {settings["nominatif.dinasNip"] || "—"}</p>
          </div>
          <div>
            <p>Mengetahui</p>
            <p className="font-semibold">Pengawas SMK</p>
            <div className="h-10 mt-3" />
            <p className="font-semibold underline">{settings["nominatif.pengawasNama"] || "( _____________ )"}</p>
            <p>NIP. {settings["nominatif.pengawasNip"] || "—"}</p>
          </div>
          <div>
            <p>Banyuwangi, {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
            <p className="font-semibold">Kepala SMK Al Munawwir IIBS</p>
            <div className="h-10 mt-3" />
            <p className="font-semibold underline">{principalName || "( _____________ )"}</p>
            <p>NIP. —</p>
          </div>
        </div>
      </div>
    </div>
  );
}
