"use client";
import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Download, Printer, QrCode, Search } from "lucide-react";
import StatTile from "@/components/admin/StatTile";
import Select from "@/components/admin/Select";
import type { BarisBukuWali } from "@/lib/buku-wali";

interface Data { kelas: { id: string; nama: string; wali: string | null; waliUserId?: string | null }; semester: string; baris: BarisBukuWali[] }
const RISIKO: Record<string, [string, string]> = {
  TINGGI: ["Perhatian", "bg-red-50 text-red-600 border-red-200"],
  SEDANG: ["Waspada", "bg-amber-50 text-amber-700 border-amber-200"],
  PANTAU: ["Pantau", "bg-blue-50 text-blue-700 border-blue-200"],
};
const STATUS_IZIN: Record<string, string> = { MENUNGGU: "bg-amber-50 text-amber-700 border-amber-200", DISETUJUI: "bg-emerald-50 text-emerald-700 border-emerald-200", DITOLAK: "bg-red-50 text-red-600 border-red-200", DIBATALKAN: "bg-gray-50 text-gray-500 border-gray-200" };
const tgl = (s: string) => new Date(`${s}T00:00:00Z`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const SARING = [
  { value: "", label: "Semua siswa" }, { value: "risiko", label: "Ada peringatan dini" }, { value: "alpha", label: "Pernah alpha" },
  { value: "kkm", label: "Ada nilai di bawah KKM" }, { value: "poin", label: "Punya poin pelanggaran" }, { value: "izin", label: "Izin menunggu keputusan" },
];

/** BUKU WALI KELAS — satu baris per siswa; ketuk baris untuk rinciannya. Hanya membaca: tindakan (absensi, izin, kunjungan
 *  rumah) tetap di menunya masing-masing lewat tautan di rincian. */
export default function BukuWaliKelas({ data, daftarKelas, basePath, portal }: { data: Data; daftarKelas: { id: string; name: string }[]; basePath: string; portal: "guru" | "admin" }) {
  const router = useRouter();
  const [cari, setCari] = useState("");
  const [saring, setSaring] = useState("");
  const [buka, setBuka] = useState<string | null>(null);
  const b = data.baris;
  const tampil = useMemo(() => b.filter(x => {
    if (cari && !`${x.nama} ${x.nis}`.toLowerCase().includes(cari.toLowerCase())) return false;
    if (saring === "risiko") return !!x.risiko;
    if (saring === "alpha") return x.hadir.ALPHA > 0;
    if (saring === "kkm") return x.nilai.dibawah.length > 0;
    if (saring === "poin") return x.poin.pelanggaran > 0;
    if (saring === "izin") return x.izin.menunggu > 0;
    return true;
  }), [b, cari, saring]);
  const rataHadir = (() => { const p = b.map(x => x.hadir.persen).filter((x): x is number => x != null); return p.length ? Math.round(p.reduce((a, c) => a + c, 0) / p.length) : null; })();
  // Tautan tindakan hanya ke rute portal yang memang bisa dibuka (CLAUDE.md #45).
  const tautan = portal === "guru"
    ? [["Absensi kelas", `/dashboard/teacher/attendance/${data.kelas.id}`], ["Izin & sakit", "/dashboard/teacher/izin-siswa"], ["Kunjungan rumah", "/dashboard/teacher/kunjungan-rumah"], ["Kontak orang tua", "/dashboard/teacher/kontak-ortu"]]
    : [["Absensi siswa", "/dashboard/admin/absensi-siswa"], ["Kunjungan rumah", "/dashboard/admin/kunjungan-rumah"], ["Peringatan dini", "/dashboard/admin/peringatan-dini"]];
  return (
    <div className="space-y-6">
      <div className="kisi-kartu kisi-kartu-4">
        <StatTile value={b.length} label={`Siswa ${data.kelas.nama}`} ikon="siswa" color="primary" />
        <StatTile value={rataHadir == null ? "—" : `${rataHadir}%`} label="Rata-rata kehadiran semester ini" ikon="hadir" color="emerald" />
        <StatTile value={b.filter(x => x.nilai.dibawah.length > 0).length} label="Siswa dengan nilai di bawah KKM" ikon="waspada" color="amber" />
        <StatTile value={b.filter(x => x.risiko?.tingkat === "TINGGI").length} label="Perlu perhatian segera" ikon="alpha" color="red" sorot={b.some(x => x.risiko?.tingkat === "TINGGI")} />
      </div>
      <div className="baris-alat print:hidden">
        <div className="alat-cari"><Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" /><input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari nama atau NIS…" className="input-field pl-10" /></div>
        {daftarKelas.length > 1 && <div className="alat-saring w-44"><Select value={data.kelas.id} onChange={v => router.push(`${basePath}?kelas=${v}`)} options={daftarKelas.map(k => ({ value: k.id, label: k.name }))} /></div>}
        <div className="alat-saring w-60"><Select value={saring} onChange={setSaring} options={SARING} /></div>
        <div className="alat-aksi">{portal === "guru" && <a href={`${basePath}/kartu-ortu?kelas=${data.kelas.id}`} className="btn-modal-cancel btn-teks"><QrCode /> Kartu Orang Tua</a>}<a href={`${basePath}/cetak?kelas=${data.kelas.id}`} className="btn-modal-cancel"><Printer /> Cetak</a><a href={`/api/buku-wali?kelas=${data.kelas.id}`} className="btn-modal-cancel"><Download /> Unduh Excel</a></div>
      </div>
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr>
              <th className="w-10">No</th><th>Nama</th><th>Kehadiran</th><th className="text-right">Alpha</th><th className="text-right">Poin</th><th className="text-right" title="Jumlah mapel di bawah KKM">&lt; KKM</th><th>Izin</th><th>Ekskul</th><th className="text-right" title="Kunjungan rumah">Kunjungan</th><th>Peringatan</th>
            </tr></thead>
            <tbody>
              {tampil.map((x, i) => {
                const terbuka = buka === x.id;
                return (
                  <Fragment key={x.id}>
                    <tr onClick={() => setBuka(terbuka ? null : x.id)} className="cursor-pointer">
                      <td className="angka text-gray-400">{i + 1}</td>
                      <td><span className="inline-flex items-center gap-1 font-medium text-primary-900">{x.nama}<ChevronDown size={14} className={`shrink-0 text-gray-400 transition-transform ${terbuka ? "rotate-180" : ""}`} aria-label={terbuka ? "Tutup rincian" : "Buka rincian"} /></span><span className="angka block text-xs text-gray-400">{x.nis}</span></td>
                      <td>
                        <div className="flex min-w-[5.5rem] items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100"><div className={`h-full rounded-full ${x.hadir.persen != null && x.hadir.persen < 75 ? "bg-amber-400" : "bg-emerald-500"}`} style={{ width: `${x.hadir.persen ?? 0}%` }} /></div>
                          <span className="angka text-xs text-gray-600">{x.hadir.persen == null ? "—" : `${x.hadir.persen}%`}</span>
                        </div>
                      </td>
                      <td className={`angka text-right ${x.hadir.ALPHA ? "font-semibold text-red-600" : "text-gray-400"}`}>{x.hadir.ALPHA}</td>
                      <td className={`angka text-right ${x.poin.bersih >= 25 ? "font-semibold text-red-600" : x.poin.bersih ? "text-amber-700" : "text-gray-400"}`}>{x.poin.bersih}</td>
                      <td className={`angka text-right ${x.nilai.dibawah.length ? "font-semibold text-amber-700" : "text-gray-400"}`}>{x.nilai.mapel ? x.nilai.dibawah.length : "—"}</td>
                      <td>{x.izin.menunggu ? <span className="status-badge bg-amber-50 text-amber-700 border-amber-200">{x.izin.menunggu} menunggu</span> : <span className="angka text-sm text-gray-500">{x.izin.disetujui || "—"}</span>}</td>
                      <td className="text-sm text-gray-600">{x.ekskul.join(", ") || <span className="text-gray-400">—</span>}</td>
                      <td className={`angka text-right ${x.kunjungan.length ? "text-primary-900" : "text-gray-400"}`}>{x.kunjungan.length}</td>
                      <td>{x.risiko ? <span className={`status-badge whitespace-nowrap ${RISIKO[x.risiko.tingkat]?.[1] ?? ""}`}>{RISIKO[x.risiko.tingkat]?.[0] ?? x.risiko.tingkat}</span> : <span className="text-gray-400">—</span>}</td>

                    </tr>
                    {terbuka && (
                      <tr>
                        <td colSpan={10} className="bg-[#f8f9fc]">
                          <div className="grid grid-cols-1 gap-5 py-2 md:grid-cols-2 xl:grid-cols-3">
                            <div className="min-w-0">
                              <p className="label-kecil mb-1.5">Kehadiran semester ini</p>
                              <p className="text-sm text-gray-700">Hadir <b className="angka">{x.hadir.HADIR}</b> · Izin <b className="angka">{x.hadir.IZIN}</b> · Sakit <b className="angka">{x.hadir.SAKIT}</b> · Alpha <b className="angka">{x.hadir.ALPHA}</b></p>
                              {x.risiko && <><p className="mt-2 text-xs text-gray-500">Peringatan dini (30 hari terakhir):</p><ul className="list-disc space-y-0.5 pl-5 text-sm text-gray-700">{x.risiko.alasan.map(a => <li key={a}>{a}</li>)}</ul></>}
                            </div>
                            <div className="min-w-0">
                              <p className="label-kecil mb-1.5">Nilai di bawah KKM{x.nilai.rata != null && <span className="ml-1 font-normal normal-case text-gray-400">rata-rata {Math.round(x.nilai.rata * 10) / 10}</span>}</p>
                              {!x.nilai.mapel ? <p className="text-sm text-gray-400">Belum ada nilai semester ini.</p> : x.nilai.dibawah.length === 0 ? <p className="text-sm text-gray-400">Semua {x.nilai.mapel} mapel bernilai sudah mencapai KKM.</p>
                                : <ul className="space-y-0.5 text-sm text-gray-700">{x.nilai.dibawah.map(n => <li key={n.mapel}>{n.mapel}: <b className="angka">{n.nilai}</b> <span className="text-gray-400">(KKM {n.kkm})</span></li>)}</ul>}
                            </div>
                            <div className="min-w-0">
                              <p className="label-kecil mb-1.5">Poin — {x.poin.level}</p>
                              {x.poin.daftar.length === 0 ? <p className="text-sm text-gray-400">Belum ada catatan poin semester ini.</p>
                                : <ul className="space-y-0.5 text-sm text-gray-700">{x.poin.daftar.map((p, k) => <li key={k}><span className="angka text-gray-400">{tgl(p.tanggal)}</span> · {p.nama} <b className={`angka ${p.jenis === "PELANGGARAN" ? "text-red-600" : "text-emerald-700"}`}>{p.jenis === "PELANGGARAN" ? "+" : "−"}{p.poin}</b></li>)}</ul>}
                            </div>
                            <div className="min-w-0">
                              <p className="label-kecil mb-1.5">Izin &amp; sakit dari orang tua</p>
                              {x.izin.daftar.length === 0 ? <p className="text-sm text-gray-400">Belum ada pengajuan semester ini.</p>
                                : <ul className="space-y-1.5 text-sm text-gray-700">{x.izin.daftar.map((z, k) => <li key={k}><span className={`status-badge mr-1.5 ${STATUS_IZIN[z.status] ?? ""}`}>{z.status.toLowerCase()}</span>{z.jenis === "SAKIT" ? "Sakit" : "Izin"} {tgl(z.mulai)}{z.selesai !== z.mulai ? ` – ${tgl(z.selesai)}` : ""}<span className="block text-xs text-gray-500">{z.alasan}</span></li>)}</ul>}
                            </div>
                            <div className="min-w-0">
                              <p className="label-kecil mb-1.5">Kunjungan rumah</p>
                              {x.kunjungan.length === 0 ? <p className="text-sm text-gray-400">Belum pernah dikunjungi.</p>
                                : <ul className="space-y-1.5 text-sm text-gray-700">{x.kunjungan.map((k, n) => <li key={n}><span className="angka font-medium text-primary-900">{tgl(k.tanggal)}</span> <span className="text-xs text-gray-400">oleh {k.oleh}</span><span className="block text-gray-600">{k.catatan}</span></li>)}</ul>}
                              {x.catatanBk > 0 && <p className="mt-2 text-xs text-gray-500">Ada <b className="angka">{x.catatanBk}</b> catatan penanganan BK lain — isinya di Guru BK.</p>}
                            </div>
                            <div className="min-w-0 print:hidden">
                              <p className="label-kecil mb-1.5">Tindak lanjut</p>
                              <div className="flex flex-wrap gap-1.5"><a href={`${basePath}/cetak?kelas=${data.kelas.id}&siswa=${x.id}`} className="btn-modal-save btn-teks px-3 text-xs"><Printer /> Cetak lembar siswa</a>{tautan.map(([l, h]) => <a key={h} href={h} className="btn-modal-cancel btn-teks px-3 text-xs">{l}</a>)}</div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {tampil.length === 0 && <p className="py-10 text-center text-sm text-gray-400">Tidak ada siswa yang cocok dengan saringan.</p>}
      </div>
      <p className="text-xs text-gray-500">Semester {data.semester}. Kehadiran dari absensi resmi kelas, nilai dari Jurnal Mengajar dibandingkan KKM tiap mapel, peringatan dari Peringatan Dini. Halaman ini hanya membaca — mengubah data tetap di menunya masing-masing.</p>
    </div>
  );
}
