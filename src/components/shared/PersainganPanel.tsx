import KendaliPersaingan from "@/components/shared/KendaliPersaingan";
import PetaPersaingan, { type TitikPeta } from "@/components/shared/PetaPersaingan";
import StatTile from "@/components/admin/StatTile";
import { getSettings } from "@/lib/site-settings";
import { kabupatenBoleh, susunPersaingan, type BarisProyeksi } from "@/lib/potensi-smp";

/** PETA PERSAINGAN & PROYEKSI (9 Oktober 2026) — Pusat SPMB → Sasaran & Potensi. Hanya angka pasti (lihat `susunPersaingan`). */
const fmt = (n: number) => n.toLocaleString("id-ID");
const satu = (n: number) => n.toLocaleString("id-ID", { maximumFractionDigits: 1 });
const persen = (a: number, b: number) => (b > 0 ? `${satu((a / b) * 100)}%` : "—");
function Arah({ a }: { a: "naik" | "turun" | "tetap" }) {
  if (a === "naik") return <span className="status-badge border-emerald-200 bg-emerald-50 text-emerald-700">Naik</span>;
  if (a === "turun") return <span className="status-badge border-red-200 bg-red-50 text-red-600">Turun</span>;
  return <span className="text-xs text-gray-400">Stabil</span>;
}

export type SaringPersaingan = { kab?: string; r?: string; jenjang?: string; status?: string };

async function muat(saring: SaringPersaingan) {
  const [boleh, s] = await Promise.all([kabupatenBoleh(), getSettings(["nominatif.npsn"]).catch(() => ({} as Record<string, string>))]);
  if (!boleh.length) return null;
  const kab = boleh.find(k => k.nama === saring.kab)?.nama ?? boleh[0].nama;
  return { boleh, kab, p: await susunPersaingan(kab, (s["nominatif.npsn"] ?? "").trim()) };
}
const Kosong = ({ teks }: { teks: string }) => <div className="panel"><p className="py-10 text-center text-sm text-gray-400">{teks}</p></div>;

export async function ProyeksiPanel({ saring }: { saring: SaringPersaingan }) {
  const d = await muat(saring);
  if (!d) return <Kosong teks="Belum ada alamat siswa yang terpetakan, jadi belum ada kabupaten yang bisa dihitung." />;
  const { p } = d;
  if (!p.proyeksi.length) return <Kosong teks={`Data SMP/MTs ${d.kab} belum diambil. Buka tab Potensi Lulusan lalu tekan "Ambil dari Sekolah Kita".`} />;
  const th = Number(new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 4)) + (new Date(Date.now() + 7 * 3600_000).getUTCMonth() >= 6 ? 1 : 0);
  const jml = p.proyeksi.reduce((t: Omit<BarisProyeksi, "nama" | "arah">, x) => ({ sekolah: t.sekolah + x.sekolah, k9: t.k9 + x.k9, k8: t.k8 + x.k8, k7: t.k7 + x.k7 }), { sekolah: 0, k9: 0, k8: 0, k7: 0 });
  return (
    <>
      <div className="panel panel-isi text-sm text-gray-600">
        <p>
          Kelas IX sekarang lulus pada {th}, kelas VIII pada {th + 1}, kelas VII pada {th + 2}. Jadi jumlah siswa per tingkat hari ini adalah
          <span className="font-semibold text-navy"> jumlah calon pendaftar tiga tahun ke depan</span> di {d.kab}.
        </p>
        <p className="mt-1 text-gray-500">Arah membandingkan kelas IX dengan kelas VII: &ldquo;Turun&rdquo; berarti lulusannya akan berkurang sedikitnya 15% dalam dua tahun. Angka bisa bergeser sedikit karena siswa pindah atau keluar.</p>
      </div>
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th className="w-10">No</th><th>Kecamatan</th><th className="text-right">SMP/MTs</th><th className="text-right">Lulus {th}</th><th className="text-right">Lulus {th + 1}</th><th className="text-right">Lulus {th + 2}</th><th className="text-right">Selisih</th><th>Arah</th></tr></thead>
            <tbody>
              {p.proyeksi.map((x, i) => (
                <tr key={x.nama}>
                  <td className="angka">{i + 1}</td><td className="font-semibold text-primary-900">{x.nama}</td>
                  <td className="angka text-right text-gray-600">{x.sekolah}</td>
                  <td className="angka text-right font-semibold text-navy">{fmt(x.k9)}</td><td className="angka text-right">{fmt(x.k8)}</td><td className="angka text-right">{fmt(x.k7)}</td>
                  <td className={`angka text-right ${x.k7 < x.k9 ? "text-red-600" : "text-emerald-700"}`}>{x.k7 - x.k9 > 0 ? "+" : ""}{fmt(x.k7 - x.k9)}</td>
                  <td><Arah a={x.arah} /></td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td /><td>Jumlah</td><td className="angka text-right">{jml.sekolah}</td>
                <td className="angka text-right">{fmt(jml.k9)}</td><td className="angka text-right">{fmt(jml.k8)}</td><td className="angka text-right">{fmt(jml.k7)}</td>
                <td className="angka text-right">{jml.k7 - jml.k9 > 0 ? "+" : ""}{fmt(jml.k7 - jml.k9)}</td><td />
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export default async function PersainganPanel({ alamat, saring }: { alamat: string; saring: SaringPersaingan }) {
  const d = await muat(saring);
  if (!d) return <Kosong teks="Belum ada alamat siswa yang terpetakan, jadi belum ada kabupaten yang bisa dihitung." />;
  const { boleh, kab, p } = d;
  const r = [5, 10, 15, 25].includes(Number(saring.r)) ? Number(saring.r) : 0;
  const jenjang = ["SMK", "SMA", "MA"].includes(saring.jenjang ?? "") ? (saring.jenjang as string) : "";
  const status = saring.status === "NEGERI" || saring.status === "SWASTA" ? saring.status : "";
  const dalam = (j: number | null) => !r || (j !== null && j <= r);
  const pesaing = p.pesaing.filter(b => dalam(b.jarak) && (!jenjang || b.bentuk === jenjang) && (!status || b.status.toUpperCase() === status));
  const smp = p.smp.filter(b => dalam(b.jarak));
  const lulusan = smp.reduce((t, b) => t + b.k9, 0);
  const masuk = smp.reduce((t, b) => t + (b.kita ?? 0), 0) / p.nTahun;
  // Pangsa memakai SEMUA sekolah lanjutan di wilayah itu (bukan yang tersaring jenjang/status) supaya penyebutnya tidak berubah-ubah.
  const semuaX = p.pesaing.filter(b => dalam(b.jarak)).reduce((t, b) => t + b.k10, 0) + (p.kita?.k10 ?? 0);
  const wilayah = r ? `radius ${r} km dari sekolah` : kab;
  const titik: TitikPeta[] = [
    ...p.smp.filter(b => b.lintang !== null && b.bujur !== null && b.jarak !== null).map(b => ({ id: b.npsn, nama: b.nama, jenis: "smp" as const, n: b.k9, lat: b.lintang!, lng: b.bujur!,
      ket: `${b.bentuk} ${b.status.toLowerCase()} · Kec. ${b.kecamatan} · kelas IX ${b.k9} · masuk ke kita ${b.kita === null ? "belum ada" : `±${satu(b.kita / p.nTahun)}/tahun`} · ${b.jarak} km` })),
    ...p.pesaing.filter(b => b.lintang !== null && b.bujur !== null && b.jarak !== null).map(b => ({ id: b.npsn, nama: b.nama, jenis: "lanjutan" as const, n: b.k10, lat: b.lintang!, lng: b.bujur!,
      ket: `${b.bentuk} ${b.status.toLowerCase()} · Kec. ${b.kecamatan} · kelas X ${b.k10}, XI ${b.k11}, XII ${b.k12} · ${b.jarak} km` })),
    ...(p.kita?.lintang != null && p.kita.bujur != null ? [{ id: "kita", nama: p.kita.nama, jenis: "kita" as const, n: p.kita.k10, lat: p.kita.lintang, lng: p.kita.bujur, ket: `Sekolah kita · kelas X ${p.kita.k10}, XI ${p.kita.k11}, XII ${p.kita.k12}` }] : []),
  ];
  const tgl = p.diambil?.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });

  return (
    <>
      <KendaliPersaingan alamat={alamat} kab={kab} radius={r ? String(r) : ""} jenjang={jenjang} status={status} adaData={p.adaLanjutan}
        daftarKab={boleh.map(k => ({ value: k.nama, label: `${k.nama} (${k.siswa} siswa kita)` }))} />

      {!p.adaLanjutan ? (
        <Kosong teks={`Data SMK, SMA & MA ${kab} belum pernah diambil. Tekan "Ambil data SMK/SMA/MA" — berjalan di latar beberapa menit.`} />
      ) : (
        <>
          <div className="kisi-kartu kisi-kartu-4">
            <StatTile value={lulusan} label="Lulusan SMP/MTs tahun ini" sublabel={wilayah} ikon="siswa" color="primary" />
            <StatTile value={semuaX} label="Kelas X di semua SMK, SMA & MA" sublabel={`termasuk kita (${p.kita?.k10 ?? 0})`} ikon="kelas" color="blue" />
            <StatTile value={persen(p.kita?.k10 ?? 0, semuaX)} label="Bagian kita dari kelas X" sublabel={wilayah} ikon="tren" color="emerald" />
            <StatTile value={satu(masuk)} label="Masuk ke kita per tahun" sublabel={`${persen(masuk, lulusan)} dari lulusan wilayah ini`} ikon="hadir" color="amber" />
          </div>

          <div className="panel panel-isi text-sm text-gray-600">
            <p>
              Semua angka di sini <span className="font-semibold text-navy">angka nyata</span> dari situs Sekolah Kita Kemendikdasmen (disalin {tgl}) dan data siswa kita.
              Kelas X = penerimaan tahun ini, kelas XI = tahun lalu, kelas XII = dua tahun lalu; dari situ terlihat sekolah yang penerimaannya naik atau turun.
            </p>
            <p className="mt-1 text-gray-500">
              Yang <span className="font-semibold">tidak</span> ada di sini: dari SMP mana siswa sekolah lain berasal, dan jurusan yang mereka buka. Data terbuka tidak memuat keduanya, jadi tidak ditebak.
            </p>
          </div>

          {p.kodeKab && (
            <div className="panel p-4 sm:p-5">
              <h2 className="font-heading mb-3 text-sm font-semibold text-navy">Peta potensi, serapan, dan sekolah — {kab}</h2>
              <PetaPersaingan kodeKab={p.kodeKab} kec={p.perKec.map(k => ({ nama: k.nama, lulusan: k.lulusan, kita: k.kita, kursi: k.kursi }))} titik={titik} />
            </div>
          )}

          <div className="panel overflow-hidden">
            <div className="panel-kepala"><h2 className="panel-judul">Lulusan lawan kursi per kecamatan</h2><span className="text-xs text-gray-500">{p.perKec.length} kecamatan</span></div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th className="w-10">No</th><th>Kecamatan</th><th className="text-right">Lulusan SMP/MTs</th><th className="text-right">Kelas X setempat</th><th className="text-right">Selisih</th><th>Sekolah lanjutan terbesar</th><th className="text-right">Masuk ke kita / tahun</th></tr></thead>
                <tbody>
                  {p.perKec.map((k, i) => (
                    <tr key={k.nama}>
                      <td className="angka">{i + 1}</td><td className="font-semibold text-primary-900">{k.nama}</td>
                      <td className="angka text-right font-semibold text-navy">{fmt(k.lulusan)}</td>
                      <td className="angka text-right">{fmt(k.kursi)} <span className="text-xs text-gray-400">({k.sekolahLanjutan})</span></td>
                      <td className={`angka text-right ${k.kursi < k.lulusan ? "text-amber-700" : "text-gray-600"}`}>{k.kursi - k.lulusan > 0 ? "+" : ""}{fmt(k.kursi - k.lulusan)}</td>
                      <td className="text-xs text-gray-600">{k.terbesar ?? "—"}</td>
                      <td className="angka text-right">{k.kita ? satu(k.kita) : "·"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-gray-100 px-5 py-3 text-xs text-gray-500">Selisih negatif = lulusan lebih banyak daripada kursi kelas X di kecamatan itu, jadi sebagian anaknya pasti bersekolah di luar kecamatan.</p>
          </div>

          <div className="panel overflow-hidden">
            <div className="panel-kepala"><h2 className="panel-judul">Sekolah lanjutan lain — {wilayah}</h2><span className="text-xs text-gray-500">{pesaing.length} sekolah</span></div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th className="w-10">No</th><th>Sekolah</th><th>Kecamatan</th><th className="text-right">Jarak</th><th className="text-right">Kelas X</th><th className="text-right">XI</th><th className="text-right">XII</th><th>Arah penerimaan</th></tr></thead>
                <tbody>
                  {pesaing.slice(0, 150).map((b, i) => (
                    <tr key={b.npsn}>
                      <td className="angka">{i + 1}</td>
                      <td><p className="font-semibold text-primary-900">{b.nama}</p><p className="text-xs text-gray-400">{[b.bentuk, b.status.toLowerCase(), b.akreditasi && `akreditasi ${b.akreditasi}`].filter(Boolean).join(" · ")}</p></td>
                      <td className="text-gray-600">{b.kecamatan}</td>
                      <td className="angka text-right text-gray-600">{b.jarak === null ? "—" : `${satu(b.jarak)} km`}</td>
                      <td className="angka text-right font-semibold text-navy">{fmt(b.k10)}</td><td className="angka text-right text-gray-600">{fmt(b.k11)}</td><td className="angka text-right text-gray-600">{fmt(b.k12)}</td>
                      <td><Arah a={b.arah} /></td>
                    </tr>
                  ))}
                  {pesaing.length === 0 && <tr><td colSpan={8} className="py-10 text-center text-sm text-gray-400">Tidak ada sekolah yang cocok dengan saringan.</td></tr>}
                </tbody>
              </table>
            </div>
            {pesaing.length > 150 && <p className="border-t border-gray-100 px-5 py-3 text-xs text-gray-500">Menampilkan 150 sekolah berkelas X terbanyak dari {pesaing.length}. Persempit dengan radius atau jenjang.</p>}
          </div>
        </>
      )}
    </>
  );
}
