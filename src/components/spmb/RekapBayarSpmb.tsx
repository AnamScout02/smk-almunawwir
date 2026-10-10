"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Wallet, Search, FileSpreadsheet, CircleDollarSign, Hourglass, TrendingDown, ReceiptText } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import Select from "@/components/admin/Select";
import Paginasi from "@/components/shared/Paginasi";
import { usePaginasi } from "@/lib/use-paginasi";
import { rupiah } from "@/lib/spmb-tahapan";
import { LABEL_KEADAAN, rekapPerGelombang, rekapPerTanggal, ringkasRekap, type BarisRekapBayar } from "@/lib/spmb-rekap-hitung";

const tgl = (iso: string | null, panjang = false) => (iso ? new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: panjang ? "numeric" : "2-digit", timeZone: "Asia/Jakarta" }) : "—");
const WARNA: Record<BarisRekapBayar["keadaan"], string> = {
  LUNAS: "bg-emerald-50 text-emerald-700 border-emerald-200", CICIL: "bg-amber-50 text-amber-700 border-amber-200",
  BELUM: "bg-red-50 text-red-700 border-red-200", TANPA: "bg-gray-50 text-gray-600 border-gray-200",
};
const TAB = [["calon", "Per Calon"], ["gelombang", "Per Gelombang"], ["tanggal", "Per Tanggal"]] as const;

/** Layar REKAP PEMBAYARAN SPMB (10 Oktober 2026). Semua angka dari src/lib/spmb-rekap-hitung.ts — sama dengan Excel-nya.
 *  Saringan gelombang/keadaan/cari berlaku untuk kartu angka DAN ketiga tabel sekaligus. */
export default function RekapBayarSpmb({ baris, gelombang, syarat, uangMuka }: {
  baris: BarisRekapBayar[]; gelombang: { id: string; nama: string; biaya: number }[]; syarat: string; uangMuka: number;
}) {
  const [g, setG] = useState("");
  const [keadaan, setKeadaan] = useState("");
  const [cari, setCari] = useState("");
  const [tab, setTab] = useState<(typeof TAB)[number][0]>("calon");
  const [buka, setBuka] = useState<string | null>(null);

  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return baris.filter(b => (!g || b.gelombangId === g)
      && (!keadaan || (keadaan === "MENUNGGU" ? b.menunggu > 0 : keadaan === "KURANG" ? b.sisa > 0 : b.keadaan === keadaan))
      && (!q || b.nama.toLowerCase().includes(q) || b.nomor.toLowerCase().includes(q) || b.jurusan.toLowerCase().includes(q)));
  }, [baris, g, keadaan, cari]);
  const r = useMemo(() => ringkasRekap(tersaring), [tersaring]);
  const perGel = useMemo(() => rekapPerGelombang(tersaring), [tersaring]);
  const perTgl = useMemo(() => rekapPerTanggal(tersaring), [tersaring]);
  const hal = usePaginasi(tersaring, 50, `${g}|${keadaan}|${cari}`);

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Wallet size={22} />} title="Rekap Pembayaran" description="Biaya daftar ulang tiap calon: tagihan, yang sudah dibayar, tanggalnya, dan kekurangannya" />
      <div className="space-y-6">
        <div className="kisi-kartu kisi-kartu-4">
          <StatTile value={rupiah(r.tagihan)} label={`Tagihan ${r.calon} calon${r.potongan ? ` (setelah potongan ${rupiah(r.potongan)})` : ""}`} icon={ReceiptText} color="primary" size="md" />
          <StatTile value={rupiah(r.sah)} label={`Sudah masuk · ${r.persen}% dari tagihan`} icon={CircleDollarSign} color="emerald" size="md" />
          <StatTile value={rupiah(r.sisa)} label={`Kurang · ${r.cicil} mencicil, ${r.belum} belum bayar`} icon={TrendingDown} color="red" size="md" sorot={r.sisa > 0} />
          <StatTile value={rupiah(r.menunggu)} label="Bukti menunggu diperiksa (belum dihitung masuk)" icon={Hourglass} color="amber" size="md" sorot={r.menunggu > 0} />
        </div>

        <div className="baris-alat">
          <div className="alat-cari"><Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" /><input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari nama, nomor pendaftaran, atau jurusan..." className="input-field pl-10" /></div>
          <div className="alat-saring"><Select value={g} onChange={setG} options={[{ value: "", label: "Semua gelombang" }, ...gelombang.map(x => ({ value: x.id, label: `${x.nama}${x.biaya ? ` · ${rupiah(x.biaya)}` : ""}` }))]} /></div>
          <div className="alat-saring"><Select value={keadaan} onChange={setKeadaan} options={[{ value: "", label: "Semua keadaan" }, { value: "KURANG", label: "Masih kurang" }, { value: "LUNAS", label: "Lunas" }, { value: "CICIL", label: "Mencicil" }, { value: "BELUM", label: "Belum bayar" }, { value: "MENUNGGU", label: "Ada bukti menunggu" }]} /></div>
          <div className="alat-tab flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-gray-100 bg-white p-1 scrollbar-hide">
            {TAB.map(([k, l]) => <button key={k} type="button" onClick={() => setTab(k)} className={`sentuh whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition ${tab === k ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>{l}</button>)}
          </div>
          <div className="alat-aksi"><a href={`/api/spmb/tahapan/pembayaran${g ? `?gelombangId=${g}` : ""}`} className="btn-modal-cancel"><FileSpreadsheet /> Unduh Excel</a></div>
        </div>

        {tersaring.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">Tidak ada calon yang cocok dengan saringan ini.</p> : tab === "calon" ? (
          <div className="panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th className="w-10">No</th><th>Calon</th><th>Gelombang</th><th className="text-right">Tagihan</th><th className="text-right">Sudah Bayar</th><th className="text-right">Kurang</th><th>Bayar Terakhir</th><th>Keadaan</th></tr></thead>
                <tbody>
                  {hal.potongan.map((b, i) => (
                    <FragmenCalon key={b.id} b={b} no={hal.awal + i} buka={buka === b.id} alih={() => setBuka(buka === b.id ? null : b.id)} />
                  ))}
                </tbody>
              </table>
            </div>
            <Paginasi hal={hal} satuan="calon" className="border-t border-gray-100" />
          </div>
        ) : tab === "gelombang" ? (
          <div className="panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Gelombang</th><th className="text-right">Calon</th><th className="text-right">Lunas</th><th className="text-right">Mencicil</th><th className="text-right">Belum</th><th className="text-right">Tagihan</th><th className="text-right">Sudah Masuk</th><th className="text-right">Kurang</th><th>Terkumpul</th></tr></thead>
                <tbody>
                  {[...perGel, ...(perGel.length > 1 ? [{ id: "jumlah", nama: "Jumlah", ...r }] : [])].map(x => (
                    <tr key={x.id} className={x.id === "jumlah" ? "font-semibold" : ""}>
                      <td className="font-semibold text-primary-900">{x.nama}</td>
                      <td className="angka text-right">{x.calon}</td><td className="angka text-right text-emerald-700">{x.lunas}</td><td className="angka text-right text-amber-700">{x.cicil}</td><td className="angka text-right text-red-700">{x.belum}</td>
                      <td className="angka text-right whitespace-nowrap">{rupiah(x.tagihan)}</td><td className="angka text-right whitespace-nowrap">{rupiah(x.sah)}</td><td className="angka text-right whitespace-nowrap">{rupiah(x.sisa)}</td>
                      <td className="min-w-[8rem]"><div className="flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100"><div className={`h-full rounded-full ${x.persen >= 100 ? "bg-emerald-500" : "bg-amber-400"}`} style={{ width: `${x.persen}%` }} /></div><span className="angka text-xs text-gray-500">{x.persen}%</span></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : perTgl.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">Belum ada pembayaran yang disahkan.</p> : (
          <div className="panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Tanggal</th><th className="text-right">Transaksi</th><th className="text-right">Calon</th><th className="text-right">Tunai</th><th className="text-right">Transfer</th><th className="text-right">Jumlah Masuk</th></tr></thead>
                <tbody>
                  {perTgl.map(x => (
                    <tr key={x.tanggal}>
                      <td className="font-semibold text-primary-900 whitespace-nowrap">{new Date(`${x.tanggal}T05:00:00Z`).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" })}</td>
                      <td className="angka text-right">{x.transaksi}</td><td className="angka text-right">{x.calon}</td>
                      <td className="angka text-right whitespace-nowrap">{rupiah(x.tunai)}</td><td className="angka text-right whitespace-nowrap">{rupiah(x.transfer)}</td><td className="angka text-right whitespace-nowrap font-semibold">{rupiah(x.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <p className="text-xs text-gray-500">
          Tagihan = biaya daftar ulang gelombangnya dikurangi potongan. &quot;Sudah bayar&quot; hanya menghitung pembayaran yang sudah DISAHKAN panitia; bukti yang baru dikirim calon tampil sebagai &quot;menunggu diperiksa&quot;.
          {syarat === "UANG_MUKA" ? ` Syarat daftar ulang saat ini: uang muka ${rupiah(uangMuka)}.` : syarat === "LUNAS" ? " Syarat daftar ulang saat ini: lunas." : " Pembayaran saat ini bukan syarat daftar ulang."}
          {" "}Mengesahkan, menolak, atau mencatat pembayaran dilakukan di jendela calon — ketuk nama calon.
        </p>
      </div>
    </div>
  );
}

function FragmenCalon({ b, no, buka, alih }: { b: BarisRekapBayar; no: number; buka: boolean; alih: () => void }) {
  return (
    <>
      <tr>
        <td className="angka">{no}</td>
        <td className="min-w-[12rem]">
          <Link href={`/pusat-spmb/tahapan?buka=${b.id}`} className="font-semibold text-primary-900 hover:underline">{b.nama}</Link>
          <span className="block text-xs text-gray-500">{[b.nomor, b.jurusan, b.jadiSiswa ? "sudah jadi siswa" : b.status].filter(Boolean).join(" · ")}</span>
        </td>
        <td className="whitespace-nowrap text-xs text-gray-600">{b.gelombang}</td>
        <td className="angka text-right whitespace-nowrap">{rupiah(b.tagihan)}{b.potongan > 0 && <span className="block text-xs text-gray-500">potongan {rupiah(b.potongan)}</span>}</td>
        <td className="angka text-right whitespace-nowrap">{rupiah(b.sah)}{b.menunggu > 0 && <span className="block text-xs text-amber-700">+{rupiah(b.menunggu)} menunggu</span>}</td>
        <td className={`angka text-right whitespace-nowrap ${b.sisa > 0 ? "font-semibold text-red-700" : "text-gray-500"}`}>{b.sisa > 0 ? rupiah(b.sisa) : "—"}</td>
        <td className="whitespace-nowrap text-xs">
          {b.cicilan.length ? <button type="button" onClick={alih} aria-expanded={buka} className="text-left text-primary-700 underline decoration-gray-300 underline-offset-2">{tgl(b.terakhir ?? b.cicilan.at(-1)!.tanggal)} · {b.cicilan.length}× {buka ? "▴" : "▾"}</button> : <span className="text-gray-400">belum ada</span>}
          {b.hariDiam != null && b.hariDiam >= 14 && <span className="block text-red-600">{b.hariDiam} hari lalu</span>}
        </td>
        <td><span className={`status-badge ${WARNA[b.keadaan]}`}>{LABEL_KEADAAN[b.keadaan]}</span></td>
      </tr>
      {buka && (
        <tr>
          <td />
          <td colSpan={7} className="bg-gray-50/70">
            <ul className="space-y-1 py-1 text-sm">
              {b.cicilan.map((c, i) => (
                <li key={`${c.tanggal}-${i}`} className="flex flex-wrap items-baseline gap-x-3">
                  <span className="angka w-24 text-gray-600">{tgl(c.tanggal, true)}</span>
                  <span className="angka w-28 font-semibold text-primary-900">{rupiah(c.jumlah)}</span>
                  <span className="text-xs text-gray-500">{c.metode === "TUNAI" ? "tunai" : "transfer"}{c.kuitansi ? ` · ${c.kuitansi}` : ""}{c.oleh ? ` · ${c.oleh}` : ""}</span>
                  {c.status !== "SAH" && <span className="status-badge bg-amber-50 text-amber-700 border-amber-200">menunggu diperiksa</span>}
                </li>
              ))}
              {b.ketPotongan && <li className="text-xs text-gray-500">Potongan: {b.ketPotongan}</li>}
              {b.konfirmasi && <li className="text-xs text-gray-500">Konfirmasi daftar ulang: {tgl(b.konfirmasi, true)}</li>}
              {b.wa && <li className="text-xs text-gray-500">WhatsApp: {b.wa}</li>}
            </ul>
          </td>
        </tr>
      )}
    </>
  );
}
