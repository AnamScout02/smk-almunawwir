export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ListChecks } from "lucide-react";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getSettings, getPrincipalName } from "@/lib/site-settings";
import { ujianDalamCakupan, kelasPeserta } from "@/lib/ujian-server";
import { hariTanggal } from "@/lib/administrasi-ujian";
import { LEVEL_KOGNITIF, kisiLengkap, rentangNomor, susunBarisKisi } from "@/lib/kisi-kisi";
import { labelTipe, type Opsi, type Kunci } from "@/lib/soal";
import { kunciKeTeks } from "@/lib/soal-kunci";
import PageHeader from "@/components/admin/PageHeader";
import PrintButton from "@/components/shared/PrintButton";
import PrintKop from "@/components/shared/PrintKop";

/** CETAK KISI-KISI PENULISAN SOAL — A4 landscape. Butir berurutan yang KD, materi, indikator, level, dan bentuknya
 * sama digabung satu baris (nomor soal didaftar), sesuai format kisi-kisi yang dipakai sekolah.
 *
 * `?kunci=1` menambah halaman LAMPIRAN KUNCI JAWABAN & PEDOMAN PENSKORAN (jawaban acuan uraian ikut) — permintaan user
 * 21 September 2026. SENGAJA bukan bawaan: kisi-kisi lazim dibagikan ke siswa sebelum ujian, kuncinya tidak boleh ikut. */
export default async function CetakKisiKisiPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ kunci?: string }> }) {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  const { id } = await params;
  const denganKunci = (await searchParams).kunci === "1";
  const exam = await ujianDalamCakupan(session, id);
  if (!exam) notFound();

  const [detail, soal, kelas, settings] = await Promise.all([
    prisma.exam.findUnique({
      where: { id },
      select: { kegiatan: { select: { nama: true, academicYear: { select: { name: true } } } }, teacher: { select: { user: { select: { name: true } } } } },
    }),
    prisma.examQuestion.findMany({
      where: { examId: id }, orderBy: { order: "asc" },
      select: { tipe: true, skor: true, kd: true, materi: true, indikator: true, levelKognitif: true, opsi: true, kunci: true },
    }),
    prisma.class.findMany({ where: { id: { in: kelasPeserta(exam) } }, select: { name: true }, orderBy: { name: "asc" } }),
    getSettings(["logo.full_white", "school.structure", "school.name"]),
  ]);

  const butir = soal.map((s, i) => ({ nomor: i + 1, ...s }));
  const baris = susunBarisKisi(butir);
  const perBentuk = new Map<string, number>();
  for (const b of butir) perBentuk.set(labelTipe(b.tipe), (perBentuk.get(labelTipe(b.tipe)) ?? 0) + 1);
  const belum = butir.filter(b => !kisiLengkap(b)).length;
  const totalSkor = butir.reduce((n, b) => n + b.skor, 0);
  const kegiatanNama = detail?.kegiatan
    ? `${detail.kegiatan.nama}${detail.kegiatan.academicYear ? ` Tahun Pelajaran ${detail.kegiatan.academicYear.name}` : ""}`
    : "Ujian Berbasis Komputer";
  const kepala = getPrincipalName(settings["school.structure"]);
  const th = "border border-gray-800 bg-primary-900 text-white px-2 py-1.5 text-center align-middle";
  const td = "border border-gray-800 px-2 py-1 align-top";

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0 bg-white">
      <style>{"@page { size: A4 landscape; margin: 1cm; }"}</style>
      <PageHeader icon={<ListChecks size={22} />} title="Cetak Kisi-kisi" description={`${exam.title} · ${exam.subject}`} printHidden />
      <div className="flex flex-wrap items-center gap-2 mb-5 print:hidden">
        <Link href={`/pusat-ujian/${id}/kisi-kisi`} className="btn-modal-cancel">
          <ArrowLeft size={18} /> Kembali
        </Link>
        <PrintButton />
        {denganKunci
          ? <Link href={`/pusat-ujian/${id}/kisi-kisi/cetak`} className="btn-modal-cancel btn-teks">Tanpa Kunci Jawaban</Link>
          : <Link href={`/pusat-ujian/${id}/kisi-kisi/cetak?kunci=1`} className="btn-modal-cancel btn-teks">Sertakan Kunci Jawaban</Link>}
        {denganKunci && <span className="text-xs font-semibold text-red-700">Lampiran kunci ikut tercetak — jangan dibagikan ke siswa.</span>}
        {belum > 0 && <span className="text-xs font-semibold text-amber-700">{belum} butir belum lengkap kisi-kisinya — kolom yang kosong tercetak &ldquo;—&rdquo;.</span>}
      </div>

      <div className="print-doc bg-white max-w-[277mm] mx-auto text-[11.5px]">
        <PrintKop title="Kisi-kisi Penulisan Soal" subtitle={kegiatanNama} logoUrl={settings["logo.full_white"]} />
        <table className="w-full mb-3">
          <tbody>
            {[
              ["Satuan Pendidikan", settings["school.name"] || "SMK Al Munawwir IIBS", "Nama Ujian", exam.title],
              ["Mata Pelajaran", exam.subject, "Alokasi Waktu", `${exam.duration} menit`],
              ["Kelas", kelas.map(k => k.name).join(", ") || "-", "Jumlah & Bentuk Soal", `${butir.length} butir (${[...perBentuk].map(([b, n]) => `${b} ${n}`).join(", ")})`],
            ].map((r, i) => (
              <tr key={i}>
                <td className="py-0.5 pr-2 text-gray-600 w-[15%]">{r[0]}</td><td className="py-0.5 pr-4 w-[35%]">: {r[1]}</td>
                <td className="py-0.5 pr-2 text-gray-600 w-[15%]">{r[2]}</td><td className="py-0.5 w-[35%]">: {r[3]}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "4%" }} /><col style={{ width: "9%" }} /><col style={{ width: "16%" }} /><col />
            <col style={{ width: "8%" }} /><col style={{ width: "12%" }} /><col style={{ width: "9%" }} /><col style={{ width: "6%" }} />
          </colgroup>
          <thead>
            <tr>
              <th className={th}>No</th><th className={th}>KD / CP</th><th className={th}>Materi</th><th className={th}>Indikator Soal</th>
              <th className={th}>Level Kognitif</th><th className={th}>Bentuk Soal</th><th className={th}>No. Soal</th><th className={th}>Skor</th>
            </tr>
          </thead>
          <tbody>
            {baris.map((b, i) => (
              <tr key={i} className="break-inside-avoid">
                <td className={`${td} text-center`}>{i + 1}</td>
                <td className={`${td} text-center`}>{b.kd || "—"}</td>
                <td className={td}>{b.materi || "—"}</td>
                <td className={td}>{b.indikator || "—"}</td>
                <td className={`${td} text-center`}>{b.level || "—"}</td>
                <td className={td}>{b.bentuk}</td>
                <td className={`${td} text-center`}>{rentangNomor(b.nomor)}</td>
                <td className={`${td} text-center`}>{b.skor}</td>
              </tr>
            ))}
            <tr>
              <td className={`${td} text-right font-bold`} colSpan={7}>Jumlah skor</td>
              <td className={`${td} text-center font-bold`}>{totalSkor}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-1.5 text-[10px] text-gray-600">Level kognitif: {LEVEL_KOGNITIF.map(l => l.label.replace(" · ", " = ")).join(" · ")}</p>

        <div className="grid grid-cols-2 gap-10 text-center mt-8 break-inside-avoid">
          <div>
            <p>Mengetahui,<br />Kepala Sekolah</p>
            <div className="h-14" />
            <p className="font-semibold underline">{kepala || "( .............................................. )"}</p>
          </div>
          <div>
            <p>{hariTanggal(new Date())}<br />Guru Mata Pelajaran</p>
            <div className="h-14" />
            <p className="font-semibold underline">{detail?.teacher.user.name ?? "( .............................................. )"}</p>
          </div>
        </div>

        {denganKunci && (
          <div className="break-before-page pt-6 print:pt-0">
            <p className="font-heading font-bold text-sm uppercase tracking-wide mb-2">Lampiran: Kunci Jawaban & Pedoman Penskoran</p>
            <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "6%" }} /><col style={{ width: "13%" }} /><col /><col style={{ width: "30%" }} /><col style={{ width: "6%" }} />
              </colgroup>
              <thead>
                <tr><th className={th}>No. Soal</th><th className={th}>Bentuk Soal</th><th className={th}>Kunci / Jawaban Acuan</th><th className={th}>Pedoman Penskoran</th><th className={th}>Skor</th></tr>
              </thead>
              <tbody>
                {butir.map(b => {
                  const k = (b.kunci ?? null) as Kunci | null;
                  const uraian = b.tipe === "URAIAN" || b.tipe === "UNGGAH" || b.tipe === "LISAN";
                  return (
                    <tr key={b.nomor} className="break-inside-avoid">
                      <td className={`${td} text-center`}>{b.nomor}</td>
                      <td className={td}>{labelTipe(b.tipe)}</td>
                      <td className={`${td} whitespace-pre-wrap`}>
                        {uraian ? (k?.acuan?.trim() || "—") : b.tipe === "SURVEI" ? "(tidak dinilai)" : (kunciKeTeks({ tipe: b.tipe, opsi: (b.opsi as unknown as Opsi[]) ?? [], kunci: k }) || "—")}
                      </td>
                      <td className={`${td} whitespace-pre-wrap`}>{uraian ? (k?.rubrik?.trim() || "—") : ""}</td>
                      <td className={`${td} text-center`}>{b.skor}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
