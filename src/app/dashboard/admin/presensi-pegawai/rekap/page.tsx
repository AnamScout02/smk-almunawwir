export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft, UserCheck } from "lucide-react";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";
import { getSettings, getPrincipalName } from "@/lib/site-settings";
import PageHeader from "@/components/admin/PageHeader";
import PrintButton from "@/components/shared/PrintButton";
import PrintKop from "@/components/shared/PrintKop";

/** Singkatan status di kalender rekap — satu huruf supaya 31 kolom tetap muat di satu halaman. */
const KODE: Record<string, string> = {
  HADIR: "H", IZIN: "I", SAKIT: "S", DINAS_LUAR: "D", CUTI: "C", ALPHA: "A",
};
const WARNA: Record<string, string> = {
  H: "text-emerald-700", I: "text-blue-700", S: "text-amber-700",
  D: "text-purple-700", C: "text-cyan-700", A: "text-red-600 font-bold",
};

/** Rekap presensi pegawai satu bulan — `?month=YYYY-MM` (default bulan berjalan). */
export default async function RekapPresensiPegawaiPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await verifyTasAccess();
  const { month } = await searchParams;
  const mm = month && /^\d{4}-\d{2}$/.test(month) ? month : new Date().toLocaleDateString("sv-SE").slice(0, 7);
  const [y, m] = mm.split("-").map(Number);
  const jumlahHari = new Date(y, m, 0).getDate();

  const [users, rows, settings] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: ["TEACHER", "TAS"] } },
      select: {
        id: true, name: true, role: true,
        teacher: { select: { nip: true, position: true, teacherStatus: true } },
        staffJabatan: { select: { jabatan: { select: { name: true } } } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.staffAttendance.findMany({
      // Rentang tanggal dibentuk di UTC — kolomnya bertipe DATE dan ditulis pada tengah malam
      // UTC oleh API-nya, jadi batasnya harus memakai skala yang sama.
      where: { tanggal: { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) } },
      select: { userId: true, tanggal: true, status: true },
    }),
    getSettings(["logo.full_white", "school.structure"]),
  ]);

  const pegawai = users.filter(u => u.teacher?.teacherStatus !== "KELUAR" && u.teacher?.teacherStatus !== "PENSIUN");
  const principalName = getPrincipalName(settings["school.structure"]);
  const monthLabel = new Date(y, m - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  // peta: userId -> tanggal(1-31) -> kode status
  const peta = new Map<string, Map<number, string>>();
  for (const r of rows) {
    const hari = new Date(r.tanggal).getUTCDate();
    if (!peta.has(r.userId)) peta.set(r.userId, new Map());
    peta.get(r.userId)!.set(hari, KODE[r.status] ?? "?");
  }
  const hitung = (uid: string, kode: string) =>
    [...(peta.get(uid)?.values() ?? [])].filter(v => v === kode).length;

  const th = "border border-gray-800 bg-primary-900 text-white px-1 py-1.5 text-center align-middle text-[8px]";
  const td = "border border-gray-800 px-1 py-0.5 align-middle text-[8px] text-center";

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0 min-h-screen print:min-h-0 bg-white">
      <style>{"@page { size: A4 landscape; margin: 8mm; }"}</style>

      <PageHeader icon={<UserCheck size={22} />} title="Rekap Presensi Pegawai" description={monthLabel} printHidden />

      <div className="flex items-center gap-2 mb-5 print:hidden">
        <Link href="/dashboard/admin/presensi-pegawai"
          className="btn-modal-cancel">
          <ArrowLeft size={18} /> Kembali
        </Link>
        <PrintButton />
      </div>

      <div className="print-doc bg-white">
        <PrintKop title="Rekapitulasi Presensi Pegawai" subtitle={`${monthLabel} — ${pegawai.length} pegawai`} logoUrl={settings["logo.full_white"]} />

        <div className="overflow-x-auto scrollbar-visible">
          <table className="w-full border-collapse mb-3">
            <thead>
              <tr>
                <th className={`${th} w-6`}>No</th>
                <th className={`${th} text-left`} style={{ minWidth: "4.5cm" }}>Nama Pegawai</th>
                {Array.from({ length: jumlahHari }, (_, i) => {
                  const hari = new Date(y, m - 1, i + 1).getDay();
                  return (
                    <th key={i} className={`${th} ${hari === 0 ? "bg-red-700" : ""}`} style={{ width: "0.62cm" }}>
                      {i + 1}
                    </th>
                  );
                })}
                <th className={th} style={{ width: "0.8cm" }}>H</th>
                <th className={th} style={{ width: "0.8cm" }}>I</th>
                <th className={th} style={{ width: "0.8cm" }}>S</th>
                <th className={th} style={{ width: "0.8cm" }}>D</th>
                <th className={th} style={{ width: "0.8cm" }}>C</th>
                <th className={th} style={{ width: "0.8cm" }}>A</th>
              </tr>
            </thead>
            <tbody>
              {pegawai.length === 0 ? (
                <tr><td className={td} colSpan={jumlahHari + 8}>Belum ada data pegawai.</td></tr>
              ) : pegawai.map((p, i) => (
                <tr key={p.id}>
                  <td className={td}>{i + 1}</td>
                  <td className={`${td} text-left`}>
                    {p.name}
                    {p.teacher?.nip ? <span className="block text-[7px] text-gray-500">{p.teacher.nip}</span> : null}
                  </td>
                  {Array.from({ length: jumlahHari }, (_, d) => {
                    const kode = peta.get(p.id)?.get(d + 1) ?? "";
                    const minggu = new Date(y, m - 1, d + 1).getDay() === 0;
                    return (
                      <td key={d} className={`${td} ${minggu ? "bg-red-50" : ""} ${WARNA[kode] ?? ""}`}>{kode}</td>
                    );
                  })}
                  <td className={`${td} font-semibold`}>{hitung(p.id, "H")}</td>
                  <td className={td}>{hitung(p.id, "I")}</td>
                  <td className={td}>{hitung(p.id, "S")}</td>
                  <td className={td}>{hitung(p.id, "D")}</td>
                  <td className={td}>{hitung(p.id, "C")}</td>
                  <td className={`${td} font-semibold text-red-600`}>{hitung(p.id, "A")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-[9px] text-gray-600 mb-6">
          Keterangan: <b>H</b> Hadir · <b>I</b> Izin · <b>S</b> Sakit · <b>D</b> Dinas Luar ·
          <b> C</b> Cuti · <b>A</b> Tanpa Keterangan. Kolom kosong berarti hari itu belum dicek
          (bukan berarti tidak hadir). Kolom berlatar merah muda adalah hari Minggu.
        </p>

        <div className="text-xs text-right pr-8" style={{ breakInside: "avoid" }}>
          <p>Banyuwangi, {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
          <p className="font-semibold">Kepala SMK Al Munawwir IIBS</p>
          <div className="h-10" />
          <p className="font-semibold underline">{principalName || "( _____________ )"}</p>
        </div>
      </div>
    </div>
  );
}
