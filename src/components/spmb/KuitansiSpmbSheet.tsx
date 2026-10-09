import PrintKop from "@/components/shared/PrintKop";
import GambarTtd from "@/components/shared/GambarTtd";
import { rupiah } from "@/lib/spmb-tahapan";
import { terbilangRupiah } from "@/lib/terbilang";
import type { DataKuitansi } from "@/lib/spmb-dokumen";

/** KUITANSI satu cicilan daftar ulang SPMB yang sudah SAH (7 Okt 2026) — satu lembar untuk calon & panitia.
 *  Setengah A4 dengan garis potong, supaya selembar kertas cukup untuk dua kuitansi bila dicetak bergantian. */
export default function KuitansiSpmbSheet({ d, sekolah, logoUrl, tahun }: { d: DataKuitansi; sekolah: string; logoUrl?: string; tahun?: string }) {
  const tgl = (v: Date) => v.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
  const baris: [string, React.ReactNode][] = [
    ["Telah terima dari", d.calon.guardianName ? `${d.calon.guardianName} (orang tua/wali ${d.calon.fullName})` : d.calon.fullName],
    ["Uang sejumlah", <span key="t" className="font-semibold italic">{terbilangRupiah(d.jumlah)}</span>],
    ["Untuk pembayaran", `Daftar ulang SPMB ${tahun || ""} — cicilan ke-${d.cicilanKe}`.replace(/\s+—/, " —")],
    ["Atas nama calon", `${d.calon.fullName} · ${d.calon.nomor ?? "—"} · ${d.calon.chosenMajor || "—"}${d.calon.gelombang ? ` · ${d.calon.gelombang.nama}` : ""}`],
    ["Cara bayar", `${d.metode === "TUNAI" ? "Tunai" : "Transfer"}, ${tgl(d.tanggal)}${d.catatan ? ` · ${d.catatan}` : ""}`],
  ];
  return (
    <>
      <style>{`@page { size: A4 portrait; margin: 1cm; }`}</style>
      <div className="print-doc mx-auto max-w-[19cm] bg-white px-8 pb-6 pt-0 text-[12px] leading-relaxed text-gray-800 shadow-sm print:shadow-none">
        <PrintKop title="Kuitansi Pembayaran" subtitle={`Daftar Ulang SPMB ${tahun || ""} · ${sekolah}`.replace(/\s+·/, " ·")} logoUrl={logoUrl}
          spacingClassName="mb-4 px-10 py-4" />
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <p className="text-[11px] uppercase tracking-widest text-gray-500">Nomor kuitansi</p>
          <p className="angka font-heading text-lg font-bold tracking-wider text-primary-900">{d.no}</p>
        </div>

        <table className="mb-4 w-full border-collapse">
          <tbody>
            {baris.map(([k, v]) => (
              <tr key={k} className="border-b border-dotted border-gray-300 align-top">
                <td className="w-[4.2cm] py-1.5 text-gray-600">{k}</td>
                <td className="w-4 py-1.5 text-gray-400">:</td>
                <td className="py-1.5 text-gray-900">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex items-end justify-between gap-6">
          <div className="space-y-2">
            <p className="angka inline-block rounded-md border-2 border-primary-900 px-4 py-1.5 font-heading text-xl font-bold text-primary-900">{rupiah(d.jumlah)}</p>
            <table className="text-[11px] text-gray-600">
              <tbody>
                <tr><td className="pr-3">Total tagihan</td><td className="angka text-right">{rupiah(d.tagihan)}</td></tr>
                <tr><td className="pr-3">Terbayar s.d. kuitansi ini</td><td className="angka text-right">{rupiah(d.sampaiIni)}</td></tr>
                <tr className="font-semibold text-gray-800"><td className="pr-3">{d.lunas ? "Status" : "Sisa"}</td><td className="angka text-right">{d.lunas ? "LUNAS" : rupiah(d.sisa)}</td></tr>
              </tbody>
            </table>
          </div>
          <div className="flex items-end gap-4">
            {d.qr && (
              <div className="text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={d.qr} alt="QR keaslian kuitansi" className="h-[2.2cm] w-[2.2cm]" />
                <p className="mt-0.5 text-[9px] leading-tight text-gray-500">Pindai untuk<br />memeriksa keaslian</p>
              </div>
            )}
            <div className="w-[5.5cm] text-center">
              <p>{tgl(d.tanggalSah)}</p>
              <p>Penerima,</p>
              <GambarTtd src={d.ttdPenerima} tinggi={52} className="my-1" />
              <p className="border-t border-gray-400 pt-1 font-semibold">{d.penerima || "Panitia SPMB"}</p>
              <p className="text-gray-500">Panitia SPMB</p>
            </div>
          </div>
        </div>
        <p className="mt-4 border-t border-dashed border-gray-300 pt-2 text-center text-[10px] text-gray-400">
          Kuitansi ini sah tanpa cap basah — keasliannya dapat diperiksa dengan memindai QR. Simpan sebagai bukti pembayaran.
        </p>
      </div>
    </>
  );
}
