"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, BookOpen, CheckCircle2, Database, DatabaseZap, GraduationCap, Link2, Loader2, UserCog } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";

interface Butir { label: string; count: number; href: string }
interface Kelompok { judul: string; total: number; href: string; butir: Butir[] }
interface Ringkasan {
  totalItems: number; siswaAktif: number; pegawaiAktif: number; pasanganManual: number;
  kelompok: Kelompok[]; lainnya: Butir[]; tautan: { siswa: string; guru: string; dapodik: string };
}

/** DASHBOARD OPERATOR SEKOLAH (diperbarui 17 Sep 2026 — temuan user: isinya minim dan tautannya kembali ke dashboard sendiri).
 * Kelengkapan data siswa & GTK per kolom (bahan Dapodik), tautan yang bisa dibuka dari portal guru, dan pintasan Sinkron Dapodik. */
/** Dipakai portal GURU (pemegang jabatannya) dan portal ADMIN (superadmin, lewat grup menu
 * "Dashboard Jabatan") — keputusan user 19 September 2026: "superadmin sifatnya full akses ke
 * semuanya ... karena si superadmin bukan pegawai dan bukan guru di situ", jadi ia tidak boleh
 * dilempar ke shell portal guru untuk melihat dashboard ini. */
export default function OperatorDashboard() {
  const [data, setData] = useState<Ringkasan | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/teacher/operator/summary")
      .then(async r => {
        const d = await r.json().catch(() => null);
        if (!r.ok || !d) { setError(d?.error || "Gagal memuat data"); return; }
        setData(d);
      })
      .catch(() => setError("Gagal memuat data"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;
  if (error || !data) return <div className="p-6 lg:p-8 text-center text-gray-400 py-20">{error || "Data tidak tersedia."}</div>;

  const pintasan = [
    { href: data.tautan.siswa, label: "Buku Induk Siswa", ket: "Lengkapi biodata siswa", ikon: BookOpen },
    { href: data.tautan.guru, label: "Buku Induk Guru", ket: "Lengkapi biodata GTK", ikon: UserCog },
    { href: data.tautan.dapodik, label: "Sinkron Dapodik", ket: "Bandingkan & cocokkan dengan Dapodik", ikon: DatabaseZap },
  ];

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Database size={22} />} title="Dashboard Operator Sekolah"
        description="Kelengkapan data siswa & GTK sebagai bahan Dapodik, beserta pintasan kerja operator" />

      <div className="space-y-6">
        <div className="kisi-kartu kisi-kartu-4">
          <StatTile ikon="peringatan" color={data.totalItems ? "amber" : "emerald"} value={data.totalItems} label="Isian data yang masih kosong" sorot={data.totalItems > 0} />
          <StatTile ikon="siswa" color="blue" value={data.siswaAktif} label="Siswa aktif" href={data.tautan.siswa} />
          <StatTile ikon="guru" color="purple" value={data.pegawaiAktif} label="Guru & tendik aktif" href={data.tautan.guru} />
          <StatTile ikon="daftar-centang" color="primary" value={data.pasanganManual} label="Pasangan Dapodik dicocokkan manual" href={data.tautan.dapodik} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {pintasan.map(p => (
            <Link key={p.href} href={p.href} className="panel panel-interaktif flex items-center gap-3 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-700 text-white"><p.ikon size={18} /></span>
              <span className="min-w-0">
                <span className="block font-heading font-bold text-primary-900 text-sm">{p.label}</span>
                <span className="block text-xs text-gray-500">{p.ket}</span>
              </span>
              <ArrowRight size={16} className="ml-auto shrink-0 text-gray-300" />
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 items-start">
          {data.kelompok.map(k => (
            <div key={k.judul} className="panel overflow-hidden">
              <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3.5">
                {k.judul.includes("siswa") ? <GraduationCap size={16} className="text-primary-700" /> : <UserCog size={16} className="text-primary-700" />}
                <h3 className="font-heading font-bold text-primary-900 text-sm">{k.judul}</h3>
                <span className="ml-auto text-xs text-gray-500 tabular-nums">{k.total} orang</span>
              </div>
              {k.butir.length === 0 ? (
                <p className="flex items-center justify-center gap-2 py-8 text-sm font-medium text-emerald-600"><CheckCircle2 size={16} /> Semua isian utama sudah lengkap</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {k.butir.map(b => {
                    const persen = k.total ? Math.round((b.count / k.total) * 100) : 0;
                    return (
                      <Link key={b.label} href={b.href} className="group flex items-center gap-3 px-5 py-2.5 hover:bg-amber-50/60">
                        <AlertTriangle size={14} className="shrink-0 text-amber-500" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm text-gray-700 group-hover:text-primary-900">{b.label}</span>
                          <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-gray-100">
                            <span className="block h-full rounded-full bg-amber-400" style={{ width: `${Math.max(persen, 2)}%` }} />
                          </span>
                        </span>
                        <span className="text-right tabular-nums">
                          <span className="block text-sm font-bold text-amber-600">{b.count}</span>
                          <span className="block text-xs text-gray-400">{persen}%</span>
                        </span>
                        <ArrowRight size={14} className="shrink-0 text-gray-300 group-hover:text-amber-500" />
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {data.lainnya.length > 0 && (
          <div className="panel p-5">
            <h3 className="font-heading font-bold text-primary-900 text-sm mb-2 flex items-center gap-2"><Link2 size={15} className="text-primary-700" /> Menunggu diproses</h3>
            {data.lainnya.map(b => (
              <Link key={b.label} href={b.href} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm hover:bg-amber-50/60">
                <AlertTriangle size={14} className="shrink-0 text-amber-500" />
                <span className="flex-1 text-gray-700">{b.label}</span>
                <span className="font-bold text-amber-600 tabular-nums">{b.count}</span>
              </Link>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-500">
          Data TU adalah acuan: lengkapi isian yang kosong dari berkas asli (ijazah, KK, akta), lalu samakan Dapodik lewat daftar di Sinkron Dapodik.
        </p>
      </div>
    </div>
  );
}
