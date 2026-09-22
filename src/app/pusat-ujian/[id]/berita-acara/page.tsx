export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileSignature } from "lucide-react";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getSettings, getPrincipalName } from "@/lib/site-settings";
import { ujianDalamCakupan } from "@/lib/ujian-server";
import { pesertaPerKelas, terbilang, rentangWaktu, ZONA } from "@/lib/administrasi-ujian";
import { ruangUntukSiswa, teksRuang } from "@/lib/denah-ruang";
import PageHeader from "@/components/admin/PageHeader";
import PrintButton from "@/components/shared/PrintButton";
import PrintKop from "@/components/shared/PrintKop";

/** BERITA ACARA PELAKSANAAN UJIAN — satu lembar per kelas peserta. Angka kehadiran, nama yang tidak
 * hadir, dan catatan pelanggaran diambil dari data pengerjaan; kejadian lain ditulis tangan pengawas. */
export default async function BeritaAcaraPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ kelas?: string }> }) {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  const [{ id }, { kelas }] = await Promise.all([params, searchParams]);
  const exam = await ujianDalamCakupan(session, id);
  if (!exam) notFound();

  const [detail, per, settings] = await Promise.all([
    prisma.exam.findUnique({ where: { id }, select: { kegiatan: { select: { nama: true, academicYear: { select: { name: true } } } } } }),
    pesertaPerKelas(exam, kelas),
    getSettings(["logo.full_white", "school.structure", "school.name"]),
  ]);

  const d = exam.startTime;
  const bagian = (o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("id-ID", { ...o, timeZone: ZONA });
  const hari = bagian({ weekday: "long" });
  const tanggal = Number(bagian({ day: "numeric" }));
  const bulan = bagian({ month: "long" });
  const tahun = Number(bagian({ year: "numeric" }));
  const kegiatanNama = detail?.kegiatan ? `${detail.kegiatan.nama}${detail.kegiatan.academicYear ? ` Tahun Pelajaran ${detail.kegiatan.academicYear.name}` : ""}` : "Ujian Berbasis Komputer";
  const kepala = getPrincipalName(settings["school.structure"]);
  const tempat = exam.kegiatanId ? await ruangUntukSiswa(exam.kegiatanId, per.flatMap(p => p.siswa.map(s => s.id))) : null;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0 bg-white">
      <style>{"@page { size: A4 portrait; margin: 1.5cm; }"}</style>
      <PageHeader icon={<FileSignature size={22} />} title="Berita Acara Pelaksanaan" description={`${exam.title} · ${per.map(p => p.kelas.name).join(", ")}`} printHidden />
      <div className="flex items-center gap-2 mb-5 print:hidden">
        <Link href="/pusat-ujian/administrasi" className="btn-modal-cancel">
          <ArrowLeft size={18} /> Kembali
        </Link>
        <PrintButton />
      </div>

      {per.map(({ kelas: k, siswa }, idx) => {
        const hadir = siswa.filter(s => s.hadir);
        const absen = siswa.filter(s => !s.hadir);
        const melanggar = siswa.filter(s => s.pelanggaran > 0).sort((a, b) => b.pelanggaran - a.pelanggaran);
        return (
          <div key={k.id} className={`print-doc bg-white max-w-[210mm] mx-auto text-[12.5px] leading-relaxed ${idx < per.length - 1 ? "print:break-after-page mb-10 print:mb-0" : ""}`}>
            <PrintKop title="Berita Acara Pelaksanaan Ujian" subtitle={kegiatanNama} logoUrl={settings["logo.full_white"]} />

            <p className="text-justify mb-3">
              Pada hari ini <strong>{hari}</strong>, tanggal <strong>{terbilang(tanggal)}</strong>, bulan <strong>{bulan}</strong>, tahun <strong>{terbilang(tahun)}</strong>,
              telah diselenggarakan {kegiatanNama} berbasis komputer di {settings["school.name"] || "SMK Al Munawwir IIBS"} untuk mata pelajaran berikut:
            </p>

            <table className="w-full mb-4">
              <tbody>
                {[
                  ["Mata Pelajaran", exam.subject],
                  ["Nama Ujian", exam.title],
                  ["Kelas", k.name],
                  ["Waktu", (() => { const w = rentangWaktu(exam.startTime, exam.endTime); return w.lintasHari ? `Dibuka ${w.teks} WIB · durasi pengerjaan ${exam.duration} menit` : `Pukul ${w.teks.replace(" – ", " s.d. ")} WIB · durasi ${exam.duration} menit`; })()],
                  ["Ruang", teksRuang(tempat, siswa.map(s => s.id)) ?? "......................................................"],
                  ["Jumlah Peserta Seharusnya", `${siswa.length} siswa`],
                  ["Jumlah Hadir (tercatat sistem)", `${hadir.length} siswa`],
                  ["Jumlah Tidak Hadir", `${absen.length} siswa`],
                ].map(([a, b]) => (
                  <tr key={a}><td className="py-0.5 pr-3 w-[38%] align-top">{a}</td><td className="py-0.5 align-top">: {b}</td></tr>
                ))}
              </tbody>
            </table>

            <p className="font-semibold mb-1">Peserta yang tidak hadir:</p>
            {absen.length === 0 ? <p className="mb-3">Nihil.</p> : (
              <ol className={`list-decimal pl-6 mb-3 gap-6 ${absen.length > 12 ? "columns-3 text-[10.5px] leading-snug" : "columns-2"}`}>
                {absen.map(s => <li key={s.id} className="break-inside-avoid">{s.nama} <span className="text-gray-500">({s.nis})</span></li>)}
              </ol>
            )}

            <p className="font-semibold mb-1">Catatan pelanggaran tercatat sistem (pindah tab, keluar layar penuh, salin, tangkapan layar):</p>
            {melanggar.length === 0 ? <p className="mb-3">Nihil.</p> : (
              <ol className={`list-decimal pl-6 mb-3 ${melanggar.length > 5 ? "columns-2 gap-6 text-[11px]" : ""}`}>
                {melanggar.slice(0, 10).map(s => <li key={s.id} className="break-inside-avoid">{s.nama} — {s.pelanggaran} catatan</li>)}
                {melanggar.length > 10 && <li className="list-none text-gray-600">… dan {melanggar.length - 10} peserta lain (rincian di menu Hasil ujian)</li>}
              </ol>
            )}

            <p className="font-semibold mb-1">Catatan kejadian selama ujian (diisi pengawas):</p>
            <div className={`space-y-4 ${absen.length + melanggar.length > 20 ? "mb-5" : "mb-8"}`}>
              {(absen.length + melanggar.length > 20 ? [0, 1] : [0, 1, 2]).map(i => <div key={i} className="border-b border-dotted border-gray-500 h-5" />)}
            </div>

            <p className="mb-6">Demikian berita acara ini dibuat dengan sesungguhnya.</p>
            <div className="grid grid-cols-2 gap-10 text-center">
              <div>
                <p>Pengawas,</p>
                <div className="h-16" />
                <p>( .............................................. )</p>
              </div>
              <div>
                <p>Mengetahui,<br />Kepala Sekolah</p>
                <div className="h-12" />
                <p className="font-semibold underline">{kepala || "( .............................................. )"}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
