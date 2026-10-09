"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard, Loader2, Users, MapPinned, UserX, Briefcase, CheckCircle2, Building2, FileSpreadsheet, TriangleAlert,
  ClipboardList, ChevronRight,
} from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import BarisPintasan from "@/components/shared/BarisPintasan";
import { KisiMenuPortal } from "@/components/shared/NavPortal";
import { MENU_PUSAT_PKL } from "@/lib/menu-portal";
import { tglPkl } from "@/lib/pkl-label";

type Data = {
  angka: Record<string, number>;
  perDudi: { id: string; nama: string; bidang: string | null; kecamatan: string | null; kuota: number | null; terisi: number; aktif: boolean }[];
  perKelas: { kelas: string; total: number; belum: number }[];
  perLama: { label: string; jumlah: number }[];
  mou: { id: string; nama: string; sampai: string | null; kode: string; label: string; kelas: string }[];
  hrefPendaftaran: string;
};

/** DASBOR PUSAT PKL (9 Okt 2026) — keadaan PKL dalam satu layar: sudah/belum ditempatkan, sedang PKL, selesai,
 *  dan daftar hal yang menunggu tindakan Humas. Tiap baris "perlu tindakan" menaut ke saringannya di Penempatan. */
export default function DasborPkl() {
  const [d, setD] = useState<Data | null>(null);
  const [galat, setGalat] = useState("");
  useEffect(() => {
    fetch("/api/pkl/ringkasan").then(r => r.json()).then(x => { if (x.error) setGalat(x.error); else setD(x); })
      .catch(() => setGalat("Gagal memuat ringkasan PKL."));
  }, []);

  if (!d) return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 flex items-center justify-center min-h-[60vh] text-gray-400">
      {galat ? <p className="text-sm">{galat}</p> : <Loader2 size={24} className="animate-spin" />}
    </div>
  );
  const a = d.angka;
  const tindakan = [
    { n: a.belum, teks: "siswa belum dapat DUDI", href: "/pusat-pkl/penempatan?saring=BELUM" },
    { n: a.tanpaKatalog, teks: "penempatan lama belum dihubungkan ke daftar DUDI", href: "/pusat-pkl/penempatan?saring=TANPA_KATALOG" },
    { n: a.tanpaGuru, teks: "siswa belum punya guru pembimbing", href: "/pusat-pkl/penempatan?saring=TANPA_GURU" },
    { n: a.belumDiantar, teks: "siswa sudah mulai PKL tetapi belum dicatat diantar", href: "/pusat-pkl/penempatan?saring=BELUM_DIANTAR" },
    { n: a.lewat, teks: "siswa melewati tanggal selesai tetapi masih berstatus Sedang PKL", href: "/pusat-pkl/penempatan?saring=LEWAT" },
    { n: a.monitoringTertunggak, teks: "siswa belum dimonitor dalam 30 hari terakhir", href: "/pusat-pkl/monitoring" },
    { n: a.peringatan ?? 0, teks: "siswa PKL perlu perhatian (peringatan dini)", href: "/pusat-pkl/peringatan" },
    { n: a.laporanAkhir ?? 0, teks: "laporan akhir menunggu diperiksa", href: "/pusat-pkl/laporan-akhir" },
    { n: a.laporanBaru, teks: "laporan masalah belum ditangani", href: "/pusat-pkl/masalah" },
    { n: a.laporanDitangani, teks: "laporan masalah sedang ditangani", href: "/pusat-pkl/masalah" },
    { n: a.mouHabis, teks: "DUDI dengan MoU sudah habis", href: "/pusat-pkl/dudi?saring=HABIS" },
    { n: a.mouSegera, teks: "DUDI dengan MoU habis dalam 60 hari", href: "/pusat-pkl/dudi?saring=SEGERA" },
    { n: a.pendaftaran, teks: "pendaftaran PKL menunggu keputusan", href: d.hrefPendaftaran },
  ].filter(t => t.n > 0);
  const persen = a.peserta ? Math.round((a.ditempatkan / a.peserta) * 100) : 0;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<LayoutDashboard size={22} />} title="Beranda PKL"
        description="Keadaan Praktik Kerja Lapangan: penempatan, DUDI, dan hal yang menunggu tindakan" />

      <div className="space-y-6">
        <div className="kisi-kartu kisi-kartu-5">
          <StatTile value={a.peserta} label="Peserta PKL" icon={Users} color="primary" href="/pusat-pkl/penempatan" />
          <StatTile value={a.ditempatkan} label="Sudah dapat DUDI" icon={MapPinned} color="emerald" href="/pusat-pkl/penempatan?saring=DITEMPATKAN" />
          <StatTile value={a.belum} label="Belum dapat DUDI" icon={UserX} color="amber" sorot={a.belum > 0} href="/pusat-pkl/penempatan?saring=BELUM" />
          <StatTile value={a.berjalan} label="Sedang PKL hari ini" icon={Briefcase} color="blue" href="/pusat-pkl/penempatan?saring=BERJALAN" />
          <StatTile value={a.selesai} label="Selesai PKL" icon={CheckCircle2} color="purple" href="/pusat-pkl/penempatan?saring=SELESAI" />
        </div>

        <BarisPintasan items={[
          { href: "/pusat-pkl/penempatan?saring=BELUM", label: "Tempatkan Siswa", ket: `${a.belum} siswa menunggu`, ikon: MapPinned, sorot: a.belum > 0 },
          { href: "/pusat-pkl/dudi", label: "Data DUDI", ket: `${a.dudi} aktif · ${a.dudiTerpakai} ditempati`, ikon: Building2 },
          { href: "/api/pkl/rekap", label: "Unduh Rekap Excel", ket: "Per DUDI, belum dapat DUDI, mutasi", ikon: FileSpreadsheet },
          { href: d.hrefPendaftaran, label: "Pendaftaran PKL", ket: `${a.pendaftaran} menunggu keputusan`, ikon: ClipboardList },
        ]} />

        <KisiMenuPortal items={MENU_PUSAT_PKL} />

        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
          <div className="min-w-0 space-y-6 xl:col-span-7">
            <div className="panel overflow-hidden">
              <div className="panel-kepala">
                <p className="panel-judul"><span className="panel-ikon"><TriangleAlert size={16} /></span> Perlu tindakan</p>
              </div>
              {tindakan.length === 0 ? (
                <p className="py-10 text-center text-sm text-gray-400">Tidak ada yang menunggu tindakan.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {tindakan.map(t => (
                    <li key={t.teks}>
                      <Link href={t.href} className="flex items-center gap-3 px-5 py-3 text-sm transition hover:bg-gray-50">
                        <span className="angka w-10 shrink-0 text-right font-heading text-lg font-semibold text-primary-900">{t.n}</span>
                        <span className="min-w-0 flex-1 text-gray-600">{t.teks}</span>
                        <ChevronRight size={16} className="shrink-0 text-gray-300" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="panel overflow-hidden">
              <div className="panel-kepala">
                <p className="panel-judul">Siswa per DUDI</p>
                <Link href="/pusat-pkl/dudi" className="panel-tautan">Semua DUDI</Link>
              </div>
              {d.perDudi.length === 0 ? (
                <p className="py-10 text-center text-sm text-gray-400">Belum ada DUDI. Tambahkan dulu di Data DUDI.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead><tr><th>DUDI</th><th>Bidang</th><th className="text-right">Sedang PKL</th><th className="text-right">Kuota</th><th>Keterisian</th></tr></thead>
                    <tbody>
                      {d.perDudi.slice(0, 15).map(x => {
                        const p = x.kuota ? Math.min(100, Math.round((x.terisi / x.kuota) * 100)) : 0;
                        const penuh = x.kuota != null && x.terisi >= x.kuota;
                        return (
                          <tr key={x.id}>
                            <td><Link href={`/pusat-pkl/dudi?buka=${x.id}`} className="font-medium text-primary-900 hover:underline">{x.nama}</Link>
                              {x.kecamatan && <span className="block text-xs text-gray-400">{x.kecamatan}</span>}</td>
                            <td className="text-gray-600">{x.bidang || "—"}</td>
                            <td className="angka text-right">{x.terisi}</td>
                            <td className="angka text-right">{x.kuota ?? "—"}</td>
                            <td className="min-w-[8rem]">
                              {x.kuota ? (
                                <div className="flex items-center gap-2">
                                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100"><div className={`h-full rounded-full ${penuh ? "bg-amber-400" : "bg-emerald-500"}`} style={{ width: `${p}%` }} /></div>
                                  {penuh && <span className="status-badge bg-amber-50 text-amber-700 border-amber-200">Penuh</span>}
                                </div>
                              ) : <span className="text-xs text-gray-400">kuota belum diisi</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="min-w-0 space-y-6 xl:col-span-5">
            <div className="panel p-5">
              <p className="panel-judul mb-3">Kemajuan penempatan</p>
              <div className="flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${persen}%` }} /></div>
                <span className="angka text-sm text-gray-600">{a.ditempatkan} / {a.peserta} ({persen}%)</span>
              </div>
              {d.perLama.length > 0 && (
                <p className="mt-3 text-sm text-gray-500">Lama PKL: {d.perLama.map(l => `${l.label} ${l.jumlah} siswa`).join(" · ")}</p>
              )}
              {a.akanMulai > 0 && <p className="mt-1 text-sm text-gray-500"><span className="angka">{a.akanMulai}</span> siswa sudah ditempatkan dan belum mulai.</p>}
            </div>

            <div className="panel overflow-hidden">
              <div className="panel-kepala"><p className="panel-judul">Belum dapat DUDI per kelas</p></div>
              {d.perKelas.length === 0 ? (
                <p className="py-10 text-center text-sm text-gray-400">Belum ada peserta PKL.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead><tr><th>Kelas</th><th className="text-right">Peserta</th><th className="text-right">Belum dapat</th></tr></thead>
                    <tbody>
                      {d.perKelas.map(k => (
                        <tr key={k.kelas}>
                          <td className="font-medium text-primary-900">{k.kelas}</td>
                          <td className="angka text-right">{k.total}</td>
                          <td className={`angka text-right ${k.belum ? "font-semibold text-amber-700" : "text-gray-400"}`}>{k.belum}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {d.mou.length > 0 && (
              <div className="panel overflow-hidden">
                <div className="panel-kepala"><p className="panel-judul">MoU perlu diperbarui</p></div>
                <ul className="divide-y divide-gray-100">
                  {d.mou.map(m => (
                    <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                      <span className="min-w-0 truncate text-gray-700">{m.nama}<span className="block text-xs text-gray-400">sampai {tglPkl(m.sampai)}</span></span>
                      <span className={`status-badge shrink-0 ${m.kelas}`}>{m.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
