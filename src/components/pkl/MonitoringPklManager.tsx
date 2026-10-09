"use client";
import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardCheck, Loader2, Printer, Users, MapPin, TriangleAlert, ChevronDown } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import MonthPicker from "@/components/shared/MonthPicker";

type Guru = { teacherId: string | null; nama: string; siswa: number; dudi: number; catatan: number; kunjungan: number; diLokasi: number; belum: { studentId: string; nama: string; kelas: string | null; tempat: string }[] };

/** MONITORING PKL per guru pembimbing — siapa sudah mengunjungi, siswa mana yang belum dimonitor bulan ini, dan cetak
 *  laporan monitoring (lampiran SPPD). */
export default function MonitoringPklManager() {
  const [bulan, setBulan] = useState(() => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7));
  const [guru, setGuru] = useState<Guru[] | null>(null);
  const [buka, setBuka] = useState<string | null>(null);
  useEffect(() => {
    let batal = false;
    fetch(`/api/pkl/monitoring?bulan=${bulan}`).then(r => r.json()).then(d => { if (!batal) setGuru(d.guru ?? []); }).catch(() => { if (!batal) setGuru([]); });
    return () => { batal = true; };
  }, [bulan]);
  const g = guru ?? [];
  const belum = g.reduce((a, x) => a + x.belum.length, 0);
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<ClipboardCheck size={22} />} title="Monitoring PKL" description="Kunjungan guru pembimbing per bulan, siswa yang belum dimonitor, dan laporan cetaknya" />
      <div className="space-y-6">
        <div className="kisi-kartu kisi-kartu-4">
          <StatTile value={g.reduce((a, x) => a + x.siswa, 0)} label="Siswa sedang PKL" icon={Users} color="primary" />
          <StatTile value={g.reduce((a, x) => a + x.catatan, 0)} label="Catatan monitoring bulan ini" icon={ClipboardCheck} color="blue" />
          <StatTile value={g.reduce((a, x) => a + x.diLokasi, 0)} label="Kunjungan terbukti di lokasi" icon={MapPin} color="emerald" />
          <StatTile value={belum} label="Siswa belum dimonitor bulan ini" icon={TriangleAlert} color="amber" sorot={belum > 0} />
        </div>
        <div className="baris-alat">
          <div className="alat-saring"><MonthPicker value={bulan} onChange={v => { setGuru(null); setBulan(v); }} /></div>
        </div>
        <div className="panel overflow-hidden">
          {!guru ? <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
            : g.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">Tidak ada siswa yang sedang PKL pada bulan ini.</p> : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr><th className="w-10">No</th><th>Guru pembimbing</th><th className="text-right">Siswa</th><th className="text-right">DUDI</th><th className="text-right">Catatan</th><th className="text-right">Kunjungan</th><th className="text-right">Belum dimonitor</th><th className="text-right">Aksi</th></tr></thead>
                  <tbody>
                    {g.map((x, i) => {
                      const k = x.teacherId ?? "tanpa";
                      return (
                        <Fragment key={k}>
                          <tr>
                            <td className="angka">{i + 1}</td>
                            <td className={x.teacherId ? "font-medium text-primary-900" : "font-medium text-amber-700"}>{x.nama}</td>
                            <td className="angka text-right">{x.siswa}</td>
                            <td className="angka text-right">{x.dudi}</td>
                            <td className="angka text-right">{x.catatan}</td>
                            <td className="angka text-right">{x.kunjungan}{x.diLokasi > 0 && <span className="block text-xs text-emerald-700">{x.diLokasi} di lokasi</span>}</td>
                            <td className="text-right">
                              {x.belum.length ? (
                                <button type="button" onClick={() => setBuka(b => (b === k ? null : k))} aria-expanded={buka === k}
                                  className="angka inline-flex items-center gap-1 font-semibold text-amber-700 hover:underline">{x.belum.length} <ChevronDown size={14} className={buka === k ? "rotate-180" : ""} /></button>
                              ) : <span className="angka text-gray-400">0</span>}
                            </td>
                            <td className="text-right">{x.teacherId && <Link href={`/pusat-pkl/monitoring/cetak?guru=${x.teacherId}&bulan=${bulan}`} className="btn-modal-cancel px-3 text-xs"><Printer size={14} /> Laporan</Link>}</td>
                          </tr>
                          {buka === k && (
                            <tr><td /><td colSpan={7} className="!pt-0">
                              <ul className="grid grid-cols-1 gap-x-6 gap-y-1 pb-2 text-sm text-gray-600 sm:grid-cols-2">
                                {x.belum.map(s => <li key={s.studentId}>{s.nama} <span className="text-xs text-gray-400">· {s.kelas ?? "—"} · {s.tempat}</span></li>)}
                              </ul>
                            </td></tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          <p className="border-t border-gray-100 px-5 py-3 text-xs text-gray-500">
            Catatan monitoring diisi guru pembimbing dari halaman PKL Pembimbingan. &ldquo;Di lokasi&rdquo; = guru menekan Saya di Lokasi dan jaraknya ke titik DUDI paling jauh 300 meter.
          </p>
        </div>
      </div>
    </div>
  );
}
