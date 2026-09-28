"use client";
import { useEffect, useState } from "react";
import { Building2, Loader2, DoorOpen, AlertTriangle, HelpCircle, Boxes, Wrench, Tv } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import Link from "next/link";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import EmptyState from "@/components/admin/EmptyState";
import RingkasanSarpras from "@/components/sarpras/RingkasanSarpras";
import { tautanJabatan, BASE_GURU } from "@/lib/rute-jabatan";

interface RoomUsage { room: string; count: number }
interface Conflict { room: string; day: string; time: string; classA: string; classB: string }
interface Summary {
  totalRooms: number; withoutRoomCount: number; conflictCount: number;
  roomUtilization: RoomUsage[]; conflicts: Conflict[];
}

const DAY_LABEL: Record<string, string> = { SENIN: "Senin", SELASA: "Selasa", RABU: "Rabu", KAMIS: "Kamis", JUMAT: "Jumat", SABTU: "Sabtu" };

/** Dipakai portal GURU (pemegang jabatannya) dan portal ADMIN (superadmin, lewat grup menu
 * "Dashboard Jabatan") — keputusan user 19 September 2026: "superadmin sifatnya full akses ke
 * semuanya ... karena si superadmin bukan pegawai dan bukan guru di situ", jadi ia tidak boleh
 * dilempar ke shell portal guru untuk melihat dashboard ini. */
export default function WakasekSarprasDashboard({ basePath = BASE_GURU }: { basePath?: string }) {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/teacher/wakasek/sarpras/summary").then(async r => {
      if (!r.ok) { const d = await r.json(); setError(d.error || "Gagal memuat data"); setLoading(false); return; }
      setData(await r.json());
      setLoading(false);
    }).catch(() => { setError("Gagal memuat data"); setLoading(false); });
  }, []);

  if (loading) return <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;
  if (error || !data) return <div className="p-6 lg:p-8 text-center text-gray-400 py-20">{error || "Data tidak tersedia."}</div>;

  /* BARIS PINTASAN (27 September 2026) — mengikuti pola Dashboard Kurikulum: empat halaman yang paling sering
     dibuka SETELAH melihat dashboard ini. Bukan daftar semua menu; empat yang benar-benar jadi langkah berikutnya. */
  const pintasan = [
    { href: tautanJabatan(basePath, "wakasek/sarpras"), label: "Layanan Sarpras", ikon: Wrench },
    { href: `${basePath}/jaringan?bagian=layar`, label: "Layar & TV", ikon: Tv },
    { href: tautanJabatan(basePath, "wakasek/sarpras"), label: "Pemesanan Ruang", ikon: DoorOpen },
  ];

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<Building2 size={22} />}
        title="Dashboard Sarana Prasarana"
        description="Inventaris, kerusakan, peminjaman, perawatan, dan pemanfaatan ruang"
      />

      <div className="space-y-6">
        <div className="">
          <RingkasanSarpras lingkupLab={false} base={tautanJabatan(basePath, "wakasek/sarpras")}
            inventarisHref={tautanJabatan(basePath, "wakasek/sarpras/inventaris")} tambahan={pintasan} />
        </div>

        <h2 className="label-kecil">Pemanfaatan ruang menurut Jadwal Pelajaran</h2>
        <div className="kisi-kartu kisi-kartu-3">
          <StatTile color="primary" icon={DoorOpen} label="Total Ruangan Terpakai" value={data.totalRooms} />
          <StatTile color="red" icon={AlertTriangle} label="Bentrok Ruangan" value={data.conflictCount} />
          <StatTile color="amber" icon={HelpCircle} label="Jadwal Belum Ada Ruangan" value={data.withoutRoomCount} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="panel p-5">
            <h3 className="font-heading font-semibold text-navy text-sm mb-3">Pemanfaatan Ruangan (Jumlah Slot Jadwal)</h3>
            {data.roomUtilization.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">Belum ada jadwal dengan ruangan terisi.</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(220, data.roomUtilization.length * 28)}>
                <BarChart data={data.roomUtilization} layout="vertical" margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="room" width={100} tick={{ fontSize: 11, fill: "#374151" }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => [v, "Slot Jadwal"]} />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} fill="#1B2B6B" maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="panel overflow-hidden">
            <div className="px-5 py-3 flex items-center justify-between border-b border-gray-100 bg-white">
              <p className="text-sm text-primary-900 font-semibold">Bentrok Ruangan</p>
              <span className="text-xs text-primary-700 font-bold">{data.conflicts.length} kasus</span>
            </div>
            {data.conflicts.length === 0 ? (
              <EmptyState icon={Building2} title="Tidak Ada Bentrok" description="Tidak ditemukan jadwal yang berbagi ruangan pada waktu bersamaan." />
            ) : (
              <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
                {data.conflicts.map((c, i) => (
                  <div key={i} className="px-5 py-3 text-sm">
                    <p className="font-semibold text-primary-900">{c.room} · {DAY_LABEL[c.day] ?? c.day}</p>
                    <p className="text-gray-400 text-xs">{c.classA} vs {c.classB} ({c.time})</p>
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
