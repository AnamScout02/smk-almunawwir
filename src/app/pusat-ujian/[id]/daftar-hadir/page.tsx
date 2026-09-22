export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { ujianDalamCakupan } from "@/lib/ujian-server";
import { pesertaPerKelas, hariTanggal, jam, rentangWaktu } from "@/lib/administrasi-ujian";
import { ruangUntukSiswa, teksRuang } from "@/lib/denah-ruang";
import PageHeader from "@/components/admin/PageHeader";
import PrintButton from "@/components/shared/PrintButton";
import PrintKop from "@/components/shared/PrintKop";

/** DAFTAR HADIR PESERTA UJIAN — satu halaman per kelas peserta. Kolom "Status" terisi otomatis dari
 * data pengerjaan (siswa yang menekan MULAI tercatat hadir), kolom tanda tangan tetap diisi di ruang. */
export default async function DaftarHadirPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ kelas?: string }> }) {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  const [{ id }, { kelas }] = await Promise.all([params, searchParams]);
  const exam = await ujianDalamCakupan(session, id);
  if (!exam) notFound();

  const [detail, per, settings] = await Promise.all([
    prisma.exam.findUnique({ where: { id }, select: { kegiatan: { select: { nama: true } }, teacher: { select: { user: { select: { name: true } } } } } }),
    pesertaPerKelas(exam, kelas),
    getSettings(["logo.full_white"]),
  ]);
  const tempat = exam.kegiatanId ? await ruangUntukSiswa(exam.kegiatanId, per.flatMap(p => p.siswa.map(s => s.id))) : null;

  const th = "border border-gray-800 bg-primary-900 text-white px-2 py-1.5 text-center align-middle";
  const td = "border border-gray-800 px-2 py-1 align-middle";

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0 bg-white">
      <style>{"@page { size: A4 portrait; margin: 1.2cm; }"}</style>
      <PageHeader icon={<ClipboardList size={22} />} title="Daftar Hadir Peserta" description={`${exam.title} · ${per.map(p => p.kelas.name).join(", ")}`} printHidden />
      <div className="flex items-center gap-2 mb-5 print:hidden">
        <Link href="/pusat-ujian/administrasi" className="btn-modal-cancel">
          <ArrowLeft size={18} /> Kembali
        </Link>
        <PrintButton />
      </div>

      {per.map(({ kelas: k, siswa }, idx) => {
        const hadir = siswa.filter(s => s.hadir).length;
        return (
          <div key={k.id} className={`print-doc bg-white max-w-[210mm] mx-auto ${idx < per.length - 1 ? "print:break-after-page mb-10 print:mb-0" : ""}`}>
            <PrintKop title="Daftar Hadir Peserta Ujian" subtitle={detail?.kegiatan?.nama ?? "Ujian Berbasis Komputer"} logoUrl={settings["logo.full_white"]} />
            <table className="w-full text-[12px] mb-3">
              <tbody>
                {[
                  ["Mata Pelajaran", exam.subject, "Hari / Tanggal", hariTanggal(exam.startTime)],
                  ["Ujian", exam.title, "Waktu", `${rentangWaktu(exam.startTime, exam.endTime).teks} (${exam.duration} menit)`],
                  ["Kelas", k.name, "Ruang", teksRuang(tempat, siswa.map(s => s.id)) ?? "...................................."],
                  ["Guru Pengampu", detail?.teacher.user.name ?? "-", "Pengawas", "...................................."],
                ].map((r, i) => (
                  <tr key={i}>
                    <td className="py-0.5 pr-2 text-gray-600 w-[17%]">{r[0]}</td><td className="py-0.5 pr-4 w-[33%]">: {r[1]}</td>
                    <td className="py-0.5 pr-2 text-gray-600 w-[17%]">{r[2]}</td><td className="py-0.5 w-[33%]">: {r[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table className="w-full border-collapse text-[11px]" style={{ tableLayout: "fixed" }}>
              <colgroup><col style={{ width: "6%" }} /><col style={{ width: "17%" }} /><col style={{ width: "37%" }} /><col style={{ width: "14%" }} /><col style={{ width: "26%" }} /></colgroup>
              <thead><tr><th className={th}>No</th><th className={th}>NIS</th><th className={th}>Nama Peserta</th><th className={th}>Status Sistem</th><th className={th}>Tanda Tangan</th></tr></thead>
              <tbody>
                {siswa.map((s, i) => (
                  <tr key={s.id} style={{ height: "7.5mm" }}>
                    <td className={`${td} text-center`}>{i + 1}</td>
                    <td className={`${td} font-mono`}>{s.nis}</td>
                    <td className={td}>{s.nama}</td>
                    <td className={`${td} text-center`}>{s.hadir ? `Hadir ${jam(s.mulai!)}` : "—"}</td>
                    <td className={`${td} ${i % 2 === 0 ? "text-left" : "text-right"} text-gray-400`}>{i + 1}.</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[11px] mt-2">Jumlah peserta: <strong>{siswa.length}</strong> · Hadir (tercatat sistem): <strong>{hadir}</strong> · Tidak hadir: <strong>{siswa.length - hadir}</strong></p>
            <div className="flex justify-end mt-6 text-[12px]">
              <div className="text-center w-64">
                <p>Pengawas,</p>
                <div className="h-16" />
                <p>( .............................................. )</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
