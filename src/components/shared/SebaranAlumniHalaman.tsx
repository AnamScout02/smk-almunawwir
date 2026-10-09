import { MapPinned } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import { BarisKembali } from "@/components/shared/TombolKembali";
import { TautanIkon } from "@/components/shared/IkonNama";
import PetaSebaran from "@/components/spmb/PetaSebaran";
import TabelTracer from "@/components/shared/TabelTracer";
import { sebaranPetaAlumni } from "@/lib/peta-sebaran";
import { laporanTracer, MIN_PENGISI, persenTerserap, terserap } from "@/lib/laporan-tracer";

/** SEBARAN & LAPORAN ALUMNI (8 Oktober 2026) — pintu Humas/BKK: peta alumni (saringan angkatan & status tracer),
 *  keterserapan per angkatan & jurusan, dan tempat kerja/kampus terbanyak. `dasar` = alamat menu Tracer Study portal ini. */
export default async function SebaranAlumniHalaman({ dasar }: { dasar: string }) {
  const [alumni, l] = await Promise.all([sebaranPetaAlumni(), laporanTracer()]);
  const s = l.semua;
  const Daftar = ({ judul, isi, kosong }: { judul: string; isi: { nama: string; jumlah: number }[]; kosong: string }) => (
    <div className="panel p-5">
      <h2 className="font-heading mb-3 text-sm font-semibold text-navy">{judul}</h2>
      {isi.length === 0 ? <p className="text-sm text-gray-400">{kosong}</p> : (
        <ol className="space-y-1.5 text-sm">
          {isi.map((x, i) => (
            <li key={x.nama} className="flex items-baseline gap-2">
              <span className="angka w-5 shrink-0 text-xs text-gray-400">{i + 1}</span>
              <span className="min-w-0 flex-1 text-gray-700">{x.nama}</span>
              <span className="angka font-semibold text-navy">{x.jumlah}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<MapPinned size={22} />} title="Sebaran & Laporan Alumni"
        description="Di mana alumni tinggal dan apa kabarnya setelah lulus — dari isian Tracer Study" />
      <BarisKembali href={dasar} />
      <div className="space-y-6">
        <div className="kisi-kartu kisi-kartu-4">
          <StatTile value={s.alumni} label="Alumni" ikon="siswa" color="primary" />
          <StatTile value={s.mengisi} label="Sudah mengisi tracer" sublabel={`${((s.mengisi / Math.max(1, s.alumni)) * 100).toLocaleString("id-ID", { maximumFractionDigits: 1 })}% dari alumni`} ikon="absensi" color="blue" />
          <StatTile value={persenTerserap(s)} label="Bekerja, kuliah, atau wirausaha"
            sublabel={s.mengisi >= MIN_PENGISI ? `${terserap(s)} dari ${s.mengisi} yang mengisi` : `Baru ${s.mengisi} yang mengisi — minimal ${MIN_PENGISI} untuk dihitung`} ikon="tren" color="emerald" />
          <StatTile value={s.BELUM_BEKERJA} label="Belum bekerja / kuliah" ikon="menunggu" color="amber" />
        </div>

        <div className="alat-aksi alat-teks justify-end">
          <TautanIkon href={`${dasar}/qr`} ikon="qr" className="btn-modal-cancel">Kartu QR untuk Alumni</TautanIkon>
          <TautanIkon href={`${dasar}/laporan`} ikon="cetak" className="btn-modal-cancel">Cetak Laporan Tracer</TautanIkon>
        </div>

        <div className="panel p-4 sm:p-5">
          <PetaSebaran alumni={alumni} lapis={["alumni"]} />
        </div>

        <div className="panel overflow-hidden">
          <div className="panel-kepala"><h2 className="panel-judul">Keterserapan per angkatan lulus</h2></div>
          <div className="overflow-x-auto"><TabelTracer kepala="Lulus tahun" baris={l.perAngkatan} total={s} /></div>
        </div>
        <div className="panel overflow-hidden">
          <div className="panel-kepala"><h2 className="panel-judul">Keterserapan per jurusan</h2></div>
          <div className="overflow-x-auto"><TabelTracer kepala="Jurusan" baris={l.perJurusan} total={s} /></div>
        </div>
        <p className="text-xs text-gray-500">
          &ldquo;Terserap&rdquo; = bekerja + kuliah + wirausaha dibagi yang SUDAH mengisi tracer, dan baru ditulis bila pengisinya sedikitnya {MIN_PENGISI} orang.
        </p>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Daftar judul="Tempat kerja terbanyak" isi={l.kerja} kosong="Belum ada alumni bekerja yang menyebut tempat kerjanya." />
          <Daftar judul="Kampus terbanyak" isi={l.kuliah} kosong="Belum ada alumni kuliah yang menyebut kampusnya." />
        </div>
      </div>
    </div>
  );
}
