import type { DataKartuPeserta } from "@/lib/spmb-dokumen";
import type { JadwalTahap } from "@/lib/spmb-tahapan";

/** KARTU PESERTA TES SPMB (7 Okt 2026) — dibawa calon saat asesmen & cek kesehatan. Satu komponen untuk cetak
 *  satu kartu (calon) maupun banyak kartu sekaligus (panitia, per sesi/gelombang): dua kartu per A4 bergaris potong. */
export default function KartuPesertaSpmbSheet({ daftar, sekolah, logoUrl, tahun, catatan }: {
  daftar: DataKartuPeserta[]; sekolah: string; logoUrl?: string; tahun?: string; catatan?: string;
}) {
  return (
    <>
      <style>{`@page { size: A4 portrait; margin: 1cm; } @media print { .kartu-peserta { break-inside: avoid; } }`}</style>
      <div className="print-doc mx-auto max-w-[19cm] space-y-6 bg-white p-4 shadow-sm print:space-y-0 print:p-0 print:shadow-none">
        {daftar.map((d, i) => (
          <div key={d.id} className={`kartu-peserta ${i % 2 === 1 ? "print:mt-[1cm] print:border-t print:border-dashed print:border-gray-300 print:pt-[1cm]" : ""} ${i % 2 === 0 && i > 0 ? "print:break-before-page" : ""}`}>
            <Kartu d={d} sekolah={sekolah} logoUrl={logoUrl} tahun={tahun} catatan={catatan} />
          </div>
        ))}
      </div>
    </>
  );
}

function tgl(iso?: string) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00+07:00`);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
}

function Jadwal({ label, j }: { label: string; j: JadwalTahap | null }) {
  return (
    <div className="rounded-lg border border-gray-200 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-primary-700">{label}</p>
      {j?.tanggal ? (
        <>
          <p className="font-semibold text-gray-900">{tgl(j.tanggal)}{j.tanggalSampai ? ` s.d. ${tgl(j.tanggalSampai)}` : ""}</p>
          <p className="angka text-gray-700">{j.jamMulai ? `Pukul ${j.jamMulai}${j.jamSelesai ? `–${j.jamSelesai}` : ""} WIB` : ""}{j.tempat ? `${j.jamMulai ? " · " : ""}${j.tempat}` : ""}</p>
        </>
      ) : <p className="text-gray-400">Menyusul — pantau halaman tahapan</p>}
    </div>
  );
}

function Kartu({ d, sekolah, logoUrl, tahun, catatan }: { d: DataKartuPeserta; sekolah: string; logoUrl?: string; tahun?: string; catatan?: string }) {
  const sama = d.sesi || (d.asesmen?.tanggal && d.asesmen.tanggal === d.pemeriksaan?.tanggal && d.asesmen.jamMulai === d.pemeriksaan?.jamMulai);
  return (
    <div className="overflow-hidden rounded-xl border-2 border-primary-900 bg-white text-[12px] leading-snug text-gray-800">
      <div className="relative flex items-center justify-between gap-4 overflow-hidden px-5 py-3 text-white"
        style={{ background: "linear-gradient(135deg, #0A1030 0%, #0F1A45 40%, #1B2B6B 100%)" }}>
        <div className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{ backgroundImage: "url('/images/pattern-smk-miring.png')", backgroundSize: "127.28px 127.28px", filter: "invert(1)" }} />
        <div className="relative">
          <p className="font-heading text-base font-bold tracking-wide">KARTU PESERTA TES</p>
          <p className="text-[11px] text-white/80">SPMB {tahun || ""} · {sekolah}</p>
        </div>
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="relative h-9 w-auto" />
        )}
      </div>

      <div className="flex gap-4 p-4">
        <div className="flex h-[4cm] w-[3cm] shrink-0 items-center justify-center overflow-hidden border border-gray-300 bg-gray-50 text-center text-[10px] text-gray-400">
          {d.foto
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={d.foto} alt="Pas foto" className="h-full w-full object-cover" />
            : <span>Tempel<br />pas foto<br />3×4</span>}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-500">Nomor peserta</p>
            <p className="angka font-heading text-2xl font-bold tracking-wider text-primary-900">{d.nomor ?? "—"}</p>
          </div>
          <table className="w-full">
            <tbody>
              {([
                ["Nama", d.nama], ["Jenis kelamin", d.gender === "L" ? "Laki-laki" : d.gender === "P" ? "Perempuan" : d.gender || "—"],
                ["Jurusan", d.jurusan || "—"], ["Gelombang", d.gelombang || "—"], ["Sekolah asal", d.sekolahAsal || "—"],
              ] as const).map(([k, v]) => (
                <tr key={k} className="align-top"><td className="w-[2.6cm] text-gray-500">{k}</td><td className="font-medium text-gray-900">{v}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        {d.qr && (
          <div className="shrink-0 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={d.qr} alt="QR peserta" className="h-[2.6cm] w-[2.6cm]" />
            <p className="text-[9px] text-gray-500">Dipindai panitia</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 px-4 pb-3 sm:grid-cols-2 print:grid-cols-2">
        {sama
          ? <div className="sm:col-span-2 print:col-span-2"><Jadwal label="Jadwal datang: asesmen awal & cek kesehatan" j={d.sesi ? { ...d.sesi, tempat: d.sesi.tempat ?? "" } : d.asesmen} /></div>
          : <><Jadwal label="Asesmen awal" j={d.asesmen} /><Jadwal label="Cek fisik & kesehatan" j={d.pemeriksaan} /></>}
      </div>

      <div className="border-t border-gray-200 bg-gray-50 px-4 py-2 text-[11px] text-gray-600">
        <p className="whitespace-pre-line">{catatan || "Bawa kartu ini (dicetak atau ditunjukkan di HP), datang 15 menit sebelum jadwal, berpakaian rapi & sopan, dan didampingi orang tua/wali."}</p>
        {!d.terverifikasi && <p className="mt-1 font-semibold text-amber-700">Berkas belum diverifikasi panitia — kartu ini belum berlaku.</p>}
      </div>
    </div>
  );
}
