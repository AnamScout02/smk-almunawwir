import { persenTerserap, type BarisTracer, type HitungTracer } from "@/lib/laporan-tracer";

/** Tabel keterserapan (per angkatan / per jurusan) — dipakai layar & lembar cetak supaya kolomnya selalu sama. */
export default function TabelTracer({ kepala, baris, total, cetak = false }: { kepala: string; baris: BarisTracer[]; total: HitungTracer; cetak?: boolean }) {
  const sel = cetak ? "border border-gray-300 px-1.5 py-[3px]" : "";
  const th = cetak ? `${sel} bg-gray-100 font-semibold` : "";
  const angka = `${sel} ${cetak ? "" : "angka"} text-right`;
  const kolom = ["Alumni", "Mengisi", "Bekerja", "Kuliah", "Wirausaha", "Belum", "Lainnya", "Terserap"];
  const isi = (h: HitungTracer) => [h.alumni, h.mengisi, h.BEKERJA, h.KULIAH, h.WIRAUSAHA, h.BELUM_BEKERJA, h.LAINNYA, persenTerserap(h)];
  return (
    <div className={cetak ? "" : "overflow-x-auto"}>
    <table className={cetak ? "w-full border-collapse" : "data-table"}>
      <thead>
        <tr><th className={`${th} text-left`}>{kepala}</th>{kolom.map(k => <th key={k} className={`${th} text-right`}>{k}</th>)}</tr>
      </thead>
      <tbody>
        {baris.map(b => (
          <tr key={b.label}>
            <td className={`${sel} ${cetak ? "" : "font-semibold text-primary-900"}`}>{b.label}</td>
            {isi(b).map((v, i) => <td key={i} className={angka}>{v}</td>)}
          </tr>
        ))}
        <tr className="font-semibold">
          <td className={sel}>Jumlah</td>
          {isi(total).map((v, i) => <td key={i} className={angka}>{v}</td>)}
        </tr>
      </tbody>
    </table>
    </div>
  );
}
