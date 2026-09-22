export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft, BookA } from "lucide-react";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { getSettings } from "@/lib/site-settings";
import { getKlapperRows, letterOf, sortKlapper, type KlapperSort } from "@/lib/buku-klapper";
import PageHeader from "@/components/admin/PageHeader";
import PrintButton from "@/components/shared/PrintButton";
import PrintKop from "@/components/shared/PrintKop";

/** Cetak Buku Klapper — susunan kolom mengikuti buku fisik sekolah (foto referensi dari user
 * 2026-09-12): NO | NAMA SISWA | NOMOR INDUK | KELAS/TAHUN MASUK (X/XI/XII) | JURUSAN | KETERANGAN.
 * SENGAJA tanpa kolom NISN & Status — buku aslinya tidak punya; info keluar/mutasi masuk ke
 * kolom Keterangan, dan tingkat yang tidak pernah ditempuh disilang (lihat `strike` di bawah).
 *
 * `?letter=A` mencetak satu huruf saja; `?urut=induk|abjad` mengikuti pilihan di halaman daftar. */
export default async function CetakBukuKlapperPage({ searchParams }: {
  searchParams: Promise<{ letter?: string; urut?: string }>;
}) {
  await verifyTasAccess();
  const { letter, urut } = await searchParams;
  const onlyLetter = letter?.trim().toUpperCase().slice(0, 1) || null;
  const sortMode: KlapperSort = urut === "abjad" ? "abjad" : "induk";

  const [rows, settings] = await Promise.all([getKlapperRows(), getSettings(["logo.full_white"])]);

  const grouped = new Map<string, typeof rows>();
  for (const r of rows) {
    const l = letterOf(r.name);
    if (onlyLetter && l !== onlyLetter) continue;
    if (!grouped.has(l)) grouped.set(l, []);
    grouped.get(l)!.push(r);
  }
  const groups = [...grouped.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([l, items]) => [l, sortKlapper(items, sortMode)] as const);

  const total = [...grouped.values()].reduce((a, b) => a + b.length, 0);

  const th = "border border-gray-800 bg-primary-900 text-white px-1.5 py-1 text-center align-middle";
  const td = "border border-gray-800 px-1.5 py-1 align-middle";
  /** Arsiran diagonal untuk setengah-kotak tahun yang siswanya sudah keluar — meniru arsiran
   * tangan di buku fisik. Pakai repeating-linear-gradient supaya ikut tercetak
   * (print-color-adjust:exact sudah dipaksa global di globals.css). */
  const ARSIR = "repeating-linear-gradient(45deg, #6b7280 0 0.6px, transparent 0.6px 4px)";

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0 min-h-screen print:min-h-0 bg-white">
      <style>{"@page { size: A4 portrait; margin: 1.2cm; }"}</style>

      <PageHeader icon={<BookA size={22} />} title="Cetak Buku Klapper"
        description={`${onlyLetter ? `Huruf ${onlyLetter}` : "Seluruh huruf A–Z"} — urut ${sortMode === "induk" ? "nomor induk (seperti buku)" : "abjad nama"}`}
        printHidden />

      <div className="flex items-center gap-2 mb-5 print:hidden">
        <Link href="/dashboard/admin/buku-klapper" className="btn-modal-cancel">
          <ArrowLeft size={18} /> Kembali
        </Link>
        <PrintButton />
      </div>

      <div className="print-doc bg-white">
        <PrintKop title="Buku Klapper" subtitle="Indeks Alfabetis Peserta Didik Lintas Angkatan" logoUrl={settings["logo.full_white"]} />

        {/* JANGAN pasang `break-inside: avoid` di pembungkus huruf ini. Satu huruf bisa berisi
            puluhan siswa (huruf "A" saja 63 baris) — memaksa satu blok utuh dalam satu halaman
            membuat browser mendorong SELURUH tabel ke halaman berikutnya dan menyisakan halaman
            pertama kosong melompong (bug nyata, ketahuan lewat pdfinfo: 3 halaman dgn halaman 1
            cuma berisi kop, 2026-09-12). Biarkan tabel mengalir antar halaman — <thead> otomatis
            diulang browser di tiap halaman. Cukup `break-after: avoid` di judul huruf supaya
            judulnya tidak tertinggal sendirian di kaki halaman. */}
        {groups.map(([lt, items]) => (
          <div key={lt} className="mb-5">
            <h2 className="font-heading font-bold text-lg mb-1 border-b-2 border-gray-800 pb-0.5"
              style={{ breakAfter: "avoid" }}>{lt}</h2>
            <table className="w-full border-collapse text-[11px]" style={{ tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "5%" }} /><col style={{ width: "29%" }} /><col style={{ width: "15%" }} />
                <col style={{ width: "10%" }} /><col style={{ width: "10%" }} /><col style={{ width: "10%" }} />
                <col style={{ width: "8%" }} /><col style={{ width: "13%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th rowSpan={2} className={th}>No</th>
                  <th rowSpan={2} className={th}>Nama Siswa</th>
                  <th rowSpan={2} className={th}>Nomor Induk</th>
                  <th colSpan={3} className={th}>Kelas / Tahun Masuk</th>
                  <th rowSpan={2} className={th}>Jurusan</th>
                  <th rowSpan={2} className={th}>Keterangan</th>
                </tr>
                <tr>
                  <th className={th}>X</th><th className={th}>XI</th><th className={th}>XII</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, i) => (
                  <tr key={r.id}>
                    <td className={`${td} text-center`}>{i + 1}</td>
                    <td className={td}>{r.name}</td>
                    <td className={`${td} text-center whitespace-nowrap`}>{r.nomorInduk}</td>
                    {/* Satu kotak tingkat dibagi dua: tahun awal di atas, tahun akhir di bawah
                        (persis buku fisik). Setengah yang siswanya sudah keluar diarsir; yang
                        belum dijalani siswa aktif dibiarkan polos (keputusan user 2026-09-12). */}
                    {[r.gradeX, r.gradeXI, r.gradeXII].map((g, k) => (
                      <td key={k} className="border border-gray-800 p-0 align-middle">
                        <div className="h-[13px] flex items-center justify-center text-[9px] leading-none border-b border-gray-400"
                          style={g.topState === "arsir" ? { backgroundImage: ARSIR } : undefined}>
                          {g.topState === "isi" && g.top != null ? g.top : ""}
                        </div>
                        <div className="h-[13px] flex items-center justify-center text-[9px] leading-none"
                          style={g.bottomState === "arsir" ? { backgroundImage: ARSIR } : undefined}>
                          {g.bottomState === "isi" && g.bottom != null ? g.bottom : ""}
                        </div>
                      </td>
                    ))}
                    <td className={`${td} text-center`}>{r.majorCode}</td>
                    <td className={`${td} text-[10px] break-words`}>{r.keterangan}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        <p className="text-[11px] text-right mt-2">Total: {total} siswa</p>
      </div>
    </div>
  );
}
