"use client";
import { useEffect, useState } from "react";
import { BadgeCheck, Loader2, BookOpen, CalendarCheck, Briefcase, AlertTriangle, CalendarClock, UserCheck, FileCheck, Stamp } from "lucide-react";
import Link from "next/link";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import { tautanJabatan, BASE_GURU } from "@/lib/rute-jabatan";
import AnimatedBar from "@/components/shared/AnimatedBar";
import BarisPintasan from "@/components/shared/BarisPintasan";

interface DataGap { label: string; count: number; href: string }
interface Summary {
  schoolAvg: number | null; attendanceRate: number | null; pklRate: number | null;
  totalGaps: number; dataGaps: DataGap[]; semester: string;
}

/** Dipakai portal GURU (pemegang jabatannya) dan portal ADMIN (superadmin, lewat grup menu
 * "Dashboard Jabatan") — keputusan user 19 September 2026: "superadmin sifatnya full akses ke
 * semuanya ... karena si superadmin bukan pegawai dan bukan guru di situ", jadi ia tidak boleh
 * dilempar ke shell portal guru untuk melihat dashboard ini. */
export default function WakasekPenjaminMutuDashboard({ basePath = BASE_GURU }: { basePath?: string }) {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/teacher/wakasek/penjamin-mutu/summary").then(async r => {
      if (!r.ok) { const d = await r.json(); setError(d.error || "Gagal memuat data"); setLoading(false); return; }
      setData(await r.json());
      setLoading(false);
    }).catch(() => { setError("Gagal memuat data"); setLoading(false); });
  }, []);

  if (loading) return <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;
  if (error || !data) return <div className="p-6 lg:p-8 text-center text-gray-400 py-20">{error || "Data tidak tersedia."}</div>;

  const pintasan = [
    { href: tautanJabatan(basePath, "wakasek/penjamin-mutu/kedisiplinan"), label: "Kedisiplinan Guru", ikon: UserCheck },
    { href: tautanJabatan(basePath, "wakasek/penjamin-mutu/jadwal-piket"), label: "Jadwal Piket", ikon: CalendarClock },
    { href: tautanJabatan(basePath, "wakasek/kaprogli/ukk"), label: "Rekap UKK", ikon: FileCheck },
    { href: tautanJabatan(basePath, "kepala-sekolah/rapor"), label: "Pengesahan Rapor", ikon: Stamp },
  ];

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<BadgeCheck size={22} />}
        title="Dashboard Penjamin Mutu"
        description={`Ringkasan KPI lintas-bidang sekolah — Semester ${data.semester}`}
      />

      <div className="space-y-6">
        {/* BARIS PINTASAN (27 September 2026) — empat halaman yang jadi langkah berikutnya setelah melihat
            angka di dashboard ini. Dashboard ini sebelumnya satu-satunya yang tidak punya jalan lanjut apa pun. */}
        <div className="kisi-kartu kisi-kartu-4">
          <StatTile color="primary" icon={BookOpen} label="Rata-rata Nilai Sekolah" value={data.schoolAvg ?? "—"} />
          <StatTile color="blue" icon={CalendarCheck} label="Kehadiran Sekolah (30 hari)"
            value={data.attendanceRate !== null ? `${data.attendanceRate}%` : "—"}>
            {data.attendanceRate !== null && <AnimatedBar pct={data.attendanceRate} className="mt-2" />}
          </StatTile>
          <StatTile color="emerald" icon={Briefcase} label="Penempatan PKL Kelas XII"
            value={data.pklRate !== null ? `${data.pklRate}%` : "—"}>
            {data.pklRate !== null && <AnimatedBar pct={data.pklRate} className="mt-2" />}
          </StatTile>
          <StatTile color="amber" icon={AlertTriangle} label="Total Data Belum Lengkap" value={data.totalGaps} />
        </div>

              <BarisPintasan items={pintasan} className="mb-5" />

        <div className="panel p-5">
          <h3 className="font-heading font-semibold text-navy text-sm mb-3">Area Perlu Perhatian</h3>
          {data.dataGaps.length === 0 ? (
            <p className="text-sm text-emerald-600 font-medium text-center py-8">Semua data sudah lengkap ✓</p>
          ) : (
            <div className="space-y-1.5">
              {data.dataGaps.map((g, i) => (
                <Link key={i} href={g.href}
                  className="flex items-center gap-2 text-sm group hover:bg-amber-50/60 -mx-1 px-3 py-2 rounded-lg transition-colors">
                  <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                  <span className="text-gray-600 flex-1 group-hover:text-navy">{g.label}</span>
                  <span className="font-bold text-amber-600">{g.count}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
