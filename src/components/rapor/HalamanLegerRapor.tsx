import { Download, FileWarning, Sheet } from "lucide-react";
import { verifyRole } from "@/lib/dal";
import { aksesRaporKelas } from "@/lib/rapor-form-server";
import { susunRaporKelas } from "@/lib/rapor-cetak";
import { semesterRapor } from "@/lib/rapor-verifikasi";
import { petaSingkatanMapel } from "@/lib/singkatan-mapel-server";
import { keteranganSingkatan } from "@/lib/singkatan-mapel";
import { legerRapor } from "@/lib/leger-rapor";
import PageHeader from "@/components/admin/PageHeader";
import PrintButton from "@/components/shared/PrintButton";
import PrintKop from "@/components/shared/PrintKop";
import { getSettings } from "@/lib/site-settings";

import { TautanIkon } from "@/components/shared/IkonNama";

/** LEGER NILAI RAPOR — satu kelas, semua siswa × mapel (src/lib/leger-rapor.ts). Wali kelas memeriksa kelengkapan & nilai
 * sebelum mengunci; dipakai portal guru (wali/pemantau) & admin. Kepala kolom memakai singkatan mapel. */
export default async function HalamanLegerRapor({ sp, kembaliHref }: { sp: { classId?: string; semester?: string }; kembaliHref: string }) {
  const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
  const classId = sp.classId ?? "", semester = sp.semester ?? "";
  const boleh = semesterRapor().includes(semester) && classId ? await aksesRaporKelas(session, classId) : null;
  const d = boleh ? await susunRaporKelas(classId, semester) : null;
  if (!d) {
    return (
      <div className="p-6 lg:p-8 pt-16 lg:pt-8">
        <PageHeader icon={<FileWarning size={22} />} title="Leger Nilai Rapor" description="Rapor kelas" />
        <p className="error-msg">Leger tidak ditemukan atau Anda tidak berhak membuka kelas ini.</p>
      </div>
    );
  }
  const semuaMapel = [...new Set(d.siswa.flatMap(s => [...s.umum, ...s.kejuruan, ...s.diniyah].map(b => b.mapel)))];
  const singkatan = await petaSingkatanMapel(semuaMapel);
  const L = legerRapor(d, singkatan);
  const nUmum = L.kolom.filter(k => k.kelompok === "UMUM").length, nKej = L.kolom.length - nUmum;
  const ket = keteranganSingkatan(semuaMapel, singkatan);
  const q = new URLSearchParams({ classId, semester }).toString();
  const merah = (n: number | null, kkm: number | null) => (n !== null && kkm !== null && n < kkm ? "text-red-600 font-semibold" : "");
  const kaki: [string, (j: number) => number | null][] = [
    ["KKM", j => L.kolom[j].kkm], ["Rata-rata", j => L.statMapel[j].rata], ["Tertinggi", j => L.statMapel[j].maks],
    ["Terendah", j => L.statMapel[j].min], ["Di bawah KKM", j => L.statMapel[j].belumTuntas],
  ];
  const st = await getSettings(["logo.full_white"]);
  const nKolom = L.kolom.length + 3 + (L.kolomDiniyah.length ? L.kolomDiniyah.length * 2 + 2 : 0);
  const lebarNilai = `${(70 / Math.max(1, nKolom)).toFixed(3)}%`;
  const th = "border border-gray-800 bg-primary-900 text-white px-1 py-1 text-center align-middle font-semibold leading-tight";
  const thDin = "border border-gray-800 px-1 py-1 text-center align-middle font-semibold leading-tight text-white";
  const td = "border border-gray-800 px-1 py-[3px] text-center angka";
  const hariIni = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0">
      {/* Dokumen resmi bergaris penuh ala Nominatif/Buku Mutasi (bukan .data-table yang garisnya nyaris hilang saat dicetak):
          kop PrintKop, kolom lebar tetap, kepala mapel memakai SINGKATAN supaya muat di A4 landscape (permintaan user 22 Sep 2026). */}
      <style>{`@page { size: A4 landscape; margin: 8mm; }
        .leger-rapor { font-size: 12px; }
        .leger-rapor thead th { font-size: 10.5px; overflow-wrap: anywhere; hyphens: none; }
        @media print { .leger-rapor { font-size: 8.5pt; } .leger-rapor thead th { font-size: 7pt; } .leger-kertas { overflow: visible !important; } }`}</style>
      <PageHeader icon={<Sheet size={22} />} title="Leger Nilai Rapor" printHidden
        description={`${d.kelas.nama} · Semester ${semester} — nilai dari Form Nilai Rapor yang sudah dikirim guru mapel`} />
      <div className="baris-alat mb-5 print:hidden">
        <p className="alat-saring text-sm text-gray-600">
          {d.mapelTanpaForm.length ? <><b className="text-amber-700">{d.mapelTanpaForm.length} mapel</b> belum dikirim guru (kolom bertanda *).</> : "Semua mapel sudah dikirim guru mapel."}
        </p>
        <div className="alat-aksi">
          <TautanIkon href={kembaliHref} ikon="kembali" className="btn-modal-cancel">Kembali</TautanIkon>
          <a href={`/api/rapor/leger?${q}`} className="btn-modal-cancel"><Download size={15} /> Unduh Excel</a>
          <PrintButton />
        </div>
      </div>

      <div className="leger-kertas overflow-x-auto">
        <div className="print-doc bg-white p-6 print:p-0 min-w-[1000px] print:min-w-0">
          <PrintKop title="Leger Nilai Rapor" subtitle={`Kelas ${d.kelas.nama} · Semester ${d.labelSemester} · Tahun Pelajaran ${d.tahun}`}
            logoUrl={st["logo.full_white"]} edgeClassName="-mx-6 print:mx-0" />
          <div className="grid grid-cols-2 gap-x-8 gap-y-0.5 text-[12px] mb-3 px-1">
            <p><span className="inline-block w-32 font-semibold">Nama Sekolah</span>: {d.sekolah.nama}</p>
            <p><span className="inline-block w-32 font-semibold">Kelas</span>: {d.kelas.nama}{d.kelas.jurusan ? ` (${d.kelas.jurusan})` : ""}</p>
            <p><span className="inline-block w-32 font-semibold">Wali Kelas</span>: {d.kelas.wali || "-"}</p>
            <p><span className="inline-block w-32 font-semibold">Semester / Tahun</span>: {d.labelSemester} / {d.tahun}</p>
          </div>
          <table className="leger-rapor w-full border-collapse" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "3%" }} /><col style={{ width: "9%" }} /><col style={{ width: "18%" }} />
              {Array.from({ length: nKolom }, (_, i) => <col key={i} style={{ width: lebarNilai }} />)}
            </colgroup>
            <thead>
              <tr>
                <th rowSpan={2} className={th}>No</th><th rowSpan={2} className={th}>NIS</th><th rowSpan={2} className={th}>Nama Siswa</th>
                {nUmum > 0 && <th colSpan={nUmum} className={th}>Kelompok Umum</th>}
                {nKej > 0 && <th colSpan={nKej} className={th}>Kelompok Kejuruan</th>}
                <th rowSpan={2} className={th}>Jml</th><th rowSpan={2} className={th}>Rata-rata</th><th rowSpan={2} className={th}>Rank</th>
                {L.kolomDiniyah.length > 0 && <th colSpan={L.kolomDiniyah.length * 2 + 2} className={thDin} style={{ background: "#B87D0E" }}>Diniyah (tidak ikut peringkat)</th>}
              </tr>
              <tr>
                {L.kolom.map(k => <th key={k.mapel} title={k.mapel} className={th}>{k.label}{!k.terkirim && "*"}</th>)}
                {L.kolomDiniyah.flatMap(k => [
                  <th key={`${k.mapel}-p`} title={`${k.mapel} — Pengetahuan`} className={thDin} style={{ background: "#B87D0E" }}>{k.label}{!k.terkirim && "*"} P</th>,
                  <th key={`${k.mapel}-t`} title={`${k.mapel} — Penerapan`} className={thDin} style={{ background: "#B87D0E" }}>{k.label}{!k.terkirim && "*"} T</th>,
                ])}
                {L.kolomDiniyah.length > 0 && <><th className={thDin} style={{ background: "#B87D0E" }}>Jml</th><th className={thDin} style={{ background: "#B87D0E" }}>Rank</th></>}
              </tr>
            </thead>
            <tbody>
              {L.baris.map((b, i) => (
                <tr key={b.id} className="break-inside-avoid">
                  <td className={td}>{i + 1}</td><td className={`${td} whitespace-nowrap`}>{b.nis}</td>
                  <td className="border border-gray-800 px-1.5 py-[3px] text-left">{b.nama}</td>
                  {b.nilai.map((n, j) => <td key={L.kolom[j].mapel} className={`${td} ${merah(n, L.kolom[j].kkm)}`}>{n ?? ""}</td>)}
                  <td className={td}>{b.jumlah ?? ""}</td>
                  <td className={`${td} font-semibold`}>{b.rata ?? ""}</td>
                  <td className={`${td} font-bold`}>{b.peringkat ?? ""}</td>
                  {b.diniyah.flatMap((x, j) => [
                    <td key={`${L.kolomDiniyah[j].mapel}-p`} className={td}>{x.p ?? ""}</td>,
                    <td key={`${L.kolomDiniyah[j].mapel}-t`} className={td}>{x.t ?? ""}</td>,
                  ])}
                  {L.kolomDiniyah.length > 0 && <><td className={td}>{b.jumlahDiniyah ?? ""}</td><td className={`${td} font-bold`}>{b.peringkatDiniyah ?? ""}</td></>}
                </tr>
              ))}
            </tbody>
            <tfoot>
              {kaki.map(([label, ambil]) => (
                <tr key={label} className="bg-gray-100 break-inside-avoid">
                  <td colSpan={3} className="border border-gray-800 px-1.5 py-[3px] text-right font-semibold">{label}</td>
                  {L.kolom.map((k, j) => <td key={k.mapel} className={`${td} font-semibold`}>{ambil(j) ?? ""}</td>)}
                  <td colSpan={3 + (L.kolomDiniyah.length ? L.kolomDiniyah.length * 2 + 2 : 0)} className="border border-gray-800" />
                </tr>
              ))}
            </tfoot>
          </table>
          <div className="mt-2 space-y-0.5 text-[11px] text-gray-700">
            <p>Nilai = nilai akhir rapor (sudah memakai nilai katrol bila form dikatrol). <span className="text-red-600 font-semibold">Merah</span> = di bawah KKM. Peringkat dari rata-rata mapel Umum & Kejuruan.</p>
            {ket && <p><span className="font-semibold">Singkatan:</span> {ket}.</p>}
            {d.mapelTanpaForm.length > 0 && <p>* Belum dikirim guru mapel: {d.mapelTanpaForm.map(m => m.nama).join(", ")}.</p>}
            {L.kolomDiniyah.length > 0 && <p>Diniyah: P = Pengetahuan, T = Penerapan.</p>}
          </div>
          <div className="mt-6 grid grid-cols-2 text-center text-[12px] break-inside-avoid">
            <div>
              <p>Mengetahui,</p><p>Kepala {d.sekolah.nama}</p>
              {/* TTD jabatan Kepala Sekolah hanya setelah rapor disahkan — aturan yang sama dengan cetak rapor. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {d.disahkan && d.sekolah.ttdKepala ? <img src={d.sekolah.ttdKepala} alt="" className="mx-auto h-16 object-contain" /> : <div className="h-16" />}
              <p className="font-bold underline">{d.sekolah.kepala || "........................................"}</p><p>NIP.-</p>
            </div>
            <div>
              <p>{d.sekolah.kota}, {hariIni}</p><p>Wali Kelas</p>
              {/* eslint-disable-next-line @next/next/no-img-element -- data URL TTD, hanya setelah nilai dikunci */}
              {d.kelas.ttdWali ? <img src={d.kelas.ttdWali} alt="" className="mx-auto h-16 object-contain" /> : <div className="h-16" />}
              <p className="font-bold underline">{d.kelas.wali || "........................................"}</p><p>NIP.{d.kelas.nipWali ? ` ${d.kelas.nipWali}` : "-"}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
