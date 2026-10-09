import { predikatPkl } from "@/lib/pkl-label";
import type { DataSertifikat, KopSertifikat } from "@/lib/pkl-sertifikat";

const tgl = (d: Date) => new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });

/** SATU lembar sertifikat PKL (A4 lanskap) — dipakai cetak per siswa dan cetak massal, supaya bentuknya tidak pernah berbeda. */
export default function LembarSertifikatPkl({ d, kop }: { d: DataSertifikat; kop: KopSertifikat }) {
  return (
    <div className="relative min-w-[720px] border-[6px] border-double border-[#0F1A45] p-10 text-center text-black print:min-h-[188mm]">
      <div className="flex items-center justify-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {kop.logo && <img src={kop.logo} alt="" className="h-16 w-16 object-contain" />}
        <div>
          <p className="text-xl font-bold uppercase tracking-wide">{kop.sekolah}</p>
          {kop.alamat && <p className="text-xs">{kop.alamat}</p>}
        </div>
      </div>
      <p className="mt-8 font-heading text-4xl font-bold tracking-[0.2em] text-[#0F1A45]">SERTIFIKAT</p>
      <p className="mt-1 text-lg font-semibold">Praktik Kerja Lapangan (PKL)</p>
      <p className="mt-1 text-sm">Nomor: {d.nomor}</p>
      <p className="mt-8 text-base">Diberikan kepada</p>
      <p className="mt-2 font-heading text-3xl font-bold">{d.nama}</p>
      <p className="mt-1 text-sm">NIS {d.nis} · {d.kelas} · {d.jurusan}</p>
      <p className="mx-auto mt-6 max-w-3xl text-base leading-relaxed">
        telah melaksanakan Praktik Kerja Lapangan di <strong>{d.tempat}</strong> sebagai <strong>{d.posisi}</strong>
        {" "}pada {tgl(d.mulai)} sampai {tgl(d.selesai)}
        {d.nilai != null ? <> dengan nilai <strong>{d.nilai.toLocaleString("id-ID")}</strong> ({predikatPkl(d.nilai)})</> : null}.
      </p>
      <div className="mt-10 grid grid-cols-3 items-end gap-6 text-sm">
        <div className="text-center">
          <p>Pembimbing Industri</p>
          <p className="mt-16 font-semibold underline">{d.pembimbing}</p>
          <p>{d.tempat}</p>
        </div>
        <div className="flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {d.qr && <img src={d.qr} alt="QR keaslian" className="h-24 w-24" />}
          <p className="mt-1 text-[11px]">Pindai untuk memeriksa keaslian</p>
        </div>
        <div className="text-center">
          <p>Kepala Sekolah</p>
          <p className="mt-16 font-semibold underline">{kop.kepala}</p>
        </div>
      </div>
    </div>
  );
}
