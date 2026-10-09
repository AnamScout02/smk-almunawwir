import PrintKop from "@/components/shared/PrintKop";
import GambarTtd from "@/components/shared/GambarTtd";
import type { DataPakta } from "@/lib/spmb-dokumen";

/** Lembar SURAT PERNYATAAN / PAKTA INTEGRITAS orang tua (7 Okt 2026) — satu lembar untuk calon & panitia.
 *  Sudah ditandatangani di HP: TTD tersisip + QR keaslian. Belum: lembar kosong untuk ditandatangani tangan. */
export default function PaktaSpmbSheet({ d, sekolah, logoUrl, tahun }: { d: DataPakta; sekolah: string; logoUrl?: string; tahun?: string }) {
  const tgl = (v: Date | null) => v
    ? v.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" })
    : "";
  const lahir = d.birthDate.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
  const calon: [string, string][] = [
    ["Nama calon murid", d.fullName],
    ["Nomor pendaftaran", d.nomor ?? "—"],
    ["Tempat, tanggal lahir", `${d.birthPlace || "—"}, ${lahir}`],
    ["Konsentrasi keahlian", d.chosenMajor || "—"],
    ["Alamat", d.address || "—"],
  ];
  const penanda: [string, string][] = [
    ["Nama orang tua / wali", d.paktaNama || "...................................................."],
    ["Hubungan dengan calon", d.paktaHubungan || "...................................................."],
  ];
  return (
    <>
      <style>{`@page { size: A4 portrait; margin: 1cm; }`}</style>
      <div className="print-doc mx-auto max-w-[21cm] bg-white px-8 pb-10 pt-0 text-[12px] leading-relaxed text-gray-800 shadow-sm print:shadow-none">
        <PrintKop title={d.judul} subtitle={`SPMB ${tahun || ""} · ${sekolah}`.replace(/\s+·\s*$/, "")} logoUrl={logoUrl} />

        <Tabel judul="Identitas Calon Murid" baris={calon} />
        <Tabel judul="Yang Membuat Pernyataan" baris={penanda} />

        <div className="mb-6 whitespace-pre-line text-justify">{d.teks}</div>

        <div className="flex items-end justify-between gap-6">
          <div className="text-[10px] text-gray-500">
            {d.qr && (
              <div className="flex items-end gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={d.qr} alt="QR keaslian surat pernyataan" className="h-[2.2cm] w-[2.2cm]" />
                <p className="max-w-[5cm] leading-tight">
                  Ditandatangani secara elektronik melalui sistem SPMB {sekolah}. Pindai QR untuk memeriksa keasliannya.
                </p>
              </div>
            )}
          </div>
          <div className="w-[7cm] text-center">
            <p>{d.paktaAt ? tgl(d.paktaAt) : "......................, ............................"}</p>
            <p>Yang membuat pernyataan,</p>
            <GambarTtd src={d.ttd} tinggi={72} className="my-1" />
            <p className="border-t border-gray-400 pt-1 font-semibold">{d.paktaNama || d.guardianName || "(.......................................)"}</p>
            {d.paktaHubungan && <p className="text-gray-500">{d.paktaHubungan} dari {d.fullName}</p>}
          </div>
        </div>
      </div>
    </>
  );
}

function Tabel({ judul, baris }: { judul: string; baris: [string, string][] }) {
  return (
    <section className="mb-4">
      <h2 className="mb-1.5 border-b border-gray-300 pb-1 text-[12px] font-bold uppercase tracking-wide text-primary-900">{judul}</h2>
      <table className="w-full border-collapse">
        <tbody>
          {baris.map(([k, v]) => (
            <tr key={k} className="align-top">
              <td className="w-[5.5cm] py-0.5 text-gray-600">{k}</td>
              <td className="w-4 py-0.5 text-gray-400">:</td>
              <td className="py-0.5 font-medium text-gray-900">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
