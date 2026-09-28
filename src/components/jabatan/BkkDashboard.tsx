"use client";
import { useEffect, useState } from "react";
import { UserCheck, Loader2, Users, Briefcase, AlertTriangle , Handshake, Users2} from "lucide-react";
import Link from "next/link";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import EmptyState from "@/components/admin/EmptyState";
import { tautanJabatan, BASE_GURU } from "@/lib/rute-jabatan";
import BarisPintasan from "@/components/shared/BarisPintasan";

interface Company { company: string; count: number }
interface UnplacedRow { studentId: string; nis: string; name: string; className: string }
interface Summary {
  totalTwelve: number; placedCount: number; unplacedCount: number;
  statusCount: { ONGOING: number; COMPLETED: number; CANCELLED: number };
  topCompanies: Company[]; unplacedList: UnplacedRow[];
}

/** Dipakai portal GURU (pemegang jabatannya) dan portal ADMIN (superadmin, lewat grup menu
 * "Dashboard Jabatan") — keputusan user 19 September 2026: "superadmin sifatnya full akses ke
 * semuanya ... karena si superadmin bukan pegawai dan bukan guru di situ", jadi ia tidak boleh
 * dilempar ke shell portal guru untuk melihat dashboard ini. */
export default function BkkDashboard({ basePath = BASE_GURU }: { basePath?: string }) {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/teacher/bkk/summary").then(async r => {
      if (!r.ok) { const d = await r.json(); setError(d.error || "Gagal memuat data"); setLoading(false); return; }
      setData(await r.json());
      setLoading(false);
    }).catch(() => { setError("Gagal memuat data"); setLoading(false); });
  }, []);

  if (loading) return <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;
  if (error || !data) return <div className="p-6 lg:p-8 text-center text-gray-400 py-20">{error || "Data tidak tersedia."}</div>;

  /* BARIS PINTASAN (27 September 2026, pola Dashboard Kurikulum) — halaman yang jadi langkah berikutnya
     setelah melihat angka di dashboard ini. */
  const pintasan = [
    { href: tautanJabatan(basePath, "bkk/tracer-study"), label: "Tracer Study", ikon: UserCheck },
    { href: tautanJabatan(basePath, "humas/pkl-pendaftaran"), label: "Pendaftaran PKL", ikon: Briefcase },
    { href: tautanJabatan(basePath, "humas/industry-partners"), label: "Mitra Industri", ikon: Handshake },
    { href: tautanJabatan(basePath, "kegiatan"), label: "Kegiatan Sekolah", ikon: Users2 },
  ];

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<UserCheck size={22} />}
        title="Dashboard BKK"
        description="Bursa Kerja Khusus — pemantauan penempatan PKL siswa kelas XII"
      />

      <div className="space-y-6">        <div className="kisi-kartu kisi-kartu-3">
          <StatTile color="primary" icon={Users} label="Total Siswa Kelas XII" value={data.totalTwelve} />
          <StatTile color="emerald" icon={Briefcase} label="Sudah PKL" value={data.placedCount} />
          <StatTile color="red" icon={AlertTriangle} label="Belum PKL" value={data.unplacedCount} />
        </div>


      
        <BarisPintasan items={pintasan} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="panel p-5">
            <h3 className="font-heading font-semibold text-navy text-sm mb-3">Perusahaan Mitra Teratas</h3>
            {data.topCompanies.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">Belum ada data penempatan PKL.</p>
            ) : (
              <div className="space-y-2">
                {data.topCompanies.map((c, i) => (
                  <div key={i} className="flex items-center justify-between text-sm border-b border-gray-50 last:border-0 pb-2 last:pb-0">
                    <span className="text-primary-900 font-medium truncate">{c.company}</span>
                    <span className="font-bold text-primary-700 shrink-0 ml-2">{c.count} siswa</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="panel overflow-hidden">
            <div className="px-5 py-3 flex items-center justify-between border-b border-gray-100 bg-white">
              <p className="text-sm text-primary-900 font-semibold">Belum Ditempatkan PKL</p>
              <span className="text-xs text-primary-700 font-bold">{data.unplacedList.length} siswa</span>
            </div>
            {data.unplacedList.length === 0 ? (
              <EmptyState icon={UserCheck} title="Semua Sudah Ditempatkan" description="Seluruh siswa kelas XII sudah memiliki data PKL." />
            ) : (
              <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
                {data.unplacedList.map(s => (
                  <div key={s.studentId} className="px-5 py-3 text-sm">
                    <p className="font-semibold text-primary-900">{s.name}</p>
                    <p className="text-gray-400 text-xs">{s.className} · {s.nis}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
