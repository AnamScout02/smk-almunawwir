import { Lock } from "lucide-react";
import type { SemesterRapor } from "@/lib/rapor-data";

/** Bagian "nilai per semester" rapor (komponen SERVER, dipakai rapor Siswa & Orang Tua). Nilai tampil hanya bila semester itu
 * sudah dikunci wali kelas DAN disahkan kepala sekolah (verifikasi bertingkat, src/lib/rapor-verifikasi.ts). Kolom KKM per mapel,
 * predikat, dan deskripsi capaian dihitung otomatis (src/lib/rapor-data.ts). */
/** `formatSekolah` = semester yang rapor format buku sekolahnya (Form Nilai Rapor) sudah disahkan — versi jurnal di sini
 * tidak ditampilkan lagi untuk semester itu supaya orang tua tidak melihat dua versi nilai (22 Sep 2026). */
export default function RaporSemester({ data, formatSekolah = [] }: { data: SemesterRapor[]; formatSekolah?: string[] }) {
  if (!data.length) return <p className="text-gray-400 text-sm text-center py-8 print:hidden">Belum ada data nilai.</p>;
  const sel = "border border-gray-200 px-2.5 py-2";
  return (
    <>
      {data.map(({ sem, disahkan, dikunci, rows, semAvg, kehadiran, catatanWali, ekstra }) => (
        <div key={sem} className="mb-8 break-inside-avoid-page">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <h4 className="font-heading font-bold text-primary-900">Semester: {sem}</h4>
            {disahkan && semAvg !== null && (
              <span className="text-sm font-bold px-3 py-1 rounded-full border bg-primary-50 text-primary-900 border-primary-100">
                Rata-rata: {semAvg.toFixed(1)}
              </span>
            )}
          </div>
          {formatSekolah.includes(sem) ? (
            <div className="border border-emerald-100 bg-emerald-50 rounded-xl py-6 px-4 text-center print:hidden">
              <p className="text-emerald-800 font-semibold text-sm">Rapor semester ini diterbitkan dalam format buku rapor sekolah</p>
              <p className="text-emerald-700 text-xs mt-1">Buka lewat tombol &quot;{sem}&quot; pada kotak Rapor sekolah di atas.</p>
            </div>
          ) : !disahkan ? (
            <div className="border border-amber-100 bg-amber-50 rounded-xl py-10 px-4 text-center print:border-gray-200 print:bg-gray-50">
              <Lock size={28} className="text-amber-400 mx-auto mb-2" />
              <p className="text-amber-700 font-semibold text-sm">Rapor semester ini belum disahkan Kepala Sekolah</p>
              <p className="text-amber-600 text-xs mt-1">
                {dikunci ? "Nilai sudah dikunci wali kelas dan menunggu pengesahan." : "Nilai masih disusun guru dan belum dikunci wali kelas."}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-primary-900 text-white">
                      <th className="border border-primary-900 px-2.5 py-2.5 text-left font-medium">Mata Pelajaran</th>
                      <th className="border border-primary-900 px-2 py-2.5 text-center font-medium w-12">KKM</th>
                      <th className="border border-primary-900 px-2 py-2.5 text-center font-medium w-20">Penge&shy;tahuan</th>
                      <th className="border border-primary-900 px-2 py-2.5 text-center font-medium w-20">Kete&shy;rampilan</th>
                      <th className="border border-primary-900 px-2 py-2.5 text-center font-medium w-16">Nilai</th>
                      <th className="border border-primary-900 px-2 py-2.5 text-center font-medium w-16">Predikat</th>
                      <th className="border border-primary-900 px-2.5 py-2.5 text-left font-medium min-w-[14rem]">Deskripsi Capaian</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, idx) => {
                      const warna = (v: number | null) => v === null ? "text-gray-300" : v >= r.kkm ? "text-emerald-700" : "text-red-600";
                      return (
                        <tr key={r.subject} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <td className={`${sel} font-medium text-primary-900`}>{r.subject}</td>
                          <td className={`${sel} text-center tabular-nums`}>{r.kkm}</td>
                          <td className={`${sel} text-center font-semibold tabular-nums ${warna(r.pengetahuan)}`}>{r.pengetahuan ?? "—"}</td>
                          <td className={`${sel} text-center font-semibold tabular-nums ${warna(r.keterampilan)}`}>{r.keterampilan ?? "—"}</td>
                          <td className={`${sel} text-center font-bold tabular-nums ${warna(r.avg)}`}>{r.avg !== null ? r.avg.toFixed(1) : "—"}</td>
                          <td className={`${sel} text-center text-xs font-semibold`}>{r.predikat ?? "—"}</td>
                          <td className={`${sel} text-xs leading-relaxed text-gray-700`}>{r.deskripsi ?? "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {kehadiran && (
                <p className="text-sm text-gray-600 mt-2">
                  Kehadiran semester ini: Hadir <strong>{kehadiran.HADIR}</strong> · Izin <strong>{kehadiran.IZIN}</strong> · Sakit{" "}
                  <strong>{kehadiran.SAKIT}</strong> · Tanpa keterangan <strong>{kehadiran.ALPHA}</strong>
                  {kehadiran.persen !== null && <> · Persentase kehadiran <strong>{kehadiran.persen}%</strong></>}
                </p>
              )}
              {ekstra.length > 0 && (
                <div className="mt-3 rounded-lg border border-gray-200 px-3 py-2 text-sm">
                  <p className="font-semibold text-primary-900">Ekstrakurikuler</p>
                  <ul className="mt-1 space-y-0.5 text-gray-700">
                    {ekstra.map(e => <li key={e.nama}>{e.nama}: <strong>{e.predikat}</strong>{e.keterangan ? ` — ${e.keterangan}` : ""}</li>)}
                  </ul>
                </div>
              )}
              {catatanWali && (
                <div className="mt-3 rounded-lg border border-gray-200 px-3 py-2 text-sm">
                  <p className="font-semibold text-primary-900">Catatan Wali Kelas</p>
                  <p className="text-gray-700 leading-relaxed">{catatanWali}</p>
                </div>
              )}
              <p className="text-xs text-gray-400 mt-1">
                Nilai = rata-rata Jurnal Mengajar sepanjang semester. Predikat mengikuti KKM tiap mapel: A ≥ KKM + ⅔(100 − KKM), B ≥ KKM + ⅓(100 − KKM), C ≥ KKM, D di bawah KKM.
              </p>
            </>
          )}
        </div>
      ))}
    </>
  );
}
