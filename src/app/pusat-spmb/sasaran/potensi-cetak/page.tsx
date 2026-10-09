export const dynamic = "force-dynamic";
import PrintKop from "@/components/shared/PrintKop";
import PrintButton from "@/components/shared/PrintButton";
import TombolKembali from "@/components/shared/TombolKembali";
import { verifySpmbAccess } from "@/lib/spmb";
import { getSettings } from "@/lib/site-settings";
import { kabupatenBoleh, saringPotensi, susunPotensi } from "@/lib/potensi-smp";

export const metadata = { title: "Potensi Lulusan SMP/MTs" };

/** Cetak / PDF daftar Potensi Lulusan (8 Okt 2026) — saringan & angkanya sama dengan layar (`saringPotensi`). */
export default async function Page({ searchParams }: { searchParams: Promise<{ kab?: string; kec?: string; jenjang?: string; status?: string; q?: string }> }) {
  await verifySpmbAccess();
  const sp = await searchParams;
  const [boleh, s] = await Promise.all([kabupatenBoleh(), getSettings(["school.name", "logo.full_white"]).catch(() => ({} as Record<string, string>))]);
  const kab = boleh.find(k => k.nama === sp.kab)?.nama ?? boleh[0]?.nama ?? "";
  const p = await susunPotensi(kab);
  const f = saringPotensi(p, sp);
  const nTh = Math.max(1, p.tahunKita.length);
  const fmt = (n: number) => n.toLocaleString("id-ID");
  const rata = (n: number) => (n / nTh).toLocaleString("id-ID", { maximumFractionDigits: 1 });
  const persen = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%` : "—");
  const jumlah = f.baris.reduce((t, b) => ({ k9: t.k9 + b.k9, kita: t.kita + (b.kita ?? 0) }), { k9: 0, kita: 0 });
  const tgl = (d: Date) => d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
  const rentang = p.tahunKita.length > 1 ? `${p.tahunKita[0]}–${p.tahunKita[p.tahunKita.length - 1]}` : String(p.tahunKita[0] ?? "");
  const q = new URLSearchParams(Object.entries({ bagian: "potensi", kab, kec: f.kec, jenjang: f.jenjang, status: f.status, q: f.q, urut: f.urut === "ix" ? "" : f.urut }).filter(x => x[1]) as [string, string][]);
  const sel = "border border-gray-300 px-1.5 py-[3px]";
  const kepala = `${sel} bg-gray-100 text-left font-semibold`;
  const judul = "mb-1 mt-3 text-[11px] font-bold uppercase tracking-wide text-primary-900";

  return (
    <div className="py-6 print:py-0">
      <div className="mx-auto mb-4 flex max-w-[29.7cm] flex-wrap justify-end gap-2 px-4 print:hidden">
        <TombolKembali href={`/pusat-spmb/sasaran?${q}`} />
        <PrintButton />
      </div>
      <style>{`@page { size: A4 landscape; margin: 1.2cm; } thead { display: table-header-group; } tr { break-inside: avoid; }`}</style>
      <div className="print-doc mx-auto max-w-[29.7cm] bg-white px-8 pb-8 pt-0 text-[10.5px] leading-snug text-gray-800 shadow-sm print:shadow-none">
        <PrintKop title="Potensi Lulusan SMP/MTs" subtitle={`${kab}${f.keterangan ? ` · ${f.keterangan}` : ""} · ${s["school.name"] || "SMK Al-Munawwir IIBS"}`} logoUrl={s["logo.full_white"]} />
        <p className="text-gray-600">
          Sumber: situs Sekolah Kita Kemendikdasmen (laporan Dapodik sekolah){p.diambil ? `, disalin ${tgl(p.diambil)}` : ""}. Dicetak {tgl(new Date())}.
          Kelas IX = calon lulusan. &ldquo;Masuk ke kita&rdquo; = rata-rata siswa kita per tahun dari sekolah itu pada angkatan {rentang};
          &ldquo;Serapan&rdquo; membandingkannya dengan kelas IX sekarang (perkiraan). &ldquo;—&rdquo; = belum ada siswa kita yang tercatat dari sekolah itu.
        </p>

        {!f.satuKec && f.kecUrut.length > 1 && (
          <>
            <h2 className={judul}>Rekap per kecamatan</h2>
            <table className="w-full border-collapse">
              <thead><tr><th className={`${kepala} w-6`}>No</th><th className={kepala}>Kecamatan</th><th className={`${kepala} text-right`}>Sekolah</th><th className={`${kepala} text-right`}>Kelas IX</th><th className={`${kepala} text-right`}>Masuk ke kita / th</th><th className={`${kepala} text-right`}>Serapan</th></tr></thead>
              <tbody>
                {f.kecUrut.map(([n, x], i) => (
                  <tr key={n}><td className={sel}>{i + 1}</td><td className={sel}>{n}</td><td className={`${sel} text-right`}>{x.sekolah}</td><td className={`${sel} text-right`}>{fmt(x.k9)}</td>
                    <td className={`${sel} text-right`}>{x.kita ? rata(x.kita) : "—"}</td><td className={`${sel} text-right`}>{x.kita ? persen(x.kita / nTh, x.k9) : "—"}</td></tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <h2 className={judul}>Daftar sekolah ({f.baris.length})</h2>
        <table className="w-full border-collapse">
          <thead>
            <tr><th className={`${kepala} w-6`}>No</th><th className={kepala}>Sekolah &amp; alamat</th>{!f.satuKec && <th className={kepala}>Kecamatan</th>}
              <th className={`${kepala} text-right`}>Kelas IX</th><th className={`${kepala} text-right`}>L/P</th><th className={`${kepala} text-right`}>Jarak</th>
              <th className={kepala}>Kepala sekolah</th><th className={kepala}>Kontak</th>
              <th className={`${kepala} text-right`}>Masuk / th</th><th className={`${kepala} text-right`}>Serapan</th><th className={kepala}>Catatan</th></tr>
          </thead>
          <tbody>
            {f.baris.map((b, i) => (
              <tr key={b.npsn}>
                <td className={sel}>{i + 1}</td>
                <td className={sel}><span className="font-semibold">{b.nama}</span>{b.alamat ? <span className="block text-[9px] text-gray-600">{b.alamat}</span> : null}</td>
                {!f.satuKec && <td className={sel}>{b.kecamatan}</td>}
                <td className={`${sel} text-right font-semibold`}>{b.k9}</td><td className={`${sel} text-right`}>{b.k9L}/{b.k9P}</td>
                <td className={`${sel} text-right`}>{b.jarak === null ? "" : `${b.jarak.toLocaleString("id-ID")} km`}</td>
                <td className={sel}>{b.kepala ?? ""}</td>
                <td className={`${sel} text-[9px]`}>{[b.kontak, b.telepon, b.email].filter(Boolean).join(" · ")}</td>
                <td className={`${sel} text-right`}>{b.kita === null ? "—" : rata(b.kita)}</td><td className={`${sel} text-right`}>{b.kita ? persen(b.kita / nTh, b.k9) : "—"}</td>
                <td className={`${sel} text-[9px]`}>{[b.dikunjungi && `Dikunjungi ${b.dikunjungi.split("-").reverse().join("/")}`, b.catatan].filter(Boolean).join(" — ")}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className={sel} colSpan={f.satuKec ? 2 : 3}>Jumlah</td>
              <td className={`${sel} text-right`}>{fmt(jumlah.k9)}</td><td className={sel} colSpan={4} />
              <td className={`${sel} text-right`}>{rata(jumlah.kita)}</td><td className={`${sel} text-right`}>{persen(jumlah.kita / nTh, jumlah.k9)}</td><td className={sel} />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
