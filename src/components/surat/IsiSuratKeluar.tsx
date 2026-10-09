import LembarSurat from "@/components/shared/LembarSurat";

interface StructureRow { role: string; name: string; highlight?: boolean }
function fmtLong(d: Date) {
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}
function getPrincipalName(structureJson: string): string {
  try {
    const parsed = JSON.parse(structureJson ?? "[]") as StructureRow[];
    return parsed.find(r => r.highlight)?.name ?? parsed[0]?.name ?? "";
  } catch { return ""; }
}

/** SATU LEMBAR SURAT KELUAR — dokumen CETAK (kertas `.a4-page` dari `LembarSurat`; ukuran huruf & tabelnya sengaja tidak
 *  mengikuti aturan layar). Isi dari editor/templat — dipindah dari CetakSuratKeluar (9 Okt 2026) supaya cetak satuan dan
 *  cetak MASSAL (Paket Kelulusan: SKL satu kelas sekaligus) memakai lembar yang persis sama. Jangan disalin ke tempat lain. */
export default function IsiSuratKeluar({ surat, setelan: s, qrSurat, terakhir = false }: {
  surat: { nomor: string; perihal: string; pihak: string | null; content: string | null; tanggal: Date; penandaTangan: string | null };
  setelan: Record<string, string>; qrSurat: string | null; terakhir?: boolean;
}) {
  const penandaTangan = surat.penandaTangan || "Kepala SMK Al Munawwir IIBS";
  const isKepalaSekolah = penandaTangan.trim() === "Kepala SMK Al Munawwir IIBS";
  const principalName = isKepalaSekolah ? getPrincipalName(s["school.structure"]) : "";
  return (
    <LembarSurat kopAtas={s["letterhead.bukuInduk"]} kopBawah={s["letterhead.kopBawah"]} terakhir={terakhir}>
            <table className="text-sm mb-4">
              <tbody>
                <tr><td className="pr-2 align-top">Nomor</td><td className="pr-2 align-top">:</td><td className="align-top font-semibold">{surat.nomor}</td></tr>
                <tr><td className="pr-2 align-top">Perihal</td><td className="pr-2 align-top">:</td><td className="align-top font-semibold">{surat.perihal}</td></tr>
              </tbody>
            </table>

            {/* Surat Keterangan / Pernyataan / SK memang tidak punya alamat tujuan — blok ini
                disembunyikan kalau kolom "Kepada" dikosongkan, bukan dicetak sebagai
                "Kepada Yth." yang menggantung tanpa nama. */}
            {surat.pihak?.trim() ? (
              <>
                <p className="text-sm mb-1">Kepada Yth.</p>
                <p className="text-sm font-semibold mb-6">{surat.pihak}</p>
              </>
            ) : null}

            {surat.content ? (
              <div className="prose-surat-print text-sm text-justify mb-10" dangerouslySetInnerHTML={{ __html: surat.content }} />
            ) : (
              <p className="text-sm text-gray-400 italic mb-10">Isi surat belum ditulis.</p>
            )}

            <div className="flex items-end justify-between gap-4">
              {qrSurat ? (
                <div className="text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrSurat} alt="QR keaslian surat" className="h-[22mm] w-[22mm]" />
                  <p className="mt-1 max-w-[30mm] text-[9px] leading-tight text-gray-600">Pindai untuk memeriksa keaslian surat</p>
                </div>
              ) : <span />}
              <div className="text-sm text-center min-w-[220px]">
                <p className="mb-1">Singojuruh, {fmtLong(surat.tanggal)}</p>
                <p className={isKepalaSekolah && s["letterhead.ttdKepalaSekolah"] ? "mb-2" : "mb-16"}>{penandaTangan}</p>
                {isKepalaSekolah && s["letterhead.ttdKepalaSekolah"] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s["letterhead.ttdKepalaSekolah"]} alt="Tanda Tangan" className="h-16 mx-auto object-contain mb-2" />
                )}
                <p className="font-bold underline">{principalName ? `( ${principalName} )` : " "}</p>
              </div>
            </div>
    </LembarSurat>
  );
}
