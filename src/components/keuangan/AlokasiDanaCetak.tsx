import { notFound } from "next/navigation";
import { verifySession } from "@/lib/dal";
import { jabatanAtauAlihkan } from "@/lib/jabatan-guard";
import { assertBendahara } from "@/lib/bendahara-guard";
import { getSettings } from "@/lib/site-settings";
import { muatRencana } from "@/lib/alokasi-dana-server";
import { hitungRencana, hitungRealisasi, formatRupiah as rp, BELUM_DIALOKASIKAN } from "@/lib/alokasi-dana";
import PrintKop from "@/components/shared/PrintKop";
import PrintButton from "@/components/shared/PrintButton";
import { BarisKembali } from "@/components/shared/TombolKembali";

/** Lembar cetak alokasi dana — angka dari hitungan yang SAMA dengan layar & Excel. Tanpa blok tanda tangan: keputusan
 *  user "ini hanya untuk perhitungan". */
export default async function AlokasiDanaCetak({ id, kembaliHref }: { id: string; kembaliHref: string }) {
  const session = await verifySession();
  await jabatanAtauAlihkan(session, () => assertBendahara(session));
  const [r, s] = await Promise.all([id ? muatRencana(id) : null, getSettings(["logo.full_white"])]);
  if (!r) notFound();
  const h = hitungRencana(r.angkatan, { bulan: r.bulan, posPenampung: r.posPenampung });
  const re = hitungRealisasi(h, r.transaksi);
  const th = "border border-gray-700 bg-gray-100 px-2 py-1 text-left font-semibold";
  const td = "border border-gray-700 px-2 py-1";
  const tdA = `${td} text-right tabular-nums`;
  const dicetak = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0">
      <style>{"@page { size: A4 portrait; margin: 1.2cm; }"}</style>
      <div className="print:hidden"><BarisKembali href={kembaliHref} /></div>
      <div className="flex justify-end mb-5 print:hidden"><PrintButton /></div>

      <div className="print-doc bg-white max-w-[210mm] mx-auto text-[11.5px] leading-snug">
        <PrintKop title="Rencana Alokasi Dana Iuran" subtitle={`${r.nama}${r.tahunAjaran ? ` · Tahun Ajaran ${r.tahunAjaran}` : ""}`} logoUrl={s["logo.full_white"]} />
        <p className="mb-3">Iuran dipungut {h.bulan} bulan per tahun · {h.totalSiswa} siswa · pemasukan {rp(h.pemasukanBulan)} per bulan ({rp(h.pemasukanTahun)} per tahun).</p>

        <h3 className="mb-1 font-bold">A. Ringkasan per Pos</h3>
        <table className="mb-4 w-full border-collapse">
          <thead><tr><th className={th}>Pos</th>{h.angkatan.map((a, i) => <th key={a.id ?? i} className={`${th} text-right`}>{a.nama}</th>)}<th className={`${th} text-right`}>Per bulan</th><th className={`${th} text-right`}>Per tahun</th><th className={`${th} text-right`}>Porsi</th></tr></thead>
          <tbody>
            {h.rekap.map(p => (
              <tr key={p.nama}><td className={td}>{p.nama}</td>
                {h.angkatan.map((a, i) => <td key={a.id ?? i} className={tdA}>{p.perAngkatan[a.id ?? `#${i}`] ? rp(p.perAngkatan[a.id ?? `#${i}`]) : "—"}</td>)}
                <td className={tdA}>{rp(p.perBulan)}</td><td className={tdA}>{rp(p.perTahun)}</td><td className={tdA}>{p.porsi.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%</td></tr>
            ))}
            {h.belumDialokasikanBulan > 0 && <tr><td className={td}>{BELUM_DIALOKASIKAN}</td>{h.angkatan.map((a, i) => <td key={a.id ?? i} className={tdA}>{a.belumDialokasikan ? rp(a.belumDialokasikan) : "—"}</td>)}
              <td className={tdA}>{rp(h.belumDialokasikanBulan)}</td><td className={tdA}>{rp(h.belumDialokasikanBulan * h.bulan)}</td><td className={td} /></tr>}
            <tr className="font-bold"><td className={td}>TOTAL</td>{h.angkatan.map((a, i) => <td key={a.id ?? i} className={tdA}>{rp(a.pemasukanBulan)}</td>)}
              <td className={tdA}>{rp(h.pemasukanBulan)}</td><td className={tdA}>{rp(h.pemasukanTahun)}</td><td className={tdA}>100%</td></tr>
          </tbody>
        </table>

        <h3 className="mb-1 font-bold">B. Rincian per Angkatan</h3>
        {h.angkatan.map((a, i) => (
          <div key={a.id ?? i} className="mb-3" style={{ breakInside: "avoid" }}>
            <p className="font-semibold">{a.nama} — {a.jumlahSiswa} siswa × {rp(a.iuran)}/bulan{a.siswaKeringanan ? ` (${a.siswaKeringanan} siswa keringanan)` : ""} = {rp(a.pemasukanBulan)}/bulan</p>
            <table className="w-full border-collapse">
              <thead><tr><th className={th}>Pos</th><th className={th}>Alokasi</th><th className={`${th} text-right`}>Per siswa/bln</th><th className={`${th} text-right`}>Per bulan</th><th className={`${th} text-right`}>Per semester</th><th className={`${th} text-right`}>Per tahun</th></tr></thead>
              <tbody>
                {a.pos.map(p => (
                  <tr key={p.nama}><td className={td}>{p.nama}</td><td className={td}>{p.jenis === "PERSEN" ? `${p.nilai.toLocaleString("id-ID")}%` : `${rp(p.nilai)}/siswa`}</td>
                    <td className={tdA}>{rp(p.perSiswa)}</td><td className={tdA}>{rp(p.perBulan)}</td><td className={tdA}>{rp(p.perSemester)}</td><td className={tdA}>{rp(p.perTahun)}</td></tr>
                ))}
                {a.belumDialokasikan > 0 && <tr><td className={td} colSpan={3}>{BELUM_DIALOKASIKAN}</td><td className={tdA}>{rp(a.belumDialokasikan)}</td><td className={tdA}>{rp(Math.round(a.belumDialokasikan * h.bulan / 2))}</td><td className={tdA}>{rp(a.belumDialokasikan * h.bulan)}</td></tr>}
                <tr className="font-bold"><td className={td} colSpan={3}>Total</td><td className={tdA}>{rp(a.pemasukanBulan)}</td><td className={tdA}>{rp(a.pemasukanSemester)}</td><td className={tdA}>{rp(a.pemasukanTahun)}</td></tr>
              </tbody>
            </table>
          </div>
        ))}

        {r.transaksi.length > 0 && (
          <div style={{ breakInside: "avoid" }}>
            <h3 className="mb-1 mt-2 font-bold">C. Realisasi & Saldo per Pos</h3>
            <table className="w-full border-collapse">
              <thead><tr><th className={th}>Pos</th><th className={`${th} text-right`}>Anggaran/tahun</th><th className={`${th} text-right`}>Uang masuk</th><th className={`${th} text-right`}>Pengeluaran</th><th className={`${th} text-right`}>Saldo</th></tr></thead>
              <tbody>
                {re.pos.map(p => <tr key={p.nama}><td className={td}>{p.nama}</td><td className={tdA}>{p.anggaranTahun ? rp(p.anggaranTahun) : "—"}</td><td className={tdA}>{rp(p.masuk)}</td><td className={tdA}>{rp(p.keluar)}</td><td className={tdA}>{rp(p.saldo)}</td></tr>)}
                <tr className="font-bold"><td className={td}>TOTAL</td><td className={tdA}>{rp(h.pemasukanTahun)}</td><td className={tdA}>{rp(re.totalMasuk)}</td><td className={tdA}>{rp(re.totalKeluar)}</td><td className={tdA}>{rp(re.saldo)}</td></tr>
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-4 text-right text-[10px] text-gray-500">Dicetak {dicetak}</p>
      </div>
    </div>
  );
}
