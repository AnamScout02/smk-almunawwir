import { readFile } from "node:fs/promises";
import { join } from "node:path";
import PrintKop from "@/components/shared/PrintKop";
import PrintButton from "@/components/shared/PrintButton";
import TombolKembali from "@/components/shared/TombolKembali";
import SaringAngkatan from "@/components/shared/SaringAngkatan";
import { getSettings } from "@/lib/site-settings";
import { analisisSebaran, geser } from "@/lib/analisis-sebaran";
import { sebaranPetaPendaftar, sebaranPetaSiswa } from "@/lib/peta-sebaran";
import type { WilayahPeta } from "@/lib/peta-batas";

/** LAPORAN SEBARAN — satu lembar A4 untuk rapat panitia/yayasan (8 Oktober 2026). Semua angka dari sumber yang sama
 *  dengan Peta Sebaran & Analisis Sebaran (`analisisSebaran`, `sebaranPeta*`), jadi tidak pernah berbeda dari layar.
 *  Petanya SVG yang digambar di server dari berkas batas kecamatan kabupaten asal siswa TERBANYAK (bukan ditulis mati). */
const SKALA = ["#d9f0c9", "#a6dba0", "#5aae8f", "#2c7fb8", "#253494"];
const KOSONG = "#eef0f4";

/** `dari`/`sampai` = rentang ANGKATAN MASUK. Tanpa saringan: peta & tabel memakai siswa AKTIF (keadaan hari ini).
 *  Dengan saringan: memakai SEMUA siswa yang masuk pada rentang itu (aktif, lulus, keluar) — "dari mana sekolah menerima
 *  siswa pada tahun-tahun itu". "Perlu didatangi lagi" selalu membandingkan dua periode tetapnya, tidak ikut saringan. */
export default async function LaporanSebaranSheet({ kembaliHref, alamat, dari: dariMentah, sampai: sampaiMentah }: {
  kembaliHref: string; alamat: string; dari?: string; sampai?: string;
}) {
  const [a, pendaftar, siswa, s] = await Promise.all([
    analisisSebaran(), sebaranPetaPendaftar(), sebaranPetaSiswa(),
    getSettings(["school.name", "logo.full_white"]).catch(() => ({} as Record<string, string>)),
  ]);
  const sekolah = s["school.name"] || "SMK Al-Munawwir IIBS";
  const thSah = (v?: string) => { const n = Number(v); return v && a.tahun.includes(n) ? n : null; };
  let dari = thSah(dariMentah), sampai = thSah(sampaiMentah);
  if (dari && sampai && dari > sampai) [dari, sampai] = [sampai, dari];
  const saring = dari !== null || sampai !== null;
  const tahunPakai = a.tahun.filter(t => (dari === null || t >= dari) && (sampai === null || t <= sampai));
  const labelRentang = tahunPakai.length > 1 ? `${tahunPakai[0]}–${tahunPakai[tahunPakai.length - 1]}` : String(tahunPakai[0] ?? "—");
  const jumlahDi = (perTahun: Record<number, number>) => tahunPakai.reduce((n, t) => n + (perTahun[t] ?? 0), 0);
  // Nilai per kecamatan yang dipetakan & diperingkat: siswa aktif (tanpa saringan) atau siswa masuk pada rentang.
  const perKec = new Map(a.kecamatan.map(w => [w.kode, saring ? jumlahDi(w.perTahun) : w.aktif]));
  const nKec = (kode: string) => perKec.get(kode) ?? 0;
  const kab = a.ringkas.kabUtama;
  const batas: WilayahPeta[] = kab
    ? await readFile(join(process.cwd(), "public", "data", "peta", "kec", `${kab.kode}.json`), "utf8").then(JSON.parse).catch(() => [])
    : [];

  // Peta: siswa aktif per kecamatan, lima kelas warna dari kuantil nilai yang ada.
  const nilai = batas.map(w => nKec(w.k));
  const isi = nilai.filter(v => v > 0).sort((x, y) => x - y);
  const batasKelas = [...new Set([1, 2, 3, 4, 5].map(q => isi[Math.max(0, Math.ceil((q / 5) * isi.length) - 1)] ?? 0))].filter(v => v > 0);
  const kelas = (v: number) => (v <= 0 ? -1 : Math.max(0, batasKelas.findIndex(b => v <= b)));
  const warna = (v: number) => (kelas(v) < 0 ? KOSONG : SKALA[batasKelas.length === 1 ? 3 : Math.round((kelas(v) * 4) / (batasKelas.length - 1))]);
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const w of batas) { x0 = Math.min(x0, w.b[0]); y0 = Math.min(y0, w.b[1]); x1 = Math.max(x1, w.b[2]); y1 = Math.max(y1, w.b[3]); }
  // Dipotong ke kecamatan yang MENGIRIM siswa (+ ruang di sekelilingnya): kabupaten yang luas membuat bagian
  // berisi angka hanya sepetak kecil di tengah kertas.
  const berisi = batas.filter(w => (nKec(w.k)) > 0);
  if (berisi.length) {
    let [a0, b0, a1, b1] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const w of berisi) { a0 = Math.min(a0, w.b[0]); b0 = Math.min(b0, w.b[1]); a1 = Math.max(a1, w.b[2]); b1 = Math.max(b1, w.b[3]); }
    const ruang = Math.max(a1 - a0, b1 - b0) * 0.12;
    x0 = Math.max(x0, a0 - ruang); y0 = Math.max(y0, b0 - ruang); x1 = Math.min(x1, a1 + ruang); y1 = Math.min(y1, b1 + ruang);
  }
  const lebar = x1 - x0, tinggi = y1 - y0;
  const u = Math.max(lebar, tinggi) / 300; // ±1 px pada gambar selebar 300

  const p = a.periode;
  const rentang = (t: number[]) => (t.length ? (t.length > 1 ? `${t[0]}–${t[t.length - 1]}` : String(t[0])) : "—");
  const kecTop = [...a.kecamatan].sort((x, y) => nKec(y.kode) - nKec(x.kode) || y.total - x.total).filter(w => !saring || nKec(w.kode) > 0).slice(0, 10);
  const nSek = (w: { total: number; perTahun: Record<number, number> }) => (saring ? jumlahDi(w.perTahun) : w.total);
  const sekSemua = a.sekolah.filter(w => nSek(w) > 0).sort((x, y) => nSek(y) - nSek(x));
  const sekTop = sekSemua.slice(0, 10);
  const tren = saring ? a.tren.filter(t => tahunPakai.includes(t.tahun)).slice(-13) : a.tren.slice(-8);
  const masuk = a.tren.filter(t => tahunPakai.includes(t.tahun)).reduce((x, t) => ({ jumlah: x.jumlah + t.jumlah, terpetakan: x.terpetakan + t.terpetakan }), { jumlah: 0, terpetakan: 0 });
  const maksTren = Math.max(1, ...tren.map(t => t.jumlah));
  const turun = [
    ...a.kecamatan.map(w => ({ nama: `Kec. ${w.nama}`, g: geser(w.perTahun, p, "terpetakan") })),
    ...a.sekolah.map(w => ({ nama: w.nama, g: geser(w.perTahun, p, "bersekolah") })),
  ].filter(x => x.g.arah === "turun").sort((x, y) => (y.g.pangsaLama - y.g.pangsaBaru) - (x.g.pangsaLama - x.g.pangsaBaru)).slice(0, 6);
  const tgl = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
  const sel = "border border-gray-300 px-1.5 py-[3px]";
  const kepala = `${sel} bg-gray-100 text-left font-semibold`;
  const persen = (n: number) => `${n.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;

  return (
    <div className="py-6 print:py-0">
      <div className="mx-auto mb-4 flex max-w-[21cm] flex-wrap items-center justify-end gap-2 px-4 print:hidden">
        <div className="mr-auto"><SaringAngkatan alamat={alamat} tahun={a.tahun} dari={dari} sampai={sampai} /></div>
        <TombolKembali href={kembaliHref} />
        <PrintButton />
      </div>
      <style>{`@page { size: A4 portrait; margin: 1.2cm; }`}</style>
      <div className="print-doc mx-auto max-w-[21cm] bg-white px-8 pb-8 pt-0 text-[10.5px] leading-snug text-gray-800 shadow-sm print:shadow-none">
        <PrintKop title="Laporan Sebaran Asal Siswa" subtitle={`${sekolah} · ${saring ? `angkatan masuk ${labelRentang} · ` : ""}per ${tgl}`} logoUrl={s["logo.full_white"]} />

        <div className="mb-3 grid grid-cols-4 gap-2">
          {(saring ? [
            [`Siswa masuk ${labelRentang}`, masuk.jumlah, `${masuk.terpetakan} terpetakan sampai kecamatan`],
            ["Kecamatan asal", a.kecamatan.filter(w => nKec(w.kode) > 0).length, "mengirim siswa pada rentang ini"],
            ["Sekolah asal", sekSemua.length, "SMP/MTs pada rentang ini"],
            ["Pendaftar SPMB", pendaftar.total, "gelombang berjalan (tidak ikut saringan)"],
          ] : [
            ["Siswa aktif", siswa.total, `${siswa.total - siswa.tanpaWilayah} terpetakan`],
            ["Alumni", a.ringkas.alumni, `${a.ringkas.alumniTerpetakan} terpetakan`],
            ["Pendaftar SPMB", pendaftar.total, `${pendaftar.total - pendaftar.tanpaWilayah} mengisi wilayah`],
            ["Sekolah asal", a.sekolah.length, `SMP/MTs · ${a.kecamatan.length} kecamatan`],
          ] as [string, number, string][]).map(([l, v, k]) => (
            <div key={String(l)} className="rounded border border-gray-300 px-2 py-1.5">
              <p className="text-[9px] uppercase tracking-wide text-gray-500">{l}</p>
              <p className="text-[17px] font-bold leading-tight text-primary-900">{typeof v === "number" ? v.toLocaleString("id-ID") : v}</p>
              <p className="text-[9px] text-gray-500">{k}</p>
            </div>
          ))}
        </div>

        <div className="mb-3 grid grid-cols-2 gap-4">
          <div>
            <h2 className="mb-1 text-[11px] font-bold uppercase tracking-wide text-primary-900">{saring ? `Peta siswa masuk ${labelRentang}` : "Peta siswa aktif"} — {kab?.nama ?? "belum ada alamat terpetakan"}</h2>
            {batas.length > 0 ? (
              <>
                <svg viewBox={`${x0} ${y0} ${lebar} ${tinggi}`} className="block w-full overflow-hidden rounded border border-gray-200" style={{ maxHeight: "82mm" }} role="img" aria-label="Peta sebaran siswa aktif per kecamatan">
                  {batas.map(w => <path key={w.k} d={w.d} fill={warna(nKec(w.k))} stroke="#ffffff" strokeWidth={0.6 * u} strokeLinejoin="round" />)}
                  {batas.filter(w => (nKec(w.k)) > 0).map(w => (
                    <text key={w.k} x={w.c[0]} y={w.c[1]} fontSize={7 * u} textAnchor="middle" dominantBaseline="central" fontWeight={700}
                      fill={kelas(nKec(w.k)) >= batasKelas.length - 2 && batasKelas.length > 2 ? "#ffffff" : "#0F1A45"}>{nKec(w.k)}</text>
                  ))}
                </svg>
                <p className="mt-1 text-[9px] text-gray-500">Angka = jumlah {saring ? `siswa yang masuk pada angkatan ${labelRentang} (aktif, lulus, maupun keluar)` : "siswa aktif"} per kecamatan; makin gelap makin banyak. Kecamatan abu-abu belum mengirim siswa. Peta dipotong ke wilayah asal siswa.</p>
              </>
            ) : <p className="text-gray-500">Peta belum bisa digambar.</p>}
          </div>
          <div>
            <h2 className="mb-1 text-[11px] font-bold uppercase tracking-wide text-primary-900">10 kecamatan teratas</h2>
            <table className="w-full border-collapse">
              <thead><tr><th className={`${kepala} w-6`}>No</th><th className={kepala}>Kecamatan</th>
                {saring ? <th className={`${kepala} text-right`}>Masuk {labelRentang}</th> : <><th className={`${kepala} text-right`}>Aktif</th><th className={`${kepala} text-right`}>Alumni</th></>}
                <th className={`${kepala} text-right`}>Pendaftar</th></tr></thead>
              <tbody>
                {kecTop.map((w, i) => (
                  <tr key={w.kode}>
                    <td className={sel}>{i + 1}</td><td className={sel}>{w.nama}</td>
                    {saring ? <td className={`${sel} text-right`}>{nKec(w.kode)}</td> : <><td className={`${sel} text-right`}>{w.aktif}</td><td className={`${sel} text-right`}>{w.alumni}</td></>}
                    <td className={`${sel} text-right`}>{pendaftar.jumlah[w.kode] ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h2 className="mb-1 mt-3 text-[11px] font-bold uppercase tracking-wide text-primary-900">Siswa tercatat per angkatan masuk</h2>
            <div className="space-y-[3px]">
              {tren.map(t => (
                <div key={t.tahun} className="flex items-center gap-1.5">
                  <span className="w-8 text-right">{t.tahun}</span>
                  <span className="h-[9px] rounded-sm bg-primary-700" style={{ width: `${(t.jumlah / maksTren) * 72}%` }} />
                  <span className="font-semibold">{t.jumlah}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <h2 className="mb-1 text-[11px] font-bold uppercase tracking-wide text-primary-900">10 sekolah asal teratas</h2>
            <table className="w-full border-collapse">
              <thead><tr><th className={`${kepala} w-6`}>No</th><th className={kepala}>Sekolah</th><th className={`${kepala} text-right`}>{saring ? labelRentang : "Total"}</th>{!saring && <th className={`${kepala} text-right`}>{rentang(p.baru)}</th>}</tr></thead>
              <tbody>
                {sekTop.map((w, i) => (
                  <tr key={w.nama}>
                    <td className={sel}>{i + 1}</td><td className={sel}>{w.nama}</td>
                    <td className={`${sel} text-right`}>{nSek(w)}</td>
                    {!saring && <td className={`${sel} text-right`}>{p.baru.reduce((n, t) => n + (w.perTahun[t] ?? 0), 0)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h2 className="mb-1 text-[11px] font-bold uppercase tracking-wide text-primary-900">Perlu didatangi lagi{saring && <span className="ml-1 font-normal normal-case text-gray-500">(semua angkatan)</span>}</h2>
            {turun.length === 0 ? (
              <p className="text-gray-600">Tidak ada kecamatan atau sekolah asal yang pangsanya turun melewati ambang (tinggal 60% atau kurang) antara angkatan {rentang(p.lama)} dan {rentang(p.baru)}. Sebaran asal siswa relatif stabil.</p>
            ) : (
              <table className="w-full border-collapse">
                <thead><tr><th className={kepala}>Kecamatan / sekolah</th><th className={`${kepala} text-right`}>{rentang(p.lama)}</th><th className={`${kepala} text-right`}>{rentang(p.baru)}</th></tr></thead>
                <tbody>
                  {turun.map(x => (
                    <tr key={x.nama}>
                      <td className={sel}>{x.nama}</td>
                      <td className={`${sel} text-right`}>{x.g.jumlahLama} ({persen(x.g.pangsaLama)})</td>
                      <td className={`${sel} text-right`}>{x.g.jumlahBaru} ({persen(x.g.pangsaBaru)})</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="mt-2 text-[9px] text-gray-500">
              Persen = pangsa dari siswa pada periodenya. Dibandingkan pangsa, bukan jumlah, karena kelengkapan alamat tiap angkatan berbeda.
              {siswa.tanpaWilayah > 0 && ` ${siswa.tanpaWilayah} siswa aktif belum terpetakan (alamat Buku Induk belum lengkap).`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
