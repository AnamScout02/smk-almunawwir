export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardSignature } from "lucide-react";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { prisma } from "@/lib/prisma";
import { getSettings, getPrincipalName } from "@/lib/site-settings";
import PageHeader from "@/components/admin/PageHeader";
import PrintButton from "@/components/shared/PrintButton";
import LembarSurat from "@/components/shared/LembarSurat";
import { SUMBER_BIAYA, labelOf } from "@/lib/tu-konstanta";
import TombolKembali from "@/components/shared/TombolKembali";
import GambarTtd from "@/components/shared/GambarTtd";
import { ttdDariNama } from "@/lib/ttd";

const tglPanjang = (d: Date | string | null) =>
  d ? new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "";
const hariTanggal = (d: Date | string) =>
  new Date(d).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

/** Selisih hari inklusif — berangkat 1 s.d. kembali 3 dihitung 3 hari, bukan 2. */
function lamaHari(a: Date, b: Date): number {
  const ms = new Date(b).setHours(0, 0, 0, 0) - new Date(a).setHours(0, 0, 0, 0);
  return Math.max(1, Math.round(ms / 86400000) + 1);
}

/** Surat Tugas + SPPD + Laporan Perjalanan Dinas dalam satu berkas cetak.
 *
 * Susunan & kalimatnya mengikuti PERSIS formulir Excel yang selama ini dipakai sekolah
 * (berkas "SPPD" yang dikirim user 13 September 2026): tiga lembar berurutan, masing-masing
 * dengan kop dan tanda tangannya sendiri. Lembar SPPD memuat butir 1-9 lengkap dengan kolom
 * singgah I-III, "Tiba kembali di" (IV), dan catatan lain-lain (V) — kolom-kolom itu memang
 * dibiarkan kosong karena diisi & ditandatangani pejabat di tempat tujuan. */
export default async function CetakSuratTugasPage({ params }: { params: Promise<{ id: string }> }) {
  await verifyTasAccess();
  const { id } = await params;

  const [st, settings] = await Promise.all([
    prisma.suratTugas.findUnique({
      where: { id },
      include: { pegawai: { orderBy: { urutan: "asc" } } },
    }),
    getSettings(["letterhead.bukuInduk", "letterhead.kopBawah", "school.structure"]),
  ]);
  if (!st) notFound();

  const principalName = getPrincipalName(settings["school.structure"]);
  const penandaTangan = st.penandaTangan || principalName;
  const ttdKepala = await ttdDariNama(penandaTangan); // TTD pribadi penanda tangan (src/lib/ttd.ts)
  const hari = lamaHari(st.tanggalBerangkat, st.tanggalKembali);
  const pelaksana = st.pegawai.filter(p => p.peran !== "PENGIKUT");
  const pengikut = st.pegawai.filter(p => p.peran === "PENGIKUT");
  const tujuan = [st.tempat, st.tempat2, st.tempat3].filter(Boolean) as string[];

  const td = "border border-gray-800 px-2 py-1.5 align-top text-[12px]";
  const th = "border border-gray-800 bg-primary-900 text-white px-2 py-1.5 text-[11px] font-semibold";

  /** Satu LEMBAR kertas A4. Dibuat eksplisit per lembar (bukan satu wadah panjang) supaya kop
   * surat & motif kertas tampil utuh di tiap lembar — bukan cuma di lembar pertama. */
  const Lembar = ({ children, terakhir = false }: { children: React.ReactNode; terakhir?: boolean }) => (
    <LembarSurat kopAtas={settings["letterhead.bukuInduk"]}
      kopBawah={settings["letterhead.kopBawah"]} terakhir={terakhir}>
      {children}
    </LembarSurat>
  );

  /** Blok tanda tangan Kepala Sekolah — dipakai di ketiga lembar. */
  const TtdKepala = ({ tanggal }: { tanggal: Date | string }) => (
    <div className="flex justify-end mt-6" style={{ breakInside: "avoid" }}>
      <div className="text-[12px] text-center w-[8cm]">
        <p>Banyuwangi, {tglPanjang(tanggal)}</p>
        <p>Kepala SMK Al Munawwir IIBS</p>
        <GambarTtd src={ttdKepala} tinggi={64} />
        <p className="font-bold underline">{penandaTangan || "( _____________ )"}</p>
        <p>NIP. —</p>
      </div>
    </div>
  );

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0 min-h-dvh print:min-h-0 bg-white">
      {/* margin 0: kop surat asli sekolah memang dicetak penuh sampai tepi kertas,
          sama seperti Persuratan & Surat Keterangan. */}
      <style>{"@page { size: A4 portrait; margin: 0; }"}</style>

      <PageHeader icon={<ClipboardSignature size={22} />} title="Cetak Surat Tugas" description={st.nomor} printHidden />

      <div className="flex items-center gap-2 mb-5 print:hidden">
        <TombolKembali href={"/dashboard/admin/surat-tugas"} />
        <PrintButton />
      </div>

      {/* ══ Lembar 1: SURAT TUGAS ═══════════════════════════════════════════ */}
      <Lembar terakhir={!st.withSppd && !st.withLaporan}>
        <div className="text-center mb-5">
          <h1 className="text-base font-bold underline tracking-wide">SURAT TUGAS</h1>
          <p className="text-[12px] mt-1">Nomor : {st.nomor}</p>
        </div>

        <div className="text-[12px] leading-relaxed">
          <p className="mb-3 text-justify">
            Yang bertanda tangan di bawah ini Kepala SMK Al Munawwir IIBS Desa Kemiri Kecamatan
            Singojuruh Kabupaten Banyuwangi dengan ini memberikan tugas dinas kepada:
          </p>

          <table className="w-full border-collapse mb-3">
            <thead>
              <tr>
                <th className={`${th} w-[8%] text-center`}>No</th>
                <th className={`${th} text-left`}>Nama</th>
                <th className={`${th} text-left w-[40%]`}>Jabatan</th>
              </tr>
            </thead>
            <tbody>
              {pelaksana.map((p, i) => (
                <tr key={p.id}>
                  <td className={`${td} text-center`}>{i + 1}</td>
                  <td className={`${td} font-semibold`}>{p.nama}</td>
                  <td className={td}>{p.jabatan || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {st.dasar && <p className="mb-2">Dasar: {st.dasar}</p>}
          <p className="mb-2">Untuk dapat melakukan kegiatan <strong>{st.maksud}</strong> pada:</p>

          <table className="w-full border-collapse mb-3">
            <thead>
              <tr>
                <th className={`${th} text-center w-[34%]`}>Hari/Tanggal</th>
                <th className={`${th} text-center w-[26%]`}>Jam</th>
                <th className={`${th} text-center`}>Tempat</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={`${td} text-center`}>
                  {hariTanggal(st.tanggalBerangkat)}
                  {hari > 1 && <> s.d. {hariTanggal(st.tanggalKembali)}</>}
                </td>
                <td className={`${td} text-center`}>{st.jam || "—"}</td>
                <td className={td}>{tujuan.join(", ")}</td>
              </tr>
            </tbody>
          </table>

          <p className="text-justify">
            Demikian surat tugas ini kami sampaikan agar dapat dilaksanakan dengan penuh tanggung
            jawab. Setelah kegiatan selesai, dimohon untuk menyerahkan laporan hasil kegiatan
            kepada Kepala Sekolah.
          </p>
          {st.keterangan && <p className="mt-2 italic">{st.keterangan}</p>}
        </div>

        <TtdKepala tanggal={st.tanggal} />
      </Lembar>

      {/* ══ Lembar 2: SPPD ══════════════════════════════════════════════════ */}
      {st.withSppd && (
        <Lembar terakhir={!st.withLaporan}>
          <div className="text-center mb-4">
            <h1 className="text-[15px] font-bold underline tracking-wide">SURAT PERINTAH PERJALANAN DINAS</h1>
            <p className="text-[12px] mt-1">(SPPD) &nbsp;·&nbsp; Nomor : {st.nomor}</p>
          </div>

          <table className="w-full border-collapse text-[12px] mb-4">
            <tbody>
              <tr>
                <td className={`${td} w-[5%] text-center`}>1</td>
                <td className={`${td} w-[38%]`}>Pejabat berwenang yang memberi perintah</td>
                <td className={td}>Kepala SMK Al Munawwir IIBS</td>
              </tr>
              <tr>
                <td className={`${td} text-center`}>2</td>
                <td className={td}>Nama / Jabatan pegawai yang diperintah</td>
                <td className={td}>
                  {pelaksana.map(p => (
                    <span key={p.id} className="block">
                      <strong>{p.nama}</strong>{p.jabatan ? ` — ${p.jabatan}` : ""}{p.nip ? ` (${p.nip})` : ""}
                    </span>
                  ))}
                </td>
              </tr>
              <tr>
                <td className={`${td} text-center`}>3</td>
                <td className={td}>Maksud perjalanan dinas</td>
                <td className={td}>{st.maksud}</td>
              </tr>
              <tr>
                <td className={`${td} text-center`}>4</td>
                <td className={td}>Alat angkutan yang dipergunakan</td>
                <td className={td}>{st.transportasi || "Kendaraan Darat"}</td>
              </tr>
              <tr>
                <td className={`${td} text-center`}>5</td>
                <td className={td}>
                  a. Tempat berangkat<br />b. Tempat tujuan
                </td>
                <td className={td}>
                  a. SMK Al Munawwir IIBS<br />
                  {tujuan.map((t, i) => (
                    <span key={i} className="block">{i === 0 ? "b. " : <span className="inline-block w-4" />}{t}</span>
                  ))}
                </td>
              </tr>
              <tr>
                <td className={`${td} text-center`}>6</td>
                <td className={td}>
                  a. Lamanya perjalanan<br />b. Tanggal berangkat<br />c. Tanggal harus kembali
                </td>
                <td className={td}>
                  a. {hari} hari<br />
                  b. {tglPanjang(st.tanggalBerangkat)}<br />
                  c. {tglPanjang(st.tanggalKembali)}
                </td>
              </tr>
              <tr>
                <td className={`${td} text-center`}>7</td>
                <td className={td}>Pengikut</td>
                <td className={td}>
                  {pengikut.length === 0 ? "—" : (
                    <table className="w-full border-collapse">
                      <tbody>
                        {pengikut.map((p, i) => (
                          <tr key={p.id}>
                            <td className="border border-gray-400 px-1.5 py-0.5 w-[6%] text-center">{i + 1}.</td>
                            <td className="border border-gray-400 px-1.5 py-0.5">{p.nama}</td>
                            <td className="border border-gray-400 px-1.5 py-0.5 w-[34%]">{p.jabatan || ""}</td>
                            <td className="border border-gray-400 px-1.5 py-0.5 w-[24%]">{p.keterangan || ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </td>
              </tr>
              <tr>
                <td className={`${td} text-center`}>8</td>
                <td className={td}>Pembebanan anggaran:<br />a. Instansi<br />b. Biaya anggaran</td>
                <td className={td}>
                  <br />
                  a. {st.instansi || "Sekolah Menengah Kejuruan"}<br />
                  b. {st.biayaAnggaran || (st.sumberBiaya ? labelOf(SUMBER_BIAYA, st.sumberBiaya) : "—")}
                </td>
              </tr>
              <tr>
                <td className={`${td} text-center`}>9</td>
                <td className={td}>Keterangan lain-lain</td>
                <td className={td}>
                  {st.keterangan || "Surat perintah ini supaya dilaksanakan dengan rasa penuh tanggung jawab."}
                </td>
              </tr>
            </tbody>
          </table>

          <TtdKepala tanggal={st.tanggal} />

          {/* Kolom singgah — diisi & ditandatangani pejabat DI TEMPAT TUJUAN, jadi sengaja kosong. */}
          <table className="w-full border-collapse text-[11px] mt-6" style={{ breakInside: "avoid" }}>
            <tbody>
              {["I", "II", "III"].map((romawi, i) => (
                <tr key={romawi}>
                  <td className={`${td} w-[5%] text-center`}>{romawi}</td>
                  <td className={`${td} w-[47%]`}>
                    <p>Tiba di : ..............................................</p>
                    <p>Pada tanggal : ......................................</p>
                    <div className="h-10" />
                    <p>( ____________________________ )</p>
                    <p>NIP.</p>
                  </td>
                  <td className={td}>
                    <p>Berangkat dari : {i === 0 ? "SMK Al Munawwir IIBS" : ".............................."}</p>
                    <p>Ke : {tujuan[i] ?? ".............................."}</p>
                    <p>Pada tanggal : ......................................</p>
                    <div className="h-6" />
                    <p>( ____________________________ )</p>
                    <p>NIP.</p>
                  </td>
                </tr>
              ))}
              <tr>
                <td className={`${td} text-center`}>IV</td>
                <td className={td} colSpan={2}>
                  <p>Tiba kembali di : <strong>SMK Al Munawwir IIBS</strong></p>
                  <p className="text-justify mt-1">
                    Telah diperiksa dengan keterangan bahwa perjalanan dinas tersebut benar-benar
                    dilaksanakan atas perintah yang berwenang dan semata-mata untuk kepentingan
                    jabatan dalam waktu yang sesingkat-singkatnya.
                  </p>
                  <div className="flex justify-end mt-3">
                    <div className="text-center w-[8cm]">
                      <p>Yang memberi perintah</p>
                      <p>Kepala SMK Al Munawwir IIBS</p>
                      <div className="h-12" />
                      <p className="font-bold underline">{penandaTangan || "( _____________ )"}</p>
                      <p>NIP. —</p>
                    </div>
                  </div>
                </td>
              </tr>
              <tr>
                <td className={`${td} text-center`}>V</td>
                <td className={td} colSpan={2}>
                  <p>Catatan lain-lain :</p>
                  <div className="h-10" />
                </td>
              </tr>
            </tbody>
          </table>
        </Lembar>
      )}

      {/* ══ Lembar 3: LAPORAN PERJALANAN DINAS ══════════════════════════════ */}
      {st.withLaporan && (
        <Lembar terakhir>
          <div className="text-center mb-5">
            <h1 className="text-base font-bold underline tracking-wide">LAPORAN PERJALANAN DINAS</h1>
          </div>

          <div className="text-[12px] leading-relaxed">
            <p className="mb-1">Dasar melakukan perjalanan dinas:</p>
            <p className="mb-3">
              1. Surat Perintah Tugas Nomor : <strong>{st.nomor}</strong> tanggal {tglPanjang(st.tanggal)}
            </p>
            <p className="mb-2">Atas dasar tersebut di atas maka:</p>

            <table className="w-full border-collapse mb-3">
              <thead>
                <tr>
                  <th className={`${th} w-[8%] text-center`}>No</th>
                  <th className={`${th} text-left`}>Nama</th>
                  <th className={`${th} text-left w-[40%]`}>Jabatan</th>
                </tr>
              </thead>
              <tbody>
                {[...pelaksana, ...pengikut].map((p, i) => (
                  <tr key={p.id}>
                    <td className={`${td} text-center`}>{i + 1}</td>
                    <td className={`${td} font-semibold`}>{p.nama}</td>
                    <td className={td}>{p.jabatan || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="mb-2">
              Telah melakukan perjalanan dinas dengan kegiatan <strong>{st.maksud}</strong> dengan
              hasil sebagai berikut:
            </p>
            {/* Hasil kegiatan boleh diisi lewat sistem, boleh juga ditulis tangan setelah dicetak —
                karena itu kotaknya tetap lapang walau isinya sudah ada. Tingginya 4cm, BUKAN 7cm:
                ruang isi per lembar hanya 171mm (kop atas 67mm + kop bawah 59mm sudah memakan
                126mm dari 297mm), dan dengan 7cm lembar Laporan meluber 30mm sehingga melahirkan
                satu halaman kosong di akhir cetakan — terukur 13 September 2026. */}
            <div className="border border-gray-800 p-3 min-h-[4cm] whitespace-pre-wrap mb-3">
              {st.hasilLaporan ?? ""}
            </div>

            <p className="text-justify">
              Demikian Laporan Perjalanan Dinas ini dibuat dengan sebenar-benarnya untuk dapat
              dipergunakan sebagaimana mestinya.
            </p>
          </div>

          <div className="flex justify-between mt-4 text-[12px]" style={{ breakInside: "avoid" }}>
            <div className="text-center w-[8cm]">
              <p className="invisible">Dibuat di : Banyuwangi</p>
              <p>Diperiksa oleh</p>
              <p>Kepala SMK Al Munawwir IIBS</p>
              <div className="h-12" />
              <p className="font-bold underline">{penandaTangan || "( _____________ )"}</p>
              <p>NIP. —</p>
            </div>
            <div className="text-center w-[8cm]">
              <p>Dibuat di : Banyuwangi</p>
              <p>Pada tanggal : {tglPanjang(st.tanggalLaporan ?? st.tanggalKembali)}</p>
              <p>Yang membuat laporan</p>
              <div className="h-12" />
              <p className="font-bold underline">{pelaksana[0]?.nama ?? "( _____________ )"}</p>
              <p>NIP. {pelaksana[0]?.nip || "—"}</p>
            </div>
          </div>
        </Lembar>
      )}
    </div>
  );
}
