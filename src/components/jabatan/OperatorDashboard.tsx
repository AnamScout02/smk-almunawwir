"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, BookOpen, CheckCircle2, Database, DatabaseZap, GraduationCap, Link2, Loader2, Search, UserCog } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Modal from "@/components/admin/Modal";
import StatTile from "@/components/admin/StatTile";
import BarisPintasan from "@/components/shared/BarisPintasan";

interface Butir { label: string; count: number; href: string; kunci?: string }
interface Orang { id: string; nama: string; ket: string }
interface Rincian { judul: string; editHref: string; daftar: Orang[] }
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
  const [rincian, setRincian] = useState<Rincian | null>(null);
  const [memuatRincian, setMemuatRincian] = useState<string | null>(null);
  const [cari, setCari] = useState("");

  /* Daftar nama diambil SAAT DIKETUK, bukan ikut muatan dashboard: butirnya belasan dan tiap butir
     bisa ratusan nama — memuat semuanya di awal membuat dashboard lambat tanpa ada yang membacanya. */
  async function bukaRincian(b: Butir) {
    if (!b.kunci) return;
    setMemuatRincian(b.kunci); setCari("");
    const r = await fetch(`/api/teacher/operator/summary?rincian=${encodeURIComponent(b.kunci)}`, { cache: "no-store" }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setMemuatRincian(null);
    if (r?.ok && d?.daftar) setRincian(d);
  }

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

        <BarisPintasan items={pintasan} />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 items-start">
          {data.kelompok.map(k => (
            <div key={k.judul} className="panel overflow-hidden">
              <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3.5">
                {k.judul.includes("siswa") ? <GraduationCap size={16} className="text-primary-700" /> : <UserCog size={16} className="text-primary-700" />}
                <h3 className="font-heading font-semibold text-primary-900 text-sm">{k.judul}</h3>
                <span className="ml-auto text-xs text-gray-500 tabular-nums">{k.total} orang</span>
              </div>
              {k.butir.length === 0 ? (
                <p className="flex items-center justify-center gap-2 py-8 text-sm font-medium text-emerald-600"><CheckCircle2 size={16} /> Semua isian utama sudah lengkap</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {k.butir.map(b => {
                    const persen = k.total ? Math.round((b.count / k.total) * 100) : 0;
                    return (
                      /* Diketuk → DAFTAR NAMA dulu, bukan langsung ke tabel Buku Induk (permintaan user
                         28 Sep 2026). Sebelumnya semua baris menuju halaman yang sama berisi seluruh
                         siswa, jadi operator masih harus mencari sendiri ke-85 yang NISN-nya kosong. */
                      <button key={b.label} type="button" onClick={() => bukaRincian(b)}
                        className="group flex w-full items-center gap-3 px-5 py-2.5 text-left hover:bg-amber-50/60">
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
                        {memuatRincian === b.kunci
                          ? <Loader2 size={14} className="shrink-0 animate-spin text-gray-400" />
                          : <ArrowRight size={14} className="shrink-0 text-gray-300 group-hover:text-amber-500" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {data.lainnya.length > 0 && (
          <div className="panel p-5">
            <h3 className="font-heading font-semibold text-primary-900 text-sm mb-2 flex items-center gap-2"><Link2 size={15} className="text-primary-700" /> Menunggu diproses</h3>
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

      {/* Daftar nama per butir — mengeklik nama membuka penyuntingnya lewat `?edit=<id>` (pola yang
          sudah dipakai Buku Induk Guru). Kotak cari disediakan karena satu butir bisa ratusan nama. */}
      <Modal open={!!rincian} onClose={() => setRincian(null)} title={rincian?.judul ?? ""} size="lg" scrollBody
        description={rincian ? `${rincian.daftar.length} orang — ketuk nama untuk membuka penyuntingnya` : undefined}>
        {rincian && (
          <>
            {rincian.daftar.length > 8 && (
              <div className="alat-cari mb-4">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari nama…" className="input-field pl-10" />
              </div>
            )}
            <div className="divide-y divide-gray-50">
              {rincian.daftar
                .filter(o => !cari.trim() || `${o.nama} ${o.ket}`.toLowerCase().includes(cari.trim().toLowerCase()))
                .map((o, i) => (
                  <Link key={o.id} href={`${rincian.editHref}?edit=${o.id}`}
                    className="group flex items-center gap-3 px-1 py-2.5 hover:bg-primary-50/60">
                    <span className="w-6 shrink-0 text-xs text-gray-400 tabular-nums">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-primary-900">{o.nama}</span>
                      <span className="block text-xs text-gray-500">{o.ket}</span>
                    </span>
                    <ArrowRight size={14} className="shrink-0 text-gray-300 group-hover:text-primary-700" />
                  </Link>
                ))}
            </div>
            {rincian.daftar.length === 0 && <p className="py-10 text-center text-sm text-gray-400">Tidak ada data.</p>}
          </>
        )}
      </Modal>
    </div>
  );
}
