import PrintKop from "@/components/shared/PrintKop";
import PrintButton from "@/components/shared/PrintButton";
import TombolKembali from "@/components/shared/TombolKembali";
import TabelTracer from "@/components/shared/TabelTracer";
import { getSettings } from "@/lib/site-settings";
import { laporanTracer, MIN_PENGISI, persenTerserap } from "@/lib/laporan-tracer";
import { analisisSebaran } from "@/lib/analisis-sebaran";

/** LAPORAN TRACER STUDY cetak A4 (8 Oktober 2026) — angka dari `laporanTracer`, sama dengan layar Sebaran & Laporan Alumni. */
export default async function LaporanTracerSheet({ kembaliHref }: { kembaliHref: string }) {
  const [l, a, s] = await Promise.all([
    laporanTracer(), analisisSebaran(),
    getSettings(["school.name", "logo.full_white"]).catch(() => ({} as Record<string, string>)),
  ]);
  const t = l.semua;
  const sekolah = s["school.name"] || "SMK Al-Munawwir IIBS";
  const tgl = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
  const kec = [...a.kecamatan].filter(k => k.alumni > 0).sort((x, y) => y.alumni - x.alumni).slice(0, 10);
  const sel = "border border-gray-300 px-1.5 py-[3px]";
  const kepala = `${sel} bg-gray-100 text-left font-semibold`;
  const judul = "mb-1 mt-3 text-[11px] font-bold uppercase tracking-wide text-primary-900";
  const Daftar = ({ nama, isi }: { nama: string; isi: { nama: string; jumlah: number }[] }) => (
    <div>
      <h2 className={judul}>{nama}</h2>
      {isi.length === 0 ? <p className="text-gray-500">Belum ada isian.</p> : (
        <table className="w-full border-collapse">
          <tbody>{isi.slice(0, 10).map((x, i) => <tr key={x.nama}><td className={`${sel} w-6`}>{i + 1}</td><td className={sel}>{x.nama}</td><td className={`${sel} w-10 text-right`}>{x.jumlah}</td></tr>)}</tbody>
        </table>
      )}
    </div>
  );
  return (
    <div className="py-6 print:py-0">
      <div className="mx-auto mb-4 flex max-w-[21cm] flex-wrap justify-end gap-2 px-4 print:hidden">
        <TombolKembali href={kembaliHref} />
        <PrintButton />
      </div>
      <style>{`@page { size: A4 portrait; margin: 1.2cm; }`}</style>
      <div className="print-doc mx-auto max-w-[21cm] bg-white px-8 pb-8 pt-0 text-[10.5px] leading-snug text-gray-800 shadow-sm print:shadow-none">
        <PrintKop title="Laporan Tracer Study Alumni" subtitle={`${sekolah} · per ${tgl}`} logoUrl={s["logo.full_white"]} />
        <div className="grid grid-cols-4 gap-2">
          {[
            ["Alumni", t.alumni, "siswa berstatus lulus"],
            ["Mengisi tracer", t.mengisi, `${((t.mengisi / Math.max(1, t.alumni)) * 100).toLocaleString("id-ID", { maximumFractionDigits: 1 })}% dari alumni`],
            ["Keterserapan", persenTerserap(t), t.mengisi >= MIN_PENGISI ? "bekerja + kuliah + wirausaha" : `pengisi belum ${MIN_PENGISI} orang`],
            ["Belum bekerja / kuliah", t.BELUM_BEKERJA, "dari yang mengisi"],
          ].map(([n, v, k]) => (
            <div key={String(n)} className="rounded border border-gray-300 px-2 py-1.5">
              <p className="text-[9px] uppercase tracking-wide text-gray-500">{n}</p>
              <p className="text-[17px] font-bold leading-tight text-primary-900">{typeof v === "number" ? v.toLocaleString("id-ID") : v}</p>
              <p className="text-[9px] text-gray-500">{k}</p>
            </div>
          ))}
        </div>
        <h2 className={judul}>Keterserapan per angkatan lulus</h2>
        <TabelTracer kepala="Lulus tahun" baris={l.perAngkatan} total={t} cetak />
        <h2 className={judul}>Keterserapan per jurusan</h2>
        <TabelTracer kepala="Jurusan" baris={l.perJurusan} total={t} cetak />
        <div className="grid grid-cols-3 gap-4">
          <Daftar nama="Tempat kerja terbanyak" isi={l.kerja} />
          <Daftar nama="Kampus terbanyak" isi={l.kuliah} />
          <div>
            <h2 className={judul}>Kecamatan asal alumni</h2>
            <table className="w-full border-collapse">
              <thead><tr><th className={kepala}>Kecamatan</th><th className={`${kepala} text-right`}>Alumni</th></tr></thead>
              <tbody>{kec.map(k => <tr key={k.kode}><td className={sel}>{k.nama}</td><td className={`${sel} text-right`}>{k.alumni}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
        <p className="mt-3 text-[9px] text-gray-500">
          Terserap = (bekerja + kuliah + wirausaha) ÷ alumni yang sudah mengisi tracer; ditulis hanya bila pengisinya sedikitnya {MIN_PENGISI} orang.
          Kecamatan dari alamat Buku Induk saat bersekolah.
        </p>
      </div>
    </div>
  );
}
