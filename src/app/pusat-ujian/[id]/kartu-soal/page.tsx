export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getSettings, getPrincipalName } from "@/lib/site-settings";
import { ujianDalamCakupan, kelasPeserta } from "@/lib/ujian-server";
import { LEVEL_KOGNITIF } from "@/lib/kisi-kisi";
import { labelTipe, HURUF, type Opsi, type Kunci } from "@/lib/soal";
import PageHeader from "@/components/admin/PageHeader";
import PrintButton from "@/components/shared/PrintButton";
import PrintKop from "@/components/shared/PrintKop";
import HtmlSoal from "@/components/ujian/HtmlSoal";
import GambarTtd from "@/components/shared/GambarTtd";
import { ttdDariNama, petaTtd } from "@/lib/ttd";

/** KARTU SOAL — satu kartu per butir, format yang dipakai sekolah untuk berkas administrasi ujian
 * (dilampirkan bersama kisi-kisi). Seluruh isinya sudah ada di sistem: identitas ujian, kolom
 * kisi-kisi (KD, materi, indikator, level), rumusan butir, pilihan, dan kunci jawaban — jadi kartu
 * ini murni menyusun ulang, guru tidak perlu mengetik ulang apa pun.
 *
 * SATU KARTU SATU HALAMAN (`break-after: page`), sesuai bentuk baku yang dikumpulkan ke kurikulum.
 * A4 portrait, kolom yang belum diisi dicetak "—" apa adanya — tidak dikarang. */
export default async function KartuSoalPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  const { id } = await params;
  const exam = await ujianDalamCakupan(session, id);
  if (!exam) notFound();

  const [detail, soal, kelas, settings] = await Promise.all([
    prisma.exam.findUnique({
      where: { id },
      select: { kegiatan: { select: { nama: true, academicYear: { select: { name: true } } } }, teacher: { select: { nip: true, userId: true, user: { select: { name: true } } } } },
    }),
    prisma.examQuestion.findMany({
      where: { examId: id }, orderBy: { order: "asc" },
      select: { tipe: true, skor: true, kd: true, materi: true, indikator: true, levelKognitif: true, pertanyaan: true, opsi: true, kunci: true, pembahasan: true },
    }),
    prisma.class.findMany({ where: { id: { in: kelasPeserta(exam) } }, select: { name: true }, orderBy: { name: "asc" } }),
    getSettings(["logo.full_white", "school.structure", "school.name"]),
  ]);
  if (soal.length === 0) notFound();

  const kegiatanNama = detail?.kegiatan
    ? `${detail.kegiatan.nama}${detail.kegiatan.academicYear ? ` Tahun Pelajaran ${detail.kegiatan.academicYear.name}` : ""}`
    : "Ujian Berbasis Komputer";
  const kepala = getPrincipalName(settings["school.structure"]);
  const penyusun = detail?.teacher.user.name ?? "-";
  const [ttdKepala, ttdPenyusun] = await Promise.all([
    ttdDariNama(kepala), detail?.teacher ? petaTtd([detail.teacher.userId]).then(m => m.get(detail.teacher.userId)) : undefined,
  ]);
  const namaKelas = kelas.map(k => k.name).join(", ") || "-";

  /** Kunci jawaban ditulis apa adanya sesuai jenis soalnya — uraian & unggah memang tidak berkunci. */
  const tulisKunci = (tipe: string, opsi: unknown, kunci: unknown): string => {
    const o = (Array.isArray(opsi) ? opsi : []) as Opsi[];
    const k = (kunci ?? null) as Kunci | null;
    switch (tipe) {
      case "PG":
      case "PG_KOMPLEKS":
        return o.filter(x => x.benar).map(x => x.kode).join("") || "—";
      case "BENAR_SALAH":
        return o.map(x => (x.benar ? "B" : "S")).join(", ") || "—";
      case "MENJODOHKAN":
        return Object.entries(k?.pasangan ?? {}).map(([kiri, kanan]) => `${kiri}-${kanan}`).join(", ") || "—";
      case "ISIAN_SINGKAT":
        return (k?.jawaban ?? []).join(" / ") || "—";
      case "TITIK_GAMBAR":
        return `${k?.area?.length ?? 0} bagian pada gambar (kotak hijau)`;
      case "SERET_LEPAS":
        return "Tiap label pada tempatnya (kotak hijau)";
      case "URUTKAN":
        return (k?.urutan?.length ? k.urutan : o.map(x => x.kode)).map((kode, n) => `${n + 1}. ${(o.find(x => x.kode === kode)?.teks ?? kode).replace(/<[^>]+>/g, "")}`).join("   ");
      default:
        return ""; // uraian & unggah: dicetak sebagai Pedoman Penskoran (lihat di bawah), bukan kunci
    }
  };

  const label = "border border-gray-800 bg-[#f1f3f7] px-2 py-1 font-semibold align-top";
  const isi = "border border-gray-800 px-2 py-1 align-top";

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0 bg-white">
      <style>{"@page { size: A4; margin: 1.2cm; }"}</style>
      <PageHeader icon={<FileText size={22} />} title="Kartu Soal" description={`${exam.title} · ${exam.subject}`} printHidden />
      <div className="flex flex-wrap items-center gap-2 mb-5 print:hidden">
        <Link href={`/pusat-ujian/${id}/kisi-kisi`} className="btn-modal-cancel">
          <ArrowLeft size={18} /> Kembali
        </Link>
        <PrintButton />
        <span className="text-xs text-gray-400">{soal.length} kartu — satu butir satu halaman.</span>
      </div>

      <div className="print-doc bg-white mx-auto max-w-[180mm] text-[11.5px]">
        {soal.map((s, i) => {
          const opsi = (Array.isArray(s.opsi) ? s.opsi : []) as unknown as Opsi[];
          const k = (s.kunci ?? null) as unknown as Kunci | null;
          return (
            <section key={i} className={i < soal.length - 1 ? "break-after-page" : ""}>
              <PrintKop title="Kartu Soal" subtitle={kegiatanNama} logoUrl={settings["logo.full_white"]} />
              <table className="w-full border-collapse mb-2">
                <tbody>
                  <tr>
                    <td className={label} style={{ width: "22%" }}>Satuan Pendidikan</td>
                    <td className={isi} style={{ width: "28%" }}>{settings["school.name"] || "SMK Al Munawwir IIBS"}</td>
                    <td className={label} style={{ width: "22%" }}>Nomor Soal</td>
                    <td className={isi}>{i + 1}</td>
                  </tr>
                  <tr>
                    <td className={label}>Mata Pelajaran</td><td className={isi}>{exam.subject}</td>
                    <td className={label}>Bentuk Soal</td><td className={isi}>{labelTipe(s.tipe)}</td>
                  </tr>
                  <tr>
                    <td className={label}>Kelas</td><td className={isi}>{namaKelas}</td>
                    <td className={label}>Skor Maksimal</td><td className={isi}>{s.skor}</td>
                  </tr>
                  <tr>
                    <td className={label}>Penyusun</td><td className={isi}>{penyusun}</td>
                    <td className={label}>Level Kognitif</td>
                    <td className={isi}>{LEVEL_KOGNITIF.find(l => l.value === s.levelKognitif)?.label ?? s.levelKognitif ?? "—"}</td>
                  </tr>
                  <tr><td className={label}>Kompetensi Dasar / CP</td><td className={isi} colSpan={3}>{s.kd || "—"}</td></tr>
                  <tr><td className={label}>Materi</td><td className={isi} colSpan={3}>{s.materi || "—"}</td></tr>
                  <tr><td className={label}>Indikator Soal</td><td className={isi} colSpan={3}>{s.indikator || "—"}</td></tr>
                </tbody>
              </table>

              <table className="w-full border-collapse mb-2">
                <tbody>
                  <tr><td className={label} colSpan={2}>Rumusan Butir Soal</td></tr>
                  <tr>
                    <td className={isi} colSpan={2}>
                      <HtmlSoal html={s.pertanyaan} />
                      {/* Soal interaktif (21 Sep 2026): gambar + kotak area jawaban benar — kartu soal pegangan guru, bukan untuk siswa. */}
                      {(s.tipe === "TITIK_GAMBAR" || s.tipe === "SERET_LEPAS") && k?.gambar && (
                        <div className="relative mt-2 inline-block max-w-full">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={k.gambar} alt="Gambar soal" className="block h-auto max-h-[9cm] max-w-full" />
                          {(k.area ?? []).map((a, n) => (
                            <div key={a.kode} className="absolute border-2 border-dashed border-emerald-600"
                              style={{ left: `${a.x}%`, top: `${a.y}%`, width: `${a.w}%`, height: `${a.h}%` }}>
                              <span className="absolute -top-4 left-0 whitespace-nowrap bg-emerald-600 px-1 text-[10px] font-semibold text-white">
                                {s.tipe === "SERET_LEPAS" ? (opsi.find(o => o.kode === a.kode)?.teks ?? `Label ${n + 1}`).replace(/<[^>]+>/g, "") : (a.label || `Area ${n + 1}`)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      {opsi.length > 0 && s.tipe !== "URUTKAN" && s.tipe !== "SERET_LEPAS" && (
                        <ol className="mt-2 space-y-0.5">
                          {opsi.map((o, n) => (
                            <li key={o.kode ?? n} className="flex gap-2">
                              <span className="font-semibold">{o.kode ?? HURUF[n]}.</span>
                              <HtmlSoal as="span" html={o.teks ?? ""} />
                            </li>
                          ))}
                        </ol>
                      )}
                      {s.tipe === "MENJODOHKAN" && (k?.kanan?.length ?? 0) > 0 && (
                        <ol className="mt-2 space-y-0.5">
                          {(k?.kanan ?? []).map((o, n) => (
                            <li key={o.kode ?? n} className="flex gap-2">
                              <span className="font-semibold">{o.kode ?? HURUF[n]}.</span>
                              <HtmlSoal as="span" html={o.teks ?? ""} />
                            </li>
                          ))}
                        </ol>
                      )}
                    </td>
                  </tr>
                  {s.tipe === "URAIAN" || s.tipe === "UNGGAH" || s.tipe === "LISAN" ? (
                    /* Soal uraian: JAWABAN ACUAN (kolom Kunci Jawaban Excel → kunci.acuan) + PEDOMAN PENSKORAN (kolom
                       Pedoman Penskoran → kunci.rubrik) — sama dengan pegangan guru di Koreksi Uraian (21 September 2026).
                       Berkas Excel lama tanpa kolom Pedoman: isi kolom Kunci tersimpan sebagai pedoman. */
                    <>
                      <tr>
                        <td className={label} style={{ width: "22%" }}>Jawaban Acuan</td>
                        <td className={isi}>
                          {k?.acuan?.trim()
                            ? <p className="whitespace-pre-wrap">{k.acuan}</p>
                            : <span className="text-gray-500">— belum diisi. Tulis di kolom Kunci Jawaban Excel untuk soal ini, atau lewat penyunting soal.</span>}
                        </td>
                      </tr>
                      <tr>
                        <td className={label} style={{ width: "22%" }}>Pedoman Penskoran<span className="block font-normal text-gray-500">skor maks. {s.skor}</span></td>
                        <td className={isi}>
                          {k?.rubrik?.trim()
                            ? <p className="whitespace-pre-wrap">{k.rubrik}</p>
                            : <span className="text-gray-500">— belum diisi. Tulis di kolom Pedoman Penskoran Excel, atau lewat penyunting soal.</span>}
                        </td>
                      </tr>
                    </>
                  ) : (
                    <tr>
                      <td className={label} style={{ width: "22%" }}>Kunci Jawaban</td>
                      <td className={isi}>{tulisKunci(s.tipe, s.opsi, s.kunci)}</td>
                    </tr>
                  )}
                  {s.pembahasan && (
                    <tr><td className={label}>Pembahasan</td><td className={isi}><HtmlSoal html={s.pembahasan} /></td></tr>
                  )}
                </tbody>
              </table>

              <div className="mt-6 flex justify-between text-[11px]">
                <div className="text-center">
                  <p>Mengetahui,</p>
                  <p>Kepala Sekolah</p>
                  <GambarTtd src={ttdKepala} tinggi={56} />
                  <p className="font-semibold underline">{kepala || "……………………………"}</p>
                </div>
                <div className="text-center">
                  <p>Penyusun Soal</p>
                  <GambarTtd src={ttdPenyusun} tinggi={64} />
                  <p className="font-semibold underline">{penyusun}</p>
                  {detail?.teacher.nip && <p>NIP. {detail.teacher.nip}</p>}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
