import Image from "next/image";
import PrintKop from "@/components/shared/PrintKop";
import { LABEL_STATUS } from "@/lib/spmb-status";
import type { DataFormulir } from "@/lib/spmb-formulir";

/** Lembar cetak FORMULIR PENDAFTARAN yang sudah diisi — dipakai pendaftar (lewat nomor + tanda)
 *  maupun panitia. Satu komponen untuk keduanya supaya isinya tidak pernah berbeda.
 *  Komponen presentasional murni: tidak membaca DB, tidak butuh "use client". */
export default function FormulirSpmbSheet({ d, sekolah, logoUrl, tahun }: {
  d: DataFormulir; sekolah: string; logoUrl?: string; tahun?: string;
}) {
  const tgl = (v: Date | string | null | undefined) => {
    if (!v) return "—";
    const x = typeof v === "string" ? new Date(v) : v;
    return isNaN(x.getTime()) ? "—" : x.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
  };

  const identitas: [string, React.ReactNode][] = [
    ["Nama Lengkap", d.fullName],
    ["Tempat, Tanggal Lahir", `${d.birthPlace || "—"}, ${tgl(d.birthDate)}`],
    ["Jenis Kelamin", d.gender || "—"],
    ["NIK", <span key="nik" className="angka">{d.nik || "—"}</span>],
    ["NISN", <span key="nisn" className="angka">{d.nisn || "—"}</span>],
    ["Alamat", d.address || "—"],
    ["Sekolah Asal", d.previousSchool || "—"],
    ["Nama Orang Tua / Wali", d.guardianName || "—"],
    ["Nomor WhatsApp", <span key="wa" className="angka">{d.phone || "—"}</span>],
    ["E-mail", d.email || "—"],
  ];

  const pilihan: [string, React.ReactNode][] = [
    ["Konsentrasi Keahlian", d.chosenMajor || "—"],
    ["Jalur Pendaftaran", (d.jalur || "—").replace(/_/g, " ")],
    ["Gelombang", d.gelombang?.nama ?? "—"],
    ["Biaya Pendaftaran", d.gelombang?.biayaDaftar ? `Rp ${d.gelombang.biayaDaftar.toLocaleString("id-ID")}` : "—"],
    ["Tanggal Mendaftar", tgl(d.createdAt)],
    ["Status Saat Dicetak", LABEL_STATUS[d.status] ?? d.status],
  ];

  const dokumenBaku = [
    { nama: "Ijazah / SKL SMP/MTs", ada: !!d.ijazahUrl },
    { nama: "Kartu Keluarga", ada: !!d.kkUrl },
    { nama: "KTP Orang Tua / Wali", ada: !!d.ktpWaliUrl },
    { nama: "Pas Foto", ada: !!d.fotoUrl },
    { nama: "Dokumen Lain", ada: !!d.dokumenLainUrl },
  ];
  const dokumen = [
    ...dokumenBaku,
    ...d.berkasSpmb.map(b => ({ nama: b.syarat.nama, ada: !!b.berkas })),
  ];

  return (
    <>
      {/* Satu dokumen, dua pintu cetak (pendaftar & panitia) — @page-nya ditaruh di komponen
          bersama ini supaya keduanya tidak pernah berbeda margin (CLAUDE.md #21). */}
      <style>{`@page { size: A4 portrait; margin: 1cm; }`}</style>
    <div className="print-doc a4-page mx-auto bg-white px-8 pb-10 pt-0 text-[12px] leading-relaxed text-gray-800 shadow-sm print:shadow-none">
      <PrintKop title="Formulir Pendaftaran Murid Baru"
        subtitle={`SPMB ${tahun || ""} · ${sekolah}`.replace(/\s+·\s*$/, "")} logoUrl={logoUrl} />

      {/* Nomor pendaftaran + pas foto + QR keaslian */}
      <div className="mb-4 flex items-start justify-between gap-5">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-widest text-gray-500">Nomor Pendaftaran</p>
          <p className="angka font-heading text-2xl font-bold tracking-wider text-primary-900">{d.nomor ?? "—"}</p>
          <p className="mt-1 text-[11px] text-gray-500">
            Status pendaftaran dibuka dengan nomor ini dan tanggal lahir di halaman SPMB sekolah.
          </p>
        </div>
        <div className="flex shrink-0 items-start gap-3">
          {d.fotoUrl && (
            <div className="relative h-[4cm] w-[3cm] overflow-hidden border border-gray-300">
              <Image src={d.fotoUrl} alt="Pas foto pendaftar" fill className="object-cover" unoptimized />
            </div>
          )}
          {d.qr && (
            <div className="text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={d.qr} alt="QR keaslian formulir" className="h-[2.4cm] w-[2.4cm]" />
              <p className="mt-1 text-[9px] leading-tight text-gray-500">Pindai untuk<br />memeriksa keaslian</p>
            </div>
          )}
        </div>
      </div>

      <Blok judul="A. Identitas Calon Murid" baris={identitas} />
      <Blok judul="B. Pilihan & Pendaftaran" baris={pilihan} />

      <section className="mb-4">
        <h2 className="mb-1.5 border-b border-gray-300 pb-1 text-[12px] font-bold uppercase tracking-wide text-primary-900">
          C. Kelengkapan Berkas
        </h2>
        <table className="w-full border-collapse">
          <tbody>
            {dokumen.map((x, i) => (
              <tr key={`${x.nama}-${i}`} className="border-b border-gray-100 last:border-0">
                <td className="w-6 py-1 align-top text-gray-500">{i + 1}.</td>
                <td className="py-1 align-top">{x.nama}</td>
                <td className="w-28 py-1 text-right align-top">
                  {x.ada ? <span className="font-semibold text-emerald-700">Terunggah</span>
                         : <span className="text-gray-400">Belum ada</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {dokumen.length === 0 && <p className="py-2 text-gray-400">Belum ada dokumen yang diminta.</p>}
      </section>

      <section className="mb-5">
        <h2 className="mb-1.5 border-b border-gray-300 pb-1 text-[12px] font-bold uppercase tracking-wide text-primary-900">
          D. Pernyataan
        </h2>
        <p className="text-justify">
          Saya yang bertanda tangan di bawah ini menyatakan bahwa seluruh data pada formulir ini diisi dengan
          sebenar-benarnya. Apabila di kemudian hari terdapat keterangan yang tidak benar, saya bersedia menerima
          keputusan panitia sesuai ketentuan yang berlaku di {sekolah}.
        </p>
      </section>

      {/* Tanda tangan: dua kolom, ditulis tangan saat berkas diserahkan ke panitia. */}
      <div className="grid grid-cols-2 gap-10 text-center">
        <div>
          <p>Orang Tua / Wali,</p>
          <div className="h-[2.2cm]" />
          <p className="border-t border-gray-400 pt-1">{d.guardianName || "(.............................)"}</p>
        </div>
        <div>
          <p>Calon Murid,</p>
          <div className="h-[2.2cm]" />
          <p className="border-t border-gray-400 pt-1">{d.fullName}</p>
        </div>
      </div>

      <p className="mt-6 text-center text-[10px] text-gray-400">
        Dicetak dari sistem SPMB {sekolah}. Keasliannya dapat diperiksa dengan memindai QR di atas.
      </p>
    </div>
    </>
  );
}

function Blok({ judul, baris }: { judul: string; baris: [string, React.ReactNode][] }) {
  return (
    <section className="mb-4">
      <h2 className="mb-1.5 border-b border-gray-300 pb-1 text-[12px] font-bold uppercase tracking-wide text-primary-900">{judul}</h2>
      <table className="w-full border-collapse">
        <tbody>
          {baris.map(([k, v]) => (
            <tr key={k} className="align-top">
              <td className="w-[6cm] py-1 text-gray-600">{k}</td>
              <td className="w-4 py-1 text-gray-400">:</td>
              <td className="py-1 font-medium text-gray-900">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
