"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, Loader2, CalendarCheck, AlertOctagon, Users, Gavel, Award, CalendarClock, MessagesSquare, TriangleAlert, ArrowRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import StatTile from "@/components/admin/StatTile";
import Panel, { PanelKosong } from "@/components/shared/Panel";
import { BarDaftar } from "@/components/shared/GrafikRingkas";
import AnimatedBar from "@/components/shared/AnimatedBar";
import { tautanJabatan, BASE_GURU } from "@/lib/rute-jabatan";
import BarisPintasan from "@/components/shared/BarisPintasan";

interface ClassRank { className: string; rate: number }
interface WatchRow { studentId: string; nis: string; name: string; className: string; alphaCount: number }
interface Kegiatan { id: string; judul: string; jenis: string; mulai: string; tempat: string | null }
interface Summary {
  attendanceRate: number | null; totalAlpha: number; watchListCount: number;
  statusCount: { HADIR: number; IZIN: number; SAKIT: number; ALPHA: number };
  classRanking: ClassRank[]; watchList: WatchRow[];
  pelanggaran30: number; prestasi30: number; topPelanggaran: { nama: string; jumlah: number }[];
  trenAlpha: { tanggal: string; jumlah: number }[];
  izinMenunggu: number; konselingBaru: number;
  risiko: { tinggi: number; sedang: number; pantau: number } | null;
  kegiatan: Kegiatan[];
}

const tglPendek = (iso: string) => new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" });
const jam = (iso: string) => new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

/** DASHBOARD WAKIL KEPALA KESISWAAN — kehadiran, kedisiplinan (poin), peringatan dini, layanan BK,
 * dan agenda kesiswaan terdekat. Diperkaya 18 Sep 2026 atas temuan user ("isinya cuma sedikit"). */
/** Dipakai portal GURU (pemegang jabatannya) dan portal ADMIN (superadmin, lewat grup menu
 * "Dashboard Jabatan") — keputusan user 19 September 2026: "superadmin sifatnya full akses ke
 * semuanya ... karena si superadmin bukan pegawai dan bukan guru di situ", jadi ia tidak boleh
 * dilempar ke shell portal guru untuk melihat dashboard ini. */
export default function WakasekKesiswaanDashboard({ basePath = BASE_GURU }: { basePath?: string }) {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/teacher/wakasek/kesiswaan/summary")
      .then(async r => { const d = await r.json().catch(() => null); if (!r.ok) { setError(d?.error || "Gagal memuat data"); return; } setData(d); })
      .catch(() => setError("Gagal memuat data"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;
  if (error || !data) return <div className="p-6 lg:p-8 text-center text-gray-400 py-20">{error || "Data tidak tersedia."}</div>;

  const perluTindakan = data.izinMenunggu + data.konselingBaru;

  /* BARIS PINTASAN (27 September 2026, pola Dashboard Kurikulum). Panel "perlu tindakan" di bawahnya tetap
     ada — itu MUNCUL BERSYARAT saat ada yang menunggu, sedangkan pintasan selalu tersedia. */
  const pintasan = [
    { href: tautanJabatan(basePath, "kesiswaan/poin-siswa"), label: "Poin Siswa", ikon: Gavel },
    { href: tautanJabatan(basePath, "kesiswaan/rekam-bk"), label: "Rekam BK", ikon: MessagesSquare },
    { href: tautanJabatan(basePath, "peringatan-dini"), label: "Peringatan Dini", ikon: TriangleAlert },
    { href: tautanJabatan(basePath, "ekstrakurikuler"), label: "Ekstrakurikuler", ikon: Award },
    { href: tautanJabatan(basePath, "kesiswaan/papan"), label: "Papan Kesiswaan", ikon: ShieldCheck },
    { href: tautanJabatan(basePath, "tata-tertib"), label: "Tata Tertib & Poin", ikon: Gavel },
    { href: tautanJabatan(basePath, "aspirasi"), label: "Kotak Aspirasi", ikon: MessagesSquare },
  ];

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<ShieldCheck size={22} />} title="Dashboard Kesiswaan"
        description="Kehadiran, kedisiplinan, peringatan dini & layanan BK — 30 hari terakhir" />

      <div className="space-y-6">        {perluTindakan > 0 && (
          <div className="panel mb-5 flex flex-wrap items-center gap-3 border-amber-200 bg-amber-50/60 p-4">
            <TriangleAlert size={18} className="shrink-0 text-amber-600" />
            <p className="flex-1 min-w-[12rem] text-sm text-amber-800">
              {data.izinMenunggu > 0 && <>{data.izinMenunggu} pengajuan izin/sakit menunggu keputusan wali kelas. </>}
              {data.konselingBaru > 0 && <>{data.konselingBaru} permintaan konseling belum dijadwalkan.</>}
            </p>
            {data.izinMenunggu > 0 && <Link href={tautanJabatan(basePath, "izin-siswa")} className="btn-modal-cancel">Izin Siswa</Link>}
            {data.konselingBaru > 0 && <Link href={tautanJabatan(basePath, "konseling")} className="btn-modal-cancel">Konseling</Link>}
          </div>
        )}

        <div className="kisi-kartu kisi-kartu-6">
          <StatTile color="primary" icon={CalendarCheck} label="Kehadiran Sekolah"
            value={data.attendanceRate !== null ? `${data.attendanceRate}%` : "—"}>
            {data.attendanceRate !== null && <AnimatedBar pct={data.attendanceRate} className="mt-2" />}
          </StatTile>
          <StatTile color="red" icon={AlertOctagon} label="Alpha 30 hari" value={data.totalAlpha} />
          <StatTile color="amber" icon={Users} label="Alpha ≥3× (watch-list)" value={data.watchListCount} />
          <StatTile color="purple" icon={Gavel} label="Pelanggaran 30 hari" value={data.pelanggaran30} href={tautanJabatan(basePath, "kesiswaan/poin-siswa")} />
          <StatTile color="emerald" icon={Award} label="Prestasi 30 hari" value={data.prestasi30} href={tautanJabatan(basePath, "kesiswaan/papan")} />
          <StatTile color="blue" icon={MessagesSquare} label="Risiko tinggi (peringatan dini)" value={data.risiko?.tinggi ?? 0}
            href={tautanJabatan(basePath, "peringatan-dini")} sorot={(data.risiko?.tinggi ?? 0) > 0} />
        </div>


      
        <BarisPintasan items={pintasan} />

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12 items-start">
          <div className="kolom-dashboard space-y-5 xl:col-span-7">
            <Panel judul="Kehadiran per Kelas" keterangan="terendah dulu — 30 hari terakhir">
              {data.classRanking.length === 0 ? (
                <PanelKosong ikon={<CalendarCheck size={20} />} teks="Belum ada data absensi 30 hari terakhir." />
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(220, data.classRanking.length * 28)}>
                  <BarChart data={data.classRanking} layout="vertical" margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="className" width={90} tick={{ fontSize: 12, fill: "#374151" }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v) => [`${v}%`, "Kehadiran"]} />
                    <Bar dataKey="rate" radius={[0, 6, 6, 0]} maxBarSize={18}>
                      {data.classRanking.map((c, i) => <Cell key={i} fill={c.rate < 75 ? "#dc2626" : "#1B2B6B"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Panel>

            <Panel judul="Tren Alpha Harian" keterangan="14 hari terakhir">
              {data.trenAlpha.length === 0 ? <PanelKosong ikon={<AlertOctagon size={20} />} teks="Tidak ada alpha tercatat." /> : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.trenAlpha} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="tanggal" tickFormatter={tglPendek} tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                    <Tooltip labelFormatter={(v) => tglPendek(String(v))} formatter={(v) => [`${v} siswa`, "Alpha"]} />
                    <Bar dataKey="jumlah" fill="#dc2626" radius={[6, 6, 0, 0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Panel>

            <Panel judul="Watch-list Kedisiplinan" keterangan={`${data.watchList.length} siswa alpha ≥3× dalam 30 hari`} isi={false}>
              {data.watchList.length === 0 ? (
                <EmptyState icon={ShieldCheck} title="Tidak Ada Catatan" description="Tidak ada siswa dengan Alpha berlebih dalam 30 hari terakhir." />
              ) : (
                <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
                  {data.watchList.map(s => (
                    <div key={s.studentId} className="px-5 py-3 flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-semibold text-primary-900 truncate">{s.name}</p>
                        <p className="text-xs text-gray-400">{s.className} · {s.nis}</p>
                      </div>
                      <span className="shrink-0 status-badge bg-red-50 text-red-600 border-red-200">{s.alphaCount}× Alpha</span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          <div className="kolom-dashboard space-y-5 xl:col-span-5">
            <Panel judul="Rekap Kehadiran" keterangan="30 hari terakhir">
              <BarDaftar satuan="catatan" data={[
                { kunci: "HADIR", label: "Hadir", nilai: data.statusCount.HADIR, warna: "#059669" },
                { kunci: "IZIN", label: "Izin", nilai: data.statusCount.IZIN, warna: "#2563eb" },
                { kunci: "SAKIT", label: "Sakit", nilai: data.statusCount.SAKIT, warna: "#d97706" },
                { kunci: "ALPHA", label: "Alpha", nilai: data.statusCount.ALPHA, warna: "#dc2626" },
              ]} />
            </Panel>

            <Panel judul="Pelanggaran Terbanyak" keterangan="30 hari terakhir" tautan={{ label: "Poin siswa", href: tautanJabatan(basePath, "kesiswaan/poin-siswa") }}>
              {data.topPelanggaran.length === 0 ? <PanelKosong ikon={<Gavel size={20} />} teks="Belum ada pelanggaran tercatat." /> : (
                <BarDaftar satuan="kejadian" data={data.topPelanggaran.map(p => ({ kunci: p.nama, label: p.nama, nilai: p.jumlah }))} />
              )}
            </Panel>

            <Panel judul="Peringatan Dini" tautan={{ label: "Lihat daftar", href: tautanJabatan(basePath, "peringatan-dini") }}>
              {!data.risiko ? <PanelKosong ikon={<TriangleAlert size={20} />} teks="Belum bisa dihitung." /> : (
                <BarDaftar satuan="siswa" data={[
                  { kunci: "tinggi", label: "Risiko tinggi", nilai: data.risiko.tinggi, warna: "#dc2626" },
                  { kunci: "sedang", label: "Risiko sedang", nilai: data.risiko.sedang, warna: "#d97706" },
                  { kunci: "pantau", label: "Perlu dipantau", nilai: data.risiko.pantau, warna: "#2563eb" },
                ]} />
              )}
            </Panel>

            <Panel judul="Agenda Terdekat" ikon={<CalendarClock size={16} />} tautan={{ label: "Kegiatan", href: tautanJabatan(basePath, "kegiatan") }} isi={false}>
              {data.kegiatan.length === 0 ? <PanelKosong ikon={<CalendarClock size={20} />} teks="Belum ada kegiatan terjadwal." /> : (
                <ul className="divide-y divide-gray-50">
                  {data.kegiatan.map(k => (
                    <li key={k.id} className="px-5 py-3 text-sm">
                      <p className="font-semibold text-primary-900">{k.judul}</p>
                      <p className="text-xs text-gray-500">{tglPendek(k.mulai)} · {jam(k.mulai)} WIB{k.tempat ? ` · ${k.tempat}` : ""}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
