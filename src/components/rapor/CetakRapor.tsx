"use client";
import { Fragment, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import Select from "@/components/admin/Select";
import DatePicker from "@/components/shared/DatePicker";
import PrintButton from "@/components/shared/PrintButton";
import LembarBerhalaman, { type Blok, type DokumenCetak, type UkuranLembar } from "@/components/rapor/LembarBerhalaman";
import { labelPredikatSikap } from "@/lib/rapor-sikap";
import { terbilangArab } from "@/lib/terbilang-arab";
import type { BarisNilai, DataRaporKelas, SiswaRapor } from "@/lib/rapor-cetak";
import type { BiodataRapor, DataHalamanDepan } from "@/lib/rapor-depan";

/** CETAK RAPOR KELAS (22 September 2026) — tiruan lembar RAPORT, RAPORT TS, dan RAPORT D makro rapor sekolah: pita kop
 * navy #002060 berlogo, judul bagian navy, kepala tabel lavender #CFCEE9, kaki halaman di setiap lembar, dan nomor
 * halaman buku rapor (mulai otomatis per tingkat & semester seperti rumus makro, bisa diubah). Isi dari
 * `susunRaporKelas` (src/lib/rapor-cetak.ts). Tanggal rapor, peringkat, dan halaman mulai hanya pilihan cetak — tidak
 * disimpan. */

export type JenisRapor = "akhir" | "ts" | "diniyah" | "depan";

const NAVY = "#002060";
const LAVENDER = "#CFCEE9";
const JUDUL_JENIS: Record<JenisRapor, string> = { depan: "Halaman Depan", akhir: "Rapor Akhir", ts: "Rapor Tengah Semester", diniyah: "Rapor Diniyah" };
/** Halaman depan buku rapor (lembar HAL.1-2 & HAL.3 makro) — bisa dipilih mana saja yang dicetak. */
const HALAMAN_DEPAN = [
  ["sampul", "Sampul"], ["sekolah", "i · Identitas Sekolah"], ["petunjuk", "ii · Petunjuk Pengisian"], ["diri", "iii · Keterangan Diri"],
  ["keluar", "Pindah Sekolah (Keluar)"], ["masuk", "Pindah Sekolah (Masuk)"], ["prestasi", "Catatan Prestasi"],
] as const;
type HalDepan = (typeof HALAMAN_DEPAN)[number][0];

const CSS = `
  .rp { font-size: 12px; line-height: 1.3; }
  .rp table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .rp td, .rp th { border: 1px solid #000; border-top: 0; padding: 0.8mm 1.2mm; vertical-align: top; font-weight: normal; }
  .rp .awal td, .rp .awal th { border-top: 1px solid #000; }
  .rp .kp td, .rp .kp th { background: ${LAVENDER}; font-weight: bold; text-align: center; vertical-align: middle; }
  .rp .kelompok td { background: #f2f2f2; font-weight: bold; }
  .rp .bar { background: ${NAVY}; color: #fff; font-weight: bold; padding: 0.9mm 2mm; }
  .rp .tengah { text-align: center; }
  .rp .kanan { text-align: right; }
  .rp .kotak { border: 1px solid #000; padding: 1.5mm 2mm; }
  .rp .jarak { padding-top: 3mm; }
  /* Arial Narrow DULU (angka, "Hari", nilai sikap, nama Latin tetap Arial Narrow seperti bagian rapor lain); huruf Arab tidak
     ada di Arial Narrow sehingga browser mengambilnya per huruf dari Amiri (permintaan user 22 Sep 2026). */
  @font-face { font-family: "RaporLatin"; src: local("Arial Narrow"), local("ArialNarrow"), local("Arial"), local("ArialMT"), local("Liberation Sans Narrow"), local("Liberation Sans");
    unicode-range: U+0000-024F, U+2000-206F, U+20A0-20CF, U+2100-214F; }
  .print-doc .arab, .print-doc .arab * { font-family: "RaporLatin", var(--font-amiri), "Amiri", "Traditional Arabic", serif !important; }
  .rp .arab { line-height: 1.9; }
`;

const tglPanjang = (iso: string) => {
  const d = new Date(`${iso}T00:00:00+07:00`);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
};
const tglIsoWib = (iso: string) => new Date(new Date(iso).getTime() + 7 * 3600_000).toISOString().slice(0, 10);
const angka = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));
const ROMAWI: Record<number, string> = { 10: "X  ( SEPULUH )", 11: "XI  ( SEBELAS )", 12: "XII  ( DUABELAS )" };

/** Satu potongan tabel (satu blok): semua potongan satu tabel memakai `lebar` yang sama supaya kolomnya segaris.
 * `awal` = potongan pertama (bergaris atas); isi = satu atau beberapa <tr>. */
function Tabel({ lebar, awal, children }: { lebar: number[]; awal?: boolean; children: ReactNode }) {
  return (
    <table className={awal ? "awal" : undefined}>
      <colgroup>{lebar.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
      <tbody>{children}</tbody>
    </table>
  );
}
function Baris({ lebar, awal, kelas, children }: { lebar: number[]; awal?: boolean; kelas?: string; children: ReactNode }) {
  return <Tabel lebar={lebar} awal={awal}><tr className={kelas}>{children}</tr></Tabel>;
}

/** `mandiri` = rapor satu siswa di portal Siswa/Orang Tua: tanpa pemilih siswa, tanggal, halaman, peringkat, dan peringatan
 * kelengkapan (semua itu urusan wali kelas). */
export default function CetakRapor({ data, jenis, hrefJenis, kembaliHref, siswaAwal, mandiri = false, depan, qr }: {
  data: DataRaporKelas; jenis: JenisRapor; hrefJenis: Partial<Record<JenisRapor, string>>; kembaliHref: string; siswaAwal?: string; mandiri?: boolean;
  depan?: DataHalamanDepan | null;
  /** QR keaslian per siswa (hanya rapor yang sudah disahkan, src/lib/rapor-qr.ts). */
  qr?: Record<string, string>;
}) {
  const [halDepan, setHalDepan] = useState<HalDepan[]>(HALAMAN_DEPAN.map(h => h[0]));
  const halamanBawaan = jenis === "ts"
    ? ((Math.min(12, Math.max(10, data.kelas.grade)) - 10) * 2 + (data.genap ? 1 : 0)) * 2 + 1
    : data.halamanAwal;
  const [pilihSiswa, setPilihSiswa] = useState(siswaAwal && data.siswa.some(s => s.id === siswaAwal) ? siswaAwal : "");
  const [tanggal, setTanggal] = useState(tglIsoWib(data.tanggal));
  const [peringkat, setPeringkat] = useState(false);
  const [mulai, setMulai] = useState(String(halamanBawaan));
  const halMulai = Math.max(1, Math.min(99, Number(mulai) || halamanBawaan));

  const siswa = pilihSiswa ? data.siswa.filter(s => s.id === pilihSiswa) : data.siswa;
  const versi = `${jenis}|${pilihSiswa}|${tanggal}|${peringkat}|${halMulai}|${halDepan.join(",")}`;
  const dokumen = useMemo<DokumenCetak[]>(
    () => jenis === "depan" ? siswa.flatMap(s => {
      const bio = depan?.biodata.find(b => b.id === s.id);
      return bio && depan ? dokDepan(data, depan, bio, halDepan, tanggal) : [];
    }) : siswa.map(s => (jenis === "akhir" ? dokAkhir(data, s, { tanggal, peringkat, mulai: halMulai, qr: qr?.[s.id] })
      : jenis === "ts" ? dokTs(data, s, { tanggal, mulai: halMulai, qr: qr?.[s.id] }) : dokDiniyah(data, s, { tanggal, qr: qr?.[s.id] }))),
    [versi], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const ukuran: UkuranLembar = jenis === "ts" ? { atas: 8, kanan: 5, bawah: 8, kiri: 5, kaki: 10 } : { atas: 8, kanan: 6, bawah: 8, kiri: 6, kaki: 10 };
  const tanpaForm = data.mapelTanpaForm.filter(m => (m.kelompok === "DINIYAH") === (jenis === "diniyah")).map(m => m.nama);
  const belumSikap = data.siswa.filter(s => (jenis === "diniyah" ? !s.akhlak || !s.kerajinan || !s.kerapian : !s.sikapSpiritual || !s.sikapSosial)).length;

  return (
    <>
      <style>{CSS}</style>
      <div className="print:hidden space-y-3 mb-4">
        <div className="baris-alat">
          <div className="alat-tab flex gap-1 border border-gray-100 bg-white rounded-xl p-1">
            {(Object.keys(JUDUL_JENIS) as JenisRapor[]).filter(j => hrefJenis[j]).map(j => (
              <Link key={j} href={hrefJenis[j]!} replace
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${j === jenis ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
                {JUDUL_JENIS[j]}
              </Link>
            ))}
          </div>
          {!mandiri && (
            <div className="alat-saring min-w-[14rem]">
              <Select value={pilihSiswa} onChange={setPilihSiswa}
                options={[{ value: "", label: `Semua siswa (${data.siswa.length})` }, ...data.siswa.map(s => ({ value: s.id, label: s.nama }))]} />
            </div>
          )}
          {!mandiri && <div className="alat-saring"><DatePicker value={tanggal} onChange={setTanggal} /></div>}
          {!mandiri && jenis !== "diniyah" && jenis !== "depan" && (
            <label className="alat-saring flex items-center gap-2 text-sm text-gray-700">
              Halaman mulai
              <input type="number" min={1} max={99} value={mulai} onChange={e => setMulai(e.target.value)} className="input-field w-20" />
            </label>
          )}
          {jenis === "depan" && (
            <div className="alat-saring flex flex-wrap gap-1.5 basis-full">
              {HALAMAN_DEPAN.map(([k, l]) => {
                const aktif = halDepan.includes(k);
                return (
                  <button key={k} type="button" aria-pressed={aktif}
                    onClick={() => setHalDepan(h => (aktif ? h.filter(x => x !== k) : HALAMAN_DEPAN.map(x => x[0]).filter(x => x === k || h.includes(x))))}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${aktif ? "border-primary-700 bg-primary-900 text-white" : "border-gray-200 bg-white text-gray-600 hover:border-primary-300"}`}>
                    {l}
                  </button>
                );
              })}
            </div>
          )}
          {!mandiri && jenis === "akhir" && (
            <label className="alat-saring flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={peringkat} onChange={e => setPeringkat(e.target.checked)} className="h-4 w-4 accent-primary-700" />
              Tampilkan peringkat
            </label>
          )}
          <div className="alat-aksi">
            <Link href={kembaliHref} className="btn-modal-cancel"><ArrowLeft size={15} /> Kembali</Link>
            <PrintButton />
          </div>
        </div>
        {!mandiri && jenis !== "depan" && (tanpaForm.length > 0 || !data.disahkan || belumSikap > 0) && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
            <ul className="space-y-0.5">
              {tanpaForm.length > 0 && <li>Form nilai belum dikirim guru mapel: <b>{tanpaForm.join(", ")}</b> — kolom nilainya masih kosong.</li>}
              {belumSikap > 0 && <li>{belumSikap} siswa belum diisi {jenis === "diniyah" ? "sikap Diniyah (Kelakuan/Kerajinan/Kerapian)" : "predikat sikap"} di Isian Rapor.</li>}
              {!data.disahkan && <li>Rapor semester ini belum disahkan Kepala Sekolah — tanda tangan Kepala Sekolah tidak ikut dicetak.</li>}
            </ul>
          </div>
        )}
      </div>
      {siswa.length === 0 ? (
        <p className="py-16 text-center text-sm text-gray-500">Belum ada siswa aktif di kelas ini.</p>
      ) : (
        <LembarBerhalaman dokumen={dokumen} ukuran={ukuran} versi={versi} />
      )}
    </>
  );
}

/* ======================== bagian bersama ======================== */

/** Motif SMK di pita navy kop (permintaan user 22 Sep 2026) — pola sekolah yang sama dengan watermark PageHeader/Modal,
 * dibalik putih & transparan. Isi pita di atasnya wajib `position: relative` supaya tidak tertutup lapisan ini. */
function PolaNavy() {
  return (
    <span aria-hidden style={{
      position: "absolute", inset: 0, backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "18mm 18mm",
      backgroundRepeat: "repeat", filter: "invert(1)", opacity: 0.12, pointerEvents: "none",
    }} />
  );
}

function Kop({ data, judul }: { data: DataRaporKelas; judul: string }) {
  return (
    <div className="rp">
      <div style={{ position: "relative", height: "22mm" }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: "4mm", height: "13mm", background: NAVY, overflow: "hidden" }}><PolaNavy /></div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={data.sekolah.logo} alt="" style={{ position: "absolute", left: "50%", top: 0, height: "22mm", width: "22mm", transform: "translateX(-50%)", objectFit: "contain" }} />
      </div>
      <p className="tengah" style={{ fontWeight: "bold", fontSize: "14px", padding: "2mm 0 2.5mm" }}>{judul}</p>
    </div>
  );
}

function Identitas({ data, s, fase = true }: { data: DataRaporKelas; s: SiswaRapor; fase?: boolean }) {
  const kiri: [string, string][] = [["Nama Sekolah", data.sekolah.nama], ["Alamat", data.sekolah.alamat], ["Nama", s.nama.toUpperCase()], ["No. Induk / NISN", `${s.nis} / ${s.nisn ?? ""}`]];
  const kanan: [string, string][] = [["Kelas", data.kelas.nama], ["Semester", data.labelSemester], ["Tahun Pelajaran", data.tahun], ...(fase ? [["Fase", data.fase] as [string, string]] : [])];
  return (
    <div className="rp" style={{ display: "grid", gridTemplateColumns: "minmax(0, 58fr) minmax(0, 42fr)", paddingBottom: "2mm" }}>
      {[kiri, kanan].map((daftar, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: i ? "27mm 1fr" : "30mm 1fr", rowGap: "0.6mm" }}>
          {daftar.map(([l, v]) => <Fragment key={l}><span>{l}</span><span>: {v}</span></Fragment>)}
        </div>
      ))}
    </div>
  );
}

function JudulBagian({ huruf, teks, jarak = true }: { huruf: string; teks: string; jarak?: boolean }) {
  return <div className={`rp ${jarak ? "jarak" : ""}`}><div className="bar">{huruf}&nbsp;&nbsp;{teks}</div></div>;
}

function Sikap({ judul, predikat, deskripsi }: { judul: string; predikat: string | null; deskripsi: string }) {
  const w = [22, 78];
  return (
    <div className="rp" style={{ paddingTop: "1.5mm" }}>
      <div className="bar" style={{ fontWeight: "bold" }}>{judul}</div>
      <Baris lebar={w} awal kelas="kp"><td>Predikat</td><td>Deskripsi</td></Baris>
      <Baris lebar={w}><td className="tengah" style={{ verticalAlign: "middle" }}>{labelPredikatSikap(predikat)}</td><td>{deskripsi}</td></Baris>
    </div>
  );
}

/** QR keaslian di dekat tanda tangan Kepala Sekolah — hanya rapor yang sudah disahkan (CLAUDE.md #49). */
function QrKeaslian({ src }: { src: string }) {
  return (
    <div className="tengah" style={{ width: "24mm" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="QR keaslian rapor" style={{ width: "20mm", height: "20mm", margin: "0 auto" }} />
      <p style={{ fontSize: "8.5px", lineHeight: 1.2, paddingTop: "0.5mm" }}>Pindai untuk memeriksa keaslian rapor</p>
    </div>
  );
}

function TandaTangan({ data, tanggal, kepala = true, qr }: { data: DataRaporKelas; tanggal: string; kepala?: boolean; qr?: string }) {
  const garisNama = { fontWeight: "bold", textDecoration: "underline" } as const;
  return (
    <div className="rp" style={{ paddingTop: "5mm" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
        <div className="tengah">
          <p>Mengetahui;</p><p>Orang Tua/Wali,</p>
          <div style={{ height: "18mm" }} />
          <p>..............................................</p>
        </div>
        <div className="tengah">
          <p>{data.sekolah.kota}, {tglPanjang(tanggal)}</p><p>Wali Kelas</p>
          <TtdWali src={data.kelas.ttdWali} />
          <p style={garisNama}>{data.kelas.wali || ".............................................."}</p>
          <p>NIP.{data.kelas.nipWali ? ` ${data.kelas.nipWali}` : "-"}</p>
        </div>
      </div>
      {kepala && (
        <div style={{ paddingTop: "3mm", display: "grid", gridTemplateColumns: "1fr 1.4fr 1fr", alignItems: "end" }}>
        <div style={{ display: "flex", justifyContent: "center" }}>{qr && <QrKeaslian src={qr} />}</div>
        <div className="tengah">
          <p>Mengetahui</p><p>Kepala {data.sekolah.nama}</p>
          <div style={{ height: "20mm", display: "flex", justifyContent: "center", alignItems: "center" }}>
            {data.disahkan && data.sekolah.ttdKepala && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.sekolah.ttdKepala} alt="" style={{ maxHeight: "20mm", maxWidth: "45mm", objectFit: "contain" }} />
            )}
          </div>
          <p style={garisNama}>{data.sekolah.kepala || ".............................................."}</p>
          <p>NIP.-</p>
        </div>
        <div />
        </div>
      )}
    </div>
  );
}

function Kaki({ judul, data, s, halaman }: { judul: string; data: DataRaporKelas; s: SiswaRapor; halaman?: number }) {
  return (
    <div className="rp" style={{ borderTop: `1.5px solid ${NAVY}`, paddingTop: "1mm", display: "flex", alignItems: "flex-start", gap: "3mm", fontSize: "10.5px" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: "bold", fontStyle: "italic", color: NAVY }}>{judul}</p>
        <p>{s.nama.toUpperCase()}&nbsp; | &nbsp;{s.nis}&nbsp; | &nbsp;Kelas: {data.kelas.nama}&nbsp; | &nbsp;Semester {data.labelSemester}&nbsp; | &nbsp;{data.tahun}</p>
      </div>
      {halaman !== undefined && (
        <div style={{ minWidth: "9mm", padding: "0.5mm 1.5mm", background: NAVY, color: "#fff", fontWeight: "bold", textAlign: "center" }}>{halaman}</div>
      )}
    </div>
  );
}

/* ======================== RAPOR AKHIR (lembar RAPORT) ======================== */

const W_NILAI = [4, 19, 6.5, 6.5, 32, 32];

function dokAkhir(data: DataRaporKelas, s: SiswaRapor, o: { tanggal: string; peringkat: boolean; mulai: number; qr?: string }): DokumenCetak {
  const kepalaNilai = (
    <div className="rp">
      <Tabel lebar={W_NILAI} awal>
        <tr className="kp"><td rowSpan={2}>No</td><td rowSpan={2}>Mata Pelajaran</td><td rowSpan={2}>Nilai</td><td rowSpan={2}>Pred ikat</td><td colSpan={2}>Capaian Kompetensi</td></tr>
        <tr className="kp"><td>Deskripsi Asesmen Formatif</td><td>Deskripsi Asesmen Sumatif</td></tr>
      </Tabel>
    </div>
  );
  const blok: Blok[] = [
    { k: "kop", isi: <><Kop data={data} judul="LAPORAN PENILAIAN HASIL BELAJAR" /><Identitas data={data} s={s} /></> },
    { k: "a", isi: <JudulBagian huruf="A." teks="SIKAP" jarak={false} />, tahan: true },
    { k: "sp", isi: <Sikap judul="Sikap Spiritual" predikat={s.sikapSpiritual} deskripsi={s.deskSpiritual} /> },
    { k: "so", isi: <Sikap judul="Sikap Sosial" predikat={s.sikapSosial} deskripsi={s.deskSosial} /> },
    { k: "b", isi: <JudulBagian huruf="B." teks="NILAI" />, tahan: true },
  ];
  const kelompok = (kode: string, judul: string, baris: BarisNilai[]) => {
    if (!baris.length) return;
    blok.push({ k: `kn-${kode}`, isi: <div className="rp" style={{ paddingTop: kode === "u" ? 0 : "2mm" }}>{kepalaNilai}</div>, tahan: true });
    blok.push({ k: `g-${kode}`, kepala: "nilai", tahan: true, isi: <div className="rp"><Baris lebar={W_NILAI} kelas="kelompok"><td colSpan={6}>{judul}</td></Baris></div> });
    baris.forEach((b, i) => blok.push({
      k: `n-${kode}-${i}`, kepala: "nilai",
      isi: (
        <div className="rp">
          <Baris lebar={W_NILAI}>
            <td className="tengah">{i + 1}</td><td>{b.mapel}</td>
            <td className="tengah">{angka(b.hasil?.hpa)}</td><td className="tengah">{b.hasil?.predikat ?? ""}</td>
            <td style={{ textAlign: "justify" }}>{b.hasil?.deskFormatif ?? ""}</td><td style={{ textAlign: "justify" }}>{b.hasil?.deskSumatif ?? ""}</td>
          </Baris>
        </div>
      ),
    }));
  };
  kelompok("u", "Kelompok Umum", s.umum);
  kelompok("k", "Kelompok Kejuruan", s.kejuruan);

  const wPkl = [5, 33, 30, 12, 20];
  blok.push({
    k: "c", isi: (
      <div className="rp">
        <div className="jarak"><div className="bar">C.&nbsp;&nbsp;PRAKTIK KERJA LAPANGAN</div></div>
        <Baris lebar={wPkl} awal kelas="kp"><td>No.</td><td>Mitra DU/DI</td><td>Lokasi</td><td>Lamanya (bulan)</td><td>Keterangan</td></Baris>
        {[0, 1, 2].map(i => {
          const p = s.pkl[i];
          return <Baris key={i} lebar={wPkl}><td className="tengah">{i + 1}</td><td>{p?.mitra ?? ""}</td><td>{p?.lokasi ?? ""}</td><td className="tengah">{p ? p.lama.replace(/\s*bulan$/, "") : ""}</td><td>{p?.keterangan ?? ""}</td></Baris>;
        })}
      </div>
    ),
  });
  const wEks = [5, 45, 12, 38];
  blok.push({
    k: "d", isi: (
      <div className="rp">
        <div className="jarak"><div className="bar">D.&nbsp;&nbsp;EKSTRAKURIKULER</div></div>
        <Baris lebar={wEks} awal kelas="kp"><td>No.</td><td>Kegiatan Ekstrakurikuler</td><td>Nilai</td><td>Keterangan</td></Baris>
        {[0, 1, 2, 3, 4].map(i => {
          const e = s.ekstra[i];
          return <Baris key={i} lebar={wEks}><td className="tengah">{i + 1}</td><td>{e?.nama ?? ""}</td><td className="tengah">{e?.predikat ?? ""}</td><td>{e?.keterangan ?? ""}</td></Baris>;
        })}
      </div>
    ),
  });
  const wPre = [5, 45, 50];
  blok.push({
    k: "e", isi: (
      <div className="rp">
        <div className="jarak"><div className="bar">E.&nbsp;&nbsp;PRESTASI</div></div>
        <Baris lebar={wPre} awal kelas="kp"><td>No.</td><td>Jenis Prestasi</td><td>Keterangan</td></Baris>
        {[0, 1, 2].map(i => {
          const p = s.prestasi[i];
          return <Baris key={i} lebar={wPre}><td className="tengah">{i + 1}.</td><td>{p?.jenis ?? ""}</td><td>{p?.keterangan ?? ""}</td></Baris>;
        })}
      </div>
    ),
  });
  blok.push({ k: "f", isi: <Ketidakhadiran s={s} /> });
  const teksPeringkat = o.peringkat && s.peringkat ? `Peringkat Nilai : ${s.peringkat} dari ${data.jumlahSiswa} siswa. ` : "";
  blok.push({
    k: "g", tahan: true, isi: (
      <div className="rp">
        <div className="jarak"><div className="bar">G.&nbsp;&nbsp;CATATAN WALI KELAS</div></div>
        <div className="kotak" style={{ minHeight: "16mm", borderTop: 0 }}>{teksPeringkat && <p>{teksPeringkat}</p>}<p style={{ whiteSpace: "pre-line" }}>{s.catatan}</p></div>
      </div>
    ),
  });
  blok.push({
    k: "h", isi: (
      <div className="rp">
        <div className="jarak"><div className="bar">H.&nbsp;&nbsp;TANGGAPAN ORANG TUA</div></div>
        <div className="kotak" style={{ height: "18mm", borderTop: 0 }} />
      </div>
    ),
    tahan: true,
  });
  if (data.genap) {
    const xii = data.kelas.grade >= 12;
    const naik = xii ? s.keputusan !== "TIDAK_LULUS" : s.keputusan !== "TINGGAL";
    const teks = xii ? (naik ? "LULUS" : "TIDAK LULUS") : naik ? "NAIK KE KELAS" : "TINGGAL DI KELAS";
    const ke = xii ? "" : ROMAWI[naik ? data.kelas.grade + 1 : data.kelas.grade] ?? "";
    blok.push({
      k: "kep", tahan: true, isi: (
        <div className="rp" style={{ paddingTop: "3mm" }}>
          <div className="kotak" style={{ marginLeft: "25%", marginRight: "25%" }}>
            <p>Keputusan:</p>
            <p>Berdasarkan hasil yang dicapai pada semester 1 dan 2; Peserta Didik ditetapkan</p>
            <p style={{ fontWeight: "bold", paddingTop: "1mm" }}>{teks}{ke ? <>&nbsp;&nbsp;:&nbsp;&nbsp;{ke}</> : null}</p>
          </div>
        </div>
      ),
    });
  }
  blok.push({ k: "ttd", isi: <TandaTangan data={data} tanggal={o.tanggal} qr={o.qr} /> });

  return {
    k: s.id, blok, mulai: o.mulai, kepala: { nilai: kepalaNilai },
    kaki: h => <Kaki judul={`Raport ${data.sekolah.nama}`} data={data} s={s} halaman={h} />,
  };
}

function Ketidakhadiran({ s, jarak = true }: { s: SiswaRapor; jarak?: boolean }) {
  const w = [55, 20, 25];
  return (
    <div className="rp">
      <div className={jarak ? "jarak" : undefined}><div className="bar">{jarak ? "F." : "C."}&nbsp;&nbsp;KETIDAKHADIRAN</div></div>
      <Tabel lebar={w} awal>
        {([["Sakit", s.absen.S], ["Izin", s.absen.I], ["Tanpa Keterangan", s.absen.A]] as const).map(([l, n]) => (
          <tr key={l}><td>{l}</td><td className="tengah">{n}</td><td>hari</td></tr>
        ))}
      </Tabel>
    </div>
  );
}

/* ======================== RAPOR TENGAH SEMESTER (lembar RAPORT TS) ======================== */

const W_TS = [4, 26, ...Array(10).fill(6), 10];

function dokTs(data: DataRaporKelas, s: SiswaRapor, o: { tanggal: string; mulai: number; qr?: string }): DokumenCetak {
  const kepala = (
    <div className="rp">
      <Tabel lebar={W_TS} awal>
        <tr className="kp"><td rowSpan={3}>No</td><td rowSpan={3}>Mata Pelajaran</td><td colSpan={10}>Hasil Penilaian Harian (HPH)</td><td rowSpan={3}>HP TS</td></tr>
        <tr className="kp"><td colSpan={5}>Lingkup Materi</td><td colSpan={5}>Tujuan Pembelajaran</td></tr>
        <tr className="kp">{[1, 2, 3, 4, 5].map(n => <td key={`l${n}`}>LM-{n}</td>)}{[1, 2, 3, 4, 5].map(n => <td key={`t${n}`}>TP-{n}</td>)}</tr>
      </Tabel>
    </div>
  );
  const blok: Blok[] = [
    { k: "kop", isi: <><Kop data={data} judul="KUMPULAN NILAI TENGAH SEMESTER" /><Identitas data={data} s={s} /></> },
    { k: "a", isi: <JudulBagian huruf="A." teks="SIKAP" jarak={false} />, tahan: true },
    { k: "sp", isi: <Sikap judul="Sikap Spiritual" predikat={s.sikapSpiritual} deskripsi={s.deskSpiritual} /> },
    { k: "so", isi: <Sikap judul="Sikap Sosial" predikat={s.sikapSosial} deskripsi={s.deskSosial} /> },
    { k: "b", isi: <JudulBagian huruf="B." teks="NILAI" />, tahan: true },
  ];
  const kelompok = (kode: string, judul: string, baris: BarisNilai[]) => {
    if (!baris.length) return;
    blok.push({ k: `kn-${kode}`, isi: <div className="rp" style={{ paddingTop: kode === "u" ? 0 : "2mm" }}>{kepala}</div>, tahan: true });
    blok.push({ k: `g-${kode}`, kepala: "ts", tahan: true, isi: <div className="rp"><Baris lebar={W_TS} kelas="kelompok"><td colSpan={13}>{judul}</td></Baris></div> });
    baris.forEach((b, i) => {
      const h = b.hasil;
      blok.push({
        k: `n-${kode}-${i}`, kepala: "ts",
        isi: (
          <div className="rp">
            <Baris lebar={W_TS}>
              <td className="tengah">{i + 1}</td><td>{b.mapel}</td>
              {[0, 1, 2, 3, 4].map(j => <td key={`l${j}`} className="tengah">{angka(h?.tsLm[j])}</td>)}
              {[0, 1, 2, 3, 4].map(j => <td key={`t${j}`} className="tengah">{angka(h?.tsTp[j])}</td>)}
              <td className="tengah">{angka(h?.hpts)}</td>
            </Baris>
          </div>
        ),
      });
    });
  };
  kelompok("u", "Kelompok Umum", s.umum);
  kelompok("k", "Kelompok Kejuruan", s.kejuruan);
  blok.push({
    k: "cd", tahan: true, isi: (
      <div className="rp jarak" style={{ display: "grid", gridTemplateColumns: "minmax(0, 40fr) minmax(0, 60fr)", columnGap: "3mm" }}>
        <Ketidakhadiran s={s} jarak={false} />
        <div>
          <div className="bar">D.&nbsp;&nbsp;CATATAN WALI KELAS</div>
          <div className="kotak" style={{ minHeight: "13mm", borderTop: 0, whiteSpace: "pre-line" }}>{s.catatan}</div>
        </div>
      </div>
    ),
  });
  blok.push({
    k: "e", tahan: true, isi: (
      <div className="rp">
        <div className="jarak"><div className="bar">E.&nbsp;&nbsp;TANGGAPAN ORANG TUA</div></div>
        <div className="kotak" style={{ height: "16mm", borderTop: 0 }} />
      </div>
    ),
  });
  blok.push({ k: "ttd", isi: <TandaTangan data={data} tanggal={o.tanggal} qr={o.qr} /> });
  return {
    k: s.id, blok, mulai: o.mulai, kepala: { ts: kepala },
    kaki: h => <Kaki judul={`Raport ${data.sekolah.nama}`} data={data} s={s} halaman={h} />,
  };
}

/* ======================== RAPOR DINIYAH (lembar RAPORT D) ======================== */

const W_DIN = [8, 36, 10, 18, 10, 18];

function dokDiniyah(data: DataRaporKelas, s: SiswaRapor, o: { tanggal: string; qr?: string }): DokumenCetak {
  const baris = s.diniyah;
  const jumlahP = baris.reduce((a, b) => a + (b.pengetahuan ?? 0), 0);
  const jumlahT = baris.reduce((a, b) => a + (b.penerapan ?? 0), 0);
  const kepala = (
    <div className="rp arab" dir="rtl">
      <Tabel lebar={W_DIN} awal>
        <tr className="kp"><td rowSpan={2}>النمرة</td><td rowSpan={2}>مادة</td><td colSpan={2}>درجة المعرفة</td><td colSpan={2}>درجة التطبيق</td></tr>
        <tr className="kp"><td>عدد</td><td>معدود</td><td>عدد</td><td>معدود</td></tr>
      </Tabel>
    </div>
  );
  const blok: Blok[] = [
    {
      k: "kop", isi: (
        <div className="rp">
          <div style={{ position: "relative", height: "24mm", background: NAVY, display: "flex", alignItems: "center", overflow: "hidden" }}>
            <PolaNavy />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.sekolah.logo} alt="" style={{ position: "relative", height: "20mm", width: "20mm", objectFit: "contain", marginLeft: "4mm", flexShrink: 0 }} />
            <div className="arab tengah" dir="rtl" style={{ position: "relative", flex: 1, color: "#fff", fontWeight: "bold", fontSize: "17px", lineHeight: 1.7 }}>
              <p>كَشْفُ الدَّرَجَةِ لِطُلَّابِ الْمَدْرَسَةِ الدِّينِيَّةِ</p>
              <p>بِالْمَدْرَسَةِ ٱلْأَهْلِيَّةِ ٱلْمُنَوَّرِ ٱلْإِسْلَامِيَّةِ ٱلْعَالَمِيَّةِ</p>
            </div>
          </div>
          <p className="arab tengah" dir="rtl" style={{ fontSize: "12.5px", padding: "1mm 0 2mm", borderBottom: `1.5px solid ${NAVY}`, marginBottom: "2mm" }}>{data.sekolah.alamatArab}</p>
          <Identitas data={data} s={s} fase={false} />
        </div>
      ),
    },
    { k: "kn", isi: kepala, tahan: true },
  ];
  baris.forEach((b, i) => blok.push({
    k: `d-${i}`, kepala: "din",
    isi: (
      <div className="rp arab" dir="rtl">
        <Baris lebar={W_DIN}>
          <td className="tengah">{i + 1}</td><td>{b.namaArab || b.mapel}</td>
          <td className="tengah">{angka(b.pengetahuan)}</td><td className="tengah">{b.pengetahuan === null || b.pengetahuan === undefined ? "" : terbilangArab(b.pengetahuan)}</td>
          <td className="tengah">{angka(b.penerapan)}</td><td className="tengah">{b.penerapan === null || b.penerapan === undefined ? "" : terbilangArab(b.penerapan)}</td>
        </Baris>
      </div>
    ),
  }));
  blok.push({
    k: "jml", kepala: "din", isi: (
      <div className="rp arab" dir="rtl">
        <Baris lebar={W_DIN} kelas="kp">
          <td colSpan={2}>جملة</td><td>{jumlahP}</td><td>{terbilangArab(jumlahP)}</td><td>{jumlahT}</td><td>{terbilangArab(jumlahT)}</td>
        </Baris>
        <Baris lebar={W_DIN}>
          <td colSpan={2} className="tengah" style={{ fontWeight: "bold" }}>مقام الطالب</td>
          <td className="tengah">{s.peringkatDiniyah ?? ""}</td><td className="tengah">من</td><td className="tengah">{data.jumlahSiswa}</td><td className="tengah">الطلبة</td>
        </Baris>
      </div>
    ),
  });
  const wSk = [22, 40, 38];
  blok.push({
    k: "sk", isi: (
      <div className="rp" style={{ paddingTop: "3mm", display: "grid", gridTemplateColumns: "minmax(0, 62fr) minmax(0, 38fr)", columnGap: "3mm", alignItems: "start" }}>
        <div className="arab" dir="rtl">
          <Tabel lebar={wSk} awal>
            <tr className="kp"><td colSpan={2}>الشخصية والغيبة</td><td>NILAI</td></tr>
            {([["الشخصية", "الأخلاق", s.akhlak ?? ""], ["", "الاجتهاد", s.kerajinan ?? ""], ["", "الترتيب", s.kerapian ?? ""],
              ["الغيبة", "المرض", `${s.absen.S} Hari`], ["", "الإذن", `${s.absen.I} Hari`], ["", "بدون البيان", `${s.absen.A} Hari`]] as const).map(([grup, l, v]) => (
              <tr key={l}>
                {grup && <td rowSpan={3} className="tengah" style={{ fontWeight: "bold", verticalAlign: "middle" }}>{grup}</td>}
                <td>{l}</td><td className="tengah" dir="ltr">{v}</td>
              </tr>
            ))}
          </Tabel>
        </div>
        <div>
          <div className="arab tengah" dir="rtl" style={{ border: "1px solid #000", background: LAVENDER, fontWeight: "bold" }}>الملحوظة لولي الطالب</div>
          <div className="kotak" style={{ borderTop: 0, minHeight: "30mm" }}>{s.catatanDiniyah}</div>
        </div>
      </div>
    ),
  });
  blok.push({
    k: "ttd", isi: (
      <div className="rp" style={{ paddingTop: "5mm", display: "grid", gridTemplateColumns: "1fr 1fr" }}>
        <div className="tengah">
          <p>&nbsp;</p><p>Wali Kelas</p>
          <TtdWali src={data.kelas.ttdWali} />
          <p style={{ fontWeight: "bold", textDecoration: "underline" }}>{data.kelas.wali || ".............................................."}</p>
          <p>NIP.{data.kelas.nipWali ? ` ${data.kelas.nipWali}` : "-"}</p>
        </div>
        <div className="tengah">
          <p>{data.sekolah.kota}, {tglPanjang(o.tanggal)}</p><p>Orang Tua/Wali,</p>
          <div style={{ height: "18mm" }} />
          <p>..............................................</p>
        </div>
        {o.qr && <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "center", paddingTop: "3mm" }}><QrKeaslian src={o.qr} /></div>}
      </div>
    ),
  });
  return { k: s.id, blok, mulai: 1, kepala: { din: kepala }, kaki: () => <Kaki judul={`Raport Diniyyah ${data.sekolah.nama}`} data={data} s={s} /> };
}

/* ======================== HALAMAN DEPAN (lembar HAL.1-2 & HAL.3) ======================== */

const TITIK = "..................................................";
const PETUNJUK = [
  "Rapor merupakan ringkasan hasil penilaian terhadap seluruh aktivitas pembelajaran yang dilakukan siswa dalam kurun waktu tertentu;",
  "Rapor dipergunakan selama siswa yang bersangkutan mengikuti seluruh program pembelajaran di Sekolah Menengah Kejuruan tersebut;",
  "Identitas Sekolah diisi dengan data yang sesuai dengan keberadaan Sekolah Menengah Kejuruan;",
  "Keterangan tentang diri Siswa diisi lengkap;",
  "Rapor harus dilengkapi dengan pas foto berwarna (3 x 4) dan pengisiannya dilakukan oleh Wali Kelas;",
  "Deskripsi sikap spiritual diambil dari hasil observasi terutama pada mata pelajaran Pendidikan Agama dan Budi pekerti, dan Pendidikan Pancasila;",
  "Deskripsi sikap sosial diambil dari hasil observasi pada semua mata pelajaran;",
  "Deskripsi pada kompetensi sikap ditulis dengan kalimat positif untuk aspek yang sangat baik atau kurang baik;",
  "Capaian siswa dalam kompetensi pengetahuan dan kompetensi keterampilan ditulis dalam bentuk angka, predikat dan deskripsi untuk masing-masing mata pelajaran;",
  "Deskripsi pada Asesmen Formatif dan Asesmen Sumatif ditulis dengan kalimat positif sesuai capaian tertinggi dan terendah yang diperoleh siswa. Apabila capaian kompetensi dasar yang diperoleh dalam muatan pelajaran itu sama, kolom deskripsi ditulis berdasarkan capaian yang diperoleh;",
  "Laporan Praktik Kerja Lapangan diisi berdasarkan kegiatan praktik kerja yang diikuti oleh siswa di industri/perusahaan mitra;",
  "Laporan Ekstrakurikuler diisi berdasarkan kegiatan ekstrakurikuler yang diikuti oleh siswa;",
  "Saran-saran wali kelas diisi berdasarkan kegiatan yang perlu mendapatkan perhatian siswa;",
  "Prestasi diisi dengan prestasi yang dicapai oleh siswa dalam bidang akademik dan non akademik;",
  "Ketidakhadiran diisi dengan data akumulasi ketidakhadiran siswa karena sakit, izin, atau tanpa keterangan selama satu semester.",
  "Tanggapan orang tua/wali adalah tanggapan atas pencapaian hasil belajar siswa.",
];

/** Pita navy bermotif SMK + logo bulat di tengah (sampul & halaman identitas sekolah). */
function PitaLogo({ data, besar }: { data: DataRaporKelas; besar?: boolean }) {
  const t = besar ? 52 : 44, pita = besar ? 18 : 15;
  return (
    <div style={{ position: "relative", height: `${t}mm` }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: `${(t - pita) / 2}mm`, height: `${pita}mm`, background: NAVY, overflow: "hidden" }}><PolaNavy /></div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={data.sekolah.logo} alt="" style={{ position: "absolute", left: "50%", top: 0, height: `${t}mm`, width: `${t}mm`, transform: "translateX(-50%)", objectFit: "contain" }} />
    </div>
  );
}

function KakiDepan({ data, nomor }: { data: DataRaporKelas; nomor?: string }) {
  return (
    <div className="rp" style={{ borderTop: `1.5px solid ${NAVY}`, paddingTop: "1mm", display: "flex", justifyContent: "space-between", fontSize: "10.5px" }}>
      <p style={{ fontWeight: "bold", fontStyle: "italic", color: NAVY }}>Raport {data.sekolah.nama}</p>
      {nomor && <p style={{ fontWeight: "bold", color: NAVY }}>{nomor}</p>}
    </div>
  );
}

function TtdKepala({ data, tanggal, kota = true }: { data: DataRaporKelas; tanggal?: string; kota?: boolean }) {
  return (
    <div className="tengah">
      <p>{kota && tanggal ? `${data.sekolah.kota}, ${tglPanjang(tanggal)}` : "......., ..............................."}</p>
      <p>Kepala {kota ? data.sekolah.nama : "Sekolah,"}</p>
      <div style={{ height: "18mm", display: "flex", justifyContent: "center", alignItems: "center" }}>
        {kota && data.disahkan && data.sekolah.ttdKepala && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.sekolah.ttdKepala} alt="" style={{ maxHeight: "18mm", maxWidth: "45mm", objectFit: "contain" }} />
        )}
      </div>
      <p style={{ fontWeight: "bold", textDecoration: "underline" }}>{data.sekolah.kepala || TITIK}</p>
      <p>NIP.-</p>
    </div>
  );
}

function dokDepan(data: DataRaporKelas, depan: DataHalamanDepan, b: BiodataRapor, pilih: HalDepan[], tanggal: string): DokumenCetak[] {
  const sk = depan.sekolah;
  const judulBesar = (t: string, ukuran = 16) => <p className="tengah" style={{ fontWeight: "bold", fontSize: `${ukuran}px`, letterSpacing: "0.04em" }}>{t}</p>;
  const baris = (label: string, nilai: string, nomor?: string) => (
    <tr key={`${nomor ?? ""}${label}`}>
      <td style={{ border: 0, width: "7%", paddingLeft: 0 }}>{nomor}</td>
      <td style={{ border: 0, width: "36%" }}>{label}</td>
      <td style={{ border: 0, width: "3%" }}>:</td>
      <td style={{ border: 0 }}>{nilai || TITIK}</td>
    </tr>
  );
  const halaman: Record<HalDepan, () => DokumenCetak> = {
    sampul: () => ({
      k: `${b.id}-sampul`, mulai: 0, kaki: () => null,
      blok: [{ k: "isi", isi: (
        <div className="rp" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4mm", paddingTop: "6mm" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/garuda-pancasila.png" alt="" style={{ height: "30mm", objectFit: "contain" }} />
          <div style={{ paddingTop: "4mm" }}>{judulBesar("RAPOR", 30)}</div>
          {judulBesar("SEKOLAH MENENGAH KEJURUAN", 18)}
          <p className="tengah" style={{ fontWeight: "bold", fontSize: "20px", color: NAVY }}>{data.sekolah.nama}</p>
          <p className="tengah" style={{ fontSize: "12.5px" }}>NSS : {sk.nss || "-"}&nbsp;&nbsp;|&nbsp;&nbsp;NPSN : {sk.npsn || "-"}</p>
          <div style={{ width: "100%", padding: "8mm 0" }}><PitaLogo data={data} besar /></div>
          {([["Nama Peserta Didik", b.nama], ["NIS / NISN", `${b.nis}${b.nisn ? ` / ${b.nisn}` : ""}`]] as const).map(([l, v]) => (
            <div key={l} style={{ width: "72%", paddingTop: "2mm" }}>
              <p className="tengah" style={{ fontSize: "13px" }}>{l}</p>
              <div className="kotak tengah" style={{ fontWeight: "bold", fontSize: "16px", border: `1.5px solid ${NAVY}`, padding: "3mm" }}>{v}</div>
            </div>
          ))}
          <div style={{ paddingTop: "22mm" }}>
            {judulBesar("KEMENTERIAN PENDIDIKAN DAN KEBUDAYAAN", 15)}
            {judulBesar("REPUBLIK INDONESIA", 15)}
          </div>
        </div>
      ) }],
    }),
    sekolah: () => ({
      k: `${b.id}-sekolah`, mulai: 0, kaki: () => <KakiDepan data={data} nomor="i" />,
      blok: [{ k: "isi", isi: (
        <div className="rp" style={{ paddingTop: "18mm" }}>
          {judulBesar("RAPOR", 26)}
          <div style={{ paddingTop: "2mm" }}>{judulBesar("SEKOLAH MENENGAH KEJURUAN", 17)}</div>
          {judulBesar("( S M K )", 17)}
          <div style={{ padding: "14mm 0 16mm" }}><PitaLogo data={data} /></div>
          <table style={{ width: "86%", margin: "0 auto", fontSize: "13px" }}><tbody>
            {([["Nama Sekolah", data.sekolah.nama], ["NPSN", sk.npsn], ["NSS", sk.nss], ["Alamat Satuan Pendidikan", sk.alamat], ["Kode POS", sk.kodePos],
              ["Kelurahan/Desa", sk.desa], ["Kecamatan", sk.kecamatan], ["Kota/Kabupaten", sk.kabKota], ["Provinsi", sk.provinsi], ["Website", sk.website], ["E-mail", sk.email]] as const)
              .map(([l, v]) => (
                <tr key={l}><td style={{ border: 0, width: "40%", padding: "1.4mm 1mm" }}>{l}</td><td style={{ border: 0, width: "3%" }}>:</td><td style={{ border: 0 }}>{v || TITIK}</td></tr>
              ))}
          </tbody></table>
        </div>
      ) }],
    }),
    petunjuk: () => ({
      k: `${b.id}-petunjuk`, mulai: 0, kaki: () => <KakiDepan data={data} nomor="ii" />,
      blok: [{ k: "isi", isi: (
        <div className="rp" style={{ paddingTop: "6mm", fontSize: "13px" }}>
          {judulBesar("PETUNJUK PENGISIAN RAPORT", 16)}
          <ol style={{ paddingTop: "8mm", display: "grid", rowGap: "2.2mm" }}>
            {PETUNJUK.map((t, i) => (
              <li key={i} style={{ display: "grid", gridTemplateColumns: "9mm 1fr", textAlign: "justify" }}><span>{i + 1}.</span><span>{t}</span></li>
            ))}
          </ol>
        </div>
      ) }],
    }),
    diri: () => ({
      k: `${b.id}-diri`, mulai: 0, kaki: () => <KakiDepan data={data} nomor="iii" />,
      blok: [{ k: "isi", isi: (
        <div className="rp" style={{ paddingTop: "4mm", fontSize: "12.5px" }}>
          {judulBesar("KETERANGAN TENTANG DIRI PESERTA DIDIK", 16)}
          <table style={{ marginTop: "6mm" }}><tbody>
            {baris("Nama Peserta Didik (Lengkap)", b.nama, "1.")}
            {baris("NIS / NISN", `${b.nis}${b.nisn ? ` / ${b.nisn}` : ""}`, "2.")}
            {baris("Tempat Tanggal Lahir", b.ttl, "3.")}
            {baris("Jenis Kelamin", b.jk, "4.")}
            {baris("Agama", b.agama, "5.")}
            {baris("Status dalam Keluarga", b.statusKeluarga, "6.")}
            {baris("Anak ke", b.anakKe, "7.")}
            {baris("Alamat Peserta Didik", b.alamat, "8.")}
            {baris("Nomor Telepon Rumah", b.telp, "9.")}
            {baris("Sekolah Asal", b.sekolahAsal, "10.")}
            {baris("Diterima di sekolah ini", " ", "11.")}
            {baris("Di kelas", b.diterimaKelas)}
            {baris("Pada tanggal", b.diterimaTanggal)}
            {baris("Nama Orang Tua", " ", "12.")}
            {baris("a. Ayah", b.ayah)}
            {baris("b. Ibu", b.ibu)}
            {baris("Alamat Orang Tua", b.alamatOrtu, "13.")}
            {baris("Nomor Telepon Rumah", b.telpOrtu)}
            {baris("Pekerjaan Orang Tua", " ", "14.")}
            {baris("a. Ayah", b.kerjaAyah)}
            {baris("b. Ibu", b.kerjaIbu)}
            {baris("Nama Wali Peserta Didik", b.wali, "15.")}
            {baris("Alamat Wali Peserta Didik", b.alamatWali, "16.")}
            {baris("Nomor Telpon Rumah", b.telpWali)}
            {baris("Pekerjaan Wali Peserta Didik", b.kerjaWali, "17.")}
          </tbody></table>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", alignItems: "end", paddingTop: "8mm" }}>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <div className="tengah" style={{ width: "30mm", height: "40mm", border: `1.5px solid ${NAVY}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", color: "#555" }}>
                Pas Foto<br />3 x 4 cm
              </div>
            </div>
            <TtdKepala data={data} tanggal={tanggal} />
          </div>
        </div>
      ) }],
    }),
    keluar: () => {
      const w = [16, 18, 30, 36];
      return {
        k: `${b.id}-keluar`, mulai: 0, kaki: () => <KakiDepan data={data} />,
        blok: [{ k: "isi", isi: (
          <div className="rp" style={{ paddingTop: "4mm" }}>
            {judulBesar("KETERANGAN PINDAH SEKOLAH", 16)}
            <p style={{ padding: "4mm 0 3mm" }}>Nama Peserta Didik : <b>{b.nama}</b></p>
            <Tabel lebar={w} awal>
              <tr className="kp"><td>Tanggal</td><td>Kelas yang Ditinggalkan</td><td>Sebab-Sebab Keluar atau Atas Permintaan (Tertulis)</td><td>Tanda Tangan Kepala Sekolah, Stempel Sekolah, dan Tanda Tangan Orang Tua/Wali</td></tr>
              {[0, 1, 2].map(i => (
                <tr key={i}>
                  <td /><td /><td />
                  <td style={{ fontSize: "11.5px" }}>
                    <TtdKepala data={data} kota={false} />
                    <div className="tengah" style={{ paddingTop: "2mm" }}><p>Orang Tua/Wali,</p><div style={{ height: "14mm" }} /><p>........................................</p></div>
                  </td>
                </tr>
              ))}
            </Tabel>
          </div>
        ) }],
      };
    },
    masuk: () => {
      const w = [7, 30, 33, 30];
      return {
        k: `${b.id}-masuk`, mulai: 0, kaki: () => <KakiDepan data={data} />,
        blok: [{ k: "isi", isi: (
          <div className="rp" style={{ paddingTop: "4mm", fontSize: "11.5px" }}>
            {judulBesar("KETERANGAN PINDAH SEKOLAH", 16)}
            <p style={{ padding: "4mm 0 3mm", fontSize: "12px" }}>Nama Peserta Didik : <b>{b.nama}</b></p>
            <Tabel lebar={w} awal>
              <tr className="kp"><td>No</td><td colSpan={3}>Masuk</td></tr>
              {[0, 1, 2, 3].map(i => (
                <tr key={i}>
                  <td colSpan={3} style={{ padding: 0 }}>
                    <table style={{ tableLayout: "fixed" }}><tbody>
                      {([["1", "Nama Peserta didik"], ["2", "Nomor Induk"], ["3", "Nama Sekolah"], ["4", "Masuk di Sekolah ini:"], ["", "a. Tanggal"], ["", "b. Di Kelas"], ["5", "Tahun Pelajaran"]] as const).map(([n, l], j) => (
                        <tr key={j}>
                          <td style={{ border: 0, borderRight: "1px solid #000", width: "10%", textAlign: "center" }}>{n}</td>
                          <td style={{ border: 0, width: "45%" }}>{l}</td>
                          <td style={{ border: 0 }}>{l.endsWith(":") ? "" : "…......................................"}</td>
                        </tr>
                      ))}
                    </tbody></table>
                  </td>
                  <td><TtdKepala data={data} kota={false} /></td>
                </tr>
              ))}
            </Tabel>
          </div>
        ) }],
      };
    },
    prestasi: () => {
      const w = [7, 55, 38];
      return {
        k: `${b.id}-prestasi`, mulai: 0, kaki: () => <KakiDepan data={data} />,
        blok: [{ k: "isi", isi: (
          <div className="rp" style={{ paddingTop: "4mm" }}>
            {judulBesar("CATATAN PRESTASI YANG PERNAH DICAPAI", 16)}
            <table style={{ margin: "5mm 0 4mm", width: "80%" }}><tbody>
              {([["Nama Peserta didik", b.nama], ["Nama Sekolah", data.sekolah.nama], ["Nomor Induk", b.nis]] as const).map(([l, v]) => (
                <tr key={l}><td style={{ border: 0, width: "32%", paddingLeft: 0 }}>{l}</td><td style={{ border: 0 }}>: {v}</td></tr>
              ))}
            </tbody></table>
            <Tabel lebar={w} awal>
              <tr className="kp"><td>No</td><td>Prestasi yang Pernah Dicapai</td><td>Keterangan</td></tr>
              {(["Kurikuler", "Ekstrakurikuler", "Catatan Khusus Lainnya"] as const).map((l, i) => (
                <tr key={l}><td className="tengah">{i + 1}</td><td style={{ height: "62mm" }}><b>{l}</b></td><td /></tr>
              ))}
            </Tabel>
          </div>
        ) }],
      };
    },
  };
  return HALAMAN_DEPAN.map(h => h[0]).filter(h => pilih.includes(h)).map(h => halaman[h]());
}

/** TTD wali kelas — hanya terisi setelah nilai dikunci (src/lib/rapor-cetak.ts); tingginya sama dengan ruang kosong. */
function TtdWali({ src }: { src?: string }) {
  if (!src) return <div style={{ height: "18mm" }} />;
  // eslint-disable-next-line @next/next/no-img-element -- data URL TTD
  return <img src={src} alt="" style={{ height: "18mm", maxWidth: "45mm", objectFit: "contain", margin: "0 auto", display: "block" }} />;
}
