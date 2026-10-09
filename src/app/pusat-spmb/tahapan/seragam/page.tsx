export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PrintKop from "@/components/shared/PrintKop";
import PrintButton from "@/components/shared/PrintButton";
import GambarTtd from "@/components/shared/GambarTtd";
import { getPrincipalName, getSettings } from "@/lib/site-settings";
import { verifySpmbAccess } from "@/lib/spmb";
import { petaTtd, ttdDariNama } from "@/lib/ttd";
import { rekapSeragam } from "@/lib/spmb-seragam";

export const metadata = { title: "Surat Pesanan Seragam" };

/** SURAT PESANAN SERAGAM ke penjahit/vendor (7 Okt 2026) — jumlah per item × ukuran × putra/putri dari
 *  `rekapSeragam` (sumber yang sama dengan Excel). Kepada & batas selesai diisi panitia sebelum mencetak. */
export default async function Page({ searchParams }: { searchParams: Promise<{ gelombangId?: string; kepada?: string; batas?: string; catatan?: string }> }) {
  const session = await verifySpmbAccess();
  const q = await searchParams;
  const [r, s] = await Promise.all([
    rekapSeragam(q.gelombangId || undefined),
    getSettings(["school.name", "logo.full_white", "spmb.tahun", "school.structure"]),
  ]);
  const sekolah = s["school.name"] || "SMK Al-Munawwir IIBS";
  const kepala = getPrincipalName(s["school.structure"] ?? "");
  const [ttdKepala, ttdSaya] = await Promise.all([ttdDariNama(kepala).catch(() => undefined), petaTtd([session.userId]).then(p => p.get(session.userId)).catch(() => undefined)]);
  const tgl = (d: Date) => d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
  const batas = q.batas && /^\d{4}-\d{2}-\d{2}$/.test(q.batas) ? tgl(new Date(`${q.batas}T00:00:00+07:00`)) : "";
  const total = (h: Record<string, { L: number; P: number; "?": number }>) =>
    Object.values(h).reduce((a, x) => ({ L: a.L + x.L, P: a.P + x.P, n: a.n + x.L + x.P + x["?"] }), { L: 0, P: 0, n: 0 });

  return (
    <div className="py-6 print:py-0">
      <div className="mx-auto mb-4 flex max-w-[21cm] flex-wrap justify-end gap-2 px-4 print:hidden">
        <Link href="/pusat-spmb/tahapan" className="btn-modal-cancel"><ArrowLeft size={16} /> Kembali</Link>
        <PrintButton />
      </div>
      <style>{`@page { size: A4 portrait; margin: 1.5cm; }`}</style>
      <div className="print-doc mx-auto max-w-[21cm] bg-white px-8 pb-10 pt-0 text-[12px] leading-relaxed text-gray-800 shadow-sm print:shadow-none">
        <PrintKop title="Surat Pesanan Seragam" subtitle={`SPMB ${s["spmb.tahun"] || ""}${r.gelombang ? ` · ${r.gelombang}` : ""} · ${sekolah}`} logoUrl={s["logo.full_white"]} />

        <p className="mb-1">Kepada Yth.</p>
        <p className="mb-4 font-semibold">{q.kepada?.trim() || "..............................................................."}</p>
        <p className="mb-4 text-justify">
          Dengan hormat, bersama ini kami memesan seragam untuk calon murid baru {sekolah} sebanyak{" "}
          <span className="font-semibold">{r.jumlah} orang</span> dengan rincian ukuran sebagai berikut
          {batas ? <>, dan mohon dapat diselesaikan paling lambat <span className="font-semibold">{batas}</span></> : ""}.
        </p>

        {r.item.map(n => {
          const h = r.hitung[n] ?? {};
          const t = total(h);
          // Item khusus putra/putri (Celana / Rok) cukup satu kolom jumlah — kolom jenis kelamin lain pasti kosong.
          const khusus = r.untuk[n] === "L" || r.untuk[n] === "P";
          const sel = "border border-gray-400 px-2 py-1";
          return (
            <section key={n} className="mb-4">
              <h2 className="mb-1 text-[12px] font-bold uppercase tracking-wide text-primary-900">
                {n}{khusus ? <span className="ml-1 font-normal normal-case text-gray-500">({r.untuk[n] === "L" ? "putra" : "putri"})</span> : null}
              </h2>
              <table className="w-full border-collapse text-center">
                <thead>
                  <tr className="bg-gray-100">
                    <th className={`${sel} text-left`}>Ukuran</th>
                    {!khusus && <th className={sel}>Putra</th>}
                    {!khusus && <th className={sel}>Putri</th>}
                    {!khusus && r.adaTanpaJk && <th className={sel}>Tanpa keterangan</th>}
                    <th className={sel}>Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(h).map(([u, j]) => (
                    <tr key={u}>
                      <td className={`${sel} text-left font-semibold`}>{u}</td>
                      {!khusus && <td className={`angka ${sel}`}>{j.L || "–"}</td>}
                      {!khusus && <td className={`angka ${sel}`}>{j.P || "–"}</td>}
                      {!khusus && r.adaTanpaJk && <td className={`angka ${sel}`}>{j["?"] || "–"}</td>}
                      <td className={`angka ${sel} font-semibold`}>{j.L + j.P + j["?"] || "–"}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-bold">
                    <td className={`${sel} text-left`}>Jumlah</td>
                    {!khusus && <td className={`angka ${sel}`}>{t.L}</td>}
                    {!khusus && <td className={`angka ${sel}`}>{t.P}</td>}
                    {!khusus && r.adaTanpaJk && <td className={`angka ${sel}`}>{t.n - t.L - t.P}</td>}
                    <td className={`angka ${sel}`}>{t.n}</td>
                  </tr>
                </tbody>
              </table>
            </section>
          );
        })}

        {q.catatan?.trim() && <p className="mb-4 whitespace-pre-line"><span className="font-semibold">Catatan:</span> {q.catatan.trim()}</p>}
        <p className="mb-6">Daftar nama per calon terlampir dalam berkas Excel rekap seragam. Atas perhatian dan kerja samanya kami ucapkan terima kasih.</p>

        <div className="grid grid-cols-2 gap-10 text-center">
          <div>
            <p>&nbsp;</p>
            <p>Mengetahui,<br />Kepala Sekolah</p>
            <GambarTtd src={ttdKepala} tinggi={60} className="my-1" />
            <p className="border-t border-gray-400 pt-1 font-semibold">{kepala || "(.......................................)"}</p>
          </div>
          <div>
            <p>{tgl(new Date())}</p>
            <p>Hormat kami,<br />Panitia SPMB</p>
            <GambarTtd src={ttdSaya} tinggi={60} className="my-1" />
            <p className="border-t border-gray-400 pt-1 font-semibold">{session.name}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
