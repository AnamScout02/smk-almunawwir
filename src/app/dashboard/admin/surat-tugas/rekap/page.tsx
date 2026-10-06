export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft, ClipboardSignature } from "lucide-react";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";
import { getSettings, getPrincipalName } from "@/lib/site-settings";
import PageHeader from "@/components/admin/PageHeader";
import PrintButton from "@/components/shared/PrintButton";
import PrintKop from "@/components/shared/PrintKop";
import GambarTtd from "@/components/shared/GambarTtd";
import { ttdDariNama } from "@/lib/ttd";

/** Rekap penugasan per pegawai dalam satu tahun — `?year=YYYY` (default tahun berjalan).
 * Dipakai sebagai lampiran kinerja: berapa kali seorang pegawai ditugaskan dan ke mana saja. */
export default async function RekapSuratTugasPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  await verifyTasAccess();
  const { year } = await searchParams;
  const y = year && /^\d{4}$/.test(year) ? Number(year) : new Date().getFullYear();

  const [rows, settings] = await Promise.all([
    prisma.suratTugas.findMany({
      where: { tanggal: { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) } },
      include: { pegawai: { orderBy: { urutan: "asc" } } },
      orderBy: { tanggal: "asc" },
    }),
    getSettings(["logo.full_white", "school.structure"]),
  ]);

  const principalName = getPrincipalName(settings["school.structure"]);

  const ttdKepala = await ttdDariNama(principalName); // TTD pribadi Kepala Sekolah (src/lib/ttd.ts)

  // Satu baris per pegawai, berisi berapa kali ditugaskan & daftar kegiatannya.
  const perPegawai = new Map<string, { nama: string; nip: string | null; tugas: { tanggal: Date; maksud: string; tempat: string }[] }>();
  for (const st of rows) {
    for (const p of st.pegawai) {
      const key = p.nama.toLowerCase();
      if (!perPegawai.has(key)) perPegawai.set(key, { nama: p.nama, nip: p.nip, tugas: [] });
      perPegawai.get(key)!.tugas.push({ tanggal: st.tanggal, maksud: st.maksud, tempat: st.tempat });
    }
  }
  const daftar = [...perPegawai.values()].sort((a, b) => b.tugas.length - a.tugas.length || a.nama.localeCompare(b.nama, "id"));

  const th = "border border-gray-800 bg-primary-900 text-white px-2 py-1.5 text-center align-middle";
  const td = "border border-gray-800 px-2 py-1 align-top";
  const tglPendek = (d: Date) => new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short" });

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0 min-h-dvh print:min-h-0 bg-white">
      <style>{"@page { size: A4; margin: 1.2cm; }"}</style>

      <PageHeader icon={<ClipboardSignature size={22} />} title="Rekap Penugasan Pegawai" description={`Tahun ${y}`} printHidden />

      <div className="flex items-center gap-2 mb-5 print:hidden">
        <Link href="/dashboard/admin/surat-tugas"
          className="btn-modal-cancel">
          <ArrowLeft size={18} /> Kembali
        </Link>
        <PrintButton />
        <div className="flex gap-1 ml-2">
          {[y - 1, y, y + 1].map(t => (
            <Link key={t} href={`/dashboard/admin/surat-tugas/rekap?year=${t}`}
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${
                t === y ? "bg-primary-900 text-white" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}>
              {t}
            </Link>
          ))}
        </div>
      </div>

      <div className="print-doc bg-white">
        <PrintKop title="Rekapitulasi Penugasan Pegawai" subtitle={`Tahun ${y} — ${rows.length} surat tugas`} logoUrl={settings["logo.full_white"]} />

        <table className="w-full border-collapse text-[11px] mb-6" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "5%" }} /><col style={{ width: "22%" }} /><col style={{ width: "16%" }} />
            <col style={{ width: "8%" }} /><col style={{ width: "49%" }} />
          </colgroup>
          <thead>
            <tr>
              <th className={th}>No</th><th className={th}>Nama Pegawai</th><th className={th}>NIP / NUPTK</th>
              <th className={th}>Jumlah</th><th className={th}>Rincian Penugasan</th>
            </tr>
          </thead>
          <tbody>
            {daftar.length === 0 ? (
              <tr><td className={`${td} text-center`} colSpan={5}>Belum ada penugasan pada tahun {y}.</td></tr>
            ) : daftar.map((p, i) => (
              <tr key={p.nama}>
                <td className={`${td} text-center`}>{i + 1}</td>
                <td className={`${td} font-semibold`}>{p.nama}</td>
                <td className={td}>{p.nip || "—"}</td>
                <td className={`${td} text-center font-semibold`}>{p.tugas.length}×</td>
                <td className={td}>
                  {p.tugas.map((t, j) => (
                    <span key={j} className="block">
                      {tglPendek(t.tanggal)} — {t.maksud} ({t.tempat})
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="text-xs text-right pr-8" style={{ breakInside: "avoid" }}>
          <p>Banyuwangi, {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
          <p className="font-semibold">Kepala SMK Al Munawwir IIBS</p>
          <GambarTtd src={ttdKepala} tinggi={40} />
          <p className="font-semibold underline">{principalName || "( _____________ )"}</p>
        </div>
      </div>
    </div>
  );
}
